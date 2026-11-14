---
inclusion: always
---

# Packet Voyage — probing ethics steering (VOY-N-02, §14.3)

**The agent building this project never probes the Internet.** It works on
recorded traces: fixtures in `gallery/**`, the appendix B examples, and traces
the user pastes. This project is a tool that reads measurements; the workshop
that builds it must not become a source of measurements.

## Rules for agents working in this repo

1. **Never run** `traceroute`, `tracert`, `mtr`, `ping`, `nmap` or `tracepath`
   against anything that is not in `.kiro/probe-allowlist.txt` (loopback and
   documentation ranges only). The same allowlist applies to the **indirect
   probe**: the product's own `trace` subcommand spawns those very binaries, so
   `voyage trace <host>` is a probe whatever launches it — `pnpm voyage trace`,
   `npx packet-voyage trace`, `node apps/cli/bin/voyage.mjs trace`, or an
   installed `voyage`. The `probe-guard` hook
   (`.kiro/hooks/probe-guard.json`, PreToolUse / shell) blocks both forms and
   tells you why — every block is journaled; that count is a submission fact
   (§14.6 fact 1). The file-based subcommands (`read`, `explain`, `export`,
   `compare`, `share`, `data`, `consent`, `mcp`) never probe and stay allowed.
2. **No range, no list, ever.** One host at a time, at a human's request. This
   applies to the product too: `voyage trace` rejects ranges, lists, anything
   starting with `-`, anything that is not a single hostname or address
   (VOY-F-42), and spawns with an argument array — never through a shell.
3. **No privilege escalation**: never `sudo`, never setcap, never raw sockets.
   If the requested mode needs privileges the user lacks, say so and offer the
   default mode (§11.6).
4. **Rate limits are product requirements, not tuning.** The MCP server: one
   trace at a time, ≥ 5 s between two traces, ≤ 20 traces per session, and
   every `trace_host` call requires an explicit user approval flag (VOY-N-02).
5. **The hosted site emits no probe and no request after load** (VOY-N-01,
   VOY-N-02). Pasted traces are computed locally in the browser.
6. **Enrichment is not probing**: rDNS/RIPEstat/IPmap/PeeringDB calls happen
   only after consent (VOY-F-13), only for public addresses (VOY-P-04), and
   stop entirely under `--offline` (VOY-F-11). Table 6.4 in `privacy.md` is
   the exhaustive list of what may leave the machine.

## The owner's exception of 2026-11-13 (named hosts, in writing)

The rule above stands for every agent that works on this repository. On
2026-11-13 the owner of the project decided that the calibration traces had to
be produced, and asked the agent to produce them: *"fait toi, je veux que tu
fasses tout sauf vidéo et submission"*. Until then the traces had never
existed — the demo ran on the synthetic example — and the rule was the reason.

What changed, and nothing else:

- `.kiro/probe-allowlist.txt` names **eleven public hosts**, in writing, for
  this calibration only (eight of them were probed on 2026-11-13; the other
  three are permitted and unused). The guard was consulted before every probe
  (`node scripts/hooks/probe-guard.mjs`, exit 0) and was not worked around:
  it permits those hosts and refuses everything else.
- `voyage consent grant` was run before the first probe, so the enrichment
  (reverse DNS, RIPE IPmap, RIPEstat, PeeringDB) saw the owner's consent, and
  only public hop addresses ever left the machine.
- The raw traces stay **outside** the repository (`~/Bureau/pv-traces/`); only
  country-redacted copies may be committed.
- The event is written up in `KIRO_JOURNAL.md` (2026-11-13), with what was
  probed and what left the machine.

Any agent that probes a host that is not named in the allowlist is still
refused, and still owes a journal entry.

## Testing without probing

- Parsers, locator, segments, cables, metrics, story: fixtures and generated
  journeys, pure functions, no network — there is never a reason to probe.
- To exercise the CLI end-to-end, feed it a recorded trace file
  (`voyage read gallery/ocean-crossing/trace.txt`), not a live host.
- Enrich adapters are tested against a fake `Fetcher` (CONTRACTS §5.6).
- If a test seems to need a live probe, the test is wrong: rewrite it against
  a fixture, or report the need — do not probe.

## Outside Kiro (any agent, any runtime)

The hook above is a Kiro `PreToolUse` hook: it does not run in another agent
runtime (the 2026-11-12 incident in `KIRO_JOURNAL.md` is exactly that). The
rule still applies everywhere, and the guard itself is portable — before any
doubtful command, any agent can run it directly from the repo root. It executes
no probe; it only reads the command string and answers with its exit code:

```
printf '{"cwd":"%s","tool_name":"shell","tool_input":{"command":"%s"}}' "$PWD" "<la commande>" | node scripts/hooks/probe-guard.mjs; echo "exit=$?"
```

`exit=2` means refused: do not run the command, and journal the attempt.
`exit=0` means allowed. Same allowlist, same reasons, no editor required.

## If you are blocked by probe-guard

Read the message, do not work around it (no renaming the binary, no piping
through `sh -c`). The allowlist stays as it is; it is owned by another lot and
contains only `localhost`, `127.0.0.1`, `::1` and the RFC 5737 / RFC 3849
documentation ranges.
