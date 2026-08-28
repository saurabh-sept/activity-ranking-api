// Single source of truth for service URLs, read from env with production defaults.
// The future SUT calls these Open-Meteo URLs for real; in tests MSW intercepts the same URLs in-process.
export const config = {
  sutBaseUrl: process.env.SUT_BASE_URL ?? 'http://localhost:3000',
  openMeteo: {
    geocodingUrl: process.env.OPEN_METEO_GEOCODING_URL ?? 'https://geocoding-api.open-meteo.com/v1/search',
    forecastUrl: process.env.OPEN_METEO_FORECAST_URL ?? 'https://api.open-meteo.com/v1/forecast'
  }
} as const;
