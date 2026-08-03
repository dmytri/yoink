> STOP. Captain's notes: non-binding. Captain writes, Captain trims. Anyone else: close this file now.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Voyage State

In flight. The R6 voyage (`ec97e5f`..`1efa3dc`) shipped and was published as `@dk/yoink@0.2.2`. A second voyage is now in flight to resolve the four open findings deferred from the R6 voyage. Four `@captain` scenarios planted at `features/command-execution.feature` (R2 pipe-consumer-stdin error, R4 pipe-close grace timer, R7 stdin O(n^2) concat) and `features/plan-input.feature` (S4 `--` end-of-options separator), with corresponding `@planks-provisional` annotations on the production seams in `src/cli.ts:233,290,517`. `watchbill.json` enumerates the four targets. Awaiting QM dispatch to harden the skeletons into binding failing targets, then Crew for the production fixes.

## Outbound

Tag `v0.2.0` is on npm. `v0.2.2` is now published. The R6 voyage shipped as a patch-bump over `v0.2.1` (which was the last local commit before the R6 voyage but was never published). `RIGGING.md` `## Outbound` names `npm` as the single distribution target; publish was performed in the main session after `npm run verify` (typecheck + lint + build + 92/92 green), `npm pack` tarball inspection (7 files, 13.4 kB, shasum `1695711213d23f3edbe7155815b9cb6973bd766e`, integrity sha512 confirmed), and a fresh `node package/dist/cli.js` smoke test that proved the R6 fix is in the published artifact (the bundle ships with a working `cwd` even when the cwd was rm-rf'd mid-run). Tag `v0.2.2` is on the remote; commit `1efa3dc` is the new `main` HEAD. No outbound action is owed until the next release.

- Trunk-based development: push to `origin/main` directly. No feature branches or PRs.
- Captain is the only human-facing role. QM, Crew, and Boatswain are internal and report through durable artifacts, verification output, and role hand-offs.

## Open Findings (in flight)

All four are now in flight. `@captain` scenarios planted, `@planks-provisional` annotations on the seams, `watchbill.json` enumerates the four. Awaiting QM dispatch.

- **`src/cli.ts:535-538`** — pipe-consumer stdin error handler rethrows any non-`EPIPE` error and crashes the process. **In flight:** `@captain` scenario at `features/command-execution.feature:A piped consumer's stdin error path does not crash Yoink`, with `@planks-provisional` on the `for (let index = 0; ...)` loop seam at `src/cli.ts:517`. Provocation: a piped consumer that emits a synthetic non-EPIPE error on its stdin via `node -e`. Crew fix: delete the `if (error.code !== "EPIPE") throw error;` branch.
- **`src/cli.ts:33, 529-532`** — `PIPE_CLOSE_GRACE_MILLISECONDS = 50` schedules `producer.child.stdout.destroy()` 50ms after the consumer closes. **In flight:** `@captain` scenario at `features/command-execution.feature:The pipe-close grace waits for the producer's close event, not a timer`, with `@planks-provisional` on the same `for` loop seam. Crew fix: wait on `child.once("close", ...)` instead of a timer.
- **`src/cli.ts:292-294`** — stdin read does `input += chunk` in a loop (O(n^2) on large plans). **In flight:** `@captain` scenario at `features/command-execution.feature:A one-megabyte plan from standard input is read in linear time`, with `@planks-provisional` on the stdin read block at `src/cli.ts:290`. Crew fix: accumulate `Buffer`s and decode once.
- **`src/cli.ts:235-241`** — no `--` end-of-options separator. **In flight:** `@captain` scenario at `features/plan-input.feature:A double-dash separator ends option parsing`, with `@planks-provisional` on the unknown-option branch at `src/cli.ts:233`. Provocation: `yoink -- --max-bytes 64` currently fails with "unknown option: --". Crew fix: when `--` is encountered, skip option parsing for the remaining args and pass them to the plan reader.

## Eval State

All `@eval` scenarios use Pi with `-p`, `--provider openrouter`, `--model`, `--skill`, `--session-dir`, `stdio: ['ignore', 'pipe', 'pipe']` in the harness. Resolved.

## Upstream Notes

- The `tests:all` `.env` sourcing issue is package-script tooling, not product work or a QM-owned asset change. Resolved by leaving it to package-script owners.
- **Shipshape shakedown (2026-07-24) — RESOLVED.** Per-command truncation with overflow identification (commit `4bdb29b`); JSON parse diagnostics with line/column position (Node 22 V8 emits them natively); JSON-safe patterns guidance in skill and README.
- **Schema URL pin drift (2026-07-30) — RESOLVED.** All four `@dk/yoink@0.1` references bumped to `@dk/yoink@0` (README, SKILL, schema `$id`, eval-retrieval asset) in `152f9a0`. Schema `$id` change is a public contract change; consumers cached on the old URL must refresh. Recorded for the next release notes.
- **Signal-handler reaping (2026-08-02) — RESOLVED.** `handleSignal` reimplemented to SIGKILL the pgroup, await every tracked child's `close`, then self-kill. Commit `152f9a0`.
- **R6 realpath rejection (2026-08-02) — RESOLVED.** `realpath(command.cwd)` wrapped in `.catch(() => command.cwd as string)` at `src/cli.ts:487`. New binding scenario at `features/command-execution.feature:A command's cwd removed between plan validation and result still ships the bundle`. Commits `53d7614` (fix + scenario + watchbill-strike), `27a566f` (dist re-sync), `9275a7d` (promotion). Broad recheck 92/92 green.
