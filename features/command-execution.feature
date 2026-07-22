@logic
Feature: Retrieval command execution
  As an agent caller
  I want Yoink to execute each declared POSIX shell command predictably
  So that one process gathers all requested context

  Rule: Commands are trusted executable POSIX shell input.

  Scenario: Commands run in declared order
    Given a plan has commands that append "first" and then "second" to one file
    When the caller runs Yoink with the plan
    Then the file contains "first" before "second"

  Scenario: A command uses its declared working directory
    Given a plan command has a cwd relative to Yoink's starting directory
    When the command prints its working directory
    Then the command result names the resolved working directory

  Scenario: A command uses the default one-second timeout
    Given a plan command runs longer than one second without a timeout value
    When the caller runs Yoink with the plan
    Then the command result is marked timed out
    And Yoink exits with a non-zero status

  Scenario: A command overrides the default timeout
    Given a plan command runs longer than one second with a timeout of two seconds
    When the caller runs Yoink with the plan
    Then the command result is not marked timed out

  Scenario: A failed command does not stop later commands
    Given a plan has a failing command followed by a successful command
    When the caller runs Yoink with the plan
    Then the bundle contains results for both commands
    And Yoink exits with a non-zero status

  Scenario: Yoink records separate standard streams
    Given a plan command writes distinct text to standard output and standard error
    When the caller runs Yoink with the plan
    Then the bundle has one stdout part with the standard output text
    And the bundle has one stderr part with the standard error text

  Scenario: A command that ignores SIGTERM is killed with SIGKILL
    Given a plan command ignores SIGTERM without a timeout value
    When the caller runs Yoink with the plan
    Then the command result metadata signal is "SIGKILL"
    And the command result is marked timed out

  Scenario: A signal terminates all pipeline members
    Given a plan has a three-command pipeline that records PIDs
    When Yoink receives a termination signal
    Then no pipeline member PID remains running after Yoink exits

  Scenario: Output beyond the byte limit is truncated
    Given a plan command exceeds "--max-bytes"
    When the caller runs Yoink with "--max-bytes 64" and the plan
    Then the command result metadata indicates stdout was truncated
    And the stdout body is exactly 64 bytes

  Scenario: A termination signal stops active child processes
    Given a plan command has an active child process
    When Yoink receives a termination signal
    Then Yoink terminates the active child process group
    And Yoink exits with the signal-derived status

  Scenario: SIGINT terminates child process groups
    Given a plan command has an active child process
    When Yoink receives SIGINT
    Then Yoink terminates the active child process group
    And Yoink exits with the signal-derived status

  Scenario: A termination signal kills processes that ignore it
    Given a plan command ignores SIGTERM without a timeout value
    When Yoink receives a termination signal
    Then no child process remains running after Yoink exits
    And Yoink exits with a non-zero status
