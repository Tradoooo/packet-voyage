# Real data — who may probe, how, and what may enter the repo

Since the incident of 2026-11-12 (`KIRO_JOURNAL.md`: a probe the workshop
should never have made), this document is the only procedure for obtaining a
real trace. **Agents never probe** (`probing-ethics.md`, rule 1 — direct
binaries and the product's own `trace` subcommand alike). Real data exists for
calibration and demonstration, and only a human may produce it.

## Who may probe

- The human, and nobody else — no agent, no CI job, no cron. **One written
  exception exists**: on 2026-11-13 the owner asked the agent to produce the
  calibration traces, and named the hosts it may probe in
  `.kiro/probe-allowlist.txt` (see "The owner's exception of 2026-11-13" in
  `probing-ethics.md`). Outside those named hosts, rule 1 stands unchanged.
- One host at a time, at the human's explicit request: never a range, never a
  list (VOY-F-42 — the CLI itself refuses them).
- Never `sudo`, never raw sockets, never a privileged mode (§11.6).

## The exact commands

```bash
pnpm voyage consent grant
pnpm voyage trace <host> --from <city> --cycles 3 --out <path>
```

### Why `--from` is indispensable (measured)

Without a declared departure, `light_floor_ms` and `inflation` stay `null`:
the light cone cannot be drawn and the rejection by light switches off — the
two things this product is built on simply disappear from the journey.

### Why consent is indispensable (measured)

The CLI probes with `mtr --json -n` — numeric, no DNS. Without enrichment
(consent granted, not `--offline`), router names are `null` and no hop can be
located: the 2026-11-12 `www.google.com` run yielded 6 hops, 0 located.
Enrichment is also the only moment table 6.4 of `privacy.md` applies — know it
before granting consent.

## Where raw files land: outside the repository

A raw journey contains the local topology (box, access network, private
addresses) and the departure city. Raw files are written **outside** the repo,
for example `~/Bureau/pv-traces/`, and they stay there — never `git add`ed,
not even "temporarily".

## What may enter the repository

Only a country-redacted journey:

```bash
pnpm voyage share <file> --level country --yes --out <file>.redacted.json
```

`scripts/guards/fixture-privacy.guard.mjs` (CI) rejects anything else:
private addresses, CGNAT, access-network hops, a source finer than country.

## Testing with real data

```bash
pnpm voyage explain <file>
node scripts/calibrate.mjs <file>
```

Both read recorded files offline: they never probe and never enrich.
