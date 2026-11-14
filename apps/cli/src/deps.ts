/**
 * Workspace dependency seam.
 *
 * The sibling packages (`@packet-voyage/core`, `@packet-voyage/enrich`,
 * `@packet-voyage/data`) are loaded **lazily**, inside `loadVoyageDeps()`, so
 * that `voyage --help` and every exit-2 argument refusal still work while a
 * sibling lot is being written, and so tests can inject in-memory fakes.
 * Types are imported with `import type` (erased at runtime); the runtime
 * imports are the dynamic ones at the bottom of this file.
 *
 * The structural interfaces mirror `docs/CONTRACTS.md` §5.5–§5.8 — the
 * contract wins over any local instinct.
 */
import type {
  Cable,
  FixedLink,
  HintCity,
  Hop,
  Journey,
  Landmass,
  Provenance,
  RedactionLevel,
} from '@packet-voyage/schema';

/* ------------------------------------------------------------- core (§5.1–5.5) */

export interface ParsedTraceLike {
  format: string;
  family: 4 | 6;
  protocol: string;
  tool: Journey['tool'];
  target?: { host: string; ip?: string | null } | null;
  hops: Hop[];
  unknownLines: string[];
  warnings: string[];
}

export interface ComputeJourneyInputLike {
  text?: string;
  parsed?: ParsedTraceLike;
  candidates?: unknown[][];
  source?: { lat: number; lon: number; label?: string; country?: string } | null;
  target?: { host: string; ip?: string | null } | null;
  tracedAt: string;
  tool?: Journey['tool'];
  protocol?: string;
  cables?: Cable[];
  masses?: Landmass[];
  links?: FixedLink[];
  hints?: HintCity[];
  credits?: string[];
}

/* ------------------------------------------------------- analytics (VOY extras) */

export interface DistanceBoundsLike {
  min_km: number;
  max_km: number | null;
  min_basis: string;
  max_basis: string | null;
  note: { en: string; fr: string };
}

export interface DelayBreakdownLike {
  rtt_ms: number | null;
  propagation_floor_ms: number | null;
  residual_ms: number | null;
  residual_share: number | null;
  clamped: boolean;
  reading: 'measured' | 'inferred';
  note: { en: string; fr: string };
}

export interface MediumCheckLike {
  medium: string;
  km_per_ms: number | null;
  min_rtt_ms: number;
  compatible: boolean;
  note: string;
}

export interface EraCableLike {
  id: string;
  name: string;
  rfs_year: number | null;
  length_km: number | null;
  compatibility: number;
  band: string;
}

export interface EraComparisonLike {
  year: number;
  available_then: number;
  compatible_then: EraCableLike[];
  compatible_now: EraCableLike[];
  crossings: number;
  verdict: { en: string; fr: string };
}

export interface JourneyDiffLike {
  same_target: boolean;
  distance_km: { a: number; b: number; delta: number };
  rtt_ms: { a: number | null; b: number | null; delta: number | null };
  inflation: { a: number | null; b: number | null; delta: number | null };
  countries_added: string[];
  countries_removed: string[];
  networks_added: number[];
  networks_removed: number[];
  hops: { a: number; b: number };
  located_hops: { a: number; b: number };
  rejected_by_light: { a: number; b: number };
  detours: { a: number; b: number };
  path_changed: boolean;
  city_path: { a: string[]; b: string[] };
  sentence: { en: string; fr: string };
}

export interface GeoFeatureCollectionLike {
  type: 'FeatureCollection';
  features: unknown[];
  properties: Record<string, unknown>;
}

export interface CoreDeps {
  parseTrace(text: string, options?: { format?: string }): ParsedTraceLike;
  computeJourney(input: ComputeJourneyInputLike): Journey;
  redactJourney(journey: Journey, level: RedactionLevel): Journey;
  redactionPreview(journey: Journey, level: RedactionLevel): string[];
  encodeShareLink(journey: Journey, baseUrl: string): string;
  MAX_FRAGMENT_BYTES: number;
  distanceBounds(journey: Journey): DistanceBoundsLike;
  delayBreakdown(journey: Journey): DelayBreakdownLike;
  mediaForJourney(journey: Journey): MediumCheckLike[];
  compareWithEra(input: { journey: Journey; cables: Cable[]; year: number }): EraComparisonLike;
  journeyToGeoJSON(journey: Journey): GeoFeatureCollectionLike;
  incidentReport(journey: Journey, language?: 'en' | 'fr'): string;
  diffJourneys(a: Journey, b: Journey): JourneyDiffLike;
}

/* ----------------------------------------------------------- enrich (§5.6) */

export interface ConsentStateLike {
  granted: boolean;
  services: string[];
  grantedAt: string | null;
}

export interface CacheLike {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, ttlDays: number): void;
  stats(): { entries: number; oldest: string | null; newest: string | null };
}

export type FetcherLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
  /** Raw bytes, for an archive rather than a JSON document. */
  arrayBuffer?(): Promise<ArrayBuffer>;
}>;

export interface EnrichOptionsLike {
  offline: boolean;
  consent: ConsentStateLike;
  cache: CacheLike;
  fetch: FetcherLike;
  now: string;
  log?: (line: string) => void;
  /** The local geolocation database, when the user downloaded one (VOY-F-08). */
  localDb?: LocalNetworkDbLike | null;
}

export interface EnrichResultLike {
  hops: Hop[];
  candidates: unknown[][];
  missing: string[];
  sentAddresses: string[];
}

/* ------------------------------------------------- geolocation database (VOY-F-08) */

/** A record from the local geolocation database, as the enrichment sees it. */
export interface LocalNetworkRecordLike {
  asn?: number | null;
  as_name?: string | null;
  prefix?: string | null;
  city?: string | null;
  country?: string | null;
  lat?: number | null;
  lon?: number | null;
}

export interface LocalNetworkDbLike {
  lookup(ip: string): LocalNetworkRecordLike | null;
}

export interface GeodbStatusLike {
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

export interface GeodbDownloadOptionsLike {
  dir: string;
  now: string;
  offline: boolean;
  consent: ConsentStateLike;
  fetch: FetcherLike;
  log?: (line: string) => void;
  force?: boolean;
  monthsBack?: number;
  maxBytes?: number;
}

export interface GeodbImportOptionsLike {
  /** An archive already on this machine. */
  path: string;
  dir: string;
  now: string;
  log?: (line: string) => void;
}

export interface GeodbDownloadResultLike {
  downloaded: boolean;
  reason: string | null;
  url: string | null;
  rows: number;
  shards: number;
  bytes: number;
}

export interface EnrichDeps {
  enrichHops(hops: Hop[], options: EnrichOptionsLike): Promise<EnrichResultLike>;
  createFileCache(dir: string): CacheLike;
  readConsent(dir: string): ConsentStateLike;
  writeConsent(dir: string, state: ConsentStateLike): void;
  consentPromptText(): string;
  ixpPrefixes(options: EnrichOptionsLike): Promise<unknown[]>;
  downloadGeodb(options: GeodbDownloadOptionsLike): Promise<GeodbDownloadResultLike>;
  importGeodbArchive(options: GeodbImportOptionsLike): Promise<GeodbDownloadResultLike>;
  loadGeodbDb(dir: string): LocalNetworkDbLike | null;
  geodbStatus(dir: string, now?: Date): GeodbStatusLike;
  GEODB_ATTRIBUTION: string;
}

/* ------------------------------------------------------------- data (§5.7) */

export interface DataDeps {
  loadCables(): Cable[];
  loadLandmasses(): Landmass[];
  loadFixedLinks(): FixedLink[];
  loadHints(): HintCity[];
  loadProvenance(): Provenance[];
  staleProvenance(days?: number): Provenance[];
  creditsFor(ids: string[]): string[];
}

/* ------------------------------------------------------------------ bundle */

export interface VoyageDeps {
  core: CoreDeps;
  enrich: EnrichDeps;
  data: DataDeps;
}

export interface LoadedDatasets {
  cables: Cable[];
  masses: Landmass[];
  links: FixedLink[];
  hints: HintCity[];
  provenance: Provenance[];
  credits: string[];
  stale: Provenance[];
}

/** Load the embedded datasets once per command; staleness threshold: 90 days. */
export function loadDatasets(data: DataDeps, staleDays = 90): LoadedDatasets {
  const provenance = data.loadProvenance();
  return {
    cables: data.loadCables(),
    masses: data.loadLandmasses(),
    links: data.loadFixedLinks(),
    hints: data.loadHints(),
    provenance,
    credits: data.creditsFor(provenance.map((entry) => entry.id)),
    stale: data.staleProvenance(staleDays),
  };
}

/** The production loader: the real workspace packages, per the contract. */
export async function loadVoyageDeps(): Promise<VoyageDeps> {
  const [core, enrich, data] = await Promise.all([
    import('@packet-voyage/core'),
    import('@packet-voyage/enrich'),
    import('@packet-voyage/data'),
  ]);
  return {
    core: core as unknown as CoreDeps,
    enrich: enrich as unknown as EnrichDeps,
    data: data as unknown as DataDeps,
  };
}
