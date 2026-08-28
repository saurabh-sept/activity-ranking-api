import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getJson } from '../support/httpClient';
import { assertMatchesContract } from '../support/contract';
import { assertStatus, assertHasError } from '../support/responseAssertions';
import { weatherLocations } from '../support/weatherLocations';
import type { ActivityRankingWorld } from '../support/world';

const rankingContract = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../contracts/activity-ranking-api/ranking.response.json', import.meta.url)),
    'utf-8'
  )
);

interface Activity {
  activity: string;
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

function rankedDays(world: ActivityRankingWorld): Day[] {
  const body = world.response?.body as { days?: Day[] };
  assert.ok(Array.isArray(body?.days), 'expected a ranking with days');
  return body.days;
}

const bestRated = (day: Day): Activity => [...day.activities].sort((a, b) => b.score - a.score)[0];

Given('I have chosen a town to plan activities for', function (this: ActivityRankingWorld) {
  this.selectedCoordinates = weatherLocations.clear;
});

Given('a town where heavy snow and freezing temperatures are forecast', function (this: ActivityRankingWorld) {
  this.selectedCoordinates = weatherLocations.snowy;
});

Given('a town where clear skies and mild temperatures are forecast', function (this: ActivityRankingWorld) {
  this.selectedCoordinates = weatherLocations.clear;
});

Given('a town where strong winds and warm, dry weather are forecast', function (this: ActivityRankingWorld) {
  this.selectedCoordinates = weatherLocations.windy;
});

Given('a town where persistent rain and poor visibility are forecast', function (this: ActivityRankingWorld) {
  this.selectedCoordinates = weatherLocations.rainy;
});

Given('the weather service is temporarily unavailable', function (this: ActivityRankingWorld) {
  this.selectedCoordinates = weatherLocations.unavailable;
});

When('I ask how suitable each activity is', async function (this: ActivityRankingWorld) {
  const c = this.selectedCoordinates ?? weatherLocations.clear;
  const url = `${this.baseUrl}/rankings?latitude=${c.latitude}&longitude=${c.longitude}`;
  try {
    this.response = await getJson(url);
  } catch (err) {
    this.error = err as Error;
    this.response = undefined;
  }
});

Then('I should receive a ranking for the next {int} days', function (this: ActivityRankingWorld, count: number) {
  assertStatus(this, 200);
  assertMatchesContract(this.response!.body, rankingContract);
  assert.equal(rankedDays(this).length, count, `expected ${count} days of ranking`);
});

Then(
  'each day should rate skiing, surfing, outdoor sightseeing and indoor sightseeing',
  function (this: ActivityRankingWorld) {
    assertStatus(this, 200);
    for (const day of rankedDays(this)) {
      const names = day.activities.map((a) => a.activity).sort();
      assert.deepEqual(names, [...FOUR_ACTIVITIES].sort(), 'each day should rate all four activities');
    }
  }
);

Then('each rating should explain how suitable the day is and why', function (this: ActivityRankingWorld) {
  for (const day of rankedDays(this)) {
    assert.ok(typeof day.date === 'string' && day.date.length > 0, 'each day should have a date');
    for (const a of day.activities) {
      assert.equal(typeof a.score, 'number', 'a suitability score is required');
      assert.equal(typeof a.rating, 'string', 'a rating is required');
      assert.ok(typeof a.reasoning === 'string' && a.reasoning.length > 0, 'a reason is required');
    }
  }
});

Then(
  'every suitability score should be on a {int} to {int} scale',
  function (this: ActivityRankingWorld, min: number, max: number) {
    assertStatus(this, 200);
    for (const day of rankedDays(this)) {
      for (const a of day.activities) {
        assert.ok(a.score >= min && a.score <= max, `score ${a.score} is outside ${min}-${max}`);
      }
    }
  }
);

Then('every score should carry a matching quality rating', function (this: ActivityRankingWorld) {
  for (const day of rankedDays(this)) {
    for (const a of day.activities) {
      assert.equal(a.rating, ratingForScore(a.score), `a score of ${a.score} should be rated ${ratingForScore(a.score)}`);
    }
  }
});

Then('{string} should be the best-rated activity', function (this: ActivityRankingWorld, activity: string) {
  assertStatus(this, 200);
  const expected = toActivityKey(activity);
  for (const day of rankedDays(this)) {
    assert.equal(bestRated(day).activity, expected, `expected ${expected} to be best-rated on ${day.date}`);
  }
});

Then('the reason should mention snow', function (this: ActivityRankingWorld) {
  for (const day of rankedDays(this)) {
    assert.match(bestRated(day).reasoning, /snow/i, 'the reason should mention snow');
  }
});

Then('I should be told activity ranking is temporarily unavailable', function (this: ActivityRankingWorld) {
  assertStatus(this, 502);
  assertHasError(this);
});
