# Sources and licences

Every dataset shipped in `packages/data` has a provenance sheet in
`packages/data/provenance/<id>.json`, checked by CI (`scripts/guards/data-licence.guard.mjs`).
The code is MIT; the data package carries its own notice (`packages/data/LICENCE-DATA.md`).

| Dataset | Origin | Licence | Retrieved | Features | Attribution |
|---|---|---|---|---|---|
| `fixed-links` | Packet Voyage contributors — hand-curated table of well-known links | CC0-1.0 | 2026-11-11 | 9 | Fixed links: hand-curated by Packet Voyage contributors (CC0); facts not copyrightable, coordinates approximate |
| `hints` | Packet Voyage contributors — hand-curated table | CC0-1.0 | 2026-11-11 | 185 | Hints table: hand-curated by Packet Voyage contributors (CC0); facts not copyrightable, coordinates rounded to 0.01° |
| `landmasses` | Natural Earth (nvkelso/natural-earth-vector mirror) | Public-Domain | 2026-11-11 | 36 | Made with Natural Earth |
| `submarine-cables` | OpenStreetMap contributors | ODbL-1.0 | 2026-11-11 | 169 | © OpenStreetMap contributors |

## What is never redistributed here

- **TeleGeography** submarine cable data: their licence covers the *maps*, and the
  underlying databases are for paying subscribers. Nothing from them is committed:
  the cable geometry comes from OpenStreetMap instead.
- **PeeringDB**: its acceptable-use policy forbids reproducing or storing its data
  without prior agreement. It is queried live from the user's machine, cached locally,
  never vendored.
- **DB-IP / IPinfo Lite**: the local geolocation database behind the `geodb`
  source. Never vendored (size and licence): the user gets it on demand with
  `voyage data geodb update` — which refuses without a consent that names the
  service — or converts a copy already on disk with `voyage data geodb import
  <archive.csv.gz>`, which makes no request at all. The archive is 85.7 MB
  compressed (7 777 727 ranges, not the 20 MB the website suggests) and lands
  as 89.2 MB in 299 gzip shards under `~/.packet-voyage/geodb/`. Every journey
  it helps locate carries the credit CC BY 4.0 requires. Measured on the eight
  real traces: 34.9 % → 86.0 % of public hops located (`docs/VALIDATION.md`).

## What the hosted site sends

Nothing. The site makes zero network request after load: the gallery journeys are
pre-computed and a pasted trace is computed locally from the hints in the router names.

## What the command-line tool may send (only with consent)

| Service | What is sent | When |
|---|---|---|
| System DNS resolver | public addresses of the route, for their reverse name | every trace, unless `--offline` |
| RIPE IPmap, RIPEstat | public addresses of the route | after consent, unless `--offline` |
| PeeringDB | nothing specific to the route: the list of exchange-point prefixes | after consent, once per cache period |
| Language model (optional) | the already redacted journey, without any address | only if the option is enabled |

Private addresses, access-network addresses and the user's own address are never sent.

## Credits

© OpenStreetMap contributors (ODbL) · Made with Natural Earth (public domain) ·
RIPE NCC for IPmap, RIPEstat and Atlas · DB-IP and IPinfo for the local databases ·
PeeringDB for the exchange-point prefixes.
