import type { ApiResponse } from './world.js';

// Native fetch call to the SUT. Parsing is defensive because the SUT does not exist yet.
export async function getJson(url: string): Promise<ApiResponse> {
  const res = await fetch(url);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  return { status: res.status, body };
}
