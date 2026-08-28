import { When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getJson } from '../support/httpClient';
import { assertMatchesContract } from '../support/contract';
import { assertStatus, assertHasError } from '../support/responseAssertions';
import type { ActivityRankingWorld } from '../support/world';

const locationsContract = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../contracts/activity-ranking-api/locations.response.json', import.meta.url)),
    'utf-8'
  )
);

interface Town {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

async function search(world: ActivityRankingWorld, name: string): Promise<void> {
  const url = `${world.baseUrl}/locations?name=${encodeURIComponent(name)}`;
  try {
    world.response = await getJson(url);
  } catch (err) {
    world.error = err as Error;
    world.response = undefined;
  }
}

When('I search for a town using part of its name', async function (this: ActivityRankingWorld) {
  await search(this, 'cape');
});

When('I search for a town using its exact name', async function (this: ActivityRankingWorld) {
  await search(this, 'capetowne');
});

When('I search for a town that does not exist', async function (this: ActivityRankingWorld) {
  await search(this, 'zzzzzzzz');
});

When('I search without entering a town name', async function (this: ActivityRankingWorld) {
  await search(this, '');
});

When('I search using only blank spaces', async function (this: ActivityRankingWorld) {
  await search(this, '   ');
});

Then('I should see a list of possible towns', function (this: ActivityRankingWorld) {
  assertStatus(this, 200);
  assertMatchesContract(this.response!.body, locationsContract);
  const body = this.response!.body as { results?: unknown[] };
  assert.ok(Array.isArray(body.results) && body.results.length > 1, 'expected several possible towns');
});

Then('each town should include enough detail to choose it', function (this: ActivityRankingWorld) {
  const body = this.response!.body as { results?: Town[] };
  assert.ok(Array.isArray(body?.results), 'expected a list of towns');
  for (const town of body.results) {
    assert.ok(town.name, 'a town should have a name');
    assert.equal(typeof town.latitude, 'number', 'a town should have a location');
    assert.equal(typeof town.longitude, 'number', 'a town should have a location');
    assert.equal(typeof town.timezone, 'string', 'a town should have a timezone');
  }
});

Then('I should see a single matching town', function (this: ActivityRankingWorld) {
  assertStatus(this, 200);
  const body = this.response!.body as { results?: unknown[] };
  assert.ok(Array.isArray(body.results) && body.results.length === 1, 'expected exactly one town');
});

Then('I should see no matching towns', function (this: ActivityRankingWorld) {
  assertStatus(this, 200);
  const body = this.response!.body as { results?: unknown[] };
  assert.ok(Array.isArray(body.results) && body.results.length === 0, 'expected no towns');
});

Then('I should be told a town name is required', function (this: ActivityRankingWorld) {
  assertStatus(this, 400);
  assertHasError(this);
});
