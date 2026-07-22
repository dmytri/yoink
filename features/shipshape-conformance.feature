@logic
Feature: Shipshape conformance
  @conformance
  Scenario: An absent watchbill leaves the deck conformant
    Given the voyage has no watchbill
    When the watchbill conformance check runs
    Then it accepts the deck

  @conformance
  Scenario: Production code has no active perturbation
    Given Yoink production code has no active perturbation
    When the perturbation quiescence check runs
    Then it reports no PERTURBATION token

  @conformance
  Scenario: Signal verification observes an active child process
    Given Yoink starts a command that remains active
    When signal verification waits for child-process readiness
    Then it sends SIGTERM only after the child process is observable

  @conformance
  Scenario: Signal tests wait for active child-process readiness
    Given a plan command has an active child process
    When Yoink's signal test waits for child-process readiness
    Then it sends SIGTERM only after the child process is observable

  @conformance
  Scenario: Plank annotations resolve to current step-definition patterns
    Given the production seams carry plank annotations
    When the plank-form check runs
    Then every plank token resolves to a docblock tag on a seam declaration
    And every plank string matches a current step-definition pattern
    And every provisional plank names a skeleton scenario awaiting review

  @conformance
  Scenario: Evaluation runs keep per-scenario evidence
    Given the evaluation harness support
    When an evaluation scenario writes its evidence
    Then the evidence path is unique to the scenario
