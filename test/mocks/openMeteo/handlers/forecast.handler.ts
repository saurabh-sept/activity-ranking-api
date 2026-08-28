import { http, HttpResponse } from 'msw';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from '../../../support/config';
import { weatherLocations, coordinateKey } from '../../../support/weatherLocations';

const load = (file: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../responses/${file}`, import.meta.url)), 'utf-8'));

// Each weather archetype maps to a minimal forecast fixture; unavailable coordinates simulate an outage.
const forecastByLocation = new Map<string, unknown>([
  [coordinateKey(weatherLocations.clear), load('forecast.clear.json')],
  [coordinateKey(weatherLocations.snowy), load('forecast.snowy.json')],
  [coordinateKey(weatherLocations.windy), load('forecast.windy.json')],
  [coordinateKey(weatherLocations.rainy), load('forecast.rainy.json')]
]);

export const forecastHandler = http.get(
  config.openMeteo.forecastUrl,
  ({ request }) => {
    const params = new URL(request.url).searchParams;
    const key = `${params.get('latitude')},${params.get('longitude')}`;
    if (key === coordinateKey(weatherLocations.unavailable)) {
      return new HttpResponse(null, { status: 503 });
    }
    return HttpResponse.json(forecastByLocation.get(key) ?? load('forecast.clear.json'));
  }
);
