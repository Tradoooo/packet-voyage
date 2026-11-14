# Packet Voyage

> A network diagnostic from 1987, stitched to geography.

You type a site address. Your request leaves your box, crosses cities, enters an
exchange point, dives under an ocean and comes out on another continent — all in
under a tenth of a second. **Packet Voyage** makes that trip visible: it takes
the output of a `traceroute`, puts every hop on a world map, lists the submarine
cables **compatible** with each crossing, and says honestly what is measured,
what is inferred and what is assumed.

[![CI](https://github.com/Tradoooo/packet-voyage/actions/workflows/ci.yml/badge.svg)](https://github.com/Tradoooo/packet-voyage/actions/workflows/ci.yml)
[![Licence MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](./LICENSE)

Live site (no install, no account, no request): <https://tradoooo.github.io/packet-voyage/>

### Try it in thirty seconds

1. Open the site, click **Lyon to Ashburn, across the Atlantic**: the route is
   stitched hop by hop, the Atlantic crossing lights up its compatible cables, and
   hop 4 shows a geolocation database contradicted by the speed of light.
2. Or paste a `traceroute` you already have: the site computes the journey locally,
   from the hints in the router names, without sending anything anywhere. If the
   paste needed cleaning (a byte-order mark, tabs), the site says so.
3. Under the delay timeline, the **insights panel** answers the questions the map
   cannot: the distance bounds, where the delay goes, which physical media can
   explain it, and what the same journey looked like in 1987. Next to it, the
   **export panel** hands over the journey as GeoJSON or as a redaction-gated
   incident report; the compare view states the **diff** between two routes.
4. Or trace your own route with the command line:

```bash
git clone https://github.com/Tradoooo/packet-voyage && cd packet-voyage
pnpm install && pnpm build
node apps/cli/bin/voyage.mjs trace example.org       # one host, never a range
node apps/cli/bin/voyage.mjs read trace.txt           # a trace you already have
node apps/cli/bin/voyage.mjs explain journey.json --year 1987
#   distance bounds, where the delay goes, which media fit, and what 1987 looked like
node apps/cli/bin/voyage.mjs export journey.json --format geojson   # for QGIS, d3, anything GIS
node apps/cli/bin/voyage.mjs export redacted.json --format markdown # a ticket-ready report
node apps/cli/bin/voyage.mjs compare v4.json v6.json  # two journeys, facts only
node apps/cli/bin/voyage.mjs share journey.json       # redact, then share a link
node apps/cli/bin/voyage.mjs data geodb status         # local geolocation database
node apps/cli/bin/voyage.mjs data geodb update         # download DB-IP Lite (consent required)
# or: data geodb import <archive.csv.gz> — use a local copy, no network request
```

> **The npm package `packet-voyage` is not published yet** (`npm view packet-voyage`
> returns 404), so `npx packet-voyage` does not work. Build from the clone as above.

## Three decisions that shape everything

1. **A browser cannot trace a route.** It has no raw packets and no hop counter.
   The product is therefore two halves: a command-line tool that wraps your
   machine's `traceroute`, and a static site that displays a journey (pasted,
   dropped, or picked from the gallery). The hosted site never sends a probe.
2. **Nobody can know which cable a packet took.** No measurement says so. The
   product speaks of **compatible** cables, ranked by plausibility — never of a
   cable that was "taken". That restraint is the point, not a weakness.
3. **Light is the lie detector.** A hop answering in 9.6 ms from Lyon cannot be
   in Ashburn, whatever a geolocation database says: in 9.6 ms round trip,
   nothing travels further than 1,439 km. Every physically impossible location is
   rejected — and the rejection is shown.

## Three levels of certainty

| Level | What belongs to it | On screen |
|---|---|---|
| **Measured** | hop address, delays, loss, hop order | bold figures, solid dot |
| **Inferred** | network, city, country, exchange point, segment nature | value + its level (solid / probable / uncertain) + its sources |
| **Assumed** | the drawn path, compatible cables, real distance | dotted line, conditional wording, list of possibilities |

No value is ever displayed without its level.

## Layout

```
packages/core/     pure computation: parse, addr, hints, geo, envelope,
                   locate, segments, cables, metrics, story, redact, share
packages/schema/   Zod schemas of journey.json, provenance sheets, datasets
packages/enrich/   Node-only adapters: rDNS, RIPEstat, IPmap, PeeringDB, cache, consent
packages/data/     datasets + provenance sheets (own licence notice: ODbL, public domain)
apps/cli/          the `voyage` command (npm package `packet-voyage`)
apps/web/          the static site (Vite + React + d3-geo canvas)
apps/mcp/          optional MCP server: trace_host, read_trace, explain_journey, compare_journeys
gallery/           six redacted sample journeys
.kiro/             steering, specs, hooks, agents, skills — the build was driven from here
docs/              CONTRACTS.md (interfaces) and fr/CAHIER-DES-CHARGES.md (specification)
docs/REAL-DATA.md  the real-data procedure: who may probe, how, and what may enter the repo
```

## Honesty, privacy, licences

- **Nothing leaves your machine without consent.** The tool names the services
  (system resolver, RIPE IPmap, RIPEstat, PeeringDB), says exactly what is sent
  (public addresses of the route only), and remembers, shows and revokes the
  consent. `--offline` sends nothing at all.
- **Private and access-network addresses are never located nor sent.** Anything
  shared is redacted first: your address, your box and your access network are
  removed, and the departure is coarse-grained to the country by default.
- **The hosted site makes zero network request after load.** Gallery journeys are
  pre-computed; a pasted trace is computed locally from the hints in the names.
- **Data licences are separate from the code.** Code is MIT; the data package
  carries its own notice (ODbL for OpenStreetMap-derived cables, public domain
  for Natural Earth). Every vendored dataset has a provenance sheet, and a CI
  guard refuses a dataset without one. TeleGeography and PeeringDB data are
  never redistributed here.

## Not a scanner

One host per command, no address range, no port discovery, no continuous
measurement, no return path (a traceroute only sees the way there). Through the
MCP server: one trace at a time, at least five seconds between two traces, at
most twenty per session, and your approval on every call.

## Measured, not claimed

| | |
|---|---|
| The §7.14 worked example | at least 6,654 km · 91.7 ms · light floor 63.7 ms · inflation 1.44 · 1 location rejected by the light |
| The same trace, offline, from the router names alone | 8 hops located out of 10, no request sent |
| Parse + compute a 30-hop journey | 30.6 ms (target: under 200 ms) |
| Site code, compressed | 191.5 kB of JS + CSS (budget 350 kB) |
| Vendored data, compressed | 116 kB: 169 cables, 36 landmasses, 212 name hints, 9 fixed links (budget 1.5 MB) |
| Tests | 357 over 52 files, including the twenty properties `VOY-P-01` … `VOY-P-20` |

`docs/VALIDATION.md` maps every acceptance point of the specification to the
command that proves it.

## What this tool refuses to do

- **No range, no list, no scan.** One host per command; a CIDR prefix, a span or
  a comma-separated list is refused with exit code 2.
- **No probe from the hosted site.** The browser cannot trace a route, and the
  site does not try: `connect-src 'none'` in its CSP, and a Playwright log in
  `docs/evidence/` proves zero external request during a full visit.
- **No continuous measurement.** One trace, on demand, by a human.
- **No return path.** A traceroute only sees the way there; the tool never
  pretends otherwise.
- **No locating people.** Cities at best, never an address; the departure is
  coarse-grained to the country in everything that is shared.
- **No agent probing while building.** `.kiro/hooks/probe-guard.json` refuses any
  shell command in which an agent would probe the Internet; it blocked
  `traceroute -n example.org` and `mtr -n 8.8.8.8` during this build (exit 2,
  recorded in `KIRO_JOURNAL.md`).

## Reproduce the numbers

```bash
pnpm test                                             # 364 tests, 20 properties
npx vitest run packages/core/src/pipeline.test.ts      # the §7.14 acceptance
npx vitest run packages/core/src/pipeline.perf.test.ts # 30 hops in 30.6 ms
node scripts/guards/run-all.mjs                        # the eight project guards
node scripts/guards/selftest.mjs                       # the guards test themselves
node scripts/calibrate.mjs                             # located-hop ratio (76.7 %)
node scripts/verify-no-request.mjs                     # the browser proof
WRITE_GALLERY=1 npx vitest run gallery                 # regenerate the gallery
```

`docs/VALIDATION.md` maps every acceptance point of the specification to the
command that proves it.

## Development

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test
pnpm build            # cli bundle + static site
node scripts/guards/run-all.mjs
```

Guards are also Kiro hooks: the same rule protects the agent while it writes and
the pull request while it merges. `scripts/hooks/probe-guard.mjs` is the one worth
watching — it refuses any shell command in which an agent would probe the
Internet, because a project about measurement ethics is built under its own rule.

CI runs on self-hosted runners and answers in five minutes at most. Mergify is
the only merge pilot; a conflict is resolved by an agent, not by a human.

## Sources

See `docs/SOURCES.md` and the provenance sheets in `packages/data/provenance/`.
Thanks to OpenStreetMap contributors, Natural Earth, the RIPE NCC (IPmap,
RIPEstat, Atlas), DB-IP and PeeringDB.
