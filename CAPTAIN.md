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
