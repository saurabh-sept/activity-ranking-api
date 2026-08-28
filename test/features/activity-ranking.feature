Feature: Ranking activities for the week ahead
  As someone planning activities for the week ahead
  I want each of the next seven days rated for skiing, surfing, outdoor sightseeing and indoor sightseeing
  So that I can pick the best day and activity for the weather

  Background:
    Given I have chosen a town to plan activities for

  Scenario: I receive a rating for each of the next seven days
    When I ask how suitable each activity is
    Then I should receive a ranking for the next 7 days

  Scenario: Every day rates all four activities with a reason
    When I ask how suitable each activity is
    Then each day should rate skiing, surfing, outdoor sightseeing and indoor sightseeing
    And each rating should explain how suitable the day is and why

  Scenario: Suitability is shown on a clear and consistent scale
    When I ask how suitable each activity is
    Then every suitability score should be on a 0 to 100 scale
    And every score should carry a matching quality rating

  Scenario: Heavy snow makes skiing the best choice
    Given a town where heavy snow and freezing temperatures are forecast
    When I ask how suitable each activity is
    Then "Skiing" should be the best-rated activity
    And the reason should mention snow

  Scenario: Clear, mild weather makes outdoor sightseeing the best choice
    Given a town where clear skies and mild temperatures are forecast
    When I ask how suitable each activity is
    Then "Outdoor Sightseeing" should be the best-rated activity

  Scenario: Strong winds with warm, dry weather make surfing the best choice
    Given a town where strong winds and warm, dry weather are forecast
    When I ask how suitable each activity is
    Then "Surfing" should be the best-rated activity

  Scenario: Persistent rain and poor visibility make indoor sightseeing the best choice
    Given a town where persistent rain and poor visibility are forecast
    When I ask how suitable each activity is
    Then "Indoor Sightseeing" should be the best-rated activity

  Scenario: The weather service being unavailable is reported clearly
    Given the weather service is temporarily unavailable
    When I ask how suitable each activity is
    Then I should be told activity ranking is temporarily unavailable
