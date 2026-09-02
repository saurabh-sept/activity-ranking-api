import assert from 'node:assert/strict';
import type { ActivityRankingWorld } from './world.js';

// Shared guard: fails with a clear RED message when the absent SUT returned nothing.
export function assertStatus(world: ActivityRankingWorld, expected: number): void {
  if (!world.response) {
    throw new Error(
      `Expected HTTP ${expected} but no response was received from the SUT at ${world.baseUrl}. ` +
        `The Activity Ranking API is not implemented yet (intended RED state). ` +
        `Cause: ${world.error?.message ?? 'unknown'}`
    );
  }
  assert.equal(world.response.status, expected);
}

export function assertHasError(world: ActivityRankingWorld): void {
  const body = world.response?.body as Record<string, unknown> | undefined;
  assert.ok(
    body && typeof body === 'object' && 'error' in body,
    'response body should explain what went wrong via an "error" field'
  );
}
