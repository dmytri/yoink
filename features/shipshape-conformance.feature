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
