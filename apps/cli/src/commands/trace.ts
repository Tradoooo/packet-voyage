/**
 * `voyage trace <host>` — validate ONE host (VOY-F-42), pick the system trace
 * tool and spawn it without a shell (VOY-F-41, VOY-N-03), parse, enrich under
 * the consent/offline rules, compute, then write `journey.json` (or `--json`
 * to stdout) and offer the local UI (`--open`).
 */
import { join } from 'node:path';
import type { Journey } from '@packet-voyage/schema';
import {
  detectTraceTool,
  noToolMessage,
  isPrivilegeError,
  nodeSpawnRunner,
  normalizeCycles,
  privilegeMessage,
  runTrace,
} from '../probe.ts';
import { findWebDist, openBrowser, serveLocalUi } from '../open.ts';
import type { SpawnResult, SpawnRunner, TraceProtocol, TraceTool } from '../probe.ts';
import { validateHost } from '../validate-host.ts';
import { CliError, EXIT_BAD_ARG, EXIT_NO_TOOL, EXIT_OK, EXIT_UNREADABLE } from '../runtime.ts';
import type { CliContext } from '../runtime.ts';
import { emitJourneyJson, formatJourneyHuman } from '../output.ts';
import { loadDatasets } from '../deps.ts';
import type { FetcherLike, ParsedTraceLike } from '../deps.ts';
import {
  creditsWithGeodb,
  defaultFetcher,
  ensureConsent,
  loadGeodb,
  resolveSourceFromFlag,
  writeJourneyFile,
} from './shared.ts';

export interface TraceCommandOptions {
  host?: string;
  ipv6: boolean;
  proto?: string;
  cycles: number;
  from?: string;
  offline: boolean;
  open: boolean;
  out?: string;
  json: boolean;
  runner?: SpawnRunner;
  fetcher?: FetcherLike;
}

const TOOL_TO_JOURNEY: Record<TraceTool, 'mtr-json' | 'traceroute' | 'tracert'> = {
  mtr: 'mtr-json',
  traceroute: 'traceroute',
  tracert: 'tracert',
};

function parseProtocol(raw: string | undefined): TraceProtocol | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower === 'icmp' || lower === 'udp' || lower === 'tcp') return lower;
  throw new CliError(EXIT_BAD_ARG, `unknown --proto "${raw}" (expected icmp, udp, or tcp)`);
}

function explainToolFailure(tool: TraceTool, protocol: TraceProtocol | undefined, res: SpawnResult): never {
  if (isPrivilegeError(res)) throw new CliError(EXIT_NO_TOOL, privilegeMessage(protocol));
  const detail = res.stderr.trim() || res.error?.message || `exit code ${res.code}`;
  throw new CliError(EXIT_UNREADABLE, `${tool} failed: ${detail}`);
}

async function probeAndParse(
  ctx: CliContext,
  opts: TraceCommandOptions,
  host: string,
  family: 4 | 6 | 'hostname',
): Promise<{ tool: TraceTool; protocol: TraceProtocol | undefined; parsed: ParsedTraceLike }> {
  const protocol = parseProtocol(opts.proto);
  const { cycles, warning } = normalizeCycles(opts.cycles);
  if (warning) ctx.io.stderr(`voyage: ${warning}\n`);
  const runner = opts.runner ?? nodeSpawnRunner;
  const tool = await detectTraceTool(runner, ctx.io.platform);
  if (!tool) {
    throw new CliError(EXIT_NO_TOOL, `no trace tool found — ${await noToolMessage(runner, ctx.io.platform)}`);
  }

  const result = await runTrace(runner, tool, host, { cycles, ipv6: opts.ipv6 || family === 6, protocol });
  if (result.timedOut) throw new CliError(EXIT_UNREADABLE, `${tool} timed out while tracing ${host}`);
  if (result.error || (result.code !== 0 && result.stdout.trim() === '')) {
    explainToolFailure(tool, protocol, result);
  }
  const parsed = ctx.deps.core.parseTrace(result.stdout);
  if (parsed.format === 'unknown' || parsed.hops.length === 0) {
    if (isPrivilegeError(result)) throw new CliError(EXIT_NO_TOOL, privilegeMessage(protocol));
    const sample = parsed.unknownLines[0] ? ` (${parsed.unknownLines[0]})` : '';
    throw new CliError(EXIT_UNREADABLE, `could not parse the ${tool} output${sample}`);
  }
  return { tool, protocol, parsed };
}

async function enrichAndCompute(
  ctx: CliContext,
  opts: TraceCommandOptions,
  trace: { tool: TraceTool; protocol: TraceProtocol | undefined; parsed: ParsedTraceLike },
  host: string,
): Promise<Journey> {
  const { io, deps } = ctx;
  const datasets = loadDatasets(deps.data);
  const source = resolveSourceFromFlag(opts.from, datasets.hints);
  const consent = opts.offline
    ? { granted: false, services: [], grantedAt: null }
    : await ensureConsent(ctx, { allowPrompt: !opts.json, refuseOnMissing: false });
  const cache = deps.enrich.createFileCache(join(ctx.home, 'cache'));
  const localDb = loadGeodb(ctx);
  const enriched = await deps.enrich.enrichHops(trace.parsed.hops, {
    offline: opts.offline || !consent.granted,
    consent,
    cache,
    fetch: opts.fetcher ?? defaultFetcher(),
    now: io.now(),
    log: (line) => io.stderr(`voyage: ${line}\n`),
    localDb,
  });
  return deps.core.computeJourney({
    parsed: { ...trace.parsed, hops: enriched.hops },
    candidates: enriched.candidates,
    source,
    target: { host, ip: trace.parsed.target?.ip ?? null },
    tracedAt: io.now(),
    tool: TOOL_TO_JOURNEY[trace.tool],
    protocol: trace.protocol ?? trace.parsed.protocol,
    cables: datasets.cables,
    masses: datasets.masses,
    links: datasets.links,
    hints: datasets.hints,
    credits: creditsWithGeodb(ctx, datasets.credits, enriched.candidates),
  });
}

async function openLocalUi(ctx: CliContext, journey: Journey): Promise<void> {
  const webDist = findWebDist(ctx.io);
  if (!webDist) {
    ctx.io.stderr(
      'Local UI not found: build it first (pnpm --filter @packet-voyage/web build) ' +
        'or set PACKET_VOYAGE_WEB_DIST to its dist directory.\n',
    );
    return;
  }
  const served = await serveLocalUi(webDist, JSON.stringify(journey));
  ctx.io.stderr(`Local UI on ${served.url} (journey at ${served.url.replace(/#\/$/, '')}journey.json)\n`);
  ctx.io.stderr('Press Ctrl-C to stop the local server.\n');
  openBrowser(ctx.io, served.url);
}

export async function runTraceCommand(opts: TraceCommandOptions, ctx: CliContext): Promise<number> {
  const checked = validateHost(opts.host);
  if (!checked.ok) throw new CliError(EXIT_BAD_ARG, checked.message);

  const trace = await probeAndParse(ctx, opts, checked.host, checked.family);
  const journey = await enrichAndCompute(ctx, opts, trace, checked.host);

  const outPath = opts.out ?? (opts.json ? undefined : 'journey.json');
  if (outPath) {
    const written = await writeJourneyFile(outPath, journey, ctx.io);
    ctx.io.stderr(`Wrote ${written}\n`);
  }
  if (opts.json) {
    emitJourneyJson(ctx.io, journey);
  } else {
    ctx.io.stdout(formatJourneyHuman(journey));
  }
  if (opts.open) await openLocalUi(ctx, journey);
  return EXIT_OK;
}
