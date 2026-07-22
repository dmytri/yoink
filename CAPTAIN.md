> STOP. Captain's notes: non-binding. Captain writes, Captain trims. Anyone else: close this file now.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Current Voyage: Stream honesty and bounded collection

Source: user-requested Captain code review. Four findings are spec'd and on the watchbill.

1. Compact diagnostics false pass: `readFile`/`JSON.parse` have no error boundary (verified live: unhandled rejection stack, exit 1). Strengthened both scenarios with "the diagnostic is a single line". Old step regexes matched stack traces.
2. Bounded collection gaps: capture=false stdout is retained then discarded (the `else` push in `execute`); stderr accumulates unbounded during streaming. Two constrained-heap scenarios (256 MiB streams).
3. Truncation flag is chunk-dependent: exact-fill then more input drops bytes without setting `stdout_truncated`. New scenario pins report-when-dropped.
4. Signal spawn race: the main loop can launch queued commands inside the 100ms grace window; they escape the SIGKILL snapshot and orphan. Marker-file scenario pins no-start.

Deferred nits, no voyage work: no `child.on("error")` handler; `realpath(cwd)` after close can reject; `--help`/`--version` pre-scan quirks; no `--` separator; stdin concat is O(n^2).

## Pending Outbound

- 2 harbour commits ahead of `origin/main`; they ride this voyage's outbound.

## Conventions

- Trunk-based development: push to `origin/main` directly. No feature branches or PRs.

## Eval State

- All @eval scenarios use Pi with `-p`, `--provider openrouter`, `--model`, `--skill`, `--session-dir`, `stdio: ['ignore', 'pipe', 'pipe']` in the harness. Resolved.
