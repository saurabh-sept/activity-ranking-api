import { Given } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import type { ActivityRankingWorld } from '../support/world.js';

Given('I am planning activities for the week', function (this: ActivityRankingWorld) {
  assert.ok(this.baseUrl, 'the Activity Ranking API base URL must be configured');
});
