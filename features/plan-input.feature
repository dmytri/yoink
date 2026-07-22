@logic
Feature: Retrieval plan input
  As an agent caller
  I want to provide a JSON retrieval plan from a file or standard input
  So that I can run a prepared retrieval batch without a temporary plan file

  Scenario: A plan file supplies a root command collection
    Given a plan file named "plan.json" contains a root command collection with one retrieval command
    When the caller runs "yoink plan.json"
    Then Yoink executes the retrieval command from "plan.json"

  Scenario: Standard input supplies a root command collection
    Given standard input contains a root command collection with one retrieval command
    When the caller runs "yoink -"
    Then Yoink executes the retrieval command from standard input

  Scenario: No plan argument prints usage
    Given the caller provides no plan argument
    When the caller runs Yoink
    Then Yoink prints usage and exits successfully

  Scenario: Help flag prints usage
    Given the caller provides "--help"
    When the caller runs Yoink
    Then Yoink prints the usage text from "assets/usage.txt"
    And Yoink exits successfully

  Scenario: Version flag prints version
    Given the caller provides "--version"
    When the caller runs Yoink
    Then Yoink prints the package version and exits successfully

  Scenario: A missing plan file prints a diagnostic
    Given a plan file is missing
    When the caller runs Yoink with the plan
    Then Yoink prints a compact diagnostic for the missing file to standard error
    And the diagnostic is a single line
    And Yoink exits with a non-zero status

  Scenario: Extra arguments are rejected
    Given a plan file named "plan.json" contains a root command collection with one retrieval command
    And the caller provides an extra argument
    When the caller runs Yoink
    Then Yoink prints a diagnostic for the extra argument to standard error
    And Yoink exits with a non-zero status

  Scenario: A command pipes stdout to the next command
    Given a root command collection has a command that prints "main" and sets "pipe" to true
    And the next command reads standard input
    When the caller runs Yoink with the plan
    Then the next command receives "main" on standard input

  Scenario: A piped command streams stdout before it exits
    Given a root command collection has a piped command that stays active after writing "main"
    And the next command reads standard input
    When the caller runs Yoink with the plan
    Then the next command receives "main" before the piped command exits

  Scenario: A pipeline consumer may stop reading early
    Given a producer emits output continuously
    And the consumer exits after reading one line
    When the caller runs Yoink with the plan
    Then Yoink emits the complete bundle
    And Yoink does not crash with EPIPE

  Scenario: Pipefail reports a failed piped producer
    Given a root command collection has a failing piped producer and a successful consumer
    When the caller runs Yoink with "--pipefail"
    Then Yoink exits with a non-zero status

  Scenario: No-pipefail accepts a failed piped producer with a successful consumer
    Given a root command collection has a failing piped producer and a successful consumer
    When the caller runs Yoink with "--no-pipefail"
    Then Yoink exits successfully

  Scenario: Malformed plan input is rejected
    Given a plan file contains malformed JSON
    When the caller runs Yoink with the plan
    Then Yoink prints a compact diagnostic for invalid JSON to standard error
    And the diagnostic is a single line
    And Yoink exits with a non-zero status before executing a retrieval command

  Scenario Outline: An invalid plan identifies its invalid JSON path
    Given a plan whose <invalid value> is invalid
    When the caller runs Yoink with the plan
    Then Yoink exits with a non-zero status
    And Yoink writes a validation diagnostic for "<json path>" to standard error
    And Yoink does not execute a retrieval command

    Examples:
      | invalid value                  | json path             |
      | missing commands                | $.commands            |
      | non-array commands              | $.commands            |
      | empty command label             | $.commands[0].label   |
      | empty command run               | $.commands[0].run     |
      | unknown top-level field         | $.unexpected          |
      | unknown command field           | $.commands[0].extra   |
      | command stdin                   | $.commands[0].stdin   |
      | non-positive command timeout    | $.commands[0].timeout |
      | non-finite command timeout      | $.commands[0].timeout |
      | non-directory command cwd       | $.commands[0].cwd     |

  Scenario: Non-boolean pipe is rejected
    Given a plan whose non-boolean pipe is invalid
    When the caller runs Yoink with the plan
    Then Yoink exits with a non-zero status
    And Yoink writes a validation diagnostic for "$.commands[0].pipe" to standard error

  Scenario: Non-boolean capture is rejected
    Given a plan whose non-boolean capture is invalid
    When the caller runs Yoink with the plan
    Then Yoink exits with a non-zero status
    And Yoink writes a validation diagnostic for "$.commands[0].capture" to standard error

  Scenario: File path as cwd is rejected
    Given a plan command has a cwd that points to a file
    When the caller runs Yoink with the plan
    Then Yoink exits with a non-zero status
    And Yoink writes a validation diagnostic for "$.commands[0].cwd" to standard error

  Scenario: Non-string cwd is rejected
    Given a plan whose non-string cwd is invalid
    When the caller runs Yoink with the plan
    Then Yoink exits with a non-zero status
    And Yoink writes a validation diagnostic for "$.commands[0].cwd" to standard error

  Scenario: Unknown options are rejected
    Given the caller provides "--unknown-option"
    When the caller runs Yoink
    Then Yoink prints a diagnostic for the unknown option to standard error
    And Yoink exits with a non-zero status

  Scenario: A missing --max-bytes value is rejected
    Given the caller provides "--max-bytes"
    When the caller runs Yoink
    Then Yoink prints a diagnostic for the missing flag value to standard error
    And Yoink exits with a non-zero status

  Scenario Outline: An invalid --max-bytes value is rejected
    Given the caller provides "<flag>"
    When the caller runs Yoink with the plan
    Then Yoink prints a diagnostic for the invalid flag value to standard error
    And Yoink exits with a non-zero status

    Examples:
      | flag              |
      | --max-bytes 0     |
      | --max-bytes -1    |
      | --max-bytes NaN   |
      | --max-bytes 64x   |
      | --max-bytes 999999999999999999999999999999999999999999999999999999999999 |
      | --max-bytes 64 --max-bytes 128 |
