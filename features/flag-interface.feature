@logic
Feature: Flag-based inline plan
  As an agent caller
  I want to specify retrieval commands using command-line flags
  So that I can avoid JSON heredocs and escaping in Markdown

  Scenario: Single command with label
    Given the caller provides "--run" and "echo hello"
    And the caller provides "--label" and "Greeting"
    When the caller runs Yoink via flags
    Then Yoink executes the retrieval command via flags
    And the command result label is "Greeting"

  Scenario: Multiple commands with pipe
    Given the caller provides "--run" and "echo hello"
    And the caller provides "--label" and "Source"
    And the caller provides the flag "--pipe"
    And the caller provides "--run" and "cat"
    And the caller provides "--label" and "Pass-through"
    When the caller runs Yoink with the plan via flags
    Then the flag bundle contains results for both commands
    And the first command result has pipe enabled

  Scenario: Command with timeout
    Given the caller provides "--run" and "sleep 10"
    And the caller provides "--timeout" and "1"
    When the caller runs Yoink with the plan via flags
    Then the flag command result is marked timed out

  Scenario: Command with cwd
    Given the caller provides "--run" and "pwd"
    And the caller provides "--cwd" and "src"
    When the caller runs Yoink with the plan via flags
    Then the flag command result names the resolved working directory

  Scenario: Command with suppressed output
    Given the caller provides "--run" and "echo hello"
    And the caller provides the flag "--no-capture"
    When the caller runs Yoink with the plan via flags
    Then the flag command result stdout is empty

  Scenario: Global flag after --run is rejected
    Given the caller provides "--run" and "echo hello"
    And the caller provides "--max-bytes" and "1000"
    When the caller runs Yoink via flags
    Then Yoink prints a diagnostic for the misplaced global flag to standard error
    And Yoink exits with a non-zero status

  Scenario: Metadata flag before --run is rejected
    Given the caller provides "--label" and "Test"
    When the caller runs Yoink via flags
    Then Yoink prints a diagnostic for the missing --run to standard error
    And Yoink exits with a non-zero status

  Scenario: Empty --run value is rejected
    Given the caller provides "--run" and ""
    When the caller runs Yoink via flags
    Then Yoink prints a diagnostic for the empty command to standard error
    And Yoink exits with a non-zero status

  Scenario: Cannot mix --run with plan file
    Given the caller provides "--run" and "echo hello"
    And the caller provides the argument "plan.json"
    When the caller runs Yoink via flags
    Then Yoink prints a diagnostic for the mixed input modes to standard error
    And Yoink exits with a non-zero status
