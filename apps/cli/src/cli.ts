/**
 * `voyage` — argv parsing, dispatch, and exit codes (CONTRACTS §5.8).
 *
 * Sibling packages are loaded lazily, after argument validation, so
 * `--help` and every exit-2 refusal work even when a sibling package is
 * unavailable. Tests call `runCli` with an injected I/O and deps loader.
 */
import { DEFAULT_CYCLES } from './probe.ts';
import type { SpawnRunner } from './probe.ts';
import {
  CliError,
  EXIT_BAD_ARG,
  EXIT_INTERNAL,
  EXIT_OK,
  defaultHomeDir,
  defaultIo,
} from './runtime.ts';
import type { CliContext, CliIo } from './runtime.ts';
import { loadVoyageDeps } from './deps.ts';
import type { FetcherLike, VoyageDeps } from './deps.ts';
import { validateHost } from './validate-host.ts';
import { runConsentCommand } from './commands/consent.ts';
import { runDataCommand } from './commands/data.ts';
import { runEnrichCommand } from './commands/enrich.ts';
import { runCompareCommand } from './commands/compare.ts';
import { runExplainCommand } from './commands/explain.ts';
import { runExportCommand } from './commands/export.ts';
import { runMcpCommand } from './commands/mcp.ts';
import { runReadCommand } from './commands/read.ts';
import { DEFAULT_SHARE_BASE_URL, runShareCommand } from './commands/share.ts';
import { runTraceCommand } from './commands/trace.ts';

export const HELP_TEXT = `voyage — follow the physical route of your own traceroute, bounded by the speed of light

Usage:
  voyage trace <host> [options]          Trace ONE host, enrich, compute, write journey.json
  voyage read <file|-> [options]         Compute a journey from a recorded trace (offline)
  voyage enrich <journey.json> [options] Complete an offline journey (consent required)
  voyage share <journey.json> [options]  Preview, redact, and encode a share link
  voyage explain <journey.json> [opts]   Bounds, delay breakdown, media, and --year <y>
  voyage export <journey.json> [options] Write the journey as GeoJSON or as a ticket report
  voyage compare <a.json> <b.json>       Two journeys side by side (IPv4/IPv6, two moments)
  voyage data status|update [options]    Dataset provenance, staleness and cache state
  voyage data geodb status|update [opts] Local geolocation database (DB-IP Lite, CC BY 4.0)
  voyage data geodb import <archive>   Convert a copy already on disk (no request)
  voyage consent [status|grant|revoke]   Third-party lookup consent (remembered)
  voyage mcp                             Start the stdio MCP server

Trace options:
  --ipv6               Prefer IPv6 (-6)
  --proto <p>          icmp | udp | tcp (default: the tool's default; never sudo)
  --cycles <n>         Probe cycles per hop for mtr (default ${DEFAULT_CYCLES}, max 100)
  --from <city>        Declared departure: a known city name or "lat,lon"
  --offline            No network lookup at all (hints and cache only)
  --open               Point at the local web UI after tracing
  --out <file>         Write the journey to <file> instead of journey.json
  --json               Print the journey as JSON on stdout (schema-valid)

Read options:   --from <city>  --out <file>  --json
Enrich options: --offline (refuses)  --out <file>  --json
Share options:  --level country|city (default country)  --base-url <url>
                --yes (skip the confirmation prompt)  --out <file>  --json
Explain options: --year <1950..2100>  --json
Export options:  --format geojson|markdown (default geojson)  --language en|fr
                 --out <file>  --json
Compare options: --language en|fr  --json
Data options:   --offline (refuses update)  --json
                geodb: --force (refresh a fresh copy)  --max-mb <n> (refuse a bigger archive)
Consent:        --json

Environment:
  PACKET_VOYAGE_HOME   Config/cache directory (default ~/.packet-voyage)

Exit codes: 0 ok | 2 bad argument (range, list, leading dash) | 3 no trace tool
            4 refused by consent/offline | 5 unreadable input`;

interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

const VALUE_FLAGS = new Set(['proto', 'cycles', 'from', 'out', 'level', 'base-url', 'year', 'format', 'language', 'max-mb']);
const BOOLEAN_FLAGS = new Set(['help', 'ipv6', 'offline', 'open', 'json', 'yes', 'force']);

function takeOption(argv: string[], idx: number, flags: Record<string, string | boolean>): number {
  const token = argv[idx] ?? '';
  if (token === '-h' || token === '--help') {
    flags.help = true;
    return idx + 1;
  }
  const eq = token.indexOf('=');
  const name = (eq >= 0 ? token.slice(2, eq) : token.slice(2)).trim();
  if (BOOLEAN_FLAGS.has(name)) {
    if (eq >= 0) throw new CliError(EXIT_BAD_ARG, `flag --${name} takes no value`);
    flags[name] = true;
    return idx + 1;
  }
  if (VALUE_FLAGS.has(name)) {
    const value = eq >= 0 ? token.slice(eq + 1) : argv[idx + 1];
    if (value === undefined || value.startsWith('--') || value === '-h') {
      throw new CliError(EXIT_BAD_ARG, `flag --${name} requires a value`);
    }
    flags[name] = value;
    return eq >= 0 ? idx + 1 : idx + 2;
  }
  throw new CliError(EXIT_BAD_ARG, `unknown option "${token}" (see --help)`);
}

export function parseArgv(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let i = 0;
  while (i < argv.length) {
    const token = argv[i] ?? '';
    if (token === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (token === '-h' || token.startsWith('--')) {
      i = takeOption(argv, i, flags);
      continue;
    }
    positionals.push(token);
    i += 1;
  }
  return { positionals, flags };
}

function str(flags: Record<string, string | boolean>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' ? value : undefined;
}

function bool(flags: Record<string, string | boolean>, key: string): boolean {
  return flags[key] === true;
}

function parseCycles(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_CYCLES;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new CliError(EXIT_BAD_ARG, `invalid --cycles "${raw}" (expected a positive integer)`);
  }
  return n;
}

function operands(parsed: ParsedArgs, max: number): string[] {
  const ops = parsed.positionals.slice(1);
  if (ops.length > max) {
    throw new CliError(
      EXIT_BAD_ARG,
      `unexpected extra argument "${ops[max] ?? ''}" (at most ${max === 1 ? 'one operand' : `${max} operands`} per command)`,
    );
  }
  return ops;
}

export interface RunCliOptions {
  io?: CliIo;
  depsLoader?: () => Promise<VoyageDeps>;
  runner?: SpawnRunner;
  fetcher?: FetcherLike;
}

async function makeContext(io: CliIo, depsLoader: () => Promise<VoyageDeps>): Promise<CliContext> {
  let deps: VoyageDeps;
  try {
    deps = await depsLoader();
  } catch (error) {
    throw new CliError(
      EXIT_INTERNAL,
      `workspace packages unavailable: ${(error as Error).message}`,
    );
  }
  return { io, home: defaultHomeDir(io.env), deps };
}

async function dispatchTrace(op: string | undefined, flags: Record<string, string | boolean>, ctx: CliContext, opts: RunCliOptions): Promise<number> {
  const hostCheck = validateHost(op);
  if (!hostCheck.ok) throw new CliError(EXIT_BAD_ARG, hostCheck.message);
  return runTraceCommand(
    {
      host: op,
      ipv6: bool(flags, 'ipv6'),
      proto: str(flags, 'proto'),
      cycles: parseCycles(str(flags, 'cycles')),
      from: str(flags, 'from'),
      offline: bool(flags, 'offline'),
      open: bool(flags, 'open'),
      out: str(flags, 'out'),
      json: bool(flags, 'json'),
      ...(opts.runner ? { runner: opts.runner } : {}),
      ...(opts.fetcher ? { fetcher: opts.fetcher } : {}),
    },
    ctx,
  );
}

async function dispatchAdmin(command: string, op: string | undefined, rest: string[], flags: Record<string, string | boolean>, ctx: CliContext, opts: RunCliOptions): Promise<number> {
  const json = bool(flags, 'json');
  if (command === 'data') {
    const maxMbRaw = str(flags, 'max-mb');
    return runDataCommand(
      {
        subcommand: op,
        rest,
        offline: bool(flags, 'offline'),
        json,
        force: bool(flags, 'force'),
        ...(maxMbRaw === undefined ? {} : { maxMb: Number(maxMbRaw) }),
        ...(opts.fetcher ? { fetcher: opts.fetcher } : {}),
      },
      ctx,
    );
  }
  if (command === 'consent') return runConsentCommand({ action: op, json }, ctx);
  return runMcpCommand(ctx);
}

async function dispatch(parsed: ParsedArgs, opts: RunCliOptions): Promise<number> {
  const io = opts.io ?? defaultIo();
  const loader = opts.depsLoader ?? loadVoyageDeps;
  const command = parsed.positionals[0];
  const flags = parsed.flags;
  if (bool(flags, 'help') || !command) {
    io.stdout(`${HELP_TEXT}\n`);
    return EXIT_OK;
  }
  const ops = operands(parsed, command === 'compare' ? 2 : command === 'data' ? 3 : 1);
  const op = ops[0];
  const json = bool(flags, 'json');

  if (command === 'trace') {
    const checked = validateHost(op);
    if (!checked.ok) throw new CliError(EXIT_BAD_ARG, checked.message);
  }
  const ctx = await makeContext(io, loader);

  switch (command) {
    case 'trace':
      return dispatchTrace(op, flags, ctx, opts);
    case 'read':
      return runReadCommand({ file: op, from: str(flags, 'from'), out: str(flags, 'out'), json }, ctx);
    case 'explain':
      return runExplainCommand({ file: op, year: str(flags, 'year'), json }, ctx);
    case 'export':
      return runExportCommand(
        { file: op, format: str(flags, 'format') ?? 'geojson', language: str(flags, 'language') ?? 'en', out: str(flags, 'out'), json },
        ctx,
      );
    case 'compare':
      return runCompareCommand({ files: ops, language: str(flags, 'language') ?? 'en', json }, ctx);
    case 'enrich':
      return runEnrichCommand(
        { file: op, offline: bool(flags, 'offline'), out: str(flags, 'out'), json, ...(opts.fetcher ? { fetcher: opts.fetcher } : {}) },
        ctx,
      );
    case 'share':
      return runShareCommand(
        { file: op, level: str(flags, 'level') ?? 'country', baseUrl: str(flags, 'base-url') ?? DEFAULT_SHARE_BASE_URL, yes: bool(flags, 'yes'), out: str(flags, 'out'), json },
        ctx,
      );
    case 'data':
    case 'consent':
    case 'mcp':
      return dispatchAdmin(command, op, ops.slice(1), flags, ctx, opts);
    default:
      throw new CliError(EXIT_BAD_ARG, `unknown command "${command}" (see --help)`);
  }
}

/** Run the CLI with `argv` (no node/script prefix); resolves to an exit code. */
export async function runCli(argv: string[], opts: RunCliOptions = {}): Promise<number> {
  const io = opts.io ?? defaultIo();
  try {
    return await dispatch(parseArgv(argv), opts);
  } catch (error) {
    if (error instanceof CliError) {
      io.stderr(`voyage: ${error.message}\n`);
      return error.exitCode;
    }
    io.stderr(`voyage: ${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT_INTERNAL;
  }
}
