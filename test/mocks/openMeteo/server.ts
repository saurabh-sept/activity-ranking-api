import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sutConfig } from '../../../src/config.js';
import { weatherLocations, coordinateKey } from '../../support/weatherLocations.js';
import { toOpenMeteoForecast, isValidDaylight, type ForecastProfile } from './forecastFixture.js';

const load = (file: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./responses/${file}`, import.meta.url)), 'utf-8'));

const isNumberArray = (value: unknown, length: number): value is number[] =>
  Array.isArray(value) && value.length === length && value.every((item) => typeof item === 'number');

const forecastHourlyFields = [
  'temperature_2m', 'rain', 'showers', 'snowfall', 'wind_speed_10m', 'visibility', 'cloud_cover'
] as const;

const loadForecast = (file: string): ForecastProfile => {
  const profile = load(file) as Partial<ForecastProfile>;
  const hourly = profile.hourly as Partial<ForecastProfile['hourly']> | undefined;
  const daily = profile.daily as Partial<ForecastProfile['daily']> | undefined;
  const weekly = profile.weeklyHourly as Partial<ForecastProfile['weeklyHourly']> | undefined;
  const validHourly = hourly && forecastHourlyFields.every((field) => isNumberArray(hourly[field], 3));
  const validDaily = daily && isNumberArray(daily.uv_index_max, 7);
  const validWeekly = !weekly || forecastHourlyFields.every((field) => {
    const days = weekly[field];
    return Array.isArray(days) && days.length === 7 && days.every((day) => isNumberArray(day, 3));
  });
  const validDaylight = isValidDaylight(profile.daylight);

  if (typeof profile.latitude !== 'number' || typeof profile.longitude !== 'number' ||
    !profile.timezone || !validHourly || !validDaily || !validWeekly || !validDaylight) {
    throw new Error(`Invalid forecast fixture: ${file}`);
  }
  return profile as ForecastProfile;
};

const forecastByLocation = new Map<string, ForecastProfile>([
  [coordinateKey(weatherLocations.weekA), loadForecast('forecast.week-a.json')],
  [coordinateKey(weatherLocations.weekB), loadForecast('forecast.week-b.json')],
  [coordinateKey(weatherLocations.boundaryWindLow), loadForecast('forecast.boundary-wind-low.json')],
  [coordinateKey(weatherLocations.boundaryWindExact), loadForecast('forecast.boundary-wind-exact.json')],
  [coordinateKey(weatherLocations.boundaryWindHigh), loadForecast('forecast.boundary-wind-high.json')],
  [coordinateKey(weatherLocations.boundaryFreeze), loadForecast('forecast.boundary-freeze.json')],
  [coordinateKey(weatherLocations.boundaryFreezeLow), loadForecast('forecast.boundary-freeze-low.json')],
  [coordinateKey(weatherLocations.boundaryThaw), loadForecast('forecast.boundary-thaw.json')],
  [coordinateKey(weatherLocations.boundaryRainLow), loadForecast('forecast.boundary-rain-low.json')],
  [coordinateKey(weatherLocations.boundaryRainExact), loadForecast('forecast.boundary-rain-exact.json')],
  [coordinateKey(weatherLocations.boundaryRainHigh), loadForecast('forecast.boundary-rain-high.json')],
  [coordinateKey(weatherLocations.boundaryVisibilityLow), loadForecast('forecast.boundary-visibility-low.json')],
  [coordinateKey(weatherLocations.boundaryVisibilityExact), loadForecast('forecast.boundary-visibility-exact.json')],
  [coordinateKey(weatherLocations.boundaryVisibilityHigh), loadForecast('forecast.boundary-visibility-high.json')]
]);

export const openMeteoServer = setupServer(
  http.get(sutConfig.openMeteo.geocodingUrl, ({ request }) => {
    const name = (new URL(request.url).searchParams.get('name') ?? '').trim().toLowerCase();
    const file = name === 'capetowne' ? 'geocoding.exact.json' : name.startsWith('cape') ? 'geocoding.partial.json' : 'geocoding.nomatch.json';
    return HttpResponse.json(load(file) as Record<string, unknown>);
  }),
  http.get(sutConfig.openMeteo.forecastUrl, ({ request }) => {
    const url = new URL(request.url);
    const key = `${url.searchParams.get('latitude')},${url.searchParams.get('longitude')}`;
    if (key === coordinateKey(weatherLocations.unavailable)) {
      return HttpResponse.json({ error: 'Weather service unavailable' }, { status: 503 });
    }
    const profile = forecastByLocation.get(key);
    if (!profile) return HttpResponse.json({ error: 'Forecast fixture not found for coordinates' }, { status: 404 });
    return HttpResponse.json(toOpenMeteoForecast(profile));
  })
);
