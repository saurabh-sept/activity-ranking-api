export const sutConfig = {
  port: Number(process.env.SUT_PORT ?? 3000),
  openMeteo: {
    geocodingUrl: process.env.OPEN_METEO_GEOCODING_URL ?? 'https://geocoding-api.open-meteo.com/v1/search',
    forecastUrl: process.env.OPEN_METEO_FORECAST_URL ?? 'https://api.open-meteo.com/v1/forecast'
  }
} as const;
