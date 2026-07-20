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
    Given Yoink signal verification starts a command that remains active
    When the signal test waits for child-process readiness
    Then the signal test sends SIGTERM only after the child process is observable
