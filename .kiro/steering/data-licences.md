---
inclusion: fileMatch
fileMatchPattern:
  - "packages/data/**"
  - "scripts/data/**"
---

# Packet Voyage — data licences steering (spec §6.1, VOY-N-05)

The repo is public and MIT. **Anything vendored here must have a licence that
allows redistribution**, plus a provenance sheet. The data package
(`packages/data`) carries its own notice — `LICENCE-DATA.md` (ODbL for
OSM-derived cables, public domain for Natural Earth); the MIT licence covers
the code only (§6.2).

## What may be vendored, what may not (table 6.1)

| Source | Licence | Vendored in repo? | Rule |
|---|---|---|---|
| OpenStreetMap cables | ODbL-1.0 | **yes** | extraction via versioned script; attribution "© OpenStreetMap contributors"; derived database stays ODbL |
| Natural Earth | public domain | **yes** | no credit required, "Made with Natural Earth" suggested |
| Wikidata | CC0 | yes, as complement | matched by name onto OSM cables |
| TeleGeography Submarine Cable Map | CC BY-SA on *maps* only; databases subscriber-only | **NO** | nothing embedded without written permission (open question 2); OSM is the fallback |
| PeeringDB | AUP forbids storing/transmitting without agreement | **NO** | live queries from the user's machine only, local cache, nothing in the repo |
| RIPE IPmap / RIPEstat | API terms | **NO** | called at run time by the CLI with consent + cache |
| DB-IP Lite | CC BY 4.0 | **NO** (size) | *now implemented*: `voyage data geodb update` downloads it into the user's cache dir (consent must name the service), `voyage data geodb import <archive>` converts a copy already on disk with no request; credit + link-back on every journey it locates |
| IPinfo Lite | CC BY-SA 4.0 | **NO** | alternative to DB-IP; one of the two suffices; the tool ships the DB-IP path only |
| RIPE Atlas results | RIPE NCC terms | no raw dumps | gallery uses redacted fixtures; commercial use needs agreement |
| Airport/city hint table | source **to confirm** | small home-made table only | from a licence-confirmed source; **no CLLI codes** (proprietary) |

## Provenance sheet — mandatory (CONTRACTS §2)

Every `packages/data/datasets/<id>.json` has a sibling
`packages/data/provenance/<id>.json`:

```json
{ "id": "…", "title": "…", "origin": "…", "url": "…", "licence": "ODbL-1.0",
  "retrieved_at": "YYYY-MM-DD", "query": "scripts/data/cables.overpassql",
  "transform": "scripts/data/build-cables.mjs", "attribution": "…",
  "features": 0, "sha256": "…" }
```

`scripts/guards/data-licence.guard.mjs` and the `data-licence-guard` hook fail
on a dataset without a sheet or with a non-permitted licence. `features` and
`sha256` must match the actual file — recompute them, never copy them.

## Build rules

- Extraction scripts are versioned: `scripts/data/cables.overpassql`,
  `build-cables.mjs`, `build-landmass.mjs`, `build-hints.mjs`.
- Scripts must run **offline against a cached response**
  (`scripts/data/cache/`, git-ignored) so CI never needs the network.
- Budgets: each dataset < 1.5 MB compressed, geometries simplified (VOY-N-07).
- Freshness: `retrieved_at` drives the 90-day staleness warning (VOY-N-11,
  `staleProvenance`); credits shown wherever data is shown (VOY-F-48) come
  from `creditsFor(ids)` — never hand-typed.
- Only the `data-curator` agent writes in `packages/data/**` and
  `scripts/data/**`.
