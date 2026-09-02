Feature: Boundary conditions for activity ranking
  As a product team defining the activity-ranking contract
  I want decisions near weather thresholds to be explicit
  So that small changes in forecast values do not change behaviour unexpectedly

  Scenario: Wind just below the surfing threshold does not make surfing best
    Given a town where all seven days have wind speed 24.9 km/h, just below the surfing threshold
    When I ask how suitable each activity is
    Then "Surfing" should not be the best-rated activity

  Scenario: Wind exactly at the surfing threshold makes surfing best
    Given a town where all seven days have wind speed 25.0 km/h, exactly at the surfing threshold
    When I ask how suitable each activity is
    Then "Surfing" should be the best-rated activity

  Scenario: Wind just above the surfing threshold makes surfing best
    Given a town where all seven days have wind speed 25.1 km/h, just above the surfing threshold
    When I ask how suitable each activity is
    Then "Surfing" should be the best-rated activity

  Scenario: Temperature at freezing with snowfall makes skiing best
    Given a town where all seven days have temperature 0.0°C with snowfall
    When I ask how suitable each activity is
    Then "Skiing" should be the best-rated activity

  Scenario: Temperature just below freezing with snowfall makes skiing best
    Given a town where all seven days have temperature -0.1°C, just below freezing, with snowfall
    When I ask how suitable each activity is
    Then "Skiing" should be the best-rated activity

  Scenario: Temperature just above freezing with snowfall does not make skiing best
    Given a town where all seven days have temperature 0.1°C, just above freezing, with snowfall
    When I ask how suitable each activity is
    Then "Skiing" should not be the best-rated activity

  Scenario: Rain just below the indoor threshold does not make indoor sightseeing best
    Given a town where all seven days have rainfall 4.9 mm/h, just below the indoor threshold
    When I ask how suitable each activity is
    Then "Indoor Sightseeing" should not be the best-rated activity

  Scenario: Rain exactly at the indoor threshold makes indoor sightseeing best
    Given a town where all seven days have rainfall 5.0 mm/h, exactly at the indoor threshold
    When I ask how suitable each activity is
    Then "Indoor Sightseeing" should be the best-rated activity

  Scenario: Rain just above the indoor threshold makes indoor sightseeing best
    Given a town where all seven days have rainfall 5.1 mm/h, just above the indoor threshold
    When I ask how suitable each activity is
    Then "Indoor Sightseeing" should be the best-rated activity

  Scenario: Visibility just below the outdoor threshold makes outdoor sightseeing unsuitable
    Given a town where all seven days have visibility 4999 m, just below the outdoor threshold
    When I ask how suitable each activity is
    Then "Outdoor Sightseeing" should not be the best-rated activity

  Scenario: Visibility exactly at the outdoor threshold allows outdoor sightseeing to be best
    Given a town where all seven days have visibility 5000 m, exactly at the outdoor threshold
    When I ask how suitable each activity is
    Then "Outdoor Sightseeing" should be the best-rated activity

  Scenario: Visibility just above the outdoor threshold allows outdoor sightseeing to be best
    Given a town where all seven days have visibility 5001 m, just above the outdoor threshold
    When I ask how suitable each activity is
    Then "Outdoor Sightseeing" should be the best-rated activity
