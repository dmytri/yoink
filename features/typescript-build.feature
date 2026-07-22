@logic
Feature: TypeScript CLI distribution
  As a package consumer
  I want the published Yoink binary to be built from TypeScript source
  So that the Node CLI has a checked, reproducible distribution

  @contract
  Scenario: The TypeScript source builds the CLI binary
    Given the Yoink CLI source is in "src/cli.ts"
    When the package build command runs
    Then the TypeScript compiler exits successfully
    And the build creates "dist/cli.js"

  Scenario: Typecheck generates the build-time usage module
    Given the generated usage module is absent
    When the package typecheck command runs
    Then the TypeScript compiler exits successfully
    And the generated usage module exists
