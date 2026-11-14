import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConsentState } from './types.ts';

const CONSENT_FILE = 'consent.json';

export const THIRD_PARTY_SERVICES = [
  'system DNS resolver',
  'RIPE IPmap',
  'RIPEstat',
  'PeeringDB',
  'DB-IP Lite',
] as const;

/** Return prompt text naming the services and what is sent (§6.4, VOY-F-13). */
export function consentPromptText(): string {
  return [
    'Packet Voyage can query third-party services to enrich your route:',
    '  - system DNS resolver: queries reverse hostnames for public hops',
    '  - RIPE IPmap: queries geolocation candidates for public hops',
    '  - RIPEstat: queries network (ASN, prefix, AS name) for public hops',
    '  - PeeringDB: downloads IXP prefix directory (no route addresses sent)',
    '  - DB-IP Lite: downloads the geolocation database into this machine only',
    '    (~90 MB compressed, sharded to ~150 MB); no route address is sent,',
    '    and every journey it locates carries its CC BY 4.0 credit',
    '',
    'Only PUBLIC IP addresses of your route are ever sent.',
    'Private (RFC 1918), CGNAT, link-local, loopback, and access-network hops',
    'are NEVER transmitted to any remote service.',
    'Consent is stored locally and can be revoked at any time via `voyage consent`.',
  ].join('\n');
}

/** Read stored consent state from a directory, default to not granted (VOY-F-13). */
export function readConsent(dir: string): ConsentState {
  const filePath = join(dir, CONSENT_FILE);
  if (!existsSync(filePath)) {
    return { granted: false, services: [], grantedAt: null };
  }
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    return {
      granted: Boolean(parsed.granted),
      services: Array.isArray(parsed.services) ? parsed.services.map(String) : [],
      grantedAt: typeof parsed.grantedAt === 'string' ? parsed.grantedAt : null,
    };
  } catch {
    return { granted: false, services: [], grantedAt: null };
  }
}

/** Write consent state to a directory (VOY-F-13). */
export function writeConsent(dir: string, state: ConsentState): void {
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, CONSENT_FILE);
  const payload = JSON.stringify(
    {
      granted: Boolean(state.granted),
      services: state.services,
      grantedAt: state.grantedAt,
    },
    null,
    2,
  );
  writeFileSync(filePath, payload, 'utf8');
}
