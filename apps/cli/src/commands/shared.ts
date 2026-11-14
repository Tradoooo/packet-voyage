/**
 * Shared command helpers: `--from` resolution, input reading (file/stdin,
 * exit 5 when unreadable), journey writing, the consent gate (VOY-F-13),
 * and the default fetcher built on the global `fetch`.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseJourney } from '@packet-voyage/schema';
import type { HintCity, Journey } from '@packet-voyage/schema';
import type { ConsentStateLike, FetcherLike, LocalNetworkDbLike } from '../deps.ts';
import { CliError, EXIT_BAD_ARG, EXIT_REFUSED, EXIT_UNREADABLE } from '../runtime.ts';
import type { CliContext, CliIo } from '../runtime.ts';

export interface DeclaredSource {
  lat: number;
  lon: number;
  label?: string;
  country?: string;
}

/**
 * Resolve `--from <city>` against the embedded hints table (city name or
 * router code) or an explicit `"lat,lon"`. Never invents a position: an
 * unknown city is a bad argument (exit 2).
 */
export function resolveSourceFromFlag(
  raw: string | undefined,
  hints: HintCity[],
): DeclaredSource | null {
  if (!raw || raw.trim() === '') return null;
  const trimmed = raw.trim();
  const coords = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(trimmed);
  if (coords) {
    const lat = Number(coords[1]);
    const lon = Number(coords[2]);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      throw new CliError(EXIT_BAD_ARG, `invalid --from coordinates "${trimmed}"`);
    }
    return { lat, lon, label: trimmed };
  }
  const needle = trimmed.toLowerCase();
  const found =
    hints.find((hint) => hint.city.toLowerCase() === needle) ??
    hints.find((hint) => hint.code.toLowerCase() === needle);
  if (!found) {
    throw new CliError(
      EXIT_BAD_ARG,
      `unknown --from city "${trimmed}": not found in the embedded hints table (try "lat,lon")`,
    );
  }
  return {
    lat: found.lat,
    lon: found.lon,
    label: `${found.city}, ${found.country}`,
    country: found.country,
  };
}

/** Read a trace/journey file, or stdin for `-` (or a missing argument). */
export async function readInputText(fileArg: string | undefined, io: CliIo): Promise<string> {
  if (fileArg !== undefined && fileArg !== '-' && fileArg.startsWith('-')) {
    // §18: an operand starting with a dash is a bad argument, never a file.
    throw new CliError(EXIT_BAD_ARG, `refusing argument starting with a dash: "${fileArg}"`);
  }
  if (!fileArg || fileArg === '-') {
    if (!fileArg && io.isStdinTty()) {
      throw new CliError(EXIT_BAD_ARG, 'missing input file (pass a path, or "-" to read stdin)');
    }
    try {
      const text = await io.readStdin();
      if (text.trim() === '') {
        throw new CliError(EXIT_UNREADABLE, 'stdin was empty');
      }
      return text;
    } catch (error) {
      if (error instanceof CliError) throw error;
      throw new CliError(EXIT_UNREADABLE, `cannot read stdin: ${(error as Error).message}`);
    }
  }
  const abs = resolve(io.cwd, fileArg);
  if (!existsSync(abs)) {
    throw new CliError(EXIT_UNREADABLE, `file not found: ${fileArg}`);
  }
  try {
    return await readFile(abs, 'utf8');
  } catch (error) {
    throw new CliError(EXIT_UNREADABLE, `cannot read "${fileArg}": ${(error as Error).message}`);
  }
}

/** Read and validate a stored journey (exit 5 when unreadable or invalid). */
export async function readJourneyFile(
  fileArg: string | undefined,
  ctx: CliContext,
): Promise<Journey> {
  if (!fileArg) {
    throw new CliError(EXIT_BAD_ARG, 'missing <journey.json> argument');
  }
  const text = await readInputText(fileArg, ctx.io);
  try {
    return parseJourney(text);
  } catch (error) {
    throw new CliError(
      EXIT_UNREADABLE,
      `invalid journey JSON in "${fileArg}": ${(error as Error).message}`,
    );
  }
}

/** Write any text artefact next to the current directory; returns its path. */
export async function writeTextFile(outPath: string, text: string, io: CliIo): Promise<string> {
  const abs = resolve(io.cwd, outPath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, text, 'utf8');
  return abs;
}

export async function writeJourneyFile(
  outPath: string,
  journey: Journey,
  io: CliIo,
): Promise<string> {
  return writeTextFile(outPath, `${JSON.stringify(journey, null, 2)}\n`, io);
}

/**
 * The service ids a consent record may name, in the order the prompt lists them.
 * One list, two callers (`consent grant` and the interactive gate): the prompt
 * text comes from `packages/enrich`, so an id added there must be added here —
 * and a download the record does not name is refused, not assumed.
 */
export const CONSENT_SERVICE_IDS = ['dns', 'ripestat', 'ipmap', 'peeringdb', 'geodb'];

/** The geolocation database needs its own mention: it is a download, not a lookup. */
export const GEODB_CONSENT_SERVICE = 'geodb';

/**
 * Consent gate: returns the stored state; when interactive, shows the
 * documented prompt once and remembers the answer (VOY-F-13). With
 * `refuseOnMissing`, a refusal becomes exit 4 (`enrich`, `data update`).
 */
export async function ensureConsent(
  ctx: CliContext,
  opts: { allowPrompt: boolean; refuseOnMissing: boolean },
): Promise<ConsentStateLike> {
  const { enrich } = ctx.deps;
  const current = enrich.readConsent(ctx.home);
  if (current.granted) return current;
  if (opts.allowPrompt && ctx.io.isStdinTty()) {
    ctx.io.stderr(`${enrich.consentPromptText()}\n`);
    const accepted = await ctx.io.confirm('Send public hop addresses to these services?');
    if (accepted) {
      const granted: ConsentStateLike = {
        granted: true,
        services: CONSENT_SERVICE_IDS,
        grantedAt: ctx.io.now(),
      };
      enrich.writeConsent(ctx.home, granted);
      return granted;
    }
  }
  if (opts.refuseOnMissing) {
    throw new CliError(
      EXIT_REFUSED,
      'refused: consent for third-party lookups is not granted (see `voyage consent grant`)',
    );
  }
  return current;
}

/** Fetcher built on the global `fetch`; the enrich layer logs every URL. */
export function defaultFetcher(): FetcherLike {
  return async (url, init) => {
    const response = await fetch(url, init);
    return {
      status: response.status,
      json: () => response.json() as Promise<unknown>,
      text: () => response.text(),
      arrayBuffer: () => response.arrayBuffer(),
    };
  };
}

/* -------------------------------------------------- geolocation database (VOY-F-08) */

/** Where the user's copy of the geolocation database lives (never the repo). */
export function geodbDir(ctx: CliContext): string {
  return join(ctx.home, 'geodb', 'dbip-city-lite');
}

/**
 * The local geolocation database, if the user has one. `voyage read` never
 * asks for it: that command is the offline oracle the site is checked against,
 * and giving it a database the browser cannot have would split the two.
 */
export function loadGeodb(ctx: CliContext): LocalNetworkDbLike | null {
  return ctx.deps.enrich.loadGeodbDb(geodbDir(ctx));
}

/**
 * Credits for a journey, with the CC BY 4.0 line added only when the local
 * database actually answered something: an attribution for an unused copy
 * would be noise, and a missing one for a used copy would breach the licence.
 */
export function creditsWithGeodb(
  ctx: CliContext,
  base: string[],
  candidates: unknown[][],
): string[] {
  const used = candidates
    .flat()
    .some((c) => (c as { source?: string } | null)?.source === 'geodb');
  if (!used) return base;
  const credit = ctx.deps.enrich.GEODB_ATTRIBUTION;
  return base.includes(credit) ? base : [...base, credit];
}
