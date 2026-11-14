import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GEODB_ATTRIBUTION, GEODB_ID, GEODB_LICENCE, geodbReleases, geodbUrl } from './geodb-csv.ts';
import type { GeodbRelease } from './geodb-csv.ts';
import { csvLinesFromFile, geodbStatus, writeGeodbMeta, writeGeodbShards } from './geodb-store.ts';
import type { ConsentState, Fetcher } from './types.ts';

/**
 * Downloading the geolocation database (VOY-F-08, §6.1, data-licences.md).
 *
 * The archive is fetched over the injected `fetch`, so a test never touches the
 * network, then converted to shards and left in the user's own directory: the
 * repository holds no copy, and nothing about a route leaves the machine — this
 * is a plain directory download, the same shape as the PeeringDB fetch (§6.4).
 *
 * Three things stop it before a byte is requested: `--offline`, a missing
 * consent, and a database that is still fresh. One thing stops it after: the
 * size cap, because the published archive is hundreds of megabytes and a tool
 * that quietly ate a user's disk is not a favour.
 */

/** The archive is ~90 MB compressed; 256 MB leaves room to grow. */
export const GEODB_DEFAULT_MAX_BYTES = 256 * 1024 * 1024;

/** The consent record must name this download: it is a new origin, not a lookup. */
export const GEODB_CONSENT_SERVICE = 'geodb';

export interface GeodbImportOptions {
  /** A `dbip-city-lite-*.csv.gz` archive (or its uncompressed CSV) on this machine. */
  path: string;
  dir: string;
  now: string;
  log?: (line: string) => void;
}

/** Kept with a `.gz` ending so the reader decompresses it like any archive. */
const ARCHIVE_TEMP = 'archive.tmp.csv.gz';
const MB = 1024 * 1024;

export interface GeodbDownloadOptions {
  dir: string;
  now: string;
  offline: boolean;
  consent: ConsentState;
  fetch: Fetcher;
  log?: (line: string) => void;
  force?: boolean;
  monthsBack?: number;
  maxBytes?: number;
}

export interface GeodbDownloadResult {
  downloaded: boolean;
  reason: string | null;
  url: string | null;
  rows: number;
  shards: number;
  bytes: number;
}

function refused(reason: string): GeodbDownloadResult {
  return { downloaded: false, reason, url: null, rows: 0, shards: 0, bytes: 0 };
}

async function fetchArchiveBytes(
  release: GeodbRelease,
  o: GeodbDownloadOptions,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; url: string } | { skip: string; url: string }> {
  const url = geodbUrl(release);
  if (!o.fetch) return { skip: 'no-fetcher', url };
  const response = await o.fetch(url, { headers: { Accept: 'application/gzip' } });
  if (response.status === 404) return { skip: 'release-not-published', url };
  if (response.status === 429 || response.status >= 500) {
    o.log?.(`geodb: HTTP ${response.status} from ${url}`);
    return { skip: `http-${response.status}`, url };
  }
  if (response.status < 200 || response.status >= 300) return { skip: `http-${response.status}`, url };
  if (typeof response.arrayBuffer !== 'function') return { skip: 'fetcher-returns-no-bytes', url };
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > maxBytes) {
    return { skip: `too-large-${Math.round(bytes.length / MB)}MB`, url };
  }
  return { bytes, url };
}

/**
 * Convert an archive that is already on this machine and record it. Shared by
 * the download and the local import, so the two leave exactly the same thing
 * behind (one implementation, two doors).
 */
async function convertArchive(
  archive: string,
  dir: string,
  url: string,
  now: string,
  log?: (line: string) => void,
): Promise<{ rows: number; shards: number; bytes: number }> {
  const bytes = statSync(archive).size;
  const written = await writeGeodbShards(csvLinesFromFile(archive), dir);
  writeGeodbMeta(dir, {
    source: GEODB_ID,
    url,
    licence: GEODB_LICENCE,
    attribution: GEODB_ATTRIBUTION,
    retrieved_at: now,
    rows: written.rows,
    shards: written.shards,
  });
  log?.(`geodb: ${written.rows} range(s) in ${written.shards} shard(s), credited as "${GEODB_ATTRIBUTION}"`);
  return { ...written, bytes };
}

/**
 * Convert an archive the user already has, with no request at all: the same
 * result as a download, for a machine that is air-gapped, rate-limited, or
 * simply re-running a measurement.
 */
export async function importGeodbArchive(o: GeodbImportOptions): Promise<GeodbDownloadResult> {
  if (!existsSync(o.path)) return refused(`archive-not-found-${o.path}`);
  mkdirSync(o.dir, { recursive: true });
  const written = await convertArchive(o.path, o.dir, o.path, o.now, o.log);
  return {
    downloaded: false,
    reason: 'imported',
    url: o.path,
    rows: written.rows,
    shards: written.shards,
    bytes: written.bytes,
  };
}

/**
 * Fetch and convert the newest published release, or say why nothing was done.
 * Older releases are tried when the current month's archive is not up yet.
 */
export async function downloadGeodb(o: GeodbDownloadOptions): Promise<GeodbDownloadResult> {
  if (o.offline || !o.consent.granted) return refused('consent-or-offline');
  // A consent granted before this service existed does not cover it: the record
  // has to name the download, or the download does not happen.
  if (!o.consent.services.includes(GEODB_CONSENT_SERVICE)) return refused('geodb-not-in-consent');
  const maxBytes = o.maxBytes ?? GEODB_DEFAULT_MAX_BYTES;
  const status = geodbStatus(o.dir, new Date(o.now));
  if (!o.force && status.present && !status.stale) {
    return refused(`fresh-${status.age_days}d-${Math.round(status.bytes_on_disk / MB)}MB`);
  }

  mkdirSync(o.dir, { recursive: true });
  const temp = join(o.dir, ARCHIVE_TEMP);
  const tried: string[] = [];
  for (const release of geodbReleases(o.now, o.monthsBack)) {
    const outcome = await fetchArchiveBytes(release, o, maxBytes);
    if ('skip' in outcome) {
      tried.push(`${release.year}-${release.month}: ${outcome.skip}`);
      continue;
    }
    o.log?.(`geodb: ${Math.round(outcome.bytes.length / MB)} MB from ${outcome.url}`);
    writeFileSync(temp, outcome.bytes);
    const written = await convertArchive(temp, o.dir, outcome.url, o.now, o.log);
    rmSync(temp, { force: true });
    return {
      downloaded: true,
      reason: null,
      url: outcome.url,
      rows: written.rows,
      shards: written.shards,
      bytes: outcome.bytes.length,
    };
  }
  return { ...refused(`unavailable-${tried.join(',')}`), url: null };
}
