import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { openMeteoServer } from './server.js';
import { toOpenMeteoForecast, isValidDaylight, type ForecastProfile } from './forecastFixture.js';
import { sutConfig } from '../../../src/config.js';
import { weatherLocations } from '../../support/weatherLocations.js';

type GeocodingBody = { results: unknown[] };
type ErrorBody = { error: string };

before(async () => {
  openMeteoServer.listen({ onUnhandledRequest: 'error' });
});

after(async () => {
  openMeteoServer.close();
});

test('returns a complete canonical seven-day forecast', async () => {
  const location = weatherLocations.weekA;
  const url = new URL(sutConfig.openMeteo.forecastUrl);
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  const response = await fetch(url);
  const body = (await response.json()) as {
    generationtime_ms: number;
    utc_offset_seconds: number;
    timezone: string;
    timezone_abbreviation: string;
    elevation: number;
    hourly: { temperature_2m: unknown[]; rain: number[]; showers: number[]; snowfall: number[] };
    daily: { time: unknown[]; precipitation_hours: number[] };
  };

  assert.equal(response.status, 200);
  assert.equal(body.hourly.temperature_2m.length, 168);
  assert.equal(body.daily.time.length, 7);

  // Metadata mirrors a real Open-Meteo response.
  assert.equal(typeof body.generationtime_ms, 'number');
  assert.equal(body.utc_offset_seconds, 0);
  assert.equal(body.timezone, 'GMT');
  assert.equal(body.timezone_abbreviation, 'GMT');
  assert.equal(body.elevation, 25.0);

  // precipitation_hours must be self-consistent with the expanded hourly arrays:
  // each day counts the number of 24 hours with measurable rain, showers or snowfall.
  assert.equal(body.daily.precipitation_hours.length, 7);
  for (let day = 0; day < 7; day++) {
    const offset = day * 24;
    const rainyHours = Array.from({ length: 24 }, (_, hour): number => {
      const i = offset + hour;
      return body.hourly.rain[i] > 0 || body.hourly.showers[i] > 0 || body.hourly.snowfall[i] > 0 ? 1 : 0;
    }).reduce((sum, value) => sum + value, 0);
    assert.equal(
      body.daily.precipitation_hours[day],
      rainyHours,
      `day ${day + 1} precipitation_hours should match the expanded hourly data`
    );
  }
});

test('routes geocoding response classes by name', async () => {
  const partial = await fetch(`${sutConfig.openMeteo.geocodingUrl}?name=cape`);
  const exact = await fetch(`${sutConfig.openMeteo.geocodingUrl}?name=capetowne`);
  const unknown = await fetch(`${sutConfig.openMeteo.geocodingUrl}?name=unknown`);

  assert.equal(partial.status, 200);
  assert.equal(exact.status, 200);
  assert.equal(unknown.status, 200);
  const partialBody = (await partial.json()) as GeocodingBody;
  const exactBody = (await exact.json()) as GeocodingBody;
  const unknownBody = (await unknown.json()) as GeocodingBody;
  assert.equal(partialBody.results.length > 1, true);
  assert.equal(exactBody.results.length, 1);
  assert.equal(unknownBody.results.length, 0);
});

test('returns deterministic errors for unavailable and unmapped forecasts', async () => {
  const unavailable = await fetch(`${sutConfig.openMeteo.forecastUrl}?latitude=0&longitude=0`);
  const unmapped = await fetch(`${sutConfig.openMeteo.forecastUrl}?latitude=1&longitude=1`);

  assert.equal(unavailable.status, 503);
  assert.equal(unmapped.status, 404);
  assert.equal((await unavailable.json() as ErrorBody).error, 'Weather service unavailable');
  assert.equal((await unmapped.json() as ErrorBody).error, 'Forecast fixture not found for coordinates');
});

// The real Open-Meteo response structure for the requested variable set. The mock must
// manufacture nothing: key sets at every level must match exactly, no more, no less.
const HOURLY_VARIABLES = ['temperature_2m', 'rain', 'showers', 'snowfall', 'wind_speed_10m', 'visibility', 'cloud_cover'];
const REAL_TOP_KEYS = [
  'latitude', 'longitude', 'generationtime_ms', 'utc_offset_seconds', 'timezone',
  'timezone_abbreviation', 'elevation', 'hourly_units', 'hourly', 'daily_units', 'daily'
];
const REAL_HOURLY_KEYS = ['time', ...HOURLY_VARIABLES];
const REAL_DAILY_KEYS = ['time', 'uv_index_max', 'precipitation_hours', 'sunrise', 'sunset'];

type ForecastBody = {
  latitude: number;
  longitude: number;
  hourly_units: Record<string, string>;
  hourly: Record<string, number[]>;
  daily_units: Record<string, string>;
  daily: Record<string, number[]>;
};

test('serves exactly the real Open-Meteo response structure', async () => {
  const location = weatherLocations.weekA;
  const url = new URL(sutConfig.openMeteo.forecastUrl);
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  const response = await fetch(url);
  assert.equal(response.status, 200);
  const body = (await response.json()) as ForecastBody;

  const keySets: Array<[string, string[], string[]]> = [
    ['top-level', Object.keys(body), REAL_TOP_KEYS],
    ['hourly_units', Object.keys(body.hourly_units), REAL_HOURLY_KEYS],
    ['hourly', Object.keys(body.hourly), REAL_HOURLY_KEYS],
    ['daily_units', Object.keys(body.daily_units), REAL_DAILY_KEYS],
    ['daily', Object.keys(body.daily), REAL_DAILY_KEYS]
  ];
  for (const [name, actual, expected] of keySets) {
    assert.deepEqual(
      [...actual].sort(),
      [...expected].sort(),
      `${name} keys must match the real Open-Meteo response exactly (no invented fields)`
    );
  }

  // The response echoes the requested coordinates.
  assert.equal(body.latitude, location.latitude);
  assert.equal(body.longitude, location.longitude);

  // 168 aligned hourly samples, 7 daily values.
  for (const key of REAL_HOURLY_KEYS) assert.equal(body.hourly[key].length, 168, `hourly.${key}`);
  for (const key of REAL_DAILY_KEYS) assert.equal(body.daily[key].length, 7, `daily.${key}`);

  // Time relations: contiguous hourly steps and midnight alignment.
  for (let i = 1; i < 168; i++) {
    assert.equal(body.hourly.time[i] - body.hourly.time[i - 1], 3600, 'hourly time must be contiguous');
  }
  for (let day = 0; day < 7; day++) {
    assert.equal(body.daily.time[day], body.hourly.time[day * 24], 'daily time must align with the first hourly sample of the day');
    const start = body.daily.time[day];
    assert.ok(body.daily.sunrise[day] > start && body.daily.sunrise[day] < start + 86_400, 'sunrise must fall inside its day');
    assert.ok(
      body.daily.sunset[day] > body.daily.sunrise[day] && body.daily.sunset[day] < start + 86_400,
      'sunset must fall inside its day, after sunrise'
    );
  }
});

test('aligns hourly day-parts with the configured daylight window', () => {
  const profile: ForecastProfile = {
    latitude: 10,
    longitude: 20,
    timezone: 'GMT',
    daylight: { sunriseHour: 5, sunsetHour: 20 },
    hourly: {
      temperature_2m: [10, 20, 2],
      rain: [0, 0, 0],
      showers: [0, 0, 0],
      snowfall: [0, 0, 0],
      wind_speed_10m: [5, 5, 5],
      visibility: [30000, 30000, 30000],
      cloud_cover: [10, 10, 10]
    },
    daily: { uv_index_max: [1, 2, 3, 4, 5, 6, 7] }
  };
  const out = toOpenMeteoForecast(profile) as { hourly: Record<string, number[]>; daily: Record<string, number[]> };

  // Sunrise/sunset come from the window.
  assert.equal(out.daily.sunrise[0], out.daily.time[0] + 5 * 3_600);
  assert.equal(out.daily.sunset[0], out.daily.time[0] + 20 * 3_600);

  // Hourly day-parts follow the window: night before 05:00, morning 05:00-11:00,
  // afternoon 12:00-19:00, night again from 20:00.
  const temps = out.hourly.temperature_2m;
  assert.equal(temps[0], 2);
  assert.equal(temps[4], 2);
  assert.equal(temps[5], 10);
  assert.equal(temps[11], 10);
  assert.equal(temps[12], 20);
  assert.equal(temps[19], 20);
  assert.equal(temps[20], 2);
  assert.equal(temps[23], 2);
});

test('validates daylight windows', () => {
  assert.equal(isValidDaylight(undefined), true);
  assert.equal(isValidDaylight({ sunriseHour: 6, sunsetHour: 18 }), true);
  assert.equal(isValidDaylight({ sunriseHour: 0, sunsetHour: 23 }), true);
  assert.equal(isValidDaylight({ sunriseHour: 18, sunsetHour: 6 }), false);
  assert.equal(isValidDaylight({ sunriseHour: 6.5, sunsetHour: 18 }), false);
  assert.equal(isValidDaylight({ sunriseHour: 6, sunsetHour: 24 }), false);
});

