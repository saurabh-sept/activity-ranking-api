import { BeforeAll, AfterAll, After } from '@cucumber/cucumber';
import { openMeteoServer } from '../mocks/openMeteo/server';

// MSW intercepts Open-Meteo only. SUT calls (localhost) are bypassed, so they fail while the SUT is absent.
BeforeAll(function () {
  openMeteoServer.listen({ onUnhandledRequest: 'bypass' });
});

After(function () {
  openMeteoServer.resetHandlers();
});

AfterAll(function () {
  openMeteoServer.close();
});
