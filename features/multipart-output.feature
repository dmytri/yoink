@logic
Feature: Multipart retrieval bundle
  As an agent caller
  I want a parseable multipart bundle containing each command result
  So that one model inference can consume complete retrieval context

  Scenario: Every result includes execution metadata
    Given a plan command has a label, command, and working directory
    When the caller runs Yoink with the plan
    Then each emitted result names its label and exact command
    And each emitted result names its working directory, exit code, duration, and timeout status

  Scenario: Multipart delimiters match the declared boundary
    Given a plan has one successful command
    When the caller runs Yoink with the plan
    Then the bundle declares one random boundary
    And every multipart delimiter uses the declared boundary
    And the closing delimiter ends with two hyphens

  Scenario: Markdown and JSON output remain byte-for-byte unchanged
    Given a plan command emits Markdown with nested fenced JSON and Bash blocks
    And the command emits a JSON result on standard error
    When the caller runs Yoink with the plan
    Then each multipart stream body equals its emitted bytes

  Scenario: Unicode and terminal escape output remain byte-for-byte unchanged
    Given a plan command emits a "Café" label, emoji, and ANSI colour bytes
    When the caller runs Yoink with the plan
    Then each multipart stream body equals its emitted bytes

  Scenario: A colliding boundary is regenerated
    Given a captured command stream contains a candidate multipart boundary
    When the caller runs Yoink with the plan
    Then the declared boundary does not occur in result metadata or captured output other than preserved stream bodies
    And the bundle preserves the captured command stream bytes

  Scenario: Redirected standard output preserves bundle bytes
    Given a plan has one successful command
    When the caller redirects Yoink standard output to "context.md"
    Then "context.md" equals the bundle Yoink writes to standard output

  Scenario: A piped producer omits stdout from the bundle by default
    Given a plan has a piped producer that emits "upstream" and a successful consumer
    When the caller runs Yoink with the plan
    Then the bundle omits the piped producer's stdout
    And the bundle includes the consumer's stdout

  Scenario: A piped producer captures stdout when requested
    Given a plan has a piped producer that emits "upstream", sets "capture" to true, and a successful consumer
    When the caller runs Yoink with the plan
    Then the bundle includes the piped producer's stdout

  Scenario: A standalone command with capture false omits its stdout
    Given a plan has a standalone command that emits "payload" with capture set to false
    When the caller runs Yoink with the plan
    Then the bundle omits the command's stdout

  Scenario: The outer content-type header is separated by a blank line
    Given a plan has one successful command
    When the caller runs Yoink with the plan
    Then the bundle begins with a content-type header followed by a blank line before the first boundary

  Scenario: A final command with pipe true is rejected
    Given a plan has a final command with pipe set to true
    When the caller runs Yoink with the plan
    Then Yoink exits with a non-zero status
    And Yoink writes a validation diagnostic for "$.commands[0].pipe" to standard error
