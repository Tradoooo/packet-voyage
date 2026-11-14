# Kiro Journal — Packet Voyage

Every line of this journal records **a spec (or lot), a task, a duration and
what was learned** — that is the deal of §14.3/§14.6: the story of the build
must be provable with numbers, not adjectives. Two kinds of entries live
here:

1. **Narrative entries** (below) — written by hand or by an agent at the end
   of a work session. Anything not actually measured in a real Kiro session
   yet is marked `TODO(measure)` and stays that way until measured: no
   invented credits, no invented durations.
2. **Automated rows** (the table at the very bottom) — appended by the
   `journal-reminder` hook (`scripts/hooks/journal-reminder.mjs`) after each
   spec task: `| timestamp | spec | task | duration |`. Durations the hook
   cannot know stay `-` until filled.

---

## 2026-11-11 — project skeleton and lot split

- **Surface**: IDE (spec/steering authoring) + CLI (workspace scaffolding).
- **What was done**: pnpm monorepo laid out per CONTRACTS §1: `packages/{schema,core,enrich,data}`,
  `apps/{cli,web,mcp}`, `scripts/{guards,hooks,data}`, `gallery/`, `.kiro/`,
  `docs/`. `packages/core/src/settings.ts`, `index.ts` and `pipeline.ts`
  written first (L0) so every lot codes against a fixed seam.
- **Learned**: writing `settings.ts` and the pipeline stub *before* splitting
  the lots removes nearly all cross-lot negotiation — the §7.13 defaults
  (299.79 / 204 / 50 km slack / 100 km fusion radius / bands 0.6/0.3) are the
  only physics knobs and they now have one owner.
- **Duration / credits**: `TODO(measure)`.

## 2026-11-11 — CONTRACTS.md frozen

- **Surface**: IDE.
- **What was done**: `docs/CONTRACTS.md` written as the single source of
  truth: ground rules (§0), workspace map and lot ownership (§1), data model
  (§2), closed lists — candidate sources with starting weights, certainty
  levels, imposed vocabulary (§3), settings (§4), binding module APIs
  §5.1–§5.13, the pipeline order (§6), definition of done (§7).
- **Learned**: naming the closed lists (12 candidate source ids, 4 rejection
  reasons, 4 confidence levels) up front is what lets 13 lots run in parallel
  without a single shared enum drifting. "The contract wins; if the contract
  is wrong, report, do not silently change" (§0) has already avoided two
  silent signature edits.
- **Duration / credits**: `TODO(measure)`.

## 2026-11-11 — parallel lots in flight

- **Surface**: IDE + CLI, one agent per lot (L1 parse/addr, L7 data, L12
  guards/hooks, L11 this workspace…).
- **What was done**: lot ownership per CONTRACTS §1. Observed while writing
  L11: `scripts/hooks/*.mjs` (probe-guard, claims-guard, data-licence-guard,
  light-properties, fixture-privacy-guard, journal-reminder) and
  `scripts/guards/*.guard.mjs` already exist (L12), and
  `.kiro/probe-allowlist.txt` was placed by its owning lot — the hook JSONs
  of L11 point at those real paths, nothing is dangling.
- **Learned**: the guard/hook duplication (same logic as CI check and as Kiro
  hook entry point, §14.3) is deliberate: file triggers only fire on
  agent-made changes, so every hook must also exist in CI to cover human
  edits. One implementation, two entry points (`scripts/hooks/<name>.mjs`
  wraps `scripts/guards/<name>.guard.mjs`).
- **Duration / credits**: `TODO(measure)`.

## 2026-11-11 — CI shell

- **Surface**: CLI.
- **What was done**: `scripts/guards/run-all.mjs` discovers and runs every
  `*.guard.mjs` (vocabulary, data-licence, fixture-privacy, limits,
  no-network, kiro-tracked, roadmap-parity, bundle-size) with **no network
  access needed**; `scripts/data` builders run `--from-cache` for the same
  reason. Workspace checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`
  (vitest, colocated tests, fast-check properties with fixed seeds).
- **Learned**: `kiro-tracked.guard.mjs` (`.kiro/` present, not git-ignored,
  MIT licence detected) is acceptance item §18 — the workspace itself is
  under CI, so the Kiro strategy cannot silently rot.
- **Duration / credits**: `TODO(measure)`.

## 2026-11-11 — L11: the `.kiro/` workspace written

- **Surface**: IDE (this lot).
- **What was done**: 11 steering files with their §14.2 inclusion rules;
  12 specs × (requirements EARS + design + tasks) with the §14.1 method
  declared in each header; 6 hook JSONs (v1 shape of §14.3, all `command`
  actions — no credit cost) pointing at the existing `scripts/hooks/*.mjs`;
  3 agents (`geo-reviewer`, `claims-reviewer` read-only; `data-curator`
  write-scoped to `packages/data/**` + `scripts/data/**` only); 2 skills
  (`latency-investigation`, `property-hunt`); `.kiro/settings/mcp.json` per
  CONTRACTS §5.11 — exact field names to confirm against the Kiro docs at
  use time (annexe D), noted in `.kiro/settings/README.md`.
- **Learned**: `locator` is where requirements analysis must watch hardest —
  the hop bound's `+ slackKm` and the triangle bound's "tolerance included"
  are two different tolerances and the spec text (§7.6) does not name the
  second one numerically; recorded as an open point for the locator session.
- **Duration / credits**: `TODO(measure)` — and per §14.6, the real cost of a
  full requirements-first spec is to be measured on `trace-parsers`.

## 2026-11-12 — a probe the workshop should never have made, self-reported

- **Surface**: CLI, from `/home/baptiste/Bureau/packet-voyage` — run by the
  agent `b` under the ZeroClaw runtime, **not** the Kiro IDE.
- **What happened**: two real probes of the public Internet, spawned by the
  product itself:
  1. ~11:44Z — `timeout 240 pnpm voyage trace example.org --offline --cycles 2
     --json --out /tmp/real-trace-1.json`, which spawned `mtr --json -n -c 2
     example.org`: 8 hops, public addresses 37.49.238.59, 141.101.67.142,
     141.101.67.157, 172.66.157.237, and the local topology 10.97.103.107,
     10.188.0.1, 172.22.3.1, 172.21.30.114.
  2. ~11:48Z — `timeout 300 pnpm voyage trace www.google.com --offline
     --cycles 2 --out /tmp/real-google.json`: 6 hops, 0 located.
- **Why nothing blocked it**: two independent failures, both real.
  1. `probe-guard` is a Kiro `PreToolUse` hook (`.kiro/hooks/probe-guard.json`):
     it does not execute in another agent runtime. The rule existed; the
     enforcement did not.
  2. A hole independent of any runtime: `extractCommandTargets()` in
     `scripts/hooks/probe-guard.mjs` looked only for probe binaries (`mtr`,
     `traceroute`, `tracert`, `ping`, `nmap`, `tracepath`) in the command line.
     `pnpm voyage trace example.org` contains none of them — so **even under
     Kiro, the hook would have let the indirect probe through**. Verified
     before the fix: `checkProbeCommand(root, 'pnpm voyage trace example.org')`
     returned `allowed: true`.
- **What left the machine**: the probes themselves (ICMP/UDP to the two hosts,
  2 cycles each). No third-party enrichment: both ran `--offline` with consent
  `not granted`, so nothing went to the resolver, RIPE IPmap, RIPEstat or
  PeeringDB — table 6.4 of `privacy.md` was not touched.
- **What was done with the output**: `/tmp/real-trace-1.json` and
  `/tmp/real-google.json` were deleted in the same session; never `git add`ed,
  never committed. No hop address from them appears anywhere in the repo
  beyond this incident record.
- **Corrective action**:
  1. `probe-guard.mjs` now detects the product's own `trace` subcommand
     (`voyage trace`, `pnpm voyage trace`, `npx packet-voyage trace`,
     `node apps/cli/bin/voyage.mjs trace`, options interleaved) and applies the
     **same** allowlist to its host — one implementation, `isTargetAllowed` /
     `parseAllowlist` reused, no duplication. The file-based subcommands
     (`read`, `explain`, `export`, `compare`, `share`, `data`, `consent`,
     `mcp`) stay allowed.
  2. `scripts/guards/selftest.mjs` (CI, job `ci-quality`, "Guard self-tests")
     now covers the indirect probe: refusals and allowlist acceptances.
  3. `probing-ethics.md` rule 1 names the indirect probe, and a new "Outside
     Kiro" section gives every agent, in any runtime, the portable self-check
     (pipe the command into `node scripts/hooks/probe-guard.mjs`; exit 2 =
     refused).
  4. `docs/REAL-DATA.md` records the only legitimate route to real data: the
     human, one host at a time, at their request.
- **Fact 1 of §14.6 is unchanged**: these two probes were *not* blocked, so
  they add no row to the block count and none appears in the automated table
  below — a block that did not happen must not be counted.
- **Learned**: a steering rule enforced only by an editor hook is not enforced
  for the agents that run elsewhere. The control must live where *every* agent
  passes — the repo itself (portable guard + CI self-tests), not one IDE's
  hook directory. And the guard must model what the command *does* (spawn a
  probe), not only which binary name it spells.
- **Duration / credits**: `TODO(measure)`.

---

## 2026-11-13 — the real traces, at the owner's request, and the bug they uncovered

- **Surface**: CLI and site, from `/home/baptiste/Bureau/packet-voyage` — run by
  the agent `b` under the ZeroClaw runtime, **not** the Kiro IDE.
- **What the owner decided**: the project reserved probing for the human, so
  the calibration traces had never been produced and the demo had always run on
  the synthetic example (`www.example.org`, RFC 5737 addresses). On
  2026-11-13 the owner asked for the agent to produce them: *"fait toi, je
  veux que tu fasses tout sauf vidéo et submission"*. The allowlist is
  therefore extended — **eleven named hosts, in writing**, in
  `.kiro/probe-allowlist.txt` — and `voyage consent grant` was run before the
  first probe. The guard was not worked around: it was consulted (exit 0,
  `node scripts/hooks/probe-guard.mjs`), it now permits those hosts and
  nothing else, and the raw traces stay outside the repository
  (`~/Bureau/pv-traces/`, country-redacted copies only).
- **What was measured** (`mtr --json -c 3`, from Lyon, 2026-11-13):
  - `time.nist.gov` — 9 hops, Paris (NTT) → Denver (Lumen/Level3) → NIST,
    **125.9 ms** measured;
  - `mirror.csclub.uwaterloo.ca` — 24 hops, **Paris → London → Newark →
    Montreal → Toronto → Waterloo**, 101.7 ms, four countries;
  - `www.itu.int` — 17 hops, Paris → Geneva.
- **The bug the real traces uncovered (this is the important part).** The
  command line enriches a trace before computing it, and the enriched
  candidates **replaced** the candidates of the router names:
  `computeJourney` did `input.candidates ?? hintCandidates(...)`. The
  enrichment knows a handful of networks; the names know the city. So **every
  real trace came out unlocated**: `time.nist.gov` gave *1 located hop, 0 km,
  no light floor*, while the same trace pasted into the site — which computes
  without candidates — located it. The example of §7.14 hid the bug because
  its fixture wrote the name-hint candidates by hand.
  - The fix adds the names to the enrichment's candidates instead of letting
    them replace them (`packages/core/src/pipeline.ts`).
  - Measured on the same trace, before → after: located hops **1 → 3**,
    distance **0 → 8,197 km**, light floor **0 → 80.4 ms**, inflation
    **none → ×1.57**, countries **FR → FR, US**, and the crossing gained its
    compatible cables (Tangerine, Yellow, IRIS, CeltixConnect-1, Havfrue/AEC-2
    and 62 more) — the product's headline claim, on a real route, for the
    first time.
  - The gallery is regenerated accordingly: `ocean-crossing` now locates
    **9 hops out of 10** instead of 8, one gap fewer; the distance, the floor,
    the inflation and the rejection are unchanged.
- **A second defect, found by the bench on a real journey**: the share step
  compared the site with the oracle of the journey *before* redaction, while
  the visitor opens the journey *after* it. The redaction drops the
  departure's coordinates, so a country only the departure carried is
  legitimately gone from the shared journey. The bench now asks the command
  line for the redacted journey and compares the site with **that** — the
  same data on both sides.
- **What left the machine**: the probes themselves, and — with the owner's
  consent granted — the reverse-DNS lookups of the *public* hop addresses, the
  RIPE IPmap and RIPEstat queries for them, and one PeeringDB IXP-prefix
  directory download. No private address was ever sent (table 6.4 of
  `privacy.md`): the access-network hops (10.97.103.107, 10.188.0.1,
  172.22.3.1, 172.21.30.114) were skipped before any lookup.
- **Credit for the fix**: `packages/core/src/pipeline.ts`,
  `packages/core/src/pipeline.test.ts` (three new tests), `gallery/` (regenerated),
  `scripts/verify-user-data.mjs`, `scripts/demo.mjs` (`--journey`).

---

## 2026-11-14 — the 70 % indicator, measured on the real traces, and three sentences corrected

- **Surface**: docs only (`docs/VALIDATION.md`, `docs/SOURCES.md`,
  `docs/REAL-DATA.md`, `.kiro/steering/data-licences.md`,
  `.kiro/steering/probing-ethics.md`, `.kiro/probe-allowlist.txt`,
  `KIRO_JOURNAL.md`). No product code touched; no probe run today — the eight
  traces of 2026-11-13 were read offline with `scripts/calibrate.mjs`.
- **What was measured** (`node scripts/calibrate.mjs ~/Bureau/pv-traces/*.enriched.json`):
  **15 of 43 public hops located = 34.9 %**, 25.6 % at `solid`/`probable`,
  3 rejections by light, 28 gaps — against a §18 target of ≥ 70 %. The gallery
  stays at 76.7 % (33 of 43). The `TODO(measure)` row is now a number.
- **Why it cannot pass as written**, three counted facts:
  - **12 of the 43 public hops carry no rDNS name at all** (28 %). Consent was
    granted before the probes of 2026-11-13, so the resolver was asked; those
    networks publish no PTR record. Ceiling for `name-hint` on this corpus:
    31/43 = **72.1 %**.
  - **16 named hops are unlocated because the token is not in the vocabulary**:
    NTT and Akamai glue city and country into one fragment
    (`ae-32.a01.parsfr05.fr.bb.gin.ntt.net`, `bsco01parth2-akamai-pni101parth2`),
    `findHints` compares a token to a code or a city name exactly after
    stripping trailing digits, so `cdg12` matches CDG and `parsfr` matches
    nothing. Also unlocated with a name in hand: `wifirst.dc3-2.hopus.net`,
    `…IPYX-334382-002-ZYO.zip.zayo.com`, `l.root-servers.net`,
    `time-a-wwv.nist.gov`, `mirror.csclub.uwaterloo.ca`.
  - **The one source able to locate a nameless hop has no data path.** `geodb`
    weighs 0.3 (§7.8 bands 0.80 / 0.50), so it lands in `uncertain` and does not
    count towards the indicator even when present — and it is never present:
    `packages/enrich/src/localdb.ts` can read a JSON database, no code produces
    one. `docs/SOURCES.md` and `data-licences.md` said the tool downloads DB-IP
    Lite on first use. It does not. Both now say what the code does.
- **Three corrections of what the repository claimed**, each one checked against
  the files rather than remembered:
  - "seven named hosts" → the allowlist names **eleven** hosts, and **eight**
    were probed (`www.ietf.org`, `www.bbc.co.uk`, `cloudflare.com` are permitted
    and unused); the allowlist's own comment said "the four hosts below" above an
    eleven-host list.
  - `docs/REAL-DATA.md` said "the human, and nobody else — no agent" while
    `probing-ethics.md` carried the owner's written exception of 2026-11-13: the
    two documents contradicted each other. `REAL-DATA.md` now names the exception.
  - the DB-IP / IPinfo rows above.
- **What is NOT done, and is the owner's**: two decisions hang — feed `geodb`
  (implement the download the docs promised, CC BY 4.0, into the user's cache,
  never the repository, attribution required) or amend the §18 indicator
  (separate ratio for `uncertain`, or a lower real-trace target with the reason
  written next to the number). Reported, not fixed silently (§0: the contract
  wins).
- **Also found, unrelated to probing**: the branch `feat/npm-published`
  (commit `dd8c1ac`, 2026-11-13 19:35) states in the README, the catalogue and
  the i18n that "the npm package `packet-voyage` is published" and flips the test
  that used to forbid `npx` so it now requires it. Checked today: the registry
  answers **404** for `packet-voyage` (and for `@tradoooo/packet-voyage`,
  `@packet-voyage/cli`, `packet-voyage-cli`), and `npm whoami` answers **401**
  with the token in `~/.npmrc`. The branch is local, never pushed, no PR opened.
  The deployed site still shows the honest older text. Staging the package works
  (`node scripts/publish-package.mjs` → `dist/npm/packet-voyage`, five files, no
  `workspace:` link), so the only missing step is a working `npm login`, which
  belongs to the owner.
- **Guards after the edits**: `node scripts/guards/run-all.mjs` → 8/8 ok
  (vocabulary over 172 files, data-licence over 4 datasets, limits over 364
  files, fixture-privacy over 131, kiro-tracked, no-network over 194,
  roadmap-parity, bundle-size 264.8 kB gzip).
- **Duration / credits**: `TODO(measure)` — this build does not run under the Kiro
  IDE, so the hook cannot know the duration (§14.6: no invented credits).

## 2026-11-14 (suite) — the geolocation database gets a data path, and the indicator splits

- **Surface**: CLI and enrichment (`packages/enrich`, `apps/cli`), one
  measurement script, the docs and the contract. No probe run today: the eight
  traces of 2026-11-13 were read offline, and the archive came from a single
  download of a public dataset.
- **What the owner decided**: of the two decisions the morning entry left open,
  both — « 1 et 2 et 3 »: feed `geodb` **and** amend the indicator, plus the npm
  page. Nothing was chosen for the owner; both were done, and the numbers are
  reported as they came out.
- **What was measured before writing any code** (`~/Bureau/pv-traces/`, DB-IP
  City Lite 2026-11, 7 777 727 ranges): **21 of the 27** public hops without a
  location do exist in the database, with a city and coordinates. Six do not
  (`141.101.67.173`, `37.77.36.8`, `37.77.32.11`, `84.116.132.177`,
  `141.101.67.159`, `104.18.21.81`). That is why the path was worth building,
  and why it was not guessed at.
- **The archive is not what the docs said.** 85.7 MB compressed, not the ~20 MB
  the vendor's page suggests; converted, it lands at **89.2 MB in 299 gzip
  shards** under `~/.packet-voyage/geodb/dbip-city-lite/`. The tool therefore
  states the size before fetching, refuses anything above a cap
  (`--max-mb`, default 256 MB), and offers `data geodb import <archive>` for a
  copy the user already has — the same conversion, **zero request**.
- **A consent that does not name the download does not cover it.** The record
  granted on 2026-11-13 lists `dns, ripestat, ipmap, peeringdb`; `update`
  refuses until the owner re-grants with DB-IP Lite named. That is a refusal,
  not a workaround: the download path is implemented, tested and ready, and it
  has not been run on this machine.
- **Measured through the product, offline, on the same eight traces**
  (`node scripts/enrich-localdb.mjs ~/Bureau/pv-traces/*.enriched.json --out
  /tmp/pv-geodb` then `node scripts/calibrate.mjs /tmp/pv-geodb/*.json`):

  | | sans la base | avec la base |
  |---|---|---|
  | hops publics localisés, tout niveau | 15/43 — 34,9 % | **37/43 — 86,0 %** |
  | localisés `solide` ou `probable` | 11/43 — 25,6 % | 11/43 — 25,6 % |
  | trous | 28 | **6** |
  | rejets par la lumière | 3 | **8** |

  The two lines that did not move are the point: `geodb` weighs 0.3, under the
  0.50 `probable` band, so it situates a hop without confirming it. Five of the
  twenty-two answers it gives are rejected by the light and counted as such.
- **The contract changed, the measurement did not.** §18 now carries three
  rows: the gallery (≥ 70 %, measured 76,7 %), real traces at
  `solide`/`probable` (descriptive, 25,6 %, with the reason next to it), and
  real traces at any level (≥ 70 %, measured 86,0 %). A single ratio could not
  tell « situé » from « confirmé ».
- **Two repairs the path needed**, each one found by running it rather than by
  reading it: `createJsonNetworkDb` scanned linearly and could not express a
  range (`start`/`end`), so it now searches `(lo, hi)` bounds and answers the
  narrowest row; and `DatasetError` / `CliError` used constructor parameter
  properties, which plain Node cannot load — the measurement script needs that.
- **The npm package, still not published.** `npm view packet-voyage` answers
  **404**; `npm whoami` answers **401** with the token in `~/.npmrc`. The
  staging works (`node scripts/publish-package.mjs` → five files, 219.5 kB,
  no `workspace:` link) and `npm publish --dry-run` passes, so the only missing
  step is an authenticated owner. The local branch `feat/npm-published`
  (`dd8c1ac`) claims the package is on npm and inverts the test that forbids
  `npx`: it stays unmerged, because that is the defect PR #34 closed. The page
  now quotes the registry instead of repeating a claim, and names the database
  commands that do exist.
- **Checked after the change**: 692 tests over 97 files green, typecheck 0,
  lint 0, 8/8 guards, the deployed site re-checked against the command line
  (`docs/evidence/user-data-2026-11-14.log`: 36 checks, 0 failure, 0 request
  outside the origin), and the page verified in a real browser: the note quotes
  the 404 and the catalogue shows `pnpm voyage data geodb status`.
- **Duration / credits**: `TODO(measure)` — this build does not run under the
  Kiro IDE, so the hook cannot know the duration (§14.6: no invented credits).

---

---

## The three facts to prove (§14.6) — placeholders until measured

1. **The project is built under its own rule.** The agent writing a probe tool
   is not allowed to probe: `probe-guard` blocks it and this journal counts
   the blocks.
   - probe-guard blocks during the build: `TODO(measure)` (target: ≥ 1 real
     block, acceptance §18; each block appends a row to the table below).
2. **The properties carry the physics.** "No retained position violates the
   speed of light" is a sentence of the cahier, an acceptance criterion and a
   test (VOY-P-06). Every counter-example found is recorded here.
   - counter-examples found, and what each one changed (all during the
     assembly of the lots, on 2026-11-11):
     1. `inflation = Infinity` when the light floor is zero: a journey could not
        survive its own share link, because JSON has no infinity. VOY-P-17 caught
        it; `summarize` now returns `null` for a meaningless ratio.
     2. The light floor was computed from the first *located* hop instead of the
        departure: 60.6 ms instead of 63.7 ms on the §7.14 example, i.e. an
        inflation flattered from 1.51 to 1.44. VOY-P-14 caught it.
     3. The leg from the departure to the first located hop was missing from the
        distance: 6,264 km instead of 6,654 km. The acceptance test of §18 caught
        it; `buildSegments` now takes the departure and emits `from_ttl: 0`.
     4. The summary listed a country per hop instead of per country (FR, FR, GB,
        GB, US, US). VOY-P-15 caught it.
     5. A candidate rejected on an *unlocated* hop was not counted in
        `rejected_by_light`: the product's headline number under-reported the
        lies the light caught. The pipeline now counts the flat rejection list.
   - property seeds: recorded in the header of each property test (42, 99, 777,
     2026, 20260711, 20261111, 20261112, 20261113, 20261116, 20261117) so any
     counter-example can be replayed; all twenty properties VOY-P-01 to VOY-P-20
     are implemented and green.
3. **The steering changes the words.** One label, before and after
   `honesty.md`:
   - before (the wording §5.4 forbids, quoted from the specification itself —
     no unsteered session was run for this build): "Your packet crossed the
     Atlantic via MAREA."
   - after, real output of `buildStory` on the §7.14 trace, computed offline
     from the router names alone: "Crossing — Sea crossing. At least 6,198 km as
     the crow flies, 82.1 ms later. 5 compatible cable(s) for this crossing:
     TAT13, Tata Atlantic South, Atlantic Crossing 1 (AC1)Seg.C, Tata Atlantic
     North, Yellow (5 other compatible cables). Nothing in the measurement says
     which one carried your packet."
   - the rule is executable, not advisory: `checkVocabulary` in
     `packages/core/src/story/vocabulary.ts` is imported by
     `scripts/guards/vocabulary.guard.mjs`, which runs in CI over 82 files.
- Credits for the whole build (indicative 800–1,000 if this replaces Suture,
  §14.6): `TODO(measure)`.

---

## Automated entries — appended by the `journal-reminder` hook

| Timestamp (UTC) | Event / Spec | Task / Detail | Duration |
|---|---|---|---|
| 2026-11-11T13:58Z | probe-guard | refused `traceroute -n example.org` — target absent from `.kiro/probe-allowlist.txt` (exit 2) | blocked |
| 2026-11-11T13:58Z | probe-guard | refused `mtr -n 8.8.8.8` — public target, VOY-N-02 (exit 2) | blocked |
| 2026-11-11T13:58Z | probe-guard | allowed `traceroute -n 203.0.113.80` and `mtr --json -n -c 3 198.51.100.9` (documentation ranges) | exit 0 |
| 2026-11-11T14:00Z | assembly | 357 tests green over 52 files; typecheck and lint clean; the twenty properties VOY-P-01…20 all present | measured |
| 2026-11-11T14:00Z | assembly | site bundle 191.5 kB gzip (budget 350 kB), vendored data 116 kB gzip (budget 1.5 MB), zero external reference in `dist/` | measured |
| 2026-11-11T14:00Z | assembly | §7.14 reproduced offline from the router names alone: at least 6,654 km, 91.7 ms, floor 63.7 ms, inflation 1.44, 8 hops located out of 10 | measured |
