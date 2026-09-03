import { Given, When, Then, type DataTable } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getJson } from '../support/httpClient.js';
import { assertMatchesContract } from '../support/contract.js';
import { assertStatus, assertHasError } from '../support/responseAssertions.js';
import { weatherLocations } from '../support/weatherLocations.js';
import type { ActivityRankingWorld } from '../support/world.js';

const rankingContract = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../contracts/activity-ranking-api/ranking.response.json', import.meta.url)),
    'utf-8'
  )
);

interface Activity {
  activity: string;
  rank: number;
  score: number;
  rating: string;
  reasoning: string;
}

interface Day {
  date: string;
  topActivity: string;
  activities: Activity[];
}

const FOUR_ACTIVITIES = ['Skiing', 'Surfing', 'OutdoorSightseeing', 'IndoorSightseeing'];

// Maps the domain wording used in features to the activity key used in the contract.
const ACTIVITY_KEYS: Record<string, string> = {
  skiing: 'Skiing',
  surfing: 'Surfing',
  'outdoor sightseeing': 'OutdoorSightseeing',
  'indoor sightseeing': 'IndoorSightseeing'
};
const toActivityKey = (label: string): string => ACTIVITY_KEYS[label.trim().toLowerCase()] ?? label;

// The intended score-to-rating banding the SUT must honour.
const RATING_BANDS: Array<{ max: number; rating: string }> = [
  { max: 24, rating: 'Poor' },
  { max: 49, rating: 'Fair' },
  { max: 74, rating: 'Good' },
  { max: 100, rating: 'Excellent' }
];
const ratingForScore = (score: number): string | undefined =>
  RATING_BANDS.find((band) => score <= band.max)?.rating;

// The four activities must occupy ranks 1-4 exactly once, scores must be non-increasing
// as rank increases, and rank 1 must be the day's topActivity. Tied scores may be ranked
// in either order (the tie policy is documented in ranking-thresholds.md).
function assertCompleteRanks(day: Day): void {
  for (const activity of day.activities) {
    assert.ok(
      Number.isInteger(activity.rank) && activity.rank >= 1 && activity.rank <= 4,
      `${activity.activity} on ${day.date} should have an integer rank 1-4, got ${activity.rank}`
    );
  }
  const ranks = day.activities.map((activity) => activity.rank).sort((a, b) => a - b);
  assert.deepEqual(ranks, [1, 2, 3, 4], `the four activities on ${day.date} should occupy ranks 1-4 exactly once`);
  const byRank = [...day.activities].sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < byRank.length; i++) {
    assert.ok(
      byRank[i - 1].score >= byRank[i].score,
      `rank ${i} (${byRank[i - 1].activity}, score ${byRank[i - 1].score}) should not score below rank ${i + 1} (${byRank[i].activity}, score ${byRank[i].score}) on ${day.date}`
    );
  }
  assert.equal(byRank[0].activity, day.topActivity, `rank 1 should be the topActivity on ${day.date}`);
}

function rankedDays(world: ActivityRankingWorld): Day[] {
  const body = world.response?.body as { days?: Day[] };
  assert.ok(Array.isArray(body?.days), 'expected a ranking with days');
  for (const [index, day] of body.days.entries()) {
    assert.match(day.date, /^\d{4}-\d{2}-\d{2}$/, 'each day should have an ISO date');
    assert.equal(new Date(`${day.date}T00:00:00.000Z`).toISOString().slice(0, 10), day.date, `day ${index + 1} should contain a valid calendar date`);
    if (index > 0) {
      const previousDate = Date.parse(`${body.days[index - 1].date}T00:00:00.000Z`);
      const currentDate = Date.parse(`${day.date}T00:00:00.000Z`);
      assert.equal(currentDate - previousDate, 86_400_000, `day ${index + 1} should follow the previous day`);
    }
    assertCompleteRanks(day);
  }
  return body.days;
}

// Best-rated = rank 1. Falls back to the highest score only if ranks are absent,
// so failure messages stay meaningful if the contract is ever violated.
const bestRated = (day: Day): Activity =>
  day.activities.find((activity) => activity.rank === 1) ?? [...day.activities].sort((a, b) => b.score - a.score)[0];

function assertRankingResponse(world: ActivityRankingWorld, expectedDays = 7): Day[] {
  assertStatus(world, 200);
  assertMatchesContract(world.response!.body, rankingContract);
  const days = rankedDays(world);
  assert.equal(days.length, expectedDays, `expected ${expectedDays} days of ranking`);
  for (const day of days) {
    const names = day.activities.map((activity) => activity.activity).sort();
    assert.deepEqual(names, [...FOUR_ACTIVITIES].sort(), 'each day should rate all four activities');
    for (const activity of day.activities) {
      assert.equal(typeof activity.score, 'number', 'a suitability score is required');
      assert.ok(activity.score >= 0 && activity.score <= 100, `score ${activity.score} is outside 0-100`);
      assert.equal(activity.rating, ratingForScore(activity.score), `a score of ${activity.score} should have a matching rating`);
      assert.ok(typeof activity.reasoning === 'string' && activity.reasoning.length > 0, 'a reason is required');
    }
  }
  return days;
}

const WEEK_A_CONDITIONS = [
  'heavy snow and freezing temperatures',
  'clear skies and mild temperatures',
  'strong winds with warm, dry weather',
  'persistent rain and poor visibility',
  'warm, dry and calm weather',
  'cold, overcast weather with limited visibility',
  'extreme heat and very high UV'
];
const WEEK_B_CONDITIONS = [
  'severe rain, poor visibility and dangerous winds',
  'cold, dry weather with no snowfall',
  'clear skies and mild temperatures',
  'strong winds with warm, dry weather',
  'persistent rain and poor visibility',
  'heavy snow and freezing temperatures',
  'warm, dry and calm weather'
];

function assertForecastTable(table: DataTable, expectedConditions: string[]): void {
  const rows = table.rows();
  assert.equal(rows.length, 7, 'the forecast should describe all seven days');
  assert.deepEqual(
    rows.map(([day, conditions]) => [Number(day), conditions]),
    expectedConditions.map((conditions, index) => [index + 1, conditions]),
    'the declared weekly weather should match the canonical fixture'
  );
}

Given('a town using canonical week A weather:', function (this: ActivityRankingWorld, table: DataTable) {
  assertForecastTable(table, WEEK_A_CONDITIONS);
  this.selectedCoordinates = weatherLocations.weekA;
});

Given('a town using canonical week B weather:', function (this: ActivityRankingWorld, table: DataTable) {
  assertForecastTable(table, WEEK_B_CONDITIONS);
  this.selectedCoordinates = weatherLocations.weekB;
});

Given('a town where all seven days have wind speed {float} km\/h, just below the surfing threshold', function (this: ActivityRankingWorld, value: number) {
  assert.equal(value, 24.9);
  this.selectedCoordinates = weatherLocations.boundaryWindLow;
});

Given('a town where all seven days have wind speed {float} km\/h, exactly at the surfing threshold', function (this: ActivityRankingWorld, value: number) {
  assert.equal(value, 25.0);
  this.selectedCoordinates = weatherLocations.boundaryWindExact;
});

Given('a town where all seven days have wind speed {float} km\/h, just above the surfing threshold', function (this: ActivityRankingWorld, value: number) {
  assert.equal(value, 25.1);
  this.selectedCoordinates = weatherLocations.boundaryWindHigh;
});

Given('a town where all seven days have temperature 0.0°C with snowfall', function (this: ActivityRankingWorld) {
  this.selectedCoordinates = weatherLocations.boundaryFreeze;
});

Given('a town where all seven days have temperature -0.1°C, just below freezing, with snowfall', function (this: ActivityRankingWorld) {
  this.selectedCoordinates = weatherLocations.boundaryFreezeLow;
});

Given('a town where all seven days have temperature 0.1°C, just above freezing, with snowfall', function (this: ActivityRankingWorld) {
  this.selectedCoordinates = weatherLocations.boundaryThaw;
});

Given('a town where all seven days have rainfall {float} mm\/h, just below the indoor threshold', function (this: ActivityRankingWorld, value: number) {
  assert.equal(value, 4.9);
  this.selectedCoordinates = weatherLocations.boundaryRainLow;
});

Given('a town where all seven days have rainfall {float} mm\/h, exactly at the indoor threshold', function (this: ActivityRankingWorld, value: number) {
  assert.equal(value, 5.0);
  this.selectedCoordinates = weatherLocations.boundaryRainExact;
});

Given('a town where all seven days have rainfall {float} mm\/h, just above the indoor threshold', function (this: ActivityRankingWorld, value: number) {
  assert.equal(value, 5.1);
  this.selectedCoordinates = weatherLocations.boundaryRainHigh;
});

Given('a town where all seven days have visibility 4999 m, just below the outdoor threshold', function (this: ActivityRankingWorld) {
  this.selectedCoordinates = weatherLocations.boundaryVisibilityLow;
});

Given('a town where all seven days have visibility 5000 m, exactly at the outdoor threshold', function (this: ActivityRankingWorld) {
  this.selectedCoordinates = weatherLocations.boundaryVisibilityExact;
});

Given('a town where all seven days have visibility 5001 m, just above the outdoor threshold', function (this: ActivityRankingWorld) {
  this.selectedCoordinates = weatherLocations.boundaryVisibilityHigh;
});

Given('the weather service is temporarily unavailable', function (this: ActivityRankingWorld) {
  this.selectedCoordinates = weatherLocations.unavailable;
});

When('I ask how suitable each activity is', async function (this: ActivityRankingWorld) {
  const c = this.selectedCoordinates ?? weatherLocations.weekA;
  const url = `${this.baseUrl}/rankings?latitude=${c.latitude}&longitude=${c.longitude}`;
  try {
    this.response = await getJson(url);
  } catch (err) {
    this.error = err as Error;
    this.response = undefined;
  }
});

Then('I should receive a ranking for the next {int} days', function (this: ActivityRankingWorld, count: number) {
  assertRankingResponse(this, count);
});

Then(
  'each day should rate skiing, surfing, outdoor sightseeing and indoor sightseeing',
  function (this: ActivityRankingWorld) {
    assertRankingResponse(this);
  }
);

Then('each rating should explain how suitable the day is and why', function (this: ActivityRankingWorld) {
  assertRankingResponse(this);
});

Then(
  'every suitability score should be on a {int} to {int} scale',
  function (this: ActivityRankingWorld, min: number, max: number) {
    for (const day of assertRankingResponse(this)) {
      for (const a of day.activities) {
        assert.ok(a.score >= min && a.score <= max, `score ${a.score} is outside ${min}-${max}`);
      }
    }
  }
);

Then('every score should carry a matching quality rating', function (this: ActivityRankingWorld) {
  assertRankingResponse(this);
});

Then('{string} should be the best-rated activity', function (this: ActivityRankingWorld, activity: string) {
  const expected = toActivityKey(activity);
  for (const day of assertRankingResponse(this)) {
    assert.equal(bestRated(day).activity, expected, `expected ${expected} to be best-rated on ${day.date}`);
  }
});

Then('day {int} should be best suited to {string}', function (this: ActivityRankingWorld, dayNumber: number, activity: string) {
  const day = assertRankingResponse(this)[dayNumber - 1];
  assert.ok(day, `expected day ${dayNumber} in the ranking`);
  assert.equal(bestRated(day).activity, toActivityKey(activity), `expected ${activity} to be best-rated on ${day.date}`);
});

Then('{string} should not be the best-rated activity', function (this: ActivityRankingWorld, activity: string) {
  const unexpected = toActivityKey(activity);
  for (const day of assertRankingResponse(this)) {
    assert.notEqual(bestRated(day).activity, unexpected, `did not expect ${unexpected} to be best-rated on ${day.date}`);
  }
});

Then('{string} should not be the best-rated activity on day {int}', function (this: ActivityRankingWorld, activity: string, dayNumber: number) {
  const day = assertRankingResponse(this)[dayNumber - 1];
  assert.ok(day, `expected day ${dayNumber} in the ranking`);
  assert.notEqual(bestRated(day).activity, toActivityKey(activity), `did not expect ${activity} to be best-rated on ${day.date}`);
});

Then('the reason should mention snow', function (this: ActivityRankingWorld) {
  for (const day of assertRankingResponse(this)) {
    assert.match(bestRated(day).reasoning, /snow/i, 'the reason should mention snow');
  }
});

Then('the reason on day {int} should mention snow', function (this: ActivityRankingWorld, dayNumber: number) {
  const day = assertRankingResponse(this)[dayNumber - 1];
  assert.ok(day, `expected day ${dayNumber} in the ranking`);
  assert.match(bestRated(day).reasoning, /snow/i, 'the reason should mention snow');
});

Then('I should be told activity ranking is temporarily unavailable', function (this: ActivityRankingWorld) {
  assertStatus(this, 502);
  assertHasError(this);
});

Then('each day should rank the four activities from 1 to 4, best to worst', function (this: ActivityRankingWorld) {
  // Explicit spec-level guarantee, asserted per day: every one of the seven days occupies
  // ranks 1-4 exactly once, scores are non-increasing by rank, and rank 1 is the topActivity.
  // (assertRankingResponse enforces the same contract on every ranking scenario.)
  for (const day of assertRankingResponse(this)) {
    assertCompleteRanks(day);
  }
});
