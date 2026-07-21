@eval
Feature: Agent retrieval skill
  As an agent user
  I want an installable Yoink skill for multi-command retrieval
  So that the agent gathers relevant context in one bundle

  Scenario: A baseline agent batches retrieval through Yoink
    Given a baseline agent has the Yoink skill from "skills/yoink" in a temporary workspace
    And the baseline agent runs under a throwaway home directory
    And the baseline agent runs "node_modules/.bin/pi" with isolated XDG directories
    And the baseline agent receives its API key and model from Yoink's ".env" file
    And the baseline agent starts Pi with the configured OpenRouter provider, task prompt, and session directory
    And the agent receives the verbatim retrieval plan in "assets/eval-retrieval-plan.json"
    When the agent gathers the requested context
    Then it passes the verbatim retrieval plan to Yoink as its positional argument
    And it invokes Yoink from the workspace-local node_modules directory
    And it consumes Yoink's multipart bundle from standard output
    And the bundle contains every retrieval-plan result
    And it does not create a plan or context file
    And the evaluation writes Pi exit status, standard output, standard error, duration, and session transcript under "coverage/eval"
    And the recorded Pi executable is "node_modules/.bin/pi"
    And the recorded Pi environment sets HOME, XDG_CONFIG_HOME, XDG_DATA_HOME, and XDG_CACHE_HOME under the throwaway home directory
    And the recorded Pi invocation uses "-p", "--provider openrouter", "--model", "--skill", and "--session-dir"
    And the recorded Pi invocation does not use "--no-session"
    And the retained Pi session transcript is not empty

  Scenario: A durable context bundle supports a later hand-off
    Given a baseline agent has the Yoink skill from "skills/yoink" in a temporary workspace
    And the baseline agent runs under a throwaway home directory
    And the baseline agent runs "node_modules/.bin/pi" with isolated XDG directories
    And the baseline agent receives its API key and model from Yoink's ".env" file
    And the baseline agent starts Pi with the configured OpenRouter provider, task prompt, and session directory
    And the agent receives the verbatim retrieval plan in "assets/eval-retrieval-plan.json"
    When the agent gathers the requested context
    Then it writes Yoink's standard output bundle to "context.md"
    And "context.md" contains every retrieval-plan result
