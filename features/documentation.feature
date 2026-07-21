@logic
Feature: CLI documentation
  As an agent-skill author
  I want concise Yoink documentation
  So that I can use retrieval plans safely and correctly

  Scenario: Documentation describes the supported contract
    Given the published package documentation
    When the reader opens the Yoink README
    Then it states "Yoink executes a retrieval plan and bundles the results into a model-ready multipart MIME bundle."
    And it describes the invocation-tax problem, JSON plans, file and standard-input use, multipart output, and exit statuses
    And it warns that plans execute trusted shell code
    And it includes a concise agent-skill example
    And the plan example table has four columns
    And the plan example uses a correct pipe chain
    And the Node version matches the package engines requirement

  Scenario: Documentation identifies the installable Yoink skill
    Given the published package documentation
    When the reader opens the Yoink README
    Then it states "npx skills add dmytri/yoink"
    And it explains that the command installs the Yoink skill for agent use
