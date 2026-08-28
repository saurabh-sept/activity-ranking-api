import { http, HttpResponse } from 'msw';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from '../../../support/config';

const load = (file: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../responses/${file}`, import.meta.url)), 'utf-8'));

const partial = load('geocoding.partial.json');
const exact = load('geocoding.exact.json');
const nomatch = load('geocoding.nomatch.json');

// Routes the geocoding search to a recorded response based on the ?name= query.
export const geocodingHandler = http.get(
  config.openMeteo.geocodingUrl,
  ({ request }) => {
    const name = (new URL(request.url).searchParams.get('name') ?? '').trim().toLowerCase();
    if (name === 'capetowne') return HttpResponse.json(exact);
    if (name.startsWith('cape')) return HttpResponse.json(partial);
    return HttpResponse.json(nomatch);
  }
);
