/**
 * `voyage data geodb status|update|import` — the local geolocation database
 * (VOY-F-08).
 *
 * The database behind the `geodb` candidate source is DB-IP Lite: CC BY 4.0,
 * free to download, too large to vendor (§6.1). It lives in the user's own
 * directory, is refreshed on demand, and every journey it helps locate carries
 * its credit. `update` refuses without consent and refuses `--offline`, like
 * every other command that would open a connection; `import` converts a copy
 * already on disk and makes no request; `status` reads the disk only.
 */
import { resolve } from 'node:path';
import type { FetcherLike, GeodbDownloadResultLike, GeodbStatusLike } from '../deps.ts';
import { CliError, EXIT_BAD_ARG, EXIT_OK, EXIT_REFUSED, EXIT_UNREADABLE } from '../runtime.ts';
import type { CliContext, CliIo } from '../runtime.ts';
import { defaultFetcher, ensureConsent, geodbDir } from './shared.ts';

export interface GeodbCommandOptions {
  subcommand?: string;
  /** For `import`: a DB-IP archive already on this machine (`.csv.gz` or `.csv`). */
  file?: string;
  offline: boolean;
  force: boolean;
  maxMb?: number;
  json: boolean;
  fetcher?: FetcherLike;
}

const MB = 1024 * 1024;

function roundMb(bytes: number): number {
  return Math.round((bytes / MB) * 10) / 10;
}

interface StatusView extends GeodbStatusLike {
  dir: string;
}

function statusView(ctx: CliContext, dir: string): StatusView {
  return { dir, ...ctx.deps.enrich.geodbStatus(dir, new Date(ctx.io.now())) };
}

function formatStatus(status: StatusView): string {
  if (!status.present) {
    return [
      'Geolocation database: none downloaded.',
      `Where it would live: ${status.dir}`,
      'Get one: voyage data geodb update   (consent required, ~90 MB compressed)',
      `Licence: ${status.licence} — credited as "${status.attribution}"`,
    ].join('\n');
  }
  return [
    `Geolocation database: ${status.rows} range(s) in ${status.shards} shard(s), ${roundMb(status.bytes_on_disk)} MB on disk`,
    `Retrieved: ${status.retrieved_at} (${status.age_days} day(s) old)${status.stale ? ' [STALE: older than ' + status.ttl_days + ' days]' : ''}`,
    `Where: ${status.dir}`,
    `Licence: ${status.licence} — credited as "${status.attribution}"`,
  ].join('\n');
}

function reportUpdate(
  io: CliIo,
  deps: CliContext['deps'],
  dir: string,
  result: GeodbDownloadResultLike,
  json: boolean,
): number {
  const status = deps.enrich.geodbStatus(dir, new Date(io.now()));
  if (json) {
    io.stdout(`${JSON.stringify({ ...result, status }, null, 2)}\n`);
    return EXIT_OK;
  }
  if (!result.downloaded) {
    io.stdout(`No download: ${result.reason}\n`);
    return EXIT_OK;
  }
  io.stdout(
    `Downloaded ${roundMb(result.bytes)} MB from ${result.url}: ${result.rows} range(s) in ` +
      `${result.shards} shard(s), ${roundMb(status.bytes_on_disk)} MB on disk.\n` +
      `Credit carried by every journey it locates: ${status.attribution}\n`,
  );
  return EXIT_OK;
}

/**
 * `voyage data geodb import <archive>` — convert a copy the user already has,
 * with no request at all: the same result as `update`, for a machine that is
 * offline, rate-limited, or re-running a measurement.
 */
async function runGeodbImport(opts: GeodbCommandOptions, ctx: CliContext, dir: string): Promise<number> {
  const { io, deps } = ctx;
  if (!opts.file) {
    throw new CliError(EXIT_BAD_ARG, 'geodb import needs an archive path: voyage data geodb import <file.csv.gz>');
  }
  const path = resolve(io.cwd, opts.file);
  const result = await deps.enrich.importGeodbArchive({
    path,
    dir,
    now: io.now(),
    log: (line) => io.stderr(`voyage: ${line}\n`),
  });
  if (result.reason !== 'imported') {
    throw new CliError(EXIT_UNREADABLE, `import refused: ${result.reason}`);
  }
  const status = deps.enrich.geodbStatus(dir, new Date(io.now()));
  if (opts.json) {
    io.stdout(`${JSON.stringify({ ...result, status }, null, 2)}\n`);
    return EXIT_OK;
  }
  io.stdout(
    `Imported ${roundMb(result.bytes)} MB from ${result.url}: ${result.rows} range(s) in ` +
      `${result.shards} shard(s), ${roundMb(status.bytes_on_disk)} MB on disk.\n` +
      `Credit carried by every journey it locates: ${status.attribution}\n`,
  );
  return EXIT_OK;
}

function runGeodbStatus(opts: GeodbCommandOptions, ctx: CliContext, dir: string): number {
  const status = statusView(ctx, dir);
  if (opts.json) ctx.io.stdout(`${JSON.stringify(status, null, 2)}\n`);
  else ctx.io.stdout(`${formatStatus(status)}\n`);
  return EXIT_OK;
}

async function runGeodbUpdate(opts: GeodbCommandOptions, ctx: CliContext, dir: string): Promise<number> {
  const { io, deps } = ctx;
  if (opts.offline) {
    throw new CliError(EXIT_REFUSED, 'geodb update refused: --offline mode is active');
  }
  const consent = await ensureConsent(ctx, { allowPrompt: !opts.json, refuseOnMissing: true });
  if (!consent.services.includes('geodb')) {
    throw new CliError(
      EXIT_REFUSED,
      'refused: the consent on record predates the geolocation database — it names lookups only, not this download (re-grant: `voyage consent grant`)',
    );
  }
  const result = await deps.enrich.downloadGeodb({
    dir,
    now: io.now(),
    offline: false,
    consent,
    fetch: opts.fetcher ?? defaultFetcher(),
    log: (line) => io.stderr(`voyage: ${line}\n`),
    force: opts.force,
    ...(opts.maxMb !== undefined ? { maxBytes: opts.maxMb * MB } : {}),
  });
  return reportUpdate(io, deps, dir, result, opts.json);
}

export async function runGeodbCommand(opts: GeodbCommandOptions, ctx: CliContext): Promise<number> {
  if (opts.maxMb !== undefined && (!Number.isFinite(opts.maxMb) || opts.maxMb <= 0)) {
    throw new CliError(EXIT_BAD_ARG, `invalid --max-mb "${opts.maxMb}" (expected a number of megabytes above 0)`);
  }
  const sub = opts.subcommand ?? 'status';
  if (sub !== 'status' && sub !== 'update' && sub !== 'import') {
    throw new CliError(
      EXIT_BAD_ARG,
      `unknown geodb subcommand "${sub}" (expected status, update or import)`,
    );
  }
  const dir = geodbDir(ctx);
  if (sub === 'status') return runGeodbStatus(opts, ctx, dir);
  if (sub === 'import') return runGeodbImport(opts, ctx, dir);
  return runGeodbUpdate(opts, ctx, dir);
}
