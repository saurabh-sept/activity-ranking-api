Feature: Finding a town to plan activities
  As someone planning activities for the week ahead
  I want to look up a town by name
  So that I can choose the right place and see how suitable each activity will be

  Background:
    Given I am planning activities for the week

  Scenario: Searching by part of a town name offers possible matches
    When I search for a town using part of its name
    Then I should see a list of possible towns
    And each town should include enough detail to choose it

  Scenario: Searching by an exact town name finds that town
    When I search for a town using its exact name
    Then I should see a single matching town

  Scenario: Searching for a town that does not exist finds nothing
    When I search for a town that does not exist
    Then I should see no matching towns

  Scenario: Searching without a town name is not allowed
    When I search without entering a town name
    Then I should be told a town name is required

  Scenario: Searching with only blank spaces is not allowed
    When I search using only blank spaces
    Then I should be told a town name is required
