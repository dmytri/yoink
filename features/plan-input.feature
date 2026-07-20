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

  Scenario: A command pipes stdout to the next command
    Given a root command collection has a command that prints "main" and sets "pipe" to true
    And the next command sets "stdin" to "args"
    When the caller runs Yoink with the plan
    Then the next command receives "main" as an argument

  Scenario: Malformed plan input is rejected
    Given a plan file contains malformed JSON
    When the caller runs Yoink with the plan
    Then Yoink exits with a non-zero status before executing a retrieval command

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
      | non-positive command timeout    | $.commands[0].timeout |
      | non-directory command cwd       | $.commands[0].cwd     |
