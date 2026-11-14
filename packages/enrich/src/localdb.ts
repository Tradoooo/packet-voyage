import { existsSync, readFileSync } from 'node:fs';
import { addressToBigInt, parseCidr } from '../../core/src/addr/index.ts';
import type { LocalNetworkDb, LocalNetworkRecord } from './types.ts';

/**
 * Local network / geolocation database (VOY-F-08, VOY-F-11).
 *
 * The data file itself (a DB-IP Lite conversion, or DB-IP's own range form) is
 * obtained by the user through the CLI — never vendored in the repository (§6.1).
 * A record is either a CIDR prefix or a closed address range, because that is how
 * the published CSVs spell a range (`start,end,…`):
 *
 *   { "entries": [ { "prefix": "1.0.0.0/24", "city": "Paris", … },
 *                  { "start": "1.0.0.0", "end": "1.0.0.255", … } ] }
 *
 * Ranges are turned into `(lo, hi)` bounds, sorted by family then lower bound,
 * and a lookup is a binary search for the greatest lower bound not above the
 * address — so a database of hundreds of thousands of rows costs microseconds,
 * not a linear scan. Published ranges are disjoint; where a broad and a narrow
 * row share an address space the search walks back a bounded number of rows
 * (`SCAN_BACK`) and returns the first that contains the address, the narrowest
 * coming first because equal lower bounds are sorted by upper bound ascending.
 */

/** A row of a JSON network database: a prefix, or a closed range. */
export interface JsonNetworkDbEntry extends LocalNetworkRecord {
  /** CIDR form, e.g. `1.0.0.0/24`. */
  prefix?: string;
  /** First address of a closed range. */
  start?: string;
  /** Last address of the same range, inclusive. */
  end?: string;
}

export interface JsonNetworkDbFile {
  source?: string;
  retrieved_at?: string;
  entries?: JsonNetworkDbEntry[];
}

interface AddressRange {
  family: 4 | 6;
  lo: bigint;
  hi: bigint;
  record: LocalNetworkRecord;
}

/** Rows inspected behind the binary-search hit: enough for nested prefixes. */
const SCAN_BACK = 16;

/** IPv6 bounds start above every IPv4 bound, whatever the numeric value. */
const V6_OFFSET = 1n << 32n;

function sortKey(family: 4 | 6, value: bigint): bigint {
  return family === 6 ? V6_OFFSET + value : value;
}

/** Project a stored row onto the record shape (the bounds are the key, not data). */
function toRecord(entry: JsonNetworkDbEntry): LocalNetworkRecord {
  return {
    asn: entry.asn ?? null,
    as_name: entry.as_name ?? null,
    prefix: entry.prefix ?? null,
    city: entry.city ?? null,
    country: entry.country ?? null,
    lat: entry.lat ?? null,
    lon: entry.lon ?? null,
  };
}

function rangeFromPrefix(prefix: string, entry: JsonNetworkDbEntry): AddressRange | null {
  const parsed = parseCidr(prefix);
  if (!parsed) return null;
  const bits = parsed.family === 4 ? 32 : 128;
  const allOnes = (1n << BigInt(bits)) - 1n;
  return {
    family: parsed.family,
    lo: parsed.base,
    hi: parsed.base | (~parsed.mask & allOnes),
    record: toRecord(entry),
  };
}

function rangeFromBounds(entry: JsonNetworkDbEntry): AddressRange | null {
  if (typeof entry.start !== 'string' || typeof entry.end !== 'string') return null;
  const lo = addressToBigInt(entry.start);
  const hi = addressToBigInt(entry.end);
  if (!lo || !hi || lo.family !== hi.family || hi.value < lo.value) return null;
  return { family: lo.family, lo: lo.value, hi: hi.value, record: toRecord(entry) };
}

/** The address range a row covers, or null when the row is unusable. */
function rangeOfEntry(entry: JsonNetworkDbEntry): AddressRange | null {
  if (typeof entry.prefix === 'string' && entry.prefix !== '') {
    return rangeFromPrefix(entry.prefix, entry);
  }
  return rangeFromBounds(entry);
}

function compareRanges(a: AddressRange, b: AddressRange): number {
  const ka = sortKey(a.family, a.lo);
  const kb = sortKey(b.family, b.lo);
  if (ka !== kb) return ka < kb ? -1 : 1;
  return a.hi === b.hi ? 0 : a.hi < b.hi ? -1 : 1;
}

/** Greatest index whose lower bound is not above `key`; -1 when none. */
function upperBound(ranges: AddressRange[], key: bigint): number {
  let low = 0;
  let high = ranges.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sortKey(ranges[mid]!.family, ranges[mid]!.lo) <= key) low = mid + 1;
    else high = mid;
  }
  return low - 1;
}

/** Build a LocalNetworkDb from an already-parsed entry list. */
export function createJsonNetworkDb(entries: JsonNetworkDbEntry[]): LocalNetworkDb {
  const ranges = entries
    .map(rangeOfEntry)
    .filter((r): r is AddressRange => r !== null)
    .sort(compareRanges);
  return {
    lookup(ip: string): LocalNetworkRecord | null {
      const address = addressToBigInt(ip);
      if (!address) return null;
      const key = sortKey(address.family, address.value);
      const hit = upperBound(ranges, key);
      // Every row at or before `hit` starts at or below the address, so a row
      // contains it as soon as its upper bound reaches; the narrowest such row
      // wins, which is what a more specific allocation means.
      let best: AddressRange | null = null;
      for (let i = hit; i >= 0 && i > hit - SCAN_BACK; i -= 1) {
        const range = ranges[i]!;
        if (range.family !== address.family || address.value > range.hi) continue;
        if (best === null || range.hi < best.hi) best = range;
      }
      return best?.record ?? null;
    },
  };
}

/** Load a JSON network database from disk; returns null when absent/corrupt. */
export function loadJsonNetworkDb(path: string): LocalNetworkDb | null {
  if (!existsSync(path)) return null;
  try {
    const file = JSON.parse(readFileSync(path, 'utf8')) as JsonNetworkDbFile;
    if (!file || !Array.isArray(file.entries)) return null;
    const entries = file.entries.filter(
      (e): e is JsonNetworkDbEntry => Boolean(e) && (typeof e.prefix === 'string' || typeof e.start === 'string'),
    );
    return createJsonNetworkDb(entries);
  } catch {
    return null;
  }
}
