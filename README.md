# Activity Ranking API — Spec-First BDD Test Suite

A **specification-first** BDD automation suite for the *Activity Ranking API – City-Based Weather Forecast Integration* feature ticket. The SUT boundary and lifecycle are in `src/`; the application behavior is intentionally left for implementation. Scenarios and test doubles remain in `test/`.

---

## Overview

The feature: a user enters a city or town name and receives a 7-day ranked list of activities — **Skiing, Surfing, Outdoor Sightseeing, Indoor Sightseeing** — based on weather conditions from [Open-Meteo](https://open-meteo.com/).

This repository delivers the three requested artefacts:

1. **Gherkin BDD scenarios** — `test/features/*.feature`
2. **Runnable automated tests** implementing them — `test/stepDefinitions/*.ts` (+ support/mocks)
3. **This README** — approach, API contract, assumptions, and trade-offs

---

## Approach

### Runtime architecture

The test runtime uses **one Node process** for Cucumber, the SUT and the Open-Meteo mock. Cucumber's `BeforeAll` hook starts MSW (the Open-Meteo interceptor) and then the in-process SUT HTTP server from `src/`; `AfterAll` stops both. Scenarios call the SUT over HTTP; the SUT calls its normal Open-Meteo URLs, which MSW intercepts in-process — no separate processes, mock URLs or port coordination.

```
Cucumber (Gherkin)  ->  SUT HTTP server  ->  Open-Meteo URL
                              |                 ^
                              +-- MSW interceptor
```

| Concern | Choice | Why |
| --- | --- | --- |
| BDD runner | **@cucumber/cucumber** | Required by the ticket; business-readable specs |
| Language | **TypeScript** run via **tsx** | Type safety, no build step |
| HTTP | **native `fetch`** | Lightweight; no Axios needed |
| Dependency mock | **MSW Node interceptor** | Deterministic in-process interception of the SUT's Open-Meteo calls |

There is no separate unit-test framework; direct Node tests cover MSW handlers and Cucumber covers the public SUT behavior.

---

## Folder structure

```
activity-ranking-api/
├── src/                      # SUT: HTTP route shell (501 until implemented) + start/stop lifecycle + config
│   ├── app.ts                #   GET /locations, GET /rankings -> 501 Not Implemented
│   ├── server.ts             #   startSut/stopSut lifecycle used by Cucumber hooks
│   └── config.ts             #   runtime configuration (SUT port + Open-Meteo URLs)
├── test/
│   ├── features/             # DELIVERABLE 1 — Gherkin specs
│   ├── stepDefinitions/      # DELIVERABLE 2 — automation glue
│   ├── support/              # world, config, httpClient, contract/response assertions, hooks, weatherLocations
│   ├── mocks/openMeteo/      # MSW server + canned responses + fixture expansion
│   └── contracts/            # golden SUT response shapes (locations + ranking)
├── cucumber.mjs              # Cucumber config
└── .env.example              # SUT + Open-Meteo URL template
```
---

## The API contract we test against (assumptions)

The SUT mirrors Open-Meteo's real two-step flow: **search a location, then rank by its coordinates.** Two endpoints:

### 1. `GET /locations?name={query}`

Wraps the Open-Meteo **Geocoding** API. A partial name returns several matches; an exact name returns one; an unknown name returns an empty list.

```jsonc
// 200 OK
{
  "query": "cape",
  "results": [
    {
      "id": 3369157,
      "name": "Cape Town",
      "country": "South Africa",
      "admin1": "Western Cape",
      "latitude": -33.92584,
      "longitude": 18.42322,
      "timezone": "Africa/Johannesburg"
    }
  ]
}
```

- Unknown name → `200` with `"results": []`.
- Blank / whitespace-only name → `400` with an `error` field.

### 2. `GET /rankings?latitude={lat}&longitude={lon}`

Wraps the Open-Meteo **Forecast** API. Returns seven days, each ranking all four activities with a suitability measure and reasoning.

```jsonc
// 200 OK
{
  "location": { "latitude": -33.9258, "longitude": 18.4232, "timezone": "Africa/Johannesburg" },
  "days": [
    {
      "date": "2026-08-28",
      "topActivity": "OutdoorSightseeing",
      "activities": [
        { "activity": "Skiing",             "rank": 1, "score": 80, "rating": "Excellent", "reasoning": "No snowfall and temperatures well above freezing." },
        { "activity": "Surfing",            "rank": 2, "score": 55, "rating": "Good",      "reasoning": "Moderate winds with a mild 17°C." },
        { "activity": "OutdoorSightseeing", "rank": 3, "score": 40, "rating": "Fair",      "reasoning": "Clear skies, good visibility and 22°C." },
        { "activity": "IndoorSightseeing",  "rank": 4, "score": 5,  "rating": "Poor",      "reasoning": "Pleasant outdoor weather makes indoor options less compelling." }
      ]
    }
    // ...seven days total
  ]
}
```

The **suitability measure** is a `rank` (1–4, best to worst), a `score` (0–100), a matching `rating` band and a `reasoning` string — satisfying the ticket's "measure of how suitable the conditions are" and "reasoning" requirements. The per-activity score drivers, the inclusive boundary thresholds (wind 25 km/h, freezing 0 °C with snow, rain 5 mm/h, visibility 5000 m) and the tie policy are specified in [`ranking-thresholds.md`](test/contracts/activity-ranking-api/ranking-thresholds.md).

- Missing / out-of-range latitude or longitude → `400` with an `error` field.
- Open-Meteo upstream failure → `502` with an `error` field.

### How the tests consume the contract

The two `contracts/activity-ranking-api/*.response.json` files are **golden shapes**. Step definitions load them and call `assertMatchesContract(actualResponse, golden)`, which checks **keys and leaf types only** (values are never compared, since live weather varies). The contract sample defines the fields checked by the shape validator; behavioral assumptions are enforced by the scenarios.
---

## Open-Meteo dependency & mocking strategy

The SUT depends on **two Open-Meteo APIs**:

| API | Endpoint | Role |
| --- | --- | --- |
| **Geocoding** | `geocoding-api.open-meteo.com/v1/search?name=` | Resolve a name → coordinates (partial → list) |
| **Forecast** | `api.open-meteo.com/v1/forecast?latitude=&longitude=&daily=…&hourly=…` | 7-day weather and daylight data used for ranking |

**MSW models the Open-Meteo dependency; the SUT itself is never mocked.** It intercepts the SUT's outbound Open-Meteo requests in the same Node process and serves the canned responses in `test/mocks/openMeteo/responses/`. The Open-Meteo URLs are configuration (see `.env.example` / `test/support/config.ts`), not hard-coded, and MSW intercepts those normal URLs — so no mock URL or mock port is injected:

| Variable | Default | Used by |
| --- | --- | --- |
| `SUT_BASE_URL` | `http://localhost:3000` | Tests → the Activity Ranking API |
| `SUT_PORT` | `3000` | In-process SUT listening port |
| `OPEN_METEO_GEOCODING_URL` | `https://geocoding-api.open-meteo.com/v1/search` | SUT production geocoding dependency |
| `OPEN_METEO_FORECAST_URL` | `https://api.open-meteo.com/v1/forecast` | SUT production forecast dependency |

The mock routes geocoding by the `?name=` query (part-of-name → multiple matches, exact → single, unknown → no results). It routes forecasts by **coordinates** to one of two canonical weekly profiles (`forecast.week-a.json` / `forecast.week-b.json`) whose days represent the major weather archetypes; the reserved `latitude=0&longitude=0` returns `503` so the SUT's upstream-failure handling (`502`) can be exercised deterministically. Declarative scenarios never mention these coordinates — the mapping lives in `weatherLocations.ts`.

The SUT requests the forecast with a fixed variable set (`format=json&timeformat=unixtime`):

```
daily=uv_index_max,precipitation_hours,sunrise,sunset
hourly=temperature_2m,rain,showers,snowfall,wind_speed_10m,visibility,cloud_cover
```

Each compact fixture profile stores three day-part values (morning/afternoon/evening); the mock expands them into all 24 hourly samples for all seven days, so returned hourly arrays have 168 values. Responses include real Open-Meteo metadata (`generationtime_ms`, `utc_offset_seconds`, `timezone_abbreviation`, `elevation`); `daily.precipitation_hours` is **derived** from the expanded hourly `rain`/`showers`/`snowfall` arrays (count of rainy hours per day), so reported durations are always consistent with the hourly data. Day-parts and `daily.sunrise`/`sunset` are derived from a per-profile daylight window (default `06:00`–`18:00`): morning runs `[sunrise, 12)`, afternoon `[12, sunset)`, and the remaining hours carry the evening/night value — so a future short-day scenario only changes the window and the hourly ranges follow.

### Weather coverage design

Forecast inputs are numeric with unbounded permutations, so the suite uses an **equivalence-partition + boundary + interaction** strategy rather than exhaustive coverage: each profile is a representative condition that leads to a clearly testable user outcome.

| Profile | Days (weather archetypes) | Role |
| --- | --- | --- |
| `week-a` | snowy · clear · windy · rainy · calm · overcast · hot/UV | Primary positive/negative archetype outcomes |
| `week-b` | storm · cold/dry · clear · windy · rainy · snowy · calm | Remaining interactions + a changing weekly sequence |

Boundary scenarios use isolated compact profiles varying one value below/at/above a threshold. The **boundary contract assumptions** are product rules for the SUT (not claims about Open-Meteo):

| Attribute | Boundary assumption | Values under test |
| --- | --- | --- |
| Wind speed | Surfing's strong-wind benefit starts at `25 km/h`, inclusive | `24.9`, `25.0`, `25.1 km/h` |
| Temperature and snow | Skiing best at/below `0°C` with snowfall; not snow-favoured just above freezing | `-0.1`, `0.0`, `0.1°C` with snowfall |
| Rainfall | Persistent rain becomes indoor-significant at `5 mm/h`, inclusive | `4.9`, `5.0`, `5.1 mm/h` |
| Visibility | Outdoor sightseeing requires at least `5000 m` visibility | `4999`, `5000`, `5001 m` |
---

## Running the suite

```bash
npm test
```

The pipeline runs TypeScript validation, direct MSW handler tests, and the full Cucumber suite. Cucumber uses the `progress` formatter for terminal output and writes a JSON report to `reports/cucumber-report.json` (Git-ignored).

**Expected result before SUT implementation:** typecheck, MSW handler tests and Cucumber discovery pass; behavioral BDD scenarios remain **RED** with explicit `501 Not Implemented` responses. CI's BDD step uses `continue-on-error` until the SUT is implemented.

---

## Scenario coverage

Feature files are **declarative and user-behaviour style** — no coordinates or search strings leak into scenarios. Ranking features declare the complete seven-day weather composition in Gherkin tables, which the step definitions validate against the canonical fixtures (so the spec documents the mock data rather than silently selecting it).

- **`location-search.feature`** — search by part of a name → several matches (each complete enough to choose) · exact name → single match · unknown name → no matches · missing name → rejected · blank spaces → rejected.
- **`activity-ranking.feature`** — 7-day ranking · every day rates all four activities with a reason · scores on a 0–100 scale with a matching rating band · heavy snow → skiing best · clear & mild → outdoor sightseeing · strong winds, warm & dry → surfing · persistent rain & poor visibility → indoor sightseeing · weather service unavailable → reported clearly.
- **`activity-ranking-boundaries.feature`** — paired below/exact/above thresholds for wind, freezing temperature with snow, rainfall and visibility (see the boundary table above).

### Scenario-to-mock mapping

Every response fixture under `test/mocks/openMeteo/responses/` is used by at least one BDD scenario:

| Mock file | Scenario coverage |
| --- | --- |
| `geocoding.partial.json` | Search by part of a town name (`cape`) |
| `geocoding.exact.json` | Search by exact town name (`capetowne`) |
| `geocoding.nomatch.json` | Unknown, missing and blank town-name searches |
| `forecast.week-a.json` | Default week + normal archetypes: snowy · clear · windy · rainy · calm · overcast · hot/UV |
| `forecast.week-b.json` | Storm · cold/dry · clear · windy · rainy · snowy · calm; also drives the changing-week scenario |
| `forecast.boundary-*.json` | Wind / freeze / rain / visibility below, at and above their thresholds |
---

## Assumptions

- **Two-step flow.** Search (`/locations`) then rank (`/rankings`) by the selected coordinates, mirroring Open-Meteo.
- **`/locations` response** trims Open-Meteo geocoding to the fields a front end needs (`id, name, country, admin1, latitude, longitude, timezone`).
- **`/rankings` echoes only what it can derive from coordinates** — `latitude`, `longitude` and the `timezone` returned by Open-Meteo. It does **not** echo a town name, since the endpoint receives only coordinates.
- **Unknown name** yields `200` + empty `results` (not `404`), which is friendlier for type-ahead UIs.
- **Rating bands.** `0–24 Poor`, `25–49 Fair`, `50–74 Good`, `75–100 Excellent` — a score must carry the matching band.
- **Ranks.** Each activity carries a `rank` (`1` best to `4` worst); the four activities of a day occupy ranks 1–4 exactly once and scores are non-increasing as rank increases.
- **Ranking heuristics (dominant weather factor per activity):** Skiing ← snowfall/snow depth + sub-zero temps; Surfing ← strong wind with warm, dry conditions; Outdoor Sightseeing ← clear skies, good visibility, mild temps; Indoor Sightseeing ← wet, cold or poor visibility (bad-weather fallback). Exact thresholds and boundary values: [`ranking-thresholds.md`](test/contracts/activity-ranking-api/ranking-thresholds.md).
- **Date** is an ISO `YYYY-MM-DD` string per day and applies to each activity within that day.
- **Reasons** are required non-empty strings; the snowy scenario additionally requires the winning reason to mention snow.
- **Best-activity assertions.** Normal archetype scenarios assert the expected winner on the specific day. Boundary scenarios assert the winner or non-winner for every day of their repeated profile.
- **Negative best-activity assertions.** A non-winner assertion excludes only the named activity; it does not prescribe which other activity wins.
- **Ties.** Tied scores may be ranked in either order — the suite asserts rank uniqueness and score ordering, not a specific tie-break.
- **Additional response fields** are allowed (shape helper checks required fields/types but does not reject extra fields).
- **Forecast fixture routing.** Registered coordinates must resolve to a fixture; unknown forecast coordinates return `404` from the mock. Mock day 1 maps to ranking day 1.
- **Validation errors** return `400`; an Open-Meteo outage returns `502`; error bodies carry an `error` field.
- **Timestamps.** Open-Meteo is requested with `timeformat=unixtime`; converting to ISO dates is the SUT's responsibility.
- **Daylight.** The SUT requests daily `sunrise`/`sunset` in addition to UV and precipitation hours. It may use their difference to reduce outdoor-sightseeing suitability on short-day forecasts; fixtures default to a deterministic 12-hour window (06:00–18:00) that also drives the hourly day-part ranges.
- **Declarative features.** Coordinates and search strings never appear in scenarios; they are held in `weatherLocations.ts` and the step definitions.

## Omissions & trade-offs

- **No separate SUT process.** The SUT route shell runs in-process under Cucumber for deterministic local and CI execution; a deployment-style process smoke test remains optional.
- **Ranking assertions check dominant-factor behaviour, not exact scores.** Scenarios assert which activity is best-rated (snow → skiing, and so on) and that scores/ratings are internally consistent — they do **not** pin precise numeric scores, which the ticket leaves to the implementation.
- **Weather archetypes are shortened, made-up fixtures.** The two canonical weekly profiles preserve Open-Meteo's real shape/units while assigning major archetypes to individual days; separate compact profiles isolate boundary values.
- **Low-level input validation** (e.g. out-of-range coordinates) is treated as an internal API-contract concern, not a user scenario — users pick a town from search results rather than typing coordinates.
- **The SUT-to-Open-Meteo path is not implemented yet.** Direct MSW handler tests cover fixture routing, while the Cucumber suite currently proves the SUT HTTP boundary and intentionally receives `501` responses.
- **No live Open-Meteo calls.** Responses are recorded/shortened for determinism; a contract-refresh against the live API is left as future tooling.
- **Single browser/runtime concern is out of scope** — this is an API suite only.