@eval
Feature: Agent retrieval skill
  As an agent user
  I want an installable Yoink skill for multi-command retrieval
  So that the agent gathers relevant context in one bundle

  Scenario: A baseline agent batches retrieval through Yoink
    Given a baseline agent has the installed Yoink skill in a temporary workspace
    And the agent needs more than one repository or CLI retrieval
    When the agent gathers the requested context
    Then it supplies a JSON retrieval plan to Yoink through standard input
    And it consumes Yoink's multipart bundle from standard output
    And it does not create a plan or context file

  Scenario: A durable context bundle supports a later hand-off
    Given a baseline agent has the installed Yoink skill in a temporary workspace
    And a later agent or process needs the retrieved context
    When the agent gathers the requested context
    Then it writes Yoink's standard output bundle to "context.md"

  Scenario: Mixed CLI retrieval runs in one plan
    Given a baseline agent has the installed Yoink skill in a temporary workspace
    And the agent needs repository search and an upstream CLI retrieval
    When the agent gathers the requested context
    Then one JSON retrieval plan contains both commands
    And the multipart bundle contains the result of each command
