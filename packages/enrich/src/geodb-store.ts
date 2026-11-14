import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  appendFileSync,
  createReadStream,
} from 'node:fs';
import { join } from 'node:path';
import { createGunzip, gunzipSync, gzipSync } from 'node:zlib';
import { createInterface } from 'node:readline';
import { createJsonNetworkDb } from './localdb.ts';
import type { JsonNetworkDbEntry } from './localdb.ts';
import type { LocalNetworkDb, LocalNetworkRecord } from './types.ts';
import {
  GEODB_ATTRIBUTION,
  GEODB_ID,
  GEODB_LICENCE,
  GEODB_META_FILE,
  GEODB_SHARD_DIR,
  GEODB_TTL_DAYS,
  parseDbipLine,
  shardKeyFor,
} from './geodb-csv.ts';

/**
 * The on-disk form of the geolocation database, and its reader (VOY-F-08).
 *
 * The archive is converted once into one gzip member per address block
 * (`shards/v4-008.json.gz`), each member a JSON-lines file of compact rows.
 * A lookup reads the single shard that could hold the address and hands its
 * rows to `createJsonNetworkDb` — the same binary search the hand-written JSON
 * database uses, one implementation for both. Members are appended, so the
 * writer never holds a whole /8 in memory and does not depend on the input
 * arriving in order.
 *
 * The old shard directory is replaced only once the conversion succeeded: a
 * download cut in half leaves the previous database usable.
 */

const DAY_MS = 86_400_000;
/** Rows buffered before a gzip member is flushed: bounds memory on huge blocks. */
const FLUSH_ROWS = 20_000;
/** Decompressed shards kept in memory at once. */
const SHARDS_IN_MEMORY = 4;

export interface GeodbMeta {
  source: string;
  url: string;
  licence: string;
  attribution: string;
  retrieved_at: string;
  rows: number;
  shards: number;
}

export interface GeodbWriteResult {
  rows: number;
  shards: number;
}

export function geodbShardDir(dir: string): string {
  return join(dir, GEODB_SHARD_DIR);
}

export function geodbMetaPath(dir: string): string {
  return join(dir, GEODB_META_FILE);
}

/**
 * The CSV rows of a local archive, compressed (`.csv.gz`) or plain (`.csv`).
 * The published file is gzipped; a user who unpacked it should not be told to
 * repack it.
 */
export function csvLinesFromFile(path: string): AsyncIterable<string> {
  const raw = createReadStream(path);
  const input = path.endsWith('.gz') ? raw.pipe(createGunzip()) : raw;
  return createInterface({ input, crlfDelay: Infinity });
}

class ShardWriter {
  private readonly staging: string;
  private currentKey = '';
  private buffer: string[] = [];
  rows = 0;
  shards = 0;

  constructor(dir: string) {
    this.staging = join(dir, `${GEODB_SHARD_DIR}-staging`);
    rmSync(this.staging, { recursive: true, force: true });
    mkdirSync(this.staging, { recursive: true });
  }

  push(line: string): void {
    const entry = parseDbipLine(line);
    if (!entry) return;
    const key = shardKeyFor(entry.start ?? '');
    if (!key) return;
    if (key !== this.currentKey) {
      this.flush();
      this.currentKey = key;
      this.shards += 1;
    }
    this.buffer.push(JSON.stringify(entry));
    this.rows += 1;
    if (this.buffer.length >= FLUSH_ROWS) this.flush();
  }

  flush(): void {
    if (this.currentKey === '' || this.buffer.length === 0) return;
    const payload = `${this.buffer.map((row) => `${row}\n`).join('')}`;
    appendFileSync(join(this.staging, `${this.currentKey}.json.gz`), gzipSync(Buffer.from(payload, 'utf8')));
    this.buffer = [];
  }

  /** Publishes the staging directory as the shard directory. */
  finish(dir: string): GeodbWriteResult {
    this.flush();
    const target = geodbShardDir(dir);
    const previous = join(dir, `${GEODB_SHARD_DIR}-previous`);
    rmSync(previous, { recursive: true, force: true });
    if (existsSync(target)) renameSync(target, previous);
    renameSync(this.staging, target);
    rmSync(previous, { recursive: true, force: true });
    return { rows: this.rows, shards: this.shards };
  }
}

/** Convert a decoded CSV stream into shards under `dir`. */
export async function writeGeodbShards(
  lines: AsyncIterable<string>,
  dir: string,
): Promise<GeodbWriteResult> {
  const writer = new ShardWriter(dir);
  for await (const line of lines) writer.push(line);
  return writer.finish(dir);
}

export function writeGeodbMeta(dir: string, meta: GeodbMeta): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(geodbMetaPath(dir), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
}

export function readGeodbMeta(dir: string): GeodbMeta | null {
  const path = geodbMetaPath(dir);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<GeodbMeta>;
    if (typeof parsed.retrieved_at !== 'string' || typeof parsed.rows !== 'number') return null;
    return {
      source: typeof parsed.source === 'string' ? parsed.source : GEODB_ID,
      url: typeof parsed.url === 'string' ? parsed.url : '',
      licence: typeof parsed.licence === 'string' ? parsed.licence : GEODB_LICENCE,
      attribution:
        typeof parsed.attribution === 'string' ? parsed.attribution : GEODB_ATTRIBUTION,
      retrieved_at: parsed.retrieved_at,
      rows: parsed.rows,
      shards: typeof parsed.shards === 'number' ? parsed.shards : 0,
    };
  } catch {
    return null;
  }
}

export interface GeodbStatus {
  present: boolean;
  meta_path: string;
  rows: number;
  shards: number;
  retrieved_at: string | null;
  age_days: number | null;
  stale: boolean;
  bytes_on_disk: number;
  ttl_days: number;
  licence: string;
  attribution: string;
}

function shardBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const name of readdirSync(dir)) {
    try {
      total += statSync(join(dir, name)).size;
    } catch {
      // A shard removed mid-scan: the figure is indicative, not a checksum.
    }
  }
  return total;
}

/** What the user's disk holds, and whether it is worth refreshing. */
export function geodbStatus(dir: string, now: Date = new Date()): GeodbStatus {
  const meta = readGeodbMeta(dir);
  if (!meta) {
    return {
      present: false,
      meta_path: geodbMetaPath(dir),
      rows: 0,
      shards: 0,
      retrieved_at: null,
      age_days: null,
      stale: true,
      bytes_on_disk: 0,
      ttl_days: GEODB_TTL_DAYS,
      licence: GEODB_LICENCE,
      attribution: GEODB_ATTRIBUTION,
    };
  }
  const retrieved = new Date(meta.retrieved_at).getTime();
  const ageDays = Number.isFinite(retrieved)
    ? Math.max(0, Math.floor((now.getTime() - retrieved) / DAY_MS))
    : null;
  return {
    present: true,
    meta_path: geodbMetaPath(dir),
    rows: meta.rows,
    shards: meta.shards,
    retrieved_at: meta.retrieved_at,
    age_days: ageDays,
    stale: ageDays === null || ageDays > GEODB_TTL_DAYS,
    bytes_on_disk: shardBytes(geodbShardDir(dir)),
    ttl_days: GEODB_TTL_DAYS,
    licence: meta.licence,
    attribution: meta.attribution,
  };
}

function readShardEntries(path: string): JsonNetworkDbEntry[] | null {
  try {
    const text = gunzipSync(readFileSync(path)).toString('utf8');
    const entries: JsonNetworkDbEntry[] = [];
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue;
      try {
        const row = JSON.parse(line) as JsonNetworkDbEntry;
        if (row && typeof row.start === 'string') entries.push(row);
      } catch {
        // A truncated member: keep what decoded. The rest is a hole, not a lie.
      }
    }
    return entries;
  } catch {
    return null;
  }
}

/**
 * A reader over the converted database, or null when nothing was converted.
 * Shards are decompressed on first use and kept least-recently-used, so a
 * thirty-hop journey touches at most a handful of files.
 */
export function loadGeodbDb(dir: string): LocalNetworkDb | null {
  if (!readGeodbMeta(dir)) return null;
  const shardDir = geodbShardDir(dir);
  if (!existsSync(shardDir)) return null;
  const memo = new Map<string, LocalNetworkDb>();

  const shardDb = (key: string): LocalNetworkDb | null => {
    const cached = memo.get(key);
    if (cached) {
      memo.delete(key);
      memo.set(key, cached);
      return cached;
    }
    const path = join(shardDir, `${key}.json.gz`);
    if (!existsSync(path)) return null;
    const entries = readShardEntries(path);
    if (entries === null || entries.length === 0) return null;
    const db = createJsonNetworkDb(entries);
    memo.set(key, db);
    while (memo.size > SHARDS_IN_MEMORY) {
      const oldest = memo.keys().next().value;
      if (oldest === undefined) break;
      memo.delete(oldest);
    }
    return db;
  };

  return {
    lookup(ip: string): LocalNetworkRecord | null {
      const key = shardKeyFor(ip);
      if (!key) return null;
      return shardDb(key)?.lookup(ip) ?? null;
    },
  };
}
