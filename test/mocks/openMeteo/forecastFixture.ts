// Daylight window in whole hours, matching the daily sunrise/sunset the response reports.
// The three day-part values are aligned to it: morning runs [sunriseHour, 12), afternoon
// runs [12, sunsetHour) and the remaining hours carry the evening/night value, so the
// hourly data range always stays consistent with the reported daylight.
export interface DaylightWindow {
  sunriseHour: number;
  sunsetHour: number;
}

export interface ForecastProfile {
  latitude: number;
  longitude: number;
  timezone: string;
  // Optional daylight window; defaults to a deterministic 06:00-18:00 day.
  daylight?: DaylightWindow;
  hourly: {
    temperature_2m: [number, number, number];
    rain: [number, number, number];
    showers: [number, number, number];
    snowfall: [number, number, number];
    wind_speed_10m: [number, number, number];
    visibility: [number, number, number];
    cloud_cover: [number, number, number];
  };
  daily: {
    uv_index_max: [number, number, number, number, number, number, number];
  };
  // Optional geographic elevation in metres; the mock falls back to 0 when omitted.
  elevation?: number;
  weeklyHourly?: {
    temperature_2m: [number, number, number][];
    rain: [number, number, number][];
    showers: [number, number, number][];
    snowfall: [number, number, number][];
    wind_speed_10m: [number, number, number][];
    visibility: [number, number, number][];
    cloud_cover: [number, number, number][];
  };
}

export const DEFAULT_DAYLIGHT: DaylightWindow = { sunriseHour: 6, sunsetHour: 18 };

// Fail-fast validation used by the mock server when loading fixtures.
export function isValidDaylight(daylight: DaylightWindow | undefined): boolean {
  if (daylight === undefined) return true;
  return (
    Number.isInteger(daylight.sunriseHour) &&
    Number.isInteger(daylight.sunsetHour) &&
    daylight.sunriseHour >= 0 &&
    daylight.sunriseHour < daylight.sunsetHour &&
    daylight.sunsetHour <= 23
  );
}

const DAY_SECONDS = 86_400;
const FORECAST_START = 1_787_875_200;

const hourlyOffsets = Array.from({ length: 24 }, (_, hour) => hour * 3_600);

// Which day-part value an hour belongs to: 0 = morning, 1 = afternoon, 2 = evening/night.
const partForHour = (hour: number, { sunriseHour, sunsetHour }: DaylightWindow): 0 | 1 | 2 => {
  if (hour < sunriseHour || hour >= sunsetHour) return 2;
  return hour < 12 ? 0 : 1;
};

const expandDay = (values: readonly number[], daylight: DaylightWindow): number[] =>
  hourlyOffsets.map((offset) => values[partForHour(offset / 3_600, daylight)]);

const repeatForWeek = (values: readonly number[], daylight: DaylightWindow): number[] => {
  const result: number[] = [];
  for (let day = 0; day < 7; day++) {
    // Cycle the three day-part values (morning/afternoon/evening) across days;
    // days separated by 3 will have the same pattern, giving similar conditions
    // while different days have different mixes.
    const triple: [number, number, number] = [
      values[day % 3],
      values[(day + 1) % 3],
      values[(day + 2) % 3]
    ];
    result.push(...expandDay(triple, daylight));
  }
  return result;
};

const weeklyValues = (
  values: readonly number[],
  weekly: readonly (readonly number[])[] | undefined,
  daylight: DaylightWindow
): number[] => (weekly ? weekly.flatMap((day) => expandDay(day, daylight)) : repeatForWeek(values, daylight));

export function toOpenMeteoForecast(profile: ForecastProfile): object {
  const daylight = profile.daylight ?? DEFAULT_DAYLIGHT;
  const dailyTime = Array.from({ length: 7 }, (_, day) => FORECAST_START + day * DAY_SECONDS);
  const hourlyTime = dailyTime.flatMap((day) => hourlyOffsets.map((offset) => day + offset));

  // Derive daily precipitation hours from the expanded hourly arrays so the reported duration is
  // always consistent with the hourly rain/showers/snowfall data an implementor receives, matching
  // how a real Open-Meteo client observes precipitation.
  const rain = weeklyValues(profile.hourly.rain, profile.weeklyHourly?.rain, daylight);
  const showers = weeklyValues(profile.hourly.showers, profile.weeklyHourly?.showers, daylight);
  const snowfall = weeklyValues(profile.hourly.snowfall, profile.weeklyHourly?.snowfall, daylight);
  const precipitationHours = Array.from({ length: 7 }, (_, day) => {
    const offset = day * 24;
    let hours = 0;
    for (let hour = 0; hour < 24; hour++) {
      const index = offset + hour;
      if (rain[index] > 0 || showers[index] > 0 || snowfall[index] > 0) hours++;
    }
    return hours;
  });

  return {
    latitude: profile.latitude,
    longitude: profile.longitude,
    generationtime_ms: 0.5,
    utc_offset_seconds: 0,
    timezone: profile.timezone,
    // All fixtures use GMT today; extend this mapping if other timezones are added.
    timezone_abbreviation: 'GMT',
    elevation: profile.elevation ?? 0,
    hourly_units: {
      time: 'unixtime',
      temperature_2m: '°C',
      rain: 'mm',
      showers: 'mm',
      snowfall: 'cm',
      wind_speed_10m: 'km/h',
      visibility: 'm',
      cloud_cover: '%'
    },
    hourly: {
      time: hourlyTime,
      temperature_2m: weeklyValues(profile.hourly.temperature_2m, profile.weeklyHourly?.temperature_2m, daylight),
      rain,
      showers,
      snowfall,
      wind_speed_10m: weeklyValues(profile.hourly.wind_speed_10m, profile.weeklyHourly?.wind_speed_10m, daylight),
      visibility: weeklyValues(profile.hourly.visibility, profile.weeklyHourly?.visibility, daylight),
      cloud_cover: weeklyValues(profile.hourly.cloud_cover, profile.weeklyHourly?.cloud_cover, daylight)
    },
    daily_units: {
      time: 'unixtime',
      uv_index_max: '',
      precipitation_hours: 'h',
      sunrise: 'unixtime',
      sunset: 'unixtime'
    },
    daily: {
      time: dailyTime,
      uv_index_max: profile.daily.uv_index_max,
      precipitation_hours: precipitationHours,
      sunrise: dailyTime.map((day) => day + daylight.sunriseHour * 3_600),
      sunset: dailyTime.map((day) => day + daylight.sunsetHour * 3_600)
    }
  };
}