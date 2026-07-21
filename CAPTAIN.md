> STOP. Captain's notes: non-binding. Captain writes, Captain trims. Anyone else: close this file now.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Eval Harness Findings

- Jolly runs Pi as a dedicated subprocess in a temporary workspace and throwaway home. It sets `OPENROUTER_API_KEY` from the harness key, passes provider and model explicitly, captures stdout and stderr, and persists Pi session JSONL for per-turn usage. It optionally preserves redacted transcripts before teardown.
- Estelle loads `.env` into `process.env` once. Its live scenarios configure a started Pi session through per-agent settings and auth files, wait on an observed reply-and-idle signal, and assert against that session's live message history. Its eval command persists summary and JSON output to coverage files.
- Yoink should retain Pi stdout, stderr, exit status, timeout state, and session output for each live-eval run before temporary-workspace teardown. Its credential loading should use the two required values from `.env` without copying unrelated values.

## Pi Invocation Comparison

- Jolly starts Pi with `-p <task> --provider openrouter --model <model> --skill <skill-dir> --session-dir <session-dir>`. Its isolated home also sets XDG config, data, and cache paths.
- Yoink starts Pi with a positional prompt, `--mode json`, `--no-session`, `--approve`, and `--skill`. It sets `HOME` but no XDG paths. It omits `--provider openrouter` and `--session-dir`.
- The `--no-session` flag conflicts with Yoink's required session transcript. The missing provider and session directory are concrete differences from Jolly's working invocation.
- Unresolved: Pi's JSON-mode output contract for the Yoink assertions needs confirmation after the Jolly-style invocation is adopted. Jolly reads Pi session JSONL and CLI trace evidence rather than relying on JSON-mode stdout.
- Follow-up: both projects resolve `node_modules/.bin/pi` to the same Pi CLI. The remaining invocation mismatch is arguments: Jolly uses `-p <task>` and preserves its session; Yoink uses a positional task with `--no-session`. Remove `--no-session` and pass the task through `-p` before judging Pi behaviour again.

## Upstream Fitting-Out Notes

- Copy only `HARNESS_OPENROUTER_API_KEY` from `~/jolly/.env` and `HARNESS_EVAL_MODEL` from `~/estelle/.env.example` into Yoink's ignored `.env`. Do not copy unrelated Jolly credentials.
- The `.env` file MUST be mode `600` and Git-ignored. The eval harness MUST load both values from literal `NAME=value` lines.
- A Jolly-style Pi evaluation requires a temporary workspace, throwaway `HOME`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, and `XDG_CACHE_HOME`, plus `OPENROUTER_API_KEY` in Pi's child environment.
- Invoke Pi through its installed binary with `-p <task> --provider openrouter --model <model> --skill <skill-dir> --session-dir <session-dir>`. Do not use `--no-session` when the evaluator requires a session transcript.
- Retain Pi exit status, stdout, stderr, duration, and session JSONL under `coverage/eval` before temporary-state teardown. Empty evidence after the timeout is a harness failure, not a Yoink product failure.
- The current harness has not yet applied the final `-p` and session-preserving argument correction. Re-run the two `@eval` scenarios after that verification change.

## Eval Resolution Plan

1. Replace the setup-only provider step with an assertion over the recorded Pi command line. It MUST name `-p`, `--provider openrouter`, `--model`, `--skill`, and `--session-dir`, and omit `--no-session`.
2. QM changes the Pi invocation until that assertion passes.
3. Run both `@eval` scenarios. Each run MUST retain a populated session transcript and a completed process result.
4. Run the `@logic` watch, then dispatch Boatswain for verification recheck and local custody.
5. Create and push the repository after clean custody, then enter harbour.

## Current Eval State

- The harness now records the Pi executable, isolated HOME/XDG environment, required invocation arguments, process result, and session path.
- The two `@eval` scenarios still end only when the 360-second harness deadline sends `SIGTERM`.
- The retained result records duration `360119` ms. Pi stdout, stderr, and session JSONL are empty. Yoink is not invoked before this deadline.
- Proven issue: Pi does not emit a first completion signal in Yoink's isolated evaluation environment. Unproven issue: why this differs from Jolly's working Pi launch.
- Next diagnostic: run Jolly's exact Pi command with a minimal prompt in Yoink's isolated workspace and compare its process result with Jolly's launch.

## Eval Root Cause Found (2026-07-19)

- Pi blocks on reading from stdin when stdin is a pipe (`stdio: 'pipe'`), even in `--print` mode. `execFile` forces `stdio: ['pipe', 'pipe', 'pipe']`, so Pi blocks on the open stdin pipe, produces zero output, and hits the 360s timeout.
- With `stdio: ['ignore', 'pipe', 'pipe']` (stdin from /dev/null), Pi exits in seconds with 42KB+ JSON output.
- Also confirms `spawn`/`spawnSync` with `ignore` stdin both work; `execFile` and `spawn` with `pipe` stdin both block.

### Fix: replace `execFile` with `spawn` + `stdio: ['ignore', 'pipe', 'pipe']` in `runAgent()`
- `execFile` overrides the `stdio` option internally and forces `['pipe', 'pipe', 'pipe']`, so passing `stdio` to execFile has no effect.
- Use `spawn` with `['ignore', 'pipe', 'pipe']` and manual stdout/stderr buffering.
- Handle timeout via `setTimeout → child.kill('SIGTERM')`.
- Status resolution matches original: `signal` for kill, `code` for normal exit, `1` for error.

## Verbatim Eval Plan

- `assets/eval-retrieval-plan.json` is the human-runnable plan and the exact JSON Pi MUST pass to the locally packed Yoink CLI on standard input.
- The eval scenarios reference this asset. The next QM target makes the harness read the asset, give its bytes to Pi in the task prompt, and assert the observed Yoink stdin payload equals those bytes.

## Shipshape Dispatch Findings

- Captain to QM accepts only role and base commit. A retry that carried target and failing-run evidence was rejected as contamination, although that evidence is needed by QM to act on a Boatswain recheck failure. The correct retry was a thin Captain to QM dispatch that relied on `watchbill.json`.
- QM reported a watchbill spent after a focused green run. Its returned run record did not persist under `coverage/runrecord.json` on the committed deck, so Boatswain could not corroborate the result from durable state.
- Boatswain requires spent-watch evidence before it strikes `watchbill.json`. Its dispatch contract permits only job, base commit, and advanced target references, so Captain cannot convey QM's spent evidence. A Boatswain return asks Captain for evidence that the contract bars Captain from supplying.
- Captain-owned removal of a spent watchbill also failed custody because Boatswain requires the same unavailable evidence. This leaves a green target with a retained watchbill and no legal custody path.
- A later QM run appended three focused green records to `coverage/runrecord.json`, including a current role-advanced deck hash. Boatswain still reported no run record and left `watchbill.json` in place. The file existed after its report, so custody must read a different state or applies a different hash calculation.
- Boatswain also left `skills/yoink/SKILL.md` unstaged as undecidable, although QM named that file in the target's durable scope and Crew changed it to make the focused target pass. The Boatswain dispatch carries scenario references only, so its authorship decision cannot receive QM's file attribution.
- Agent deadlock: Captain could not complete harbour entry because Boatswain requires spent-watch evidence but its contract excludes that evidence. Captain did not send the prohibited prose because Boatswain is required to reject extra dispatch content as contamination. Captain also could not make the custody commit because Shipshape assigns that action to Boatswain. The process has no defined escalation or durable evidence channel for this contradiction.

## Conventions

- Trunk-based development: push to `origin/main` directly. No feature branches or PRs.

## Hardening Review Verdict (2026-07-21)

Inspected `main` at `53be604`. Items 1, 4, 5, 6, 8 from the original roadmap are properly improved. Items 2, 3, 7 are still incomplete.

### Still critical

1. **No SIGKILL escalation** — Timeout sends one SIGTERM and waits indefinitely. No grace → SIGKILL path. No ESRCH protection. The `trap '' SIGTERM; sleep 1.2` test does not prove escalation because `sleep` receives the group signal. Need a process group that survives SIGTERM, an external deadline, and assertion that Yoink sends SIGKILL.
2. **No SIGINT handler** — Only SIGTERM is handled. Children are detached process groups and may not receive terminal SIGINT. Same cleanup routine must handle at least SIGINT and SIGTERM.
3. **`--max-bytes` does not bound memory** — All chunks accumulated without limit; only trimmed after `close`. Need bounded collectors that retain first N bytes while draining. Uncaptured piped producer stdout also still fully buffered.
4. **`capture: false` on standalone does not suppress stdout** — Implementation checks `command.pipe && !command.capture`. Should use `command.capture ?? !command.pipe`.
5. **Terminal `pipe: true` still deletes stdout** — No validation preventing `pipe: true` on final command. Result assembly still suppresses stdout.
6. **Missing files and malformed JSON produce Node stack traces** — `readFile` and `JSON.parse` unguarded. No top-level `catch` with `yoink: path: message` format.
7. **Option validation incomplete** — `--max-bytes` accepts zero, negative, NaN, strings like `64garbage`, repeated conflicting options. Missing value makes flag the plan argument. Unknown options treated as positional.
8. **MIME blank line missing** — `Content-Type` header directly followed by first boundary. Need `\r\n\r\n` between outer headers and multipart body.
9. **README defects** — Table has 5 separator columns for 4 headers. Plan example has broken pipe chain (cat → sed with pipe, but cat has no pipe). Node version says "22 or later" but requires `>=22.19`.


### Verbatim Eval Plan

`assets/eval-retrieval-plan.json` is the human-runnable plan and the exact JSON Pi MUST pass to the locally packed Yoink CLI on standard input.

The eval scenarios reference this asset. The next QM target makes the harness read the asset, give its bytes to Pi in the task prompt, and assert the observed Yoink stdin payload equals those bytes.
