> STOP. Captain's notes: non-binding. Captain writes, Captain trims. Anyone else: close this file now.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Voyage State

Closed. R6 voyage shipped four commits on top of v0.2.1 (`ec97e5f`, `53d7614`, `27a566f`, `9275a7d`): the R6 realpath-rejection fix (Crew wrapped `realpath(command.cwd)` in `.catch(() => command.cwd as string)` at `src/cli.ts:487`), the binding scenario hardening (QM-2 added three new step definitions and the cwd-removed fixture), the R6 `@captain` skeleton promotion (Boatswain-4 stripped the tag), the README `--max-bytes` pipe-semantics clarification, and the dist re-sync. R6 is now a binding `@logic` scenario; broad recheck 92/92 green, ~15s. No `watchbill.json`, no live `PERTURBATION` statements, no `@captain` or `@shipwright` tags. `RIGGING.md` `eval` tier is unfitted; `broad-eval` is not run by default. Outbound `npm publish` is the next action and is gated on a fresh `npm run verify` plus artifact inspection per the Outbound verification policy.

## Outbound

Tag `v0.2.0` is on npm. `v0.2.1` was the last patch-bump commit on the local branch but was not published (no `v0.2.1` tag exists on the remote — confirmed). The R6 voyage is now ready to publish as `v0.2.2` (next patch-bump on top of v0.2.1). `RIGGING.md` `## Outbound` names `npm` as the single distribution target. Per the Outbound verification policy, publish runs in the human-facing main session after (a) `npm run verify` against the local source, (b) `npm pack` and tarball inspection to confirm the published artifact is correct, and (c) the user's explicit approval.

## Conventions

- Trunk-based development: push to `origin/main` directly. No feature branches or PRs.
- Captain is the only human-facing role. QM, Crew, and Boatswain are internal and report through durable artifacts, verification output, and role hand-offs.

## Open Findings (deferred, not blocking)

These are real defects the next harbour full regression will surface. Each is a Crew target, not a Captain write; none has been opened as a watch yet. Logged here so the next Captain cycle is not blind to them. None of them is a publish-blocker for the R6 voyage because none has a binding scenario that fails today.

- **`src/cli.ts:530-533`** — pipe-consumer stdin error handler rethrows any non-`EPIPE` error and crashes the process. The path is unreachable for normal POSIX piped consumers; the `throw error` is speculative defensive code. Crew fix: delete the `if (error.code !== "EPIPE") throw error;` branch; the existing EPIPE scenarios pin the bundle-ships invariant.
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
- **R6 realpath rejection (2026-08-02) — RESOLVED.** `realpath(command.cwd)` wrapped in `.catch(() => command.cwd as string)` at `src/cli.ts:487`. New binding scenario at `features/command-execution.feature:A command's cwd removed between plan validation and result still ships the bundle`. Commits `53d7614` (fix + scenario + watchbill-strike), `27a566f` (dist re-sync), `9275a7d` (promotion). Broad recheck 92/92 green.
