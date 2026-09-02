import type { Server } from 'node:http';
import { createApp } from './app.js';
import { sutConfig } from './config.js';

export function startSut(): Promise<Server> {
  const app = createApp();
  return new Promise((resolve, reject) => {
    app.once('error', reject);
    app.listen(sutConfig.port, '127.0.0.1', () => resolve(app));
  });
}

export function stopSut(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
