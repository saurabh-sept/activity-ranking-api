import { setupServer } from 'msw/node';
import { geocodingHandler } from './handlers/geocoding.handler';
import { forecastHandler } from './handlers/forecast.handler';

// Deterministic mock of the Open-Meteo dependency, ready for the future SUT to call.
export const openMeteoServer = setupServer(geocodingHandler, forecastHandler);
