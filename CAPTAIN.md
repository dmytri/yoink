> STOP. Captain's notes: non-binding. Captain writes, Captain trims. Anyone else: close this file now.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Current Voyage: Hardening Items 2, 3, 7

### Item 2 — Signal escalation for survivors
- Added scenario: "A termination signal kills processes that ignore it" (command-execution.feature:71)
- Existing scenarios cover SIGINT, SIGTERM, pipeline termination, and per-command SIGKILL
- Gap: external signal handler sends TERM/INT to child groups and exits immediately. Processes that ignore the signal survive as orphans. Need: send signal → wait grace → SIGKILL survivors → catch ESRCH → self-terminate.

### Item 3 — Bounded --max-bytes collection
- Existing scenario "Output beyond the byte limit is truncated" covers the functional contract
- Implementation fix: bounded collector that retains only N bytes during streaming; uncaptured piped stdout should use 'ignore' not 'pipe'

### Item 7 — CLI parser validation
- Existing scenarios for unknown options, missing/invalid --max-bytes, extra args
- Implementation fix: replace Number.parseInt with strict pattern match, reject zero/negative/NaN/trailing garbage, reject duplicates, reject unknown options, wrap readFile/JSON.parse in error boundary

### Test harness concern (from external review)
- Several plan-input scenarios for --max-bytes pass the whole string as a single argv element, making the test a false positive (tests file-not-found, not option validation)
- "A termination signal kills processes that ignore it" needs a step def implementation (no matching step exists yet)
- QM will report these as missing step definitions and false passes; Crew will make production changes, verification harness fixes may be needed

## Conventions
- Trunk-based development: push to `origin/main` directly. No feature branches or PRs.

## Eval State
- All @eval scenarios use Pi with `-p`, `--provider openrouter`, `--model`, `--skill`, `--session-dir`, `stdio: ['ignore', 'pipe', 'pipe']` in the harness. Resolved.
