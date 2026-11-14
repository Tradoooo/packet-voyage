import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createJsonNetworkDb } from './localdb.ts';
import {
  GEODB_ATTRIBUTION,
  GEODB_LICENCE,
  geodbReleases,
  geodbUrl,
  parseDbipLine,
  shardKeyFor,
} from './geodb-csv.ts';
import {
  geodbStatus,
  loadGeodbDb,
  readGeodbMeta,
  writeGeodbMeta,
  writeGeodbShards,
} from './geodb-store.ts';
import { downloadGeodb, importGeodbArchive } from './geodb-download.ts';
import { enrichHops } from './orchestrator.ts';
import { createMemoryCache } from './cache.ts';
import { publicAddress } from './fixtures/fake.ts';
import type { Fetcher } from './types.ts';

/**
 * The geolocation database path (VOY-F-08, §7.4.2, data-licences.md).
 * No test touches the network: the archive is a fixture, gzip-compressed in
 * memory and handed to a fake fetcher.
 */

const CSV = [
  '0.0.0.0,0.255.255.255,ZZ,ZZ,,,0,0',
  '1.0.0.0,1.0.0.255,OC,AU,Queensland,South Brisbane,-27.4767,153.017',
  '1.0.1.0,1.0.3.255,AS,CN,Fujian,Wenquan,26.0998,119.297',
  '37.77.32.0,37.77.32.255,EU,FR,Bouches-du-Rhone,Marseille,43.2965,5.3698',
  '141.101.67.0,141.101.67.255,EU,FR,Ile-de-France,Paris,48.8566,2.3522',
  '199.7.83.0,199.7.83.255,NA,US,California,"Los Angeles (Westchester)",33.9829,-118.4054',
  '2001:db8::,2001:db8::ff,EU,FR,Ile-de-France,Paris,48.8566,2.3522',
].join('\n');

function tempDir(label: string): string {
  return mkdtempSync(join(tmpdir(), `pv-${label}-`));
}

async function linesOf(text: string): Promise<AsyncIterable<string>> {
  return (async function* generate() {
    for (const line of text.split('\n')) yield line;
  })();
}

function bytesResponse(body: Uint8Array, status = 200) {
  return {
    status,
    json: async () => ({}),
    text: async () => '',
    arrayBuffer: async () => body as unknown as ArrayBuffer,
  };
}

function textOnlyResponse(status = 200) {
  return { status, json: async () => ({}), text: async () => '' };
}

function csvArchive(): Uint8Array {
  return new Uint8Array(gzipSync(Buffer.from(CSV, 'utf8')));
}

/** Convert the fixture archive the way `downloadGeodb` does, meta included. */
async function convertInto(dir: string): Promise<{ rows: number; shards: number }> {
  const written = await writeGeodbShards(await linesOf(CSV), dir);
  writeGeodbMeta(dir, {
    source: 'dbip-city-lite',
    url: 'https://download.db-ip.com/free/dbip-city-lite-2026-11.csv.gz',
    licence: GEODB_LICENCE,
    attribution: GEODB_ATTRIBUTION,
    retrieved_at: '2026-11-14T00:00:00Z',
    rows: written.rows,
    shards: written.shards,
  });
  return written;
}

describe('DB-IP CSV rows', () => {
  it('reads a range, a city and its coordinates', () => {
    expect(parseDbipLine('1.0.0.0,1.0.0.255,OC,AU,Queensland,South Brisbane,-27.4767,153.017')).toEqual({
      start: '1.0.0.0',
      end: '1.0.0.255',
      country: 'AU',
      city: 'South Brisbane',
      lat: -27.4767,
      lon: 153.017,
    });
  });

  it('unquotes a city containing a comma', () => {
    const row = parseDbipLine('199.7.83.0,199.7.83.255,NA,US,California,"Los Angeles, Westchester",33.98,-118.4');
    expect(row?.city).toBe('Los Angeles, Westchester');
  });

  it('drops the rows that could never locate a hop', () => {
    expect(parseDbipLine('0.0.0.0,0.255.255.255,ZZ,ZZ,,,0,0')).toBeNull();
    expect(parseDbipLine('1.0.0.0,1.0.0.255,EU,FR,Ile-de-France,,48.85,2.35')).toBeNull();
    expect(parseDbipLine('1.0.0.0,1.0.0.255,EU,FR,Ile-de-France,Paris,0,0')).toBeNull();
    expect(parseDbipLine('not,a,row')).toBeNull();
  });

  it('keys a shard by the first IPv4 octet or the first IPv6 hextet', () => {
    expect(shardKeyFor('8.8.8.8')).toBe('v4-008');
    expect(shardKeyFor('141.101.67.142')).toBe('v4-141');
    expect(shardKeyFor('2001:db8::1')).toBe('v6-2001');
    expect(shardKeyFor('not-an-address')).toBeNull();
  });
});

describe('releases and URLs', () => {
  it('asks for the newest release first, then the two before it', () => {
    expect(geodbReleases('2026-11-14T00:00:00Z')).toEqual([
      { year: 2026, month: 11 },
      { year: 2026, month: 10 },
      { year: 2026, month: 9 },
    ]);
  });

  it('crosses the year boundary', () => {
    const releases = geodbReleases('2026-01-05T00:00:00Z');
    expect(releases).toEqual([
      { year: 2026, month: 1 },
      { year: 2025, month: 12 },
      { year: 2025, month: 11 },
    ]);
    expect(geodbUrl(releases[2]!)).toBe(
      'https://download.db-ip.com/free/dbip-city-lite-2025-11.csv.gz',
    );
  });
});

describe('the converted database', () => {
  it('locates an address inside a range, and says nothing outside one', async () => {
    const dir = tempDir('geodb');
    try {
      const written = await convertInto(dir);
      expect(written.rows).toBe(6);
      expect(written.shards).toBeGreaterThan(0);

      const db = loadGeodbDb(dir);
      expect(db).not.toBeNull();
      expect(db!.lookup('37.77.32.11')?.city).toBe('Marseille');
      expect(db!.lookup('199.7.83.42')?.city).toBe('Los Angeles (Westchester)');
      expect(db!.lookup('2001:db8::5')?.country).toBe('FR');
      expect(db!.lookup('8.8.8.8')).toBeNull();
      expect(db!.lookup('1.0.4.0')).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports what is on disk, and nothing when there is none', async () => {
    const dir = tempDir('geodb-status');
    try {
      const empty = geodbStatus(dir, new Date('2026-11-14T00:00:00Z'));
      expect(empty.present).toBe(false);
      expect(empty.stale).toBe(true);
      expect(empty.licence).toBe(GEODB_LICENCE);
      expect(empty.attribution).toBe(GEODB_ATTRIBUTION);

      await convertInto(dir);
      const status = geodbStatus(dir, new Date('2026-11-14T00:00:00Z'));
      expect(status.present).toBe(true);
      expect(status.rows).toBe(6);
      expect(status.age_days).toBe(0);
      expect(status.stale).toBe(false);
      expect(status.bytes_on_disk).toBeGreaterThan(0);

      const old = geodbStatus(dir, new Date('2027-02-01T00:00:00Z'));
      expect(old.stale).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the local database search (VOY-F-08)', () => {
  it('prefers the narrower row when two cover an address', () => {
    const db = createJsonNetworkDb([
      { prefix: '192.0.2.0/24', city: 'Broad' },
      { prefix: '192.0.2.0/28', city: 'Narrow' },
    ]);
    expect(db.lookup('192.0.2.5')?.city).toBe('Narrow');
    expect(db.lookup('192.0.2.40')?.city).toBe('Broad');
  });

  it('never answers across families', () => {
    const db = createJsonNetworkDb([{ start: '1.0.0.0', end: '1.0.0.255', city: 'V4' }]);
    expect(db.lookup('1.0.0.9')?.city).toBe('V4');
    expect(db.lookup('2001:db8::1')).toBeNull();
  });

  it('searches hundreds of ranges without scanning them all', () => {
    const entries = Array.from({ length: 4000 }, (_, i) => ({
      start: `10.${(i >> 8) & 0xff}.${i & 0xff}.0`,
      end: `10.${(i >> 8) & 0xff}.${i & 0xff}.255`,
      city: `City ${i}`,
    }));
    const db = createJsonNetworkDb(entries);
    expect(db.lookup('10.0.15.7')?.city).toBe('City 15');
    expect(db.lookup('10.15.0.7')?.city).toBe('City 3840');
    expect(db.lookup('11.0.0.1')).toBeNull();
  });
});

const CONSENT = { granted: true, services: ['geodb'], grantedAt: '2026-11-14T00:00:00Z' };
const NOW = '2026-11-14T10:00:00Z';

describe('downloadGeodb: consent and offline (VOY-F-08, §6.1)', () => {

  it('sends nothing when offline or without consent, and never calls fetch', async () => {
    const dir = tempDir('geodb-offline');
    let calls = 0;
    const fetcher: Fetcher = async () => {
      calls += 1;
      return { status: 200, json: async () => ({}), text: async () => '' };
    };
    try {
      for (const offline of [true, false]) {
        const result = await downloadGeodb({
          dir,
          now: NOW,
          offline,
          consent: { granted: false, services: [], grantedAt: null },
          fetch: fetcher,
        });
        expect(result.downloaded).toBe(false);
        expect(result.reason).toBe('consent-or-offline');
      }
      expect(calls).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses a consent that does not name the download', async () => {
    const dir = tempDir('geodb-not-in-consent');
    let calls = 0;
    const fetcher: Fetcher = async () => {
      calls += 1;
      return textOnlyResponse();
    };
    try {
      const result = await downloadGeodb({
        dir,
        now: NOW,
        offline: false,
        consent: { granted: true, services: ['dns', 'ripestat', 'ipmap', 'peeringdb'], grantedAt: '2026-11-13T00:00:00Z' },
        fetch: fetcher,
      });
      expect(result.downloaded).toBe(false);
      expect(result.reason).toBe('geodb-not-in-consent');
      expect(calls).toBe(0);
      expect(loadGeodbDb(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('downloadGeodb: the conversion (VOY-F-08)', () => {
  it('converts the archive it fetched, and names the URL it used', async () => {
    const dir = tempDir('geodb-ok');
    const urls: string[] = [];
    const fetcher: Fetcher = async (url) => {
      urls.push(url);
      return bytesResponse(csvArchive());
    };
    try {
      const result = await downloadGeodb({ dir, now: NOW, offline: false, consent: CONSENT, fetch: fetcher });
      expect(result.downloaded).toBe(true);
      expect(result.rows).toBe(6);
      expect(result.url).toBe('https://download.db-ip.com/free/dbip-city-lite-2026-11.csv.gz');
      expect(urls).toEqual([result.url]);
      expect(loadGeodbDb(dir)?.lookup('141.101.67.142')?.city).toBe('Paris');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('tries the previous month when the newest release is not published', async () => {
    const dir = tempDir('geodb-404');
    const seen: string[] = [];
    const fetcher: Fetcher = async (url) => {
      seen.push(url);
      return url.endsWith('2026-11.csv.gz')
        ? textOnlyResponse(404)
        : bytesResponse(csvArchive());
    };
    try {
      const result = await downloadGeodb({ dir, now: NOW, offline: false, consent: CONSENT, fetch: fetcher });
      expect(result.downloaded).toBe(true);
      expect(result.url).toContain('2026-10');
      expect(seen.length).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

});

describe('downloadGeodb: the size cap (VOY-F-08)', () => {
  it('refuses an archive bigger than the cap, and says how big it was', async () => {
    const dir = tempDir('geodb-big');
    const fetcher: Fetcher = async () => bytesResponse(new Uint8Array(300 * 1024 * 1024));
    try {
      const result = await downloadGeodb({ dir, now: NOW, offline: false, consent: CONSENT, fetch: fetcher, maxBytes: 10 * 1024 * 1024 });
      expect(result.downloaded).toBe(false);
      expect(result.reason).toContain('too-large-300MB');
      expect(loadGeodbDb(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

});

describe('downloadGeodb: freshness (VOY-F-08)', () => {
  it('leaves a fresh copy alone, and refreshes it on demand', async () => {
    const dir = tempDir('geodb-fresh');
    const fetcher: Fetcher = async () => bytesResponse(csvArchive());
    try {
      await downloadGeodb({ dir, now: NOW, offline: false, consent: CONSENT, fetch: fetcher });
      const second = await downloadGeodb({ dir, now: NOW, offline: false, consent: CONSENT, fetch: fetcher });
      expect(second.downloaded).toBe(false);
      expect(second.reason).toContain('fresh-0d');
      const forced = await downloadGeodb({ dir, now: NOW, offline: false, consent: CONSENT, fetch: fetcher, force: true });
      expect(forced.downloaded).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

});

describe('downloadGeodb: a fetcher without bytes (VOY-F-08)', () => {
  it('says so when the fetcher cannot return bytes', async () => {
    const dir = tempDir('geodb-nobytes');
    try {
      const result = await downloadGeodb({
        dir,
        now: NOW,
        offline: false,
        consent: CONSENT,
        fetch: async () => textOnlyResponse(),
      });
      expect(result.downloaded).toBe(false);
      expect(result.reason).toContain('fetcher-returns-no-bytes');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('importing an archive already on disk (VOY-F-08)', () => {
  it('converts a gzipped copy and makes no request at all', async () => {
    const dir = tempDir('geodb-import');
    const archive = join(dir, 'dbip-city-lite-2026-11.csv.gz');
    let calls = 0;
    try {
      writeFileSync(archive, gzipSync(Buffer.from(CSV, 'utf8')));
      const realFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        calls += 1;
        throw new Error('the import must not reach the network');
      }) as typeof fetch;
      try {
        const result = await importGeodbArchive({ path: archive, dir: join(dir, 'db'), now: NOW });
        expect(result.reason).toBe('imported');
        expect(result.rows).toBe(6);
        expect(calls).toBe(0);
      } finally {
        globalThis.fetch = realFetch;
      }
      const db = loadGeodbDb(join(dir, 'db'));
      expect(db?.lookup('37.77.32.9')?.city).toBe('Marseille');
      expect(readGeodbMeta(join(dir, 'db'))?.attribution).toBe(GEODB_ATTRIBUTION);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('says so when the archive is not there', async () => {
    const dir = tempDir('geodb-missing');
    try {
      const result = await importGeodbArchive({
        path: join(dir, 'nope.csv.gz'),
        dir: join(dir, 'db'),
        now: NOW,
      });
      expect(result.downloaded).toBe(false);
      expect(result.reason).toContain('archive-not-found');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the database reaches the enrichment (VOY-F-08, VOY-P-04)', () => {
  it('produces a geodb candidate for a public hop, offline', async () => {
    const ip = publicAddress(77);
    const [a, b, c] = ip.split('.');
    const db = createJsonNetworkDb([
      { start: `${a}.${b}.${c}.0`, end: `${a}.${b}.${c}.255`, city: 'Testville', country: 'FR', lat: 48.8, lon: 2.3 },
    ]);
    const result = await enrichHops(
      [{ ttl: 5, class: 'public', replies: [{ ip, rtt_ms: [10], loss: 0 }] }],
      {
        offline: true,
        consent: { granted: false, services: [], grantedAt: null },
        cache: createMemoryCache(),
        fetch: async () => ({ status: 200, json: async () => ({}), text: async () => '' }),
        now: '2026-11-14T10:00:00Z',
        ixpPrefixes: [],
        localDb: db,
      },
    );
    const candidates = result.candidates[0] ?? [];
    const geodb = candidates.find((candidate) => candidate.source === 'geodb');
    expect(geodb?.city).toBe('Testville');
    expect(geodb?.weight).toBe(0.3);
    expect(result.sentAddresses).toEqual([]);
  });
});
