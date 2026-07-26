> STOP. Captain's notes: non-binding. Captain writes, Captain trims. Anyone else: close this file now.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Voyage State

Closed. Flag-based inline plan interface shipped in v0.2.0. All 9 scenarios green. Documentation updated (skill docs, README, usage text, env var parameterization guidance).

## Outbound

`main` at `a09b7bc`. Tag `v0.2.0` published. `@dk/yoink@0.2.0` on npm. Working tree clean.

## Conventions

- Trunk-based development: push to `origin/main` directly. No feature branches or PRs.

## Deferred Nits

No voyage work: no `child.on("error")` handler; `realpath(cwd)` after close can reject; `--help`/`--version` pre-scan quirks; no `--` separator; stdin concat is O(n^2).

## Eval State

- All @eval scenarios use Pi with `-p`, `--provider openrouter`, `--model`, `--skill`, `--session-dir`, `stdio: ['ignore', 'pipe', 'pipe']` in the harness. Resolved.

## Upstream Note

- The `tests:all` `.env` sourcing issue is package-script tooling, not product work or a QM-owned asset change. A cancelled QM dispatch was wrong because Captain conflated that script defect with the separate pipe-closure verification blocker. Keep Captain-owned assets and package-script decisions on Captain's side; dispatch QM only for verification support.

- **Shipshape shakedown (2026-07-24) — RESOLVED.** All items delivered:
  1. Per-command truncation: `--max-bytes` bounds each command independently; `stdout_bytes`/`stderr_bytes` metadata identifies which command overflowed (commit `4bdb29b`).
  2. Plan-parse errors: JSON parse diagnostics include line/column position (commit `4bdb29b`).
  3. JSON-safe patterns guidance: skill docs and README now recommend `git ls-files` over raw `find` and warn against shell-metachar predicates.
