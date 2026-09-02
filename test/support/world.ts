import { World, setWorldConstructor } from '@cucumber/cucumber';
import { config } from './config.js';
import type { Coordinates } from './weatherLocations.js';

export interface ApiResponse {
  status: number;
  body: unknown;
}

// Shared scenario state: the SUT base URL, the chosen location, and the outcome of the last request.
export class ActivityRankingWorld extends World {
  readonly baseUrl = config.sutBaseUrl;
  selectedCoordinates?: Coordinates;
  response?: ApiResponse;
  error?: Error;
}

setWorldConstructor(ActivityRankingWorld);
