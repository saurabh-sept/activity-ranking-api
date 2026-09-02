import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
};

const notImplemented = (response: ServerResponse, route: string): void => {
  sendJson(response, 501, { error: `${route} is not implemented yet` });
};

export function createApp() {
  return createServer((request: IncomingMessage, response: ServerResponse) => {
    const path = new URL(request.url ?? '/', `http://${request.headers.host}`).pathname;
    if (request.method !== 'GET') return sendJson(response, 405, { error: 'Method not allowed' });
    if (path === '/locations') return notImplemented(response, 'Location search');
    if (path === '/rankings') return notImplemented(response, 'Activity ranking');
    return sendJson(response, 404, { error: 'Not found' });
  });
}
