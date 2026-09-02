import { BeforeAll, AfterAll } from '@cucumber/cucumber';
import { startSut, stopSut } from '../../src/server.js';
import { openMeteoServer } from '../mocks/openMeteo/server.js';

let sut: Awaited<ReturnType<typeof startSut>>;
BeforeAll(async function () {
  openMeteoServer.listen({ onUnhandledRequest: 'bypass' });
  sut = await startSut();
});

AfterAll(async function () {
  await stopSut(sut);
  openMeteoServer.close();
});
