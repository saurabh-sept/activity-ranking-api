export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Named weather archetypes used by the declarative scenarios. Coordinates are opaque to the
// feature files; the forecast mock returns matching weather for each. `unavailable` triggers an outage.
export const weatherLocations = {
  clear: { latitude: -33.9258, longitude: 18.4232 },
  snowy: { latitude: 46.8, longitude: 9.8 },
  windy: { latitude: 21.3, longitude: -157.8 },
  rainy: { latitude: 51.5, longitude: -0.12 },
  unavailable: { latitude: 0, longitude: 0 }
} as const satisfies Record<string, Coordinates>;

export const coordinateKey = (c: Coordinates): string => `${c.latitude},${c.longitude}`;
