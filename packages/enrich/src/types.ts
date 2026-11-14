import type { Candidate, Hop } from '@packet-voyage/schema';

/** HTTP-like fetch abstraction injected into adapters (no bare global fetch). */
export type Fetcher = (
  url: string,
  init?: { headers?: Record<string, string> }
) => Promise<{
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
  /** Raw bytes, for an archive rather than a JSON document (geodb download). */
  arrayBuffer?(): Promise<ArrayBuffer>;
}>;

/** Cache abstraction (file or memory backed). */
export interface Cache {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, ttlDays: number): void;
  stats(): {
    entries: number;
    oldest: string | null;
    newest: string | null;
  };
}

/** User consent state for remote third-party services (VOY-F-13). */
export interface ConsentState {
  granted: boolean;
  services: string[];
  grantedAt: string | null;
}

/** One datacentre facility of an IXP (PeeringDB `fac`/`ix`, §6.1). */
export interface IxpFacility {
  name: string;
  city?: string | null;
  country?: string | null;
  lat?: number | null;
  lon?: number | null;
}

/** IXP prefix record from PeeringDB (VOY-F-10). */
export interface IxpPrefix {
  ix_id: number;
  name: string;
  prefix: string;
  city?: string | null;
  country?: string | null;
  lat?: number | null;
  lon?: number | null;
  /** Facilities of this IXP: each one becomes a location candidate (§7.4.3). */
  facilities?: IxpFacility[];
}

/** Record returned by a local geolocation / network database (e.g. DB-IP / IPinfo Lite). */
export interface LocalNetworkRecord {
  asn?: number | null;
  as_name?: string | null;
  prefix?: string | null;
  city?: string | null;
  country?: string | null;
  lat?: number | null;
  lon?: number | null;
}

/** Optional local database interface (VOY-F-08, VOY-F-11). */
export interface LocalNetworkDb {
  lookup(ip: string): LocalNetworkRecord | null;
}

/** Injected system DNS reverse resolver. */
export type DnsReverseResolver = (ip: string) => Promise<string[]>;

/** Options passed to the enrichment orchestrator and individual adapters. */
export interface EnrichOptions {
  offline: boolean;
  consent: ConsentState;
  cache: Cache;
  fetch: Fetcher;
  now: string;
  ixpPrefixes?: IxpPrefix[];
  localDb?: LocalNetworkDb;
  reverseResolver?: DnsReverseResolver;
  log?: (line: string) => void;
}

/** Result returned by `enrichHops`. */
export interface EnrichResult {
  hops: Hop[];
  candidates: Candidate[][];
  missing: string[];
  sentAddresses: string[];
}
