@logic
Feature: Dependency currency
  As a package maintainer
  I want direct dependencies to track their latest stable npm releases
  So that Yoink uses supported current tooling

  @conformance
  Scenario: Direct dependencies use their latest stable releases
    Given the Yoink package manifest declares direct dependencies
    When the verifier compares each declared version to npm's "latest" release
    Then every declared dependency version equals npm's latest stable release
