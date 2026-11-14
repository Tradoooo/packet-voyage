# Validation plan — every claim proven by a log or a file

The specification (§18) requires that each acceptance point is proven by a log or
a file, never by eye or by ear. This table maps each point to the command that
proves it and to the artefact it leaves behind.

| # | Acceptance point (§18) | Command | Artefact |
|---|---|---|---|
| 1 | The six gallery journeys reproduce the summary locked in their reference files | `npx vitest run gallery` | test run log |
| 2 | The worked example of §7.14 gives: at least 6,655 km, 91.7 ms, floor 63.6 ms, inflation 1.44, one light rejection | `npx vitest run packages/core/src/pipeline.test.ts` | test run log |
| 3 | The twenty properties pass and their seeds are recorded | `npx vitest run packages/core packages/enrich` | seeds in the test file headers |
| 4b | The **deployed** site is reachable by everyone and works end to end | `node scripts/verify-live-site.mjs` (anonymous headless Chromium against the public URL) | `docs/evidence/live-site-*.log`: 9 screens rendered, a journey opened, the light cone drawn, 0 request outside the origin |
| 4d | The **demo environment** comes up in one command and proves itself | `pnpm demo` (builds, serves on loopback, runs the bench against it, writes `docs/evidence/demo-*.log` and the demo page), `pnpm demo:stop` | `docs/evidence/demo-*.log`: five steps green, the chain included; the page `http://127.0.0.1:4180/demo.html` lists them |
| 4c | The **deployed** site computes a visitor's own data exactly like the command line does, **at each of its three doors** | `node scripts/verify-user-data.mjs` (anonymous headless Chromium against the public URL, `voyage read --offline` as the oracle) | `docs/evidence/user-data-*.log`: four steps, each with its own proof — pasted trace, imported `journey.json`, share link (nine banner numbers equal to the oracle) and catalogue (13 blocks, the data named on screen); `docs/evidence/user-data-*.json` is the machine-readable form; 0 request outside the origin |
| 4 | The site makes no request after load | `node scripts/verify-no-request.mjs` (real Chromium, full visit) and `node scripts/guards/no-network.guard.mjs` | `docs/evidence/no-request-2026-11-11.log`: "0 external request(s) after load — 12 loopback asset(s)", CSP recorded |
| 5 | `--offline` opens no outbound connection | `node packages/enrich/src/offline.test.ts` via vitest | test asserting zero `fetch` calls |
| 6 | No enrichment request carries a non-public address | `npx vitest run packages/enrich` (VOY-P-04) | test log |
| 7 | `voyage trace` refuses a range, a list, an argument starting with a dash | `node apps/cli/bin/voyage.mjs trace 192.0.2.0/24; echo $?` | exit code 2 recorded in the test log |
| 8 | A shared journey holds no private address, no access network, no departure finer than the country | `node scripts/guards/fixture-privacy.guard.mjs` | guard log |
| 9 | The vocabulary check finds no forbidden wording in labels or in the journey log | `node scripts/guards/vocabulary.guard.mjs` | guard log |
| 10 | Every vendored dataset has a provenance sheet and the sources page lists them all | `node scripts/guards/data-licence.guard.mjs` | guard log + `docs/SOURCES.md` |
| 11 | The public repository holds no TeleGeography or PeeringDB data | `node scripts/guards/data-licence.guard.mjs` (refuses those origins) | guard log |
| 12 | `traceroute`, `tracert` (two languages at least) and `mtr` traces are read without loss | `npx vitest run packages/core/src/parse` | test log over the Annexe B fixtures |
| 13 | The roadmap table contains every hop and every segment of the map | `node scripts/guards/roadmap-parity.guard.mjs` + `npx vitest run apps/web` | guard log + test log |
| 14 | The whole journey can be walked with the keyboard | `npx vitest run apps/web` (keyboard navigation test) | test log |
| 15 | The `probe-guard` hook blocked at least one attempt during the build | `KIRO_JOURNAL.md` entry + `scripts/hooks/probe-guard.mjs` self-test | journal line |
| 16 | `.kiro` is present at the root and not git-ignored; the MIT licence is detected | `node scripts/guards/kiro-tracked.guard.mjs` | guard log |
| 17 | A file stays under 500 lines and a function under 50 lines | `node scripts/guards/limits.guard.mjs` | guard log |
| 18 | The site stays inside its weight budget | `node scripts/guards/bundle-size.guard.mjs` (after `pnpm build`) | guard log with measured sizes |

## One command for everything

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build && node scripts/guards/run-all.mjs
```

CI runs exactly this on the self-hosted runners, inside a five-minute budget
(`.github/workflows/ci.yml`, guarded by `.github/workflows/ci-budget.yml`).

## Numbers to record before the freeze

| Measure | Target | Measured | How it is measured |
|---|---|---|---|
| Parse + compute a 30-hop journey | < 200 ms | **30.6 ms** | `npx vitest run packages/core/src/pipeline.perf.test.ts` (asserts the bound, prints the number) |
| Site application code, compressed | < 350 kB | **191.5 kB** (JS + CSS, gzip) | `node scripts/guards/bundle-size.guard.mjs` after `pnpm build` |
| Vendored data, compressed | < 1.5 MB | **116 kB** (736 kB raw) | same guard; `packages/data` provenance sheets |
| The §7.14 worked example | at least 6,655 km · 91.7 ms · 63.6 ms · 1.44 · 1 rejection | **6,654 km · 91.7 ms · 63.7 ms · 1.44 · 1 rejection** | `npx vitest run packages/core/src/pipeline.test.ts` |
| The same trace, offline, from the router names alone | most hops located | **8 hops located out of 10, 1 gap** | `voyage read docs/examples/lyon-ashburn.txt --from Lyon --offline` |
| The twenty properties | all green, seeds recorded | **VOY-P-01 … VOY-P-20 green** | `npx vitest run packages apps` |
| Enrichment with a warm cache | < 3 s | `TODO(measure)` — needs a live consent and the RIPE services; the offline equality is proven instead by VOY-P-19 | `npx vitest run packages/enrich` |
| Public hops located at `solid` or `probable` level on the gallery | ≥ 70 % | **76.7 %** (33 of 43; `with-gaps` deliberately drags it down at 42.9 %) | `node scripts/calibrate.mjs` |
| The same ratio on thirty real traces | ≥ 70 % | **34.9 %** — 15 of 43 public hops located across **8** real traces (not thirty), run 2026-11-13 under the owner's written exception; the structural ceiling with router names alone is **72.1 %** (31 of 43: twelve hops carry no rDNS at all). See "The 70 % indicator on real traces" below. | `node scripts/calibrate.mjs ~/Bureau/pv-traces/*.enriched.json` |
| The trace tool is detected and wrapped, never through a shell | `mtr --json`, else `traceroute`, else `tracert` | **`tool: mtr-json`** on a loopback trace; ranges refused with exit 2, missing tool with exit 3, unreadable input with exit 5 | `node apps/cli/bin/voyage.mjs trace 127.0.0.1 --out /tmp/j.json` and `npx vitest run apps/cli/src/probe.test.ts` |
| False locations rejected by the light | counted per journey | shown in every journey summary and on each hop card | gallery journeys |

## The 70 % indicator on real traces — measured, and why it cannot pass as written

Eight real traces exist now (`~/Bureau/pv-traces/`, run 2026-11-13 under the
owner's written exception in `.kiro/steering/probing-ethics.md`, hosts named in
`.kiro/probe-allowlist.txt`, raw files kept outside the repository). Measured
with `node scripts/calibrate.mjs`:

```
TOTAL 8 journeys · 15/43 public hops located (34.9 %), 25.6 % at solid or
probable · 3 rejected by light · 28 gaps · target 70 %   → NOT MET
```

Three facts, each of them counted rather than argued:

1. **Twelve of the 43 public hops carry no rDNS name at all** (28 %). Consent
   was granted before the first probe, so the resolver was asked; those networks
   simply publish no PTR record. No name-based source can locate a hop without a
   name, so the ceiling for `name-hint` alone on this corpus is 31/43 = **72.1 %**
   — the target is only reachable if almost every named hop resolves to a city.
2. **Sixteen named hops are unlocated because their operator's naming convention
   is not in the vocabulary** (`ae-32.a01.parsfr05.fr.bb.gin.ntt.net` — NTT glues
   city and country into one token; `bsco01parth2-akamai-pni101parth2…` — Akamai
   does the same; `wifirst.dc3-2.hopus.net`, `…IPYX-334382-002-ZYO.zip.zayo.com`,
   `l.root-servers.net`, `time-a-wwv.nist.gov`). `findHints` matches a token
   against a table code or city name exactly, after stripping trailing digits, so
   `parsfr` matches nothing while `cdg12` matches CDG. Extending the table or the
   matcher is a real lever, but each addition must be a documented public fact,
   never a guess about an operator's internals.
3. **The one source that could locate a nameless hop has no data path.** `geodb`
   is capped at weight 0.3 (§7.8 bands are 0.80 / 0.50), so a hop located by
   `geodb` alone lands in `uncertain` and does not count towards the indicator
   even when the database is present. And the database is never present: nothing
   in the CLI downloads DB-IP Lite or IPinfo Lite — `packages/enrich/src/localdb.ts`
   can read a JSON file, but no code path produces one. `docs/SOURCES.md` and
   `.kiro/steering/data-licences.md` said the tool downloads it on first use; they
   now say what the code does instead.

So the honest reading is: **34.9 % measured against a ≥ 70 % target, and the
target as written is unreachable on real traces** while the only source able to
cover nameless hops scores below the band the indicator counts. This is reported,
not fixed silently (§0: the contract wins). Two decisions are the owner's:

- **(a) feed `geodb`** — implement the download the docs promised (DB-IP Lite,
  CC BY 4.0, into the user's cache, never the repository, with the attribution
  line the licence requires). It raises coverage of nameless hops but still only
  reaches `uncertain` at weight 0.3.
- **(b) change the indicator** — either count `uncertain` in a separate ratio, or
  set the real-trace target below the gallery one, with the reason written next to
  the number. That is a §18 change and the contract must be amended, not the
  measurement bent.

Until one of them is taken, the gallery figure (76.7 %) stays what the project
claims, and the real-trace figure stays what this file records: 34.9 %.
