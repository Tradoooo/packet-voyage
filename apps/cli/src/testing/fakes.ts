/**
 * Test doubles for the CLI: a fake I/O sink, an in-memory `VoyageDeps`, and a
 * schema-valid journey fixture built from RFC 5737 documentation addresses.
 * Used by the colocated `*.test.ts` suites; never touches the network.
 */
import * as realCore from '@packet-voyage/core';
import type { Cable, HintCity, Hop, Journey, Provenance } from '@packet-voyage/schema';
import type {
  CacheLike,
  ComputeJourneyInputLike,
  ConsentStateLike,
  CoreDeps,
  DataDeps,
  EnrichDeps,
  EnrichOptionsLike,
  GeodbDownloadOptionsLike,
  GeodbImportOptionsLike,
  LocalNetworkDbLike,
  ParsedTraceLike,
  VoyageDeps,
} from '../deps.ts';
import type { CliIo } from '../runtime.ts';

export interface FakeIo extends CliIo {
  out: string[];
  err: string[];
  stdinText: string;
  stdinTty: boolean;
  confirmAnswer: boolean;
  confirms: string[];
  clock: string;
}

export function createFakeIo(overrides: Partial<FakeIo> = {}): FakeIo {
  const io: FakeIo = {
    out: [],
    err: [],
    stdinText: '',
    stdinTty: false,
    confirmAnswer: false,
    confirms: [],
    clock: '2026-11-11T12:00:00.000Z',
    stdout: (text) => {
      io.out.push(text);
    },
    stderr: (text) => {
      io.err.push(text);
    },
    readStdin: async () => io.stdinText,
    isStdinTty: () => io.stdinTty,
    confirm: async (question) => {
      io.confirms.push(question);
      return io.confirmAnswer;
    },
    env: {},
    cwd: '/tmp',
    platform: 'linux',
    now: () => io.clock,
    ...overrides,
  };
  return io;
}

/** One hop on a documentation address (RFC 5737), unlocated by default. */
export function fakeHop(ttl: number, ip: string, rtt: number, name?: string): Hop {
  return {
    ttl,
    replies: [{ ip, ...(name ? { name } : {}), rtt_ms: [rtt] }],
    class: 'documentation',
    envelope_ms: rtt,
    location: null,
  };
}

export function fakeJourney(overrides: Partial<Journey> = {}): Journey {
  return {
    version: 1,
    traced_at: '2026-11-11T12:00:00.000Z',
    tool: 'traceroute',
    protocol: 'udp',
    family: 4,
    source: null,
    target: { host: 'example.test', ip: '192.0.2.1' },
    hops: [fakeHop(1, '192.0.2.1', 1.5), fakeHop(2, '198.51.100.9', 9.9)],
    segments: [
      {
        from_ttl: 1,
        to_ttl: 2,
        kind: 'undetermined',
        geodesic_km: 120,
        delta_ms: 8.4,
        skipped_hops: 0,
        cables: [],
        other_cables: 0,
        fixed_link: null,
      },
    ],
    summary: {
      distance_km_min: 120,
      rtt_ms: 9.9,
      light_floor_ms: 0.8,
      inflation: 12.4,
      countries: [],
      networks: 0,
      ixps: 0,
      detours: [],
      rejected_by_light: 0,
      gaps: 0,
    },
    credits: ['Test fixture'],
    redaction: null,
    ...overrides,
  };
}

export const FAKE_HINTS: HintCity[] = [
  { code: 'LYS', city: 'Lyon', country: 'FR', lat: 45.76, lon: 4.84, kind: 'airport' },
  { code: 'PAR', city: 'Paris', country: 'FR', lat: 48.86, lon: 2.35, kind: 'city' },
];

/** Synthetic traceroute fixture — documentation addresses only (RFC 5737). */
export const TRACE_FIXTURE = [
  'traceroute to example.test (203.0.113.80), 30 hops max, 60 byte packets',
  ' 1  192.0.2.1  1.234 ms  1.100 ms  1.050 ms',
  ' 2  198.51.100.9  9.900 ms  9.600 ms  10.400 ms',
  ' 3  * * *',
  ' 4  203.0.113.80  91.700 ms  91.500 ms  91.900 ms',
  '',
].join('\n');

export const FAKE_PROVENANCE: Provenance[] = [
  {
    id: 'test-dataset',
    title: 'Test dataset',
    origin: 'fixture',
    url: 'https://example.test/dataset',
    licence: 'ODbL',
    retrieved_at: '2026-11-01T00:00:00.000Z',
    attribution: 'Fixture authors',
    features: 2,
    sha256: 'deadbeef',
  },
];

export interface FakeDepsOptions {
  consent?: ConsentStateLike;
  parseResult?: 'trace' | 'unknown';
  enrichMissing?: string[];
  staleIds?: string[];
  /** Why the fake declined to download the geolocation database. */
  geodbReason?: string;
  /** The local geolocation database the fake hands to the enrichment. */
  geodbDb?: LocalNetworkDbLike | null;
}

function fakeParseTrace(text: string, options: FakeDepsOptions): ParsedTraceLike {
  if (options.parseResult === 'unknown' || text.trim() === 'not a trace') {
    return {
      format: 'unknown',
      family: 4,
      protocol: 'unknown',
      tool: 'unknown',
      target: null,
      hops: [],
      unknownLines: [text.split('\n')[0] ?? ''],
      warnings: ['unrecognized'],
    };
  }
  return {
    format: 'traceroute',
    family: 4,
    protocol: 'udp',
    tool: 'traceroute',
    target: { host: 'example.test', ip: '192.0.2.1' },
    hops: [fakeHop(1, '192.0.2.1', 1.5), fakeHop(2, '198.51.100.9', 9.9)],
    unknownLines: [],
    warnings: [],
  };
}

function fakeCompute(input: ComputeJourneyInputLike): Journey {
  return fakeJourney({
    traced_at: input.tracedAt,
    tool: input.tool ?? (input.parsed?.tool as Journey['tool']) ?? 'traceroute',
    ...(input.source
      ? {
          source: {
            label: input.source.label ?? null,
            lat: input.source.lat,
            lon: input.source.lon,
            precision: 'city',
            declared: true,
          },
        }
      : {}),
    ...(input.target ? { target: input.target } : {}),
  });
}

function makeFakeCore(options: FakeDepsOptions): CoreDeps {
  return {
    parseTrace: (text) => fakeParseTrace(text, options),
    computeJourney: fakeCompute,
    redactJourney: (journey, level) => ({
      ...journey,
      source: journey.source ? { ...journey.source, precision: level, lat: null, lon: null } : null,
      redaction: { level, applied: true },
    }),
    redactionPreview: (journey, level) => [
      `redaction level: ${level}`,
      `target host: ${journey.target.host}`,
      `${journey.hops.length} hop(s), non-public addresses removed`,
    ],
    encodeShareLink: (journey, baseUrl) =>
      `${baseUrl.replace(/\/$/, '')}/#j=${Buffer.from(journey.target.host).toString('base64url')}`,
    MAX_FRAGMENT_BYTES: 60_000,
    // The analytics are pure: the fakes delegate to the real implementations so
    // the CLI tests exercise the numbers a user would see.
    distanceBounds: (journey: Journey) => realCore.distanceBounds(journey),
    delayBreakdown: (journey: Journey) => realCore.delayBreakdown(journey),
    mediaForJourney: (journey: Journey) => realCore.mediaForJourney(journey),
    compareWithEra: (input: { journey: Journey; cables: Cable[]; year: number }) =>
      realCore.compareWithEra(input),
    journeyToGeoJSON: (journey: Journey) => realCore.journeyToGeoJSON(journey),
    incidentReport: (journey: Journey, language?: 'en' | 'fr') =>
      realCore.incidentReport(journey, language ?? 'en'),
    diffJourneys: (a: Journey, b: Journey) => realCore.diffJourneys(a, b),
  };
}

interface FakeState {
  consentState: ConsentStateLike;
  consentDirs: string[];
  cacheStore: Map<string, unknown>;
  cacheDirs: string[];
  enrichOpts: EnrichOptionsLike[];
  enrichCalls: { count: number };
  geodbOpts: GeodbDownloadOptionsLike[];
  geodbImports: GeodbImportOptionsLike[];
}

function fakeCache(state: FakeState): CacheLike {
  return {
    get: <T>(key: string) => (state.cacheStore.has(key) ? (state.cacheStore.get(key) as T) : null),
    set: <T>(key: string, value: T) => {
      state.cacheStore.set(key, value);
    },
    stats: () => ({
      entries: state.cacheStore.size,
      oldest: state.cacheStore.size > 0 ? '2026-11-01T00:00:00.000Z' : null,
      newest: state.cacheStore.size > 0 ? '2026-11-11T00:00:00.000Z' : null,
    }),
  };
}

/** The geolocation-database half of the fake: no download, nothing on disk. */
function fakeGeodb(
  options: FakeDepsOptions,
  state: FakeState,
): Pick<
  EnrichDeps,
  'downloadGeodb' | 'importGeodbArchive' | 'loadGeodbDb' | 'geodbStatus' | 'GEODB_ATTRIBUTION'
> {
  return {
    downloadGeodb: async (geodbOptions) => {
      state.geodbOpts.push(geodbOptions);
      return {
        downloaded: false,
        reason: options.geodbReason ?? 'fake-no-download',
        url: null,
        rows: 0,
        shards: 0,
        bytes: 0,
      };
    },
    importGeodbArchive: async (importOptions) => {
      state.geodbImports.push(importOptions);
      return {
        downloaded: false,
        reason: 'fake-no-import',
        url: importOptions.path,
        rows: 0,
        shards: 0,
        bytes: 0,
      };
    },
    loadGeodbDb: () => options.geodbDb ?? null,
    geodbStatus: (dir) => ({
      present: false,
      meta_path: dir,
      rows: 0,
      shards: 0,
      retrieved_at: null,
      age_days: null,
      stale: true,
      bytes_on_disk: 0,
      ttl_days: 30,
      licence: 'CC-BY-4.0',
      attribution: 'IP geolocation data: DB-IP Lite (fake), CC BY 4.0',
    }),
    GEODB_ATTRIBUTION: 'IP geolocation data: DB-IP Lite (fake), CC BY 4.0',
  };
}

function makeFakeEnrich(options: FakeDepsOptions, state: FakeState): EnrichDeps {
  const cache = fakeCache(state);
  return {
    enrichHops: async (hops, enrichOptions) => {
      state.enrichCalls.count += 1;
      state.enrichOpts.push(enrichOptions);
      return {
        hops,
        candidates: hops.map(() => []),
        missing: options.enrichMissing ?? [],
        sentAddresses: [],
      };
    },
    createFileCache: (dir) => {
      state.cacheDirs.push(dir);
      return cache;
    },
    readConsent: (dir) => {
      state.consentDirs.push(dir);
      return state.consentState;
    },
    writeConsent: (dir, s) => {
      state.consentDirs.push(dir);
      state.consentState = s;
    },
    consentPromptText: () =>
      'With your consent, public hop addresses are sent to: system DNS (reverse), RIPEstat, RIPE IPmap, PeeringDB. The geolocation database is downloaded and kept on this machine.',
    ixpPrefixes: async () => [{ prefix: '192.0.2.0/24', ixp: 'Test-IX' }],
    ...fakeGeodb(options, state),
  };
}

function makeFakeData(options: FakeDepsOptions): DataDeps {
  return {
    loadCables: () => [],
    loadLandmasses: () => [],
    loadFixedLinks: () => [],
    loadHints: () => FAKE_HINTS,
    loadProvenance: () => FAKE_PROVENANCE,
    staleProvenance: () =>
      FAKE_PROVENANCE.filter((p) => (options.staleIds ?? []).includes(p.id)),
    creditsFor: (ids) => ids.map((id) => `Credit: ${id}`),
  };
}

/** In-memory `VoyageDeps` implementing the contract shapes deterministically. */
export function createFakeDeps(options: FakeDepsOptions = {}): VoyageDeps & {
  consentState: ConsentStateLike;
  consentDirs: string[];
  cacheStore: Map<string, unknown>;
  cacheDirs: string[];
  enrichOpts: EnrichOptionsLike[];
  enrichCalls: number;
  geodbOpts: GeodbDownloadOptionsLike[];
  geodbImports: GeodbImportOptionsLike[];
} {
  const state = {
    consentState: options.consent ?? { granted: false, services: [], grantedAt: null },
    consentDirs: [] as string[],
    cacheStore: new Map<string, unknown>(),
    cacheDirs: [] as string[],
    enrichOpts: [] as EnrichOptionsLike[],
    enrichCalls: { count: 0 },
    geodbOpts: [] as GeodbDownloadOptionsLike[],
    geodbImports: [] as GeodbImportOptionsLike[],
  };
  return {
    core: makeFakeCore(options),
    enrich: makeFakeEnrich(options, state),
    data: makeFakeData(options),
    get consentState() {
      return state.consentState;
    },
    consentDirs: state.consentDirs,
    cacheStore: state.cacheStore,
    cacheDirs: state.cacheDirs,
    enrichOpts: state.enrichOpts,
    geodbOpts: state.geodbOpts,
    geodbImports: state.geodbImports,
    get enrichCalls() {
      return state.enrichCalls.count;
    },
  };
}
