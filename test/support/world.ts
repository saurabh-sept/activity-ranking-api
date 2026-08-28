import { World, setWorldConstructor } from '@cucumber/cucumber';
import { config } from './config';
import type { Coordinates } from './weatherLocations';

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
