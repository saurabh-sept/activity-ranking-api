Feature: Ranking activities for the week ahead
  As someone planning activities for the week ahead
  I want each of the next seven days rated for skiing, surfing, outdoor sightseeing and indoor sightseeing
  So that I can pick the best day and activity for the weather

  Background:
    Given a town using canonical week A weather:
      | day | conditions                                     |
      | 1   | heavy snow and freezing temperatures           |
      | 2   | clear skies and mild temperatures              |
      | 3   | strong winds with warm, dry weather            |
      | 4   | persistent rain and poor visibility            |
      | 5   | warm, dry and calm weather                     |
      | 6   | cold, overcast weather with limited visibility |
      | 7   | extreme heat and very high UV                  |

  Scenario: I receive a rating for each of the next seven days
    When I ask how suitable each activity is
    Then I should receive a ranking for the next 7 days

  Scenario: Every day rates all four activities with a reason
    When I ask how suitable each activity is
    Then each day should rate skiing, surfing, outdoor sightseeing and indoor sightseeing
    And each rating should explain how suitable the day is and why

  Scenario: Every day ranks the four activities from best to worst
    When I ask how suitable each activity is
    Then each day should rank the four activities from 1 to 4, best to worst

  Scenario: Suitability is shown on a clear and consistent scale
    When I ask how suitable each activity is
    Then every suitability score should be on a 0 to 100 scale
    And every score should carry a matching quality rating

  Scenario: Heavy snow makes skiing the best choice
    When I ask how suitable each activity is
    Then day 1 should be best suited to "Skiing"
    And the reason on day 1 should mention snow

  Scenario: Clear, mild weather makes outdoor sightseeing the best choice
    When I ask how suitable each activity is
    Then day 2 should be best suited to "Outdoor Sightseeing"

  Scenario: Strong winds with warm, dry weather make surfing the best choice
    When I ask how suitable each activity is
    Then day 3 should be best suited to "Surfing"

  Scenario: Persistent rain and poor visibility make indoor sightseeing the best choice
    When I ask how suitable each activity is
    Then day 4 should be best suited to "Indoor Sightseeing"

  Scenario: Warm, dry and calm weather is unsuitable for surfing
    When I ask how suitable each activity is
    Then "Surfing" should not be the best-rated activity on day 5

  Scenario: Cold overcast weather with limited visibility is unsuitable for outdoor sightseeing
    When I ask how suitable each activity is
    Then "Outdoor Sightseeing" should not be the best-rated activity on day 6

  Scenario: Extreme heat and high UV make outdoor sightseeing unsuitable
    When I ask how suitable each activity is
    Then "Outdoor Sightseeing" should not be the best-rated activity on day 7

  Scenario: Severe wet and windy weather is unsuitable for surfing and outdoor sightseeing
    Given a town using canonical week B weather:
      | day | conditions                                       |
      | 1   | severe rain, poor visibility and dangerous winds |
      | 2   | cold, dry weather with no snowfall               |
      | 3   | clear skies and mild temperatures                |
      | 4   | strong winds with warm, dry weather              |
      | 5   | persistent rain and poor visibility              |
      | 6   | heavy snow and freezing temperatures             |
      | 7   | warm, dry and calm weather                       |
    When I ask how suitable each activity is
    Then "Surfing" should not be the best-rated activity on day 1
    And "Outdoor Sightseeing" should not be the best-rated activity on day 1

  Scenario: The weather service being unavailable is reported clearly
    Given the weather service is temporarily unavailable
    When I ask how suitable each activity is
    Then I should be told activity ranking is temporarily unavailable

  Scenario: Cold but dry conditions should not favour skiing
    Given a town using canonical week B weather:
      | day | conditions                                       |
      | 1   | severe rain, poor visibility and dangerous winds |
      | 2   | cold, dry weather with no snowfall               |
      | 3   | clear skies and mild temperatures                |
      | 4   | strong winds with warm, dry weather              |
      | 5   | persistent rain and poor visibility              |
      | 6   | heavy snow and freezing temperatures             |
      | 7   | warm, dry and calm weather                       |
    When I ask how suitable each activity is
    Then "Skiing" should not be the best-rated activity on day 2

  Scenario: Pleasant clear dry weather should not favour indoor sightseeing
    Given a town using canonical week B weather:
      | day | conditions                                       |
      | 1   | severe rain, poor visibility and dangerous winds |
      | 2   | cold, dry weather with no snowfall               |
      | 3   | clear skies and mild temperatures                |
      | 4   | strong winds with warm, dry weather              |
      | 5   | persistent rain and poor visibility              |
      | 6   | heavy snow and freezing temperatures             |
      | 7   | warm, dry and calm weather                       |
    When I ask how suitable each activity is
    Then "Indoor Sightseeing" should not be the best-rated activity on day 3

  Scenario: A full week with changing weather conditions
    Given a town using canonical week B weather:
      | day | conditions                                       |
      | 1   | severe rain, poor visibility and dangerous winds |
      | 2   | cold, dry weather with no snowfall               |
      | 3   | clear skies and mild temperatures                |
      | 4   | strong winds with warm, dry weather              |
      | 5   | persistent rain and poor visibility              |
      | 6   | heavy snow and freezing temperatures             |
      | 7   | warm, dry and calm weather                       |
    When I ask how suitable each activity is
    Then day 1 should be best suited to "Indoor Sightseeing"
    And day 2 should be best suited to "Indoor Sightseeing"
    And day 3 should be best suited to "Outdoor Sightseeing"
    And day 4 should be best suited to "Surfing"
    And day 5 should be best suited to "Indoor Sightseeing"
    And day 6 should be best suited to "Skiing"
    And day 7 should be best suited to "Outdoor Sightseeing"
    And each day should rank the four activities from 1 to 4, best to worst
