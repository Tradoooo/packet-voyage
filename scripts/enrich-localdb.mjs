#!/usr/bin/env node
/**
 * Recompute recorded journeys with the local geolocation database, offline.
 *
 * `voyage read` deliberately knows only the router names: it is the oracle the
 * deployed site is checked against, and a browser cannot read a file from the
 * user's disk. So the effect of a database the user installed cannot be measured
 * through `read`. This script is the other door: it takes journey files, runs
 * the same enrichment the command line runs — with `localDb` and with ZERO
 * requests — recomputes each journey, and writes the result beside the input.
 * `scripts/calibrate.mjs` then counts, unchanged.
 *
 *   node scripts/enrich-localdb.mjs ~/pv-traces/*.enriched.json
 *   node scripts/enrich-localdb.mjs ~/pv-traces/*.json --out /tmp/with-geodb
 *   node scripts/calibrate.mjs /tmp/with-geodb/*.json
 *
 * Nothing here probes the network (`.kiro/steering/probing-ethics.md`): the
 * inputs are recorded files and the enrichment runs offline, so a fetch call
 * would be an error, not a fallback.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import process from 'node:process';
import { parseJourney } from '../packages/schema/src/index.ts';
import {
  creditsFor,
  loadCables,
  loadFixedLinks,
  loadHints,
  loadLandmasses,
  loadProvenance,
} from '../packages/data/src/index.ts';
import { computeJourney } from '../packages/core/src/index.ts';
import {
  GEODB_ATTRIBUTION,
  createMemoryCache,
  enrichHops,
  loadGeodbDb,
} from '../packages/enrich/src/index.ts';

const HOME = process.env.PACKET_VOYAGE_HOME || join(process.env.HOME ?? '', '.packet-voyage');
const GEODB_DIR = join(HOME, 'geodb', 'dbip-city-lite');
const CLOCK = '2026-11-14T00:00:00.000Z';

function parseArgs(argv) {
  const options = { paths: [], out: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') options.out = resolve(argv[++i] ?? '');
    else options.paths.push(argv[i]);
  }
  return options;
}

/** The parsed-trace shape `computeJourney` takes, from a stored journey. */
function toParsed(journey, hops) {
  return {
    format: journey.tool === 'mtr-json' ? 'mtr-json' : 'traceroute',
    family: journey.family,
    protocol: journey.protocol,
    tool: journey.tool,
    target: journey.target,
    hops,
    unknownLines: [],
    warnings: ['recomputed offline with the local geolocation database'],
  };
}

function sourceOf(journey) {
  const src = journey.source;
  if (!src || typeof src.lat !== 'number' || typeof src.lon !== 'number') return null;
  return { lat: src.lat, lon: src.lon, ...(src.label ? { label: src.label } : {}) };
}

function locatedCount(journey) {
  const publicHops = journey.hops.filter((h) => h.class === 'public');
  const located = publicHops.filter((h) => h.location !== null && h.location !== undefined);
  const solid = located.filter(
    (h) => h.location?.level === 'solid' || h.location?.level === 'probable',
  );
  return { public: publicHops.length, located: located.length, solid: solid.length };
}

function creditsForJourney(base, candidates) {
  const used = candidates.flat().some((c) => c?.source === 'geodb');
  return used && !base.includes(GEODB_ATTRIBUTION) ? [...base, GEODB_ATTRIBUTION] : base;
}

async function recompute(journey, localDb, datasets) {
  const enriched = await enrichHops(journey.hops, {
    offline: true,
    consent: { granted: false, services: [], grantedAt: null },
    cache: createMemoryCache(),
    fetch: async () => {
      throw new Error('enrich-localdb makes no request: the database is a local file');
    },
    now: CLOCK,
    ixpPrefixes: [],
    localDb,
  });
  return computeJourney({
    parsed: toParsed(journey, enriched.hops),
    candidates: enriched.candidates,
    source: sourceOf(journey),
    target: journey.target,
    tracedAt: journey.traced_at,
    tool: journey.tool,
    protocol: journey.protocol,
    cables: datasets.cables,
    masses: datasets.masses,
    links: datasets.links,
    hints: datasets.hints,
    credits: creditsForJourney(datasets.credits, enriched.candidates),
  });
}

function outPath(path, options) {
  if (!options.out) return path.replace(/\.json$/, '.localdb.json');
  return join(options.out, basename(path));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.paths.length === 0) {
    console.error('usage: node scripts/enrich-localdb.mjs <journey.json>… [--out <dir>]');
    return 2;
  }
  const localDb = loadGeodbDb(GEODB_DIR);
  if (!localDb) {
    console.error(`no local geolocation database at ${GEODB_DIR}`);
    console.error('get one: voyage data geodb update   or   voyage data geodb import <archive.csv.gz>');
    return 4;
  }
  if (options.out) mkdirSync(options.out, { recursive: true });
  const provenance = loadProvenance();
  const datasets = {
    cables: loadCables(),
    masses: loadLandmasses(),
    links: loadFixedLinks(),
    hints: loadHints(),
    credits: creditsFor(provenance.map((p) => p.id)),
  };

  const totals = { public: 0, before: 0, after: 0, solidBefore: 0, solidAfter: 0 };
  for (const path of options.paths) {
    const journey = parseJourney(readFileSync(resolve(path), 'utf8'));
    const before = locatedCount(journey);
    const recomputed = await recompute(journey, localDb, datasets);
    const after = locatedCount(recomputed);
    const target = outPath(resolve(path), options);
    writeFileSync(target, `${JSON.stringify(recomputed, null, 2)}\n`, 'utf8');
    totals.public += after.public;
    totals.before += before.located;
    totals.after += after.located;
    totals.solidBefore += before.solid;
    totals.solidAfter += after.solid;
    console.log(
      `${basename(path)}: public ${after.public} · located ${before.located} → ${after.located}` +
        ` · solid-or-probable ${before.solid} → ${after.solid}`,
    );
  }
  const pct = (n) => (totals.public === 0 ? '—' : `${((n / totals.public) * 100).toFixed(1)} %`);
  console.log(
    `TOTAL ${options.paths.length} journeys · public ${totals.public} · ` +
      `located ${totals.before} → ${totals.after} (${pct(totals.after)}) · ` +
      `solid-or-probable ${totals.solidBefore} → ${totals.solidAfter} (${pct(totals.solidAfter)})`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  process.exitCode = await main();
}