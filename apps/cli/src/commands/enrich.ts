/**
 * `voyage enrich <journey.json>` — complete a journey that was computed
 * offline: consent is mandatory (refusal ⇒ exit 4), `--offline` is
 * contradictory (⇒ exit 4), every outbound address is logged (VOY-P-04).
 */
import { join } from 'node:path';
import type { Journey } from '@packet-voyage/schema';
import { CliError, EXIT_OK, EXIT_REFUSED } from '../runtime.ts';
import type { CliContext } from '../runtime.ts';
import { emitJourneyJson, formatJourneyHuman } from '../output.ts';
import { loadDatasets } from '../deps.ts';
import type { EnrichResultLike, FetcherLike, ParsedTraceLike } from '../deps.ts';
import {
  creditsWithGeodb,
  defaultFetcher,
  ensureConsent,
  loadGeodb,
  readJourneyFile,
  writeJourneyFile,
} from './shared.ts';

export interface EnrichCommandOptions {
  file?: string;
  offline: boolean;
  out?: string;
  json: boolean;
  fetcher?: FetcherLike;
}

function toParsedTrace(journey: Journey): ParsedTraceLike {
  const format =
    journey.tool === 'mtr-json' ? 'mtr-json'
      : journey.tool === 'mtr' ? 'mtr-text'
      : journey.tool === 'tracert' ? 'tracert'
      : journey.tool === 'atlas' ? 'atlas'
      : 'traceroute';
  return {
    format,
    family: journey.family,
    protocol: journey.protocol,
    tool: journey.tool,
    target: journey.target,
    hops: journey.hops,
    unknownLines: [],
    warnings: ['hops re-enriched from a stored journey'],
  };
}

function recomputeJourney(ctx: CliContext, journey: Journey, enriched: EnrichResultLike): Journey {
  const datasets = loadDatasets(ctx.deps.data);
  const src = journey.source;
  const source =
    src && src.lat != null && src.lon != null
      ? { lat: src.lat, lon: src.lon, ...(src.label ? { label: src.label } : {}) }
      : null;
  return ctx.deps.core.computeJourney({
    parsed: toParsedTrace({ ...journey, hops: enriched.hops }),
    candidates: enriched.candidates,
    source,
    target: journey.target,
    tracedAt: journey.traced_at,
    cables: datasets.cables,
    masses: datasets.masses,
    links: datasets.links,
    hints: datasets.hints,
    credits: creditsWithGeodb(
      ctx,
      journey.credits.length > 0 ? journey.credits : datasets.credits,
      enriched.candidates,
    ),
  });
}

export async function runEnrichCommand(opts: EnrichCommandOptions, ctx: CliContext): Promise<number> {
  const { io, deps } = ctx;
  const journey = await readJourneyFile(opts.file, ctx);
  if (opts.offline) {
    throw new CliError(EXIT_REFUSED, 'enrich refused: --offline disables every network lookup');
  }
  const consent = await ensureConsent(ctx, { allowPrompt: !opts.json, refuseOnMissing: true });
  const cache = deps.enrich.createFileCache(join(ctx.home, 'cache'));
  const enriched = await deps.enrich.enrichHops(journey.hops, {
    offline: false,
    consent,
    cache,
    fetch: opts.fetcher ?? defaultFetcher(),
    now: io.now(),
    log: (line) => io.stderr(`voyage: ${line}\n`),
    localDb: loadGeodb(ctx),
  });
  const updated = recomputeJourney(ctx, journey, enriched);
  const outPath = opts.out ?? (opts.json ? undefined : opts.file);
  if (outPath) {
    const written = await writeJourneyFile(outPath, updated, io);
    io.stderr(`Wrote ${written}\n`);
  }
  if (opts.json) emitJourneyJson(io, updated);
  else io.stdout(formatJourneyHuman(updated));
  if (enriched.missing.length > 0) {
    io.stderr(`Missing enrichments: ${enriched.missing.join(', ')}\n`);
  }
  return EXIT_OK;
}
