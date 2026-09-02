export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Named weather archetypes used by the declarative scenarios. Coordinates are opaque to the
// feature files; the forecast mock returns matching weather for each. `unavailable` triggers an outage.
export const weatherLocations = {
  weekA: { latitude: -33.9258, longitude: 18.4232 },
  weekB: { latitude: 35.0, longitude: 139.0 },
  boundaryWindLow: { latitude: 22.25, longitude: -159.5 },
  boundaryWindExact: { latitude: 22.3, longitude: -159.3 },
  boundaryWindHigh: { latitude: 22.35, longitude: -159.2 },
  boundaryFreeze: { latitude: 46.9, longitude: 8.9 },
  boundaryFreezeLow: { latitude: 46.95, longitude: 8.85 },
  boundaryThaw: { latitude: 47.0, longitude: 8.8 },
  boundaryRainLow: { latitude: 48.7, longitude: 2.2 },
  boundaryRainExact: { latitude: 48.75, longitude: 2.25 },
  boundaryRainHigh: { latitude: 48.8, longitude: 2.3 },
  boundaryVisibilityLow: { latitude: 52.1, longitude: -1.5 },
  boundaryVisibilityExact: { latitude: 52.15, longitude: -1.45 },
  boundaryVisibilityHigh: { latitude: 52.2, longitude: -1.4 },
  unavailable: { latitude: 0, longitude: 0 }
} as const satisfies Record<string, Coordinates>;

export const coordinateKey = (c: Coordinates): string => `${c.latitude},${c.longitude}`;
