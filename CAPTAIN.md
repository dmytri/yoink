> STOP. Captain's notes: non-binding. Captain writes, Captain trims. Anyone else: close this file now.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Voyage State

At rest. `main` is at `a0b600a` (v0.2.1) on a clean working tree. The previous voyage's signal-handler reaping gap (`PERTURBATION` on `src/cli.ts:handleSignal`) was reimplemented in `152f9a0`, and the v0.2.1 patch-bump commit advanced three transitive deps and re-synced the schema URL pin across README, SKILL, schema `$id`, and the eval-retrieval asset.

`@logic` suite is green: 91/91 scenarios, 552/552 steps, ~14.6s. No `watchbill.json`, no live `PERTURBATION` statements. One `@captain` scenario planted at `features/command-execution.feature:A command's cwd removed between plan validation and result still ships the bundle`, with a `@planks-provisional` annotation on the `execute` seam at `src/cli.ts:403`. Awaiting QM dispatch to harden the skeleton into a binding failing target. `RIGGING.md` `eval` tier is unfitted; `broad-eval` is not run by default. Outbound `npm publish` is gated on harbour full regression per the Verification policy.

## Outbound

Tag `v0.2.0` is on npm; `v0.2.1` is the next publishable. No outbound action is owed until the next release.

## Conventions

- Trunk-based development: push to `origin/main` directly. No feature branches or PRs.
- Captain is the only human-facing role. QM, Crew, and Boatswain are internal and report through durable artifacts, verification output, and role hand-offs.

## Open Findings (deferred, not blocking)

These are real defects the next harbour full regression will surface. Each is a Crew target, not a Captain write; none has been opened as a watch yet. Logged here so the next Captain cycle is not blind to them.

- **`src/cli.ts:530-533`** — pipe-consumer stdin error handler rethrows any non-`EPIPE` error and crashes the process. The path is unreachable for normal POSIX piped consumers; the `throw error` is speculative defensive code. Crew fix: delete the `if (error.code !== "EPIPE") throw error;` branch; the existing EPIPE scenarios pin the bundle-ships invariant.
- **`src/cli.ts:486`** — `await realpath(command.cwd)` runs after the child has closed. If `command.cwd` was removed between plan validation and the result callback, `realpath` rejects and the bundle is lost. **In flight:** `@captain` scenario planted at `features/command-execution.feature:A command's cwd removed between plan validation and result still ships the bundle`, with a `@planks-provisional` annotation on the `execute` seam at `src/cli.ts:403`. QM dispatched to harden the skeleton; Crew follows to wrap the realpath in `try/catch` and fall back to the declared `command.cwd` literal.
- **`src/cli.ts:33, 524-527`** — `PIPE_CLOSE_GRACE_MILLISECONDS = 50` schedules `producer.child.stdout.destroy()` 50ms after the consumer closes. If the producer is mid-write at that 50ms mark, queued bytes are dropped. The bundle's captured `stdout` is already in `stdout[]` by then, so no observable data loss in practice, but the implementation is racy by construction. Crew fix: wait on `child.on("close", ...)` instead of a timer. No behaviour change for the pinned scenarios.
- **`src/cli.ts:292-294`** — stdin read does `input += chunk` in a loop (O(n^2) on large plans). Not user-observable below a few hundred KB. Crew fix: accumulate `Buffer`s and decode once.
- **`src/cli.ts:235-241`** — no `--` end-of-options separator. Unknown options after a positional still report a useful diagnostic, so no silent failure, but a `--` separator would be friendlier. Crew fix: skip args after a bare `--` and pass the rest to the plan reader.

## Eval State

All `@eval` scenarios use Pi with `-p`, `--provider openrouter`, `--model`, `--skill`, `--session-dir`, `stdio: ['ignore', 'pipe', 'pipe']` in the harness. Resolved.

## Upstream Notes

- The `tests:all` `.env` sourcing issue is package-script tooling, not product work or a QM-owned asset change. Resolved by leaving it to package-script owners.
- **Shipshape shakedown (2026-07-24) — RESOLVED.** Per-command truncation with overflow identification (commit `4bdb29b`); JSON parse diagnostics with line/column position (Node 22 V8 emits them natively); JSON-safe patterns guidance in skill and README.
- **Schema URL pin drift (2026-07-30) — RESOLVED.** All four `@dk/yoink@0.1` references bumped to `@dk/yoink@0` (README, SKILL, schema `$id`, eval-retrieval asset) in `152f9a0`. Schema `$id` change is a public contract change; consumers cached on the old URL must refresh. Recorded for the next release notes.
- **Signal-handler reaping (2026-08-02) — RESOLVED.** `handleSignal` reimplemented to SIGKILL the pgroup, await every tracked child's `close`, then self-kill. Commit `152f9a0`.
