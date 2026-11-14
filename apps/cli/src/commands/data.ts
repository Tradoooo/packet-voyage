
/**
 * `voyage data status|update|geodb` — report the embedded datasets (source,
 * date, licence, staleness > 90 days, VOY-N-11) and the local cache; `update`
 * refreshes the IXP prefix cache with consent (never writes into the repo);
 * `geodb` manages the local geolocation database, which is downloaded into the
 * user's directory and never vendored (VOY-F-08, §6.1).
 */
import { join } from 'node:path';
import type { Provenance } from '@packet-voyage/schema';
import { CliError, EXIT_BAD_ARG, EXIT_OK, EXIT_REFUSED } from '../runtime.ts';
import type { CliContext } from '../runtime.ts';
import type { CacheLike, FetcherLike } from '../deps.ts';
import { defaultFetcher, ensureConsent } from './shared.ts';
import { runGeodbCommand } from './geodb.ts';

export interface DataCommandOptions {
  subcommand?: string;
  /** Further positionals: `data geodb <status|update>` lives one level deeper. */
  rest?: string[];
  offline: boolean;
  json: boolean;
  force?: boolean;
  maxMb?: number;
  fetcher?: FetcherLike;
}

const STALE_DAYS = 90;

function statusPayload(
  ctx: CliContext,
  cache: CacheLike,
  provenance: Provenance[],
  stale: Provenance[],
): Record<string, unknown> {
  return {
    home: ctx.home,
    consent: ctx.deps.enrich.readConsent(ctx.home),
    cache: cache.stats(),
    stale_threshold_days: STALE_DAYS,
    stale_ids: stale.map((p) => p.id),
    datasets: provenance,
  };
}

function formatStatusHuman(payload: Record<string, unknown>, provenance: Provenance[], staleIds: Set<string>): string {
  const cache = payload.cache as { entries: number; oldest: string | null; newest: string | null };
  const consent = payload.consent as { granted: boolean };
  const lines = [
    `Home: ${String(payload.home)}`,
    `Consent: ${consent.granted ? 'granted' : 'not granted'}`,
    `Cache: ${cache.entries} entry/entries (oldest ${cache.oldest ?? '-'}, newest ${cache.newest ?? '-'})`,
    `Datasets (${provenance.length}):`,
  ];
  for (const p of provenance) {
    const staleTag = staleIds.has(p.id) ? ` [STALE: older than ${STALE_DAYS} days]` : '';
    lines.push(`  - ${p.id}: ${p.title} | retrieved ${p.retrieved_at} | ${p.licence} | ${p.features} feature(s)${staleTag}`);
  }
  return `${lines.join('\n')}\n`;
}

/** `data geodb …` — one level deeper, so `runDataCommand` stays short. */
function runGeodbSubcommand(opts: DataCommandOptions, ctx: CliContext): Promise<number> {
  return runGeodbCommand(
    {
      subcommand: opts.rest?.[0],
      ...(opts.rest?.[1] !== undefined ? { file: opts.rest[1] } : {}),
      offline: opts.offline,
      force: opts.force ?? false,
      ...(opts.maxMb !== undefined ? { maxMb: opts.maxMb } : {}),
      json: opts.json,
      ...(opts.fetcher ? { fetcher: opts.fetcher } : {}),
    },
    ctx,
  );
}

export async function runDataCommand(opts: DataCommandOptions, ctx: CliContext): Promise<number> {
  const { io, deps } = ctx;
  const sub = opts.subcommand ?? 'status';
  if (sub === 'geodb') return runGeodbSubcommand(opts, ctx);
  if (sub !== 'status' && sub !== 'update') {
    throw new CliError(EXIT_BAD_ARG, `unknown data subcommand "${sub}" (expected status, update or geodb)`);
  }
  const cache = deps.enrich.createFileCache(join(ctx.home, 'cache'));

  if (sub === 'status') {
    const provenance = deps.data.loadProvenance();
    const stale = deps.data.staleProvenance(STALE_DAYS);
    const payload = statusPayload(ctx, cache, provenance, stale);
    if (opts.json) {
      io.stdout(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      io.stdout(formatStatusHuman(payload, provenance, new Set(stale.map((p) => p.id))));
    }
    return EXIT_OK;
  }

  if (opts.offline) {
    throw new CliError(EXIT_REFUSED, 'data update refused: --offline mode is active');
  }
  const consent = await ensureConsent(ctx, { allowPrompt: !opts.json, refuseOnMissing: true });
  const prefixes = await deps.enrich.ixpPrefixes({
    offline: false,
    consent,
    cache,
    fetch: opts.fetcher ?? defaultFetcher(),
    now: io.now(),
    log: (line) => io.stderr(`voyage: ${line}\n`),
  });
  const stats = cache.stats();
  if (opts.json) {
    io.stdout(`${JSON.stringify({ updated: true, ixp_prefixes: prefixes.length, cache: stats }, null, 2)}\n`);
  } else {
    io.stdout(`Refreshed the IXP prefix cache: ${prefixes.length} prefix(es), ${stats.entries} cache entry/entries.\n`);
  }
  return EXIT_OK;
}
