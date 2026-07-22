# Rigging

## Stack
- language: TypeScript
- runtime: Node.js >=22.19
- packageManager: npm

## Directories
- implementation: src
- specs: features
- verification: features/step_definitions
- assets: assets
- scantlings: none

## Commands
- discover: `npx cucumber-js --dry-run --tags "not @captain and not @shipwright"`
- focused: `if [ -f .env ]; then set -a; . .env; set +a; fi; ref="{scenario}"; npx cucumber-js "${ref%%:*}" --name "^${ref#*:}$" --tags "not @captain and not @shipwright"`
- broad: `npx cucumber-js --tags "@logic and not @captain and not @shipwright"`
- coverage: `npx c8 npx cucumber-js --tags "@logic and not @captain and not @shipwright"`
- broad-eval: `set -a; . .env; set +a; OPENROUTER_API_KEY="$HARNESS_OPENROUTER_API_KEY" npx cucumber-js --tags "@eval and not @captain and not @shipwright"`
- coverage-eval: `set -a; . .env; set +a; OPENROUTER_API_KEY="$HARNESS_OPENROUTER_API_KEY" npx c8 npx cucumber-js --tags "@eval and not @captain and not @shipwright"`
- focused-eval: `set -a; . .env; set +a; ref="{scenario}"; OPENROUTER_API_KEY="$HARNESS_OPENROUTER_API_KEY" npx cucumber-js "${ref%%:*}" --name "^${ref#*:}$" --tags "not @captain and not @shipwright"`
- step-usage: `npx cucumber-js --dry-run --format usage-json --tags "not @captain and not @shipwright"`
- plank-inventory: `rg -n '@planks(?:-provisional)?\(' src`
- typecheck: `npm run codegen && npx tsc src/cli.ts --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --types node`
- lint: `npx gplint && npx biome check src`
- conformance: none

## Perturbation
- message: `PERTURBATION: consider current durable context; remove when fixed`
- perturb: `throw new Error("PERTURBATION: consider current durable context; remove when fixed");`

## Tiers
- default: @logic
- sandbox: none
- eval: @eval
- policy: @logic: none
- policy: @eval: HARNESS_OPENROUTER_API_KEY and HARNESS_EVAL_MODEL with the OpenRouter provider
- weather: none
- runrecord: coverage/runrecord.json

## Dependencies
- policy: latest-stable
- dependency: @earendil-works/pi-coding-agent
- dependency: @biomejs/biome
- dependency: @cucumber/cucumber
- dependency: @types/node
- dependency: c8
- dependency: gplint
- dependency: typescript

## Outbound
- outbound: npm
- ship: npm publish
- verify: npm run verify
