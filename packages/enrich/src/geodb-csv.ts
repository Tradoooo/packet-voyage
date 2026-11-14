import { parseAddress } from '../../core/src/addr/index.ts';
import type { JsonNetworkDbEntry } from './localdb.ts';

/**
 * The shape of DB-IP Lite's city database (VOY-F-08, §7.4.2).
 *
 * DB-IP publishes a monthly CSV archive, one row per address range, no header
 * line: `start,end,continent,country_code,province,city,latitude,longitude`.
 * It carries no ASN, so it answers "where is this network" and never
 * "who owns it" — RIPEstat keeps that job.
 *
 * The licence is CC BY 4.0: the copy may be held, it may not be redistributed,
 * and it must be credited wherever its answers show. The archive is tens of
 * megabytes, so it is never vendored (§6.1): it lands in the user's own
 * directory and the attribution line below travels with every journey it
 * helped locate.
 */

export const GEODB_ID = 'dbip-city-lite';
export const GEODB_LICENCE = 'CC-BY-4.0';
export const GEODB_HOMEPAGE = 'https://db-ip.com/';
export const GEODB_ATTRIBUTION = `IP geolocation data: DB-IP Lite (${GEODB_HOMEPAGE}), CC BY 4.0`;

/** Where the converted database lives, under the user's home directory. */
export const GEODB_META_FILE = 'meta.json';
export const GEODB_SHARD_DIR = 'shards';

/** Releases are monthly: a copy older than this is worth refreshing. */
export const GEODB_TTL_DAYS = 30;

/** A release appears mid-month, so the two previous months are tried too. */
const DEFAULT_MONTHS_BACK = 2;

export interface GeodbRelease {
  year: number;
  month: number;
}

export function geodbUrl(release: GeodbRelease): string {
  const month = String(release.month).padStart(2, '0');
  return `https://download.db-ip.com/free/dbip-city-lite-${release.year}-${month}.csv.gz`;
}

/** The releases to try, newest first. */
export function geodbReleases(now: string, monthsBack = DEFAULT_MONTHS_BACK): GeodbRelease[] {
  const date = new Date(now);
  const base = Number.isNaN(date.getTime()) ? new Date() : date;
  const out: GeodbRelease[] = [];
  for (let back = 0; back <= monthsBack; back += 1) {
    const shifted = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - back, 1));
    out.push({ year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 });
  }
  return out;
}

/**
 * One CSV row as a database entry, or null when the row cannot produce a
 * candidate: a range with no city and no coordinates says nothing about where
 * a hop is, and country `ZZ` is DB-IP's own marker for "unassigned".
 * Quoted fields (a city containing a comma) are unquoted, nothing else is
 * rewritten: a coordinate is copied, never rounded here.
 */
export function parseDbipLine(line: string): JsonNetworkDbEntry | null {
  const fields = splitCsvRow(line);
  if (fields === null || fields.length < 8) return null;
  const [start, end, , country, , city, latRaw, lonRaw] = fields;
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!start || !end) return null;
  if (country === 'ZZ' || country === '') return null;
  if (city === '' || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat === 0 && lon === 0) return null;
  return { start, end, country, city, lat, lon };
}

/** Split a row on commas, honouring double quotes; null on an unbalanced quote. */
function splitCsvRow(line: string): string[] | null {
  const out: string[] = [];
  let current = '';
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      out.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (quoted) return null;
  out.push(current.trim());
  return out;
}

/**
 * The file a lookup for `ip` must read: one shard per first IPv4 octet, one per
 * first IPv6 hextet. The published ranges are contiguous, so a shard holds
 * every row that could match an address of that block — and a lookup then
 * decompresses 0.5 MB instead of carrying a 500 MB database in memory.
 */
export function shardKeyFor(ip: string): string | null {
  const parsed = parseAddress(ip);
  if (!parsed) return null;
  if (parsed.family === 4) {
    const first = parsed.normalized.split('.')[0] ?? '';
    return /^\d{1,3}$/.test(first) ? `v4-${first.padStart(3, '0')}` : null;
  }
  const firstGroup = parsed.normalized.split(':')[0] ?? '';
  return /^[0-9a-f]{4}$/.test(firstGroup) ? `v6-${firstGroup}` : null;
}
