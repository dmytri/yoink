> STOP. Captain's notes: non-binding. Captain writes, Captain trims. Anyone else: close this file now.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Voyage State

Closed. Flag-based inline plan interface shipped in v0.2.0. Patch-bump voyage: 3 deps advanced to latest-stable, schema URL drift cleared across README/SKILL/schema/asset. Signal-handler reaping gap routed through Perturbation: `watchbill.json` written, PERTURBATION planted at `src/cli.ts:handleSignal`, 5 scenarios failing as expected (3 pinned + 2 timing artifacts + 1 conformance sentinel). Awaiting QM dispatch to Crew for the reimplementation.

## Outbound

`main` at `acd7e02` plus uncommitted: package.json + package-lock.json patch bumps; `watchbill.json` written for the perturbed seam; README.md, skills/yoink/SKILL.md, schemas/plan.schema.json, assets/eval-retrieval-plan.json schema URL bumped `@0.1` -> `@0`. PERTURBATION planted at `src/cli.ts:handleSignal`. Working tree dirty. Tag `v0.2.0` still on npm; do not publish until perturbation reimplementation lands and verification re-greens.

## Conventions

- Trunk-based development: push to `origin/main` directly. No feature branches or PRs.

## Deferred Nits

No voyage work: no `child.on("error")` handler; `realpath(cwd)` after close can reject; `--help`/`--version` pre-scan quirks; no `--` separator; stdin concat is O(n^2).

## Latent Findings

- **Schema URL pin drift — RESOLVED.** All four `@dk/yoink@0.1` references now `@dk/yoink@0` (README.md:107, skills/yoink/SKILL.md:124, schemas/plan.schema.json:3 `$id`, assets/eval-retrieval-plan.json:2). Schema `$id` change is a public contract change: any consumer cached on the old URL must refresh. Recorded for the next release notes.

## Active Perturbation

- **Seam:** `handleSignal` at `src/cli.ts:363-381` (the SIGTERM/SIGINT async handler that walks child pgroups, then self-kills Yoink).
- **Pinned scenarios:** `features/command-execution.feature:A termination signal stops active child processes`, `SIGINT terminates child process groups`, `A termination signal kills processes that ignore it`, plus `A signal terminates all pipeline members` (line 49) which shares the same handler.
- **Why perturbed:** the handler self-kills Node (`process.kill(process.pid, signal)`) before libuv's SIGCHLD handler has a chance to `waitpid` the bash child spawned with `detached: true`. In hosts whose PID 1 does not reap, the bash wrapper survives as a zombie and `process.kill(pid, 0)` from the cucumber step returns 0, failing the scenario. Real defect; env-masked in this sandbox where PID 1 reaps. Cannot be Perturbation-reddened without a failing target, so the throw at line 366 is the standard perturbation mechanism: it surfaces the failure as a discoverable QM target.
- **Crew's job:** reimplement the handler so the SIGKILL-to-pgroup completes and libuv reaps before the self-kill, then remove the `throw new Error("PERTURBATION: …")` statement. The pinned scenarios passing again prove the behaviour survived the rebuild.
- **Status:** planted. `watchbill.json` enumerates the three pinned scenarios. `npm run verify` currently reddens on 5 scenarios (3 pinned + 1 shipshape-conformance sentinel that detects the perturbation + 2 timing artifacts in shipshape-conformance that also exercise the handler). All other scenarios green.

## Eval State

- All @eval scenarios use Pi with `-p`, `--provider openrouter`, `--model`, `--skill`, `--session-dir`, `stdio: ['ignore', 'pipe', 'pipe']` in the harness. Resolved.

## Upstream Note

- The `tests:all` `.env` sourcing issue is package-script tooling, not product work or a QM-owned asset change. A cancelled QM dispatch was wrong because Captain conflated that script defect with the separate pipe-closure verification blocker. Keep Captain-owned assets and package-script decisions on Captain's side; dispatch QM only for verification support.

- **Shipshape shakedown (2026-07-24) — RESOLVED.** All items delivered:
  1. Per-command truncation: `--max-bytes` bounds each command independently; `stdout_bytes`/`stderr_bytes` metadata identifies which command overflowed (commit `4bdb29b`).
  2. Plan-parse errors: JSON parse diagnostics include line/column position (commit `4bdb29b`).
  3. JSON-safe patterns guidance: skill docs and README now recommend `git ls-files` over raw `find` and warn against shell-metachar predicates.
