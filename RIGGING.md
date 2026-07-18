# Rigging

## Stack
- language: TypeScript
- runtime: Node.js >=22
- packageManager: npm

## Directories
- implementation: src
- specs: features
- verification: none
- assets: none
- scantlings: none

## Commands
- discover: `npx cucumber-js --dry-run --tags "not @captain and not @shipwright"`
- focused: `ref="{scenario}"; npx cucumber-js "${ref%%:*}" --name "^${ref#*:}$" --tags "not @captain and not @shipwright"`
- broad: `npx cucumber-js --tags "not @captain and not @shipwright"`
- coverage: `npx c8 npx cucumber-js --tags "not @captain and not @shipwright"`
- step-usage: none
- plank-inventory: none
- typecheck: none
- lint: `npx biome check src`
- conformance: none

## Perturbation
- message: `PERTURBATION: consider current durable context; remove when fixed`
- perturb: `throw new Error("PERTURBATION: consider current durable context; remove when fixed");`

## Tiers
- default: @logic
- sandbox: none
- policy: none
- weather: none
- runrecord: none

## Dependencies
- policy: latest-stable
- dependency: @earendil-works/pi-coding-agent

## Outbound
- outbound: none
