Feature: CLI documentation
  As an agent-skill author
  I want concise Yoink documentation
  So that I can use retrieval plans safely and correctly

  Scenario: Documentation describes the supported contract
    Given the published package documentation
    When the reader opens the Yoink README
    Then it states "Yoink executes a retrieval plan and bundles the results into model-ready multipart Markdown."
    And it describes the invocation-tax problem, JSON plans, file and standard-input use, multipart output, and exit statuses
    And it warns that plans execute trusted shell code
    And it includes a concise agent-skill example

  Scenario: Documentation identifies the installable Yoink skill
    Given the published package documentation
    When the reader opens the Yoink README
    Then it states "npx skills add dmytri/yoink"
    And it explains that the command installs the Yoink skill for agent use
