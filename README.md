# Activity Ranking API — Spec-First BDD Test Suite

A **specification-first** BDD automation suite for the *Activity Ranking API – City-Based Weather Forecast Integration* feature ticket. The system under test (SUT) does **not exist yet**: these tests define the intended behaviour and therefore fail on purpose. A meaningful **RED** state that pins down the contract is the goal.

---

## Overview

The feature: a user enters a city or town name and receives a 7-day ranked list of activities — **Skiing, Surfing, Outdoor Sightseeing, Indoor Sightseeing** — based on weather conditions from [Open-Meteo](https://open-meteo.com/).

This repository delivers the three requested artefacts:

1. **Gherkin BDD scenarios** — `test/features/*.feature`
2. **Runnable automated tests** implementing them — `test/stepDefinitions/*.ts` (+ support/mocks)
3. **This README** — approach, API contract, assumptions, and trade-offs

---

## Approach

```
Cucumber (Gherkin)  ->  Step Definitions  ->  native fetch  ->  Activity Ranking API (SUT)
                                                                        |
                                                                        v  (future)
                                                                    Open-Meteo
                                                                        |
                                                                        v
                                                                      MSW mock
```

| Concern | Choice | Why |
| --- | --- | --- |
| BDD runner | **@cucumber/cucumber** | Required by the ticket; business-readable specs |
| Language | **TypeScript** run via **tsx** | Type safety, no build step |
| HTTP | **native `fetch`** | Lightweight; no Axios needed |
| Dependency mock | **MSW** | Deterministic, offline Open-Meteo responses |

There is **no Vitest / unit layer** and **no fake SUT** — only what the assessment asks for.

---

## Folder structure & purpose of each file

```
activity-ranking-api/
├── package.json                 # Single package manifest; deps + the test:bdd script
├── tsconfig.json                # TypeScript config (NodeNext ESM, strict, noEmit)
├── cucumber.mjs                 # Cucumber config: where features + step/support files live
├── .env.example                 # Template for SUT + Open-Meteo URLs (copy to .env)
├── .gitignore                   # Ignores node_modules, .env, logs
├── README.md                    # This document
│
├── src/
│   └── .gitkeep                 # Reserved for the future SUT implementation — intentionally empty
│
└── test/
    ├── features/                            # DELIVERABLE 1 — Gherkin specs
    │   ├── location-search.feature          # City/town search: partial, exact, unknown, invalid
    │   └── activity-ranking.feature         # 7-day ranking: shape, four activities, ranges, errors
    │
    ├── stepDefinitions/                     # DELIVERABLE 2 — automation glue
    │   ├── common.steps.ts                  # Shared steps: config, status code, error-body assertions
    │   ├── location-search.steps.ts         # Calls GET /locations; asserts search behaviour + contract
    │   └── activity-ranking.steps.ts        # Calls GET /rankings; asserts ranking behaviour + contract
    │
    ├── support/                             # Cucumber runtime glue (auto-loaded)
    │   ├── config.ts                        # Reads SUT + Open-Meteo URLs from env (single source of truth)
    │   ├── world.ts                         # Custom World: base URL, chosen location, last response/error
    │   ├── httpClient.ts                    # Thin native-fetch wrapper returning { status, body }
    │   ├── contract.ts                      # assertMatchesContract(): shape/type check vs golden files
    │   ├── responseAssertions.ts            # Shared status + error-body guards (clear RED messages)
    │   ├── weatherLocations.ts              # Named weather archetypes -> coordinates (keeps features declarative)
    │   └── hooks.ts                         # Starts/stops the MSW server around the run
    │
    ├── mocks/
    │   └── openMeteo/                        # External dependency test double (runner-agnostic)
    │       ├── server.ts                     # setupServer() wiring the two handlers
    │       ├── handlers/
    │       │   ├── geocoding.handler.ts      # Intercepts geocoding search; routes ?name= -> a response
    │       │   └── forecast.handler.ts       # Intercepts forecast; routes coordinates -> a weather archetype
    │       └── responses/                    # Canned Open-Meteo responses the handlers return
    │           ├── geocoding.partial.json    # part of a name  -> multiple matches
    │           ├── geocoding.exact.json      # exact name      -> single match
    │           ├── geocoding.nomatch.json    # unknown name    -> no results key
    │           ├── forecast.clear.json       # clear & mild    -> favours outdoor sightseeing (7 days)
    │           ├── forecast.snowy.json       # heavy snow      -> favours skiing
    │           ├── forecast.windy.json       # windy/warm/dry  -> favours surfing
    │           └── forecast.rainy.json       # persistent rain -> favours indoor sightseeing
    │
    └── contracts/
        └── activity-ranking-api/            # Golden SUT contract shapes (what we pin down)
            ├── locations.response.json      # Expected shape of GET /locations
            └── ranking.response.json        # Expected shape of GET /rankings
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
        { "activity": "Skiing",             "score": 5,  "rating": "Poor",      "reasoning": "No snowfall and temperatures well above freezing." },
        { "activity": "Surfing",            "score": 55, "rating": "Good",      "reasoning": "Moderate winds with a mild 17°C." },
        { "activity": "OutdoorSightseeing", "score": 80, "rating": "Excellent", "reasoning": "Clear skies, good visibility and 22°C." },
        { "activity": "IndoorSightseeing",  "score": 40, "rating": "Fair",      "reasoning": "Pleasant outdoor weather makes indoor options less compelling." }
      ]
    }
    // ...seven days total
  ]
}
```

The **suitability measure** is a `score` (0–100) plus a `rating` band and a `reasoning` string — satisfying the ticket's "measure of how suitable the conditions are" and "reasoning" requirements.

- Missing / out-of-range latitude or longitude → `400` with an `error` field.
- Open-Meteo upstream failure → `502` with an `error` field.

### How the tests consume the contract

The two `contracts/activity-ranking-api/*.response.json` files are **golden shapes**. Step definitions load them and call `assertMatchesContract(actualResponse, golden)`, which checks **keys and leaf types only** (values are never compared, since live weather varies). Because the golden files *are* the documented contract and the tests assert against them, the documentation and the enforced shape cannot drift.

---

## Open-Meteo dependency & mocking strategy

The future SUT depends on **two Open-Meteo APIs**:

| API | Endpoint | Role |
| --- | --- | --- |
| **Geocoding** | `geocoding-api.open-meteo.com/v1/search?name=` | Resolve a name → coordinates (partial → list) |
| **Forecast** | `api.open-meteo.com/v1/forecast?latitude=&longitude=&daily=…&hourly=…` | 7-day weather used for ranking |

**MSW models the Open-Meteo dependency — the SUT itself is never mocked.** The handlers in `test/mocks/openMeteo/` already import the canned responses in `responses/` and route requests to them, so the mock is wired as real plumbing today (the response files are consumed by the handlers now, not left as dead fixtures). The MSW server is started and stopped around every run by `test/support/hooks.ts`.

### Configuration — one URL, two modes

The Open-Meteo URLs are configuration, not hard-coded, and live in `.env` (see `.env.example`):

| Variable | Default | Used by |
| --- | --- | --- |
| `SUT_BASE_URL` | `http://localhost:3000` | Tests → the Activity Ranking API |
| `OPEN_METEO_GEOCODING_URL` | `https://geocoding-api.open-meteo.com/v1/search` | SUT (to call) **and** MSW (to intercept) |
| `OPEN_METEO_FORECAST_URL` | `https://api.open-meteo.com/v1/forecast` | SUT (to call) **and** MSW (to intercept) |

`test/support/config.ts` reads these once with the production defaults. Both the MSW handlers and the future SUT resolve the Open-Meteo URLs from the **same** values, so they can never disagree.

The important point: **MSW intercepts requests in-process at the network layer — it is not a URL swap.** The SUT uses the *same real Open-Meteo URL* in production and in test; the only difference is whether MSW is active in the process:

```
Production:   SUT --fetch(OPEN_METEO_*_URL)--> real Open-Meteo        (live weather)
Under test:   SUT --fetch(OPEN_METEO_*_URL)--> MSW intercepts --> responses/*.json   (deterministic)
```

So you never point the SUT at a mock address. MSW sits in front of the network inside the test process and catches the real-URL call. Because the handler match URL comes from the same env value, overriding `OPEN_METEO_*_URL` (e.g. to a staging mirror) keeps the interception aligned automatically.

### How the mocks get used now vs. once the SUT is implemented

**Today (SUT absent) — the mock is armed but not reached:**

```
Cucumber -> step -> fetch(SUT_BASE_URL/...) -> ❌ Activity Ranking API not implemented   =>  RED
                                               (the SUT never calls Open-Meteo,
                                                so MSW does not fire yet)
```

The MSW server is listening the whole time; the request simply never gets past the missing SUT.

**After the SUT is implemented — the same mocks turn the suite GREEN, with zero test changes:**

```
Cucumber -> step -> fetch(SUT_BASE_URL/...) -> Activity Ranking API (SUT)
                                                      |
                                                      v  outbound fetch to Open-Meteo
                                                    MSW intercepts
                                                      |
                                        geocoding.handler / forecast.handler
                                                      |
                                                      v
                                       responses/*.json (deterministic mock)          =>  GREEN
```

When the SUT exists, running the suite starts the MSW server (via the hooks); the SUT process makes
its real outbound calls to `geocoding-api.open-meteo.com` / `api.open-meteo.com`; MSW intercepts
those calls and replies with the canned `responses/*.json`. Nothing in the features, steps or
contracts changes — only the SUT appears. To make MSW visible to the SUT process, run the SUT in the
same Node process/test run (or start MSW in the SUT during test mode); the `onUnhandledRequest: 'bypass'`
setting lets the SUT's own `localhost` traffic through while still intercepting Open-Meteo.

The `geocoding.handler` routes by the `?name=` query (part-of-name → multiple matches, exact →
single, unknown → no results). The `forecast.handler` routes by **coordinates** to a weather
archetype — `forecast.clear.json`, `forecast.snowy.json`, `forecast.windy.json` or
`forecast.rainy.json` — each of which exhibits one dominant weather factor so the future SUT ranks a
different activity top. The reserved `latitude=0&longitude=0` route returns `503` from MSW so the
future SUT's upstream-failure handling (surfacing as `502`) can be exercised deterministically. The
declarative scenarios never mention these coordinates; the mapping lives in `weatherLocations.ts`.

The mock responses are **shortened, made-up payloads** that preserve Open-Meteo's real shape and units
(unixtime, `hourly`/`daily` aligned arrays, `°C`/`cm`/`%`/`m`/`km/h`/`mm`) — trimmed so the intent of
each scenario is clear without pages of data.

---

## Why the suite is RED

```
Cucumber -> step -> fetch(SUT_BASE_URL/...) -> ❌ nothing listening
```

`src/` is intentionally empty. The step definitions target the real intended SUT endpoints, so every scenario fails with a clear message ("no response was received from the SUT … not implemented yet"). This proves the tests exercise the *intended* API rather than a stand-in. When the SUT is built and started, the same specs validate it — RED → GREEN.

---

## Running the suite

```bash
npm install
cp .env.example .env    # optional; defaults to http://localhost:3000
npm run test:bdd        # or: npm test
```

Expected result today: **all scenarios fail (RED)** because the SUT is absent — this is intentional.

---

## Scenario coverage

The feature files are written in a **declarative, user-behaviour style** — no coordinates or search strings leak into the scenarios. Concrete inputs (search terms, weather-archetype coordinates) live in the step definitions.

**`location-search.feature`** — search by part of a name → several matches (each complete enough to choose) · search by exact name → single match · unknown name → no matches · missing name → rejected · blank spaces → rejected.

**`activity-ranking.feature`** — a ranking for the next 7 days · every day rates all four activities with a reason · scores on a 0–100 scale with a matching rating band · **heavy snow → skiing best-rated** (reason mentions snow) · **clear & mild → outdoor sightseeing best-rated** · **strong winds, warm & dry → surfing best-rated** · **persistent rain & poor visibility → indoor sightseeing best-rated** · weather service unavailable → reported clearly.

---

## Assumptions

- **Two-step flow.** Search (`/locations`) then rank (`/rankings`) by the selected coordinates, mirroring Open-Meteo.
- **`/locations` response** trims Open-Meteo geocoding to the fields a front end needs (`id, name, country, admin1, latitude, longitude, timezone`).
- **`/rankings` echoes only what it can derive from coordinates** — `latitude`, `longitude` and the `timezone` returned by Open-Meteo's forecast. It does **not** echo a town name, since the endpoint receives only coordinates (the front end already holds the name from the search step).
- **Unknown name** yields `200` + empty `results` (not `404`), which is friendlier for type-ahead UIs.
- **Suitability measure** = `score` 0–100 + `rating` + `reasoning`.
- **Rating bands.** `0–24 Poor`, `25–49 Fair`, `50–74 Good`, `75–100 Excellent` — a score must carry the matching band.
- **Ranking heuristics (dominant weather factor per activity).** The intended behaviour the specs pin down:
  - **Skiing** — favoured by snowfall / snow depth and sub-zero temperatures.
  - **Surfing** — favoured by strong wind with warm, dry conditions.
  - **Outdoor Sightseeing** — favoured by clear skies, good visibility and mild temperatures.
  - **Indoor Sightseeing** — favoured when it is wet, cold or visibility is poor (the bad-weather fallback).
- **Date** is an ISO `YYYY-MM-DD` string per day and applies to each activity within that day.
- **Validation errors** return `400`; an Open-Meteo outage returns `502`; error bodies carry an `error` field.
- **Timestamps.** Open-Meteo is requested with `timeformat=unixtime`; converting to ISO dates is the SUT's responsibility.
- **Declarative features.** Coordinates and search strings never appear in scenarios; they are held in `weatherLocations.ts` and the step definitions.

## Omissions & trade-offs

- **No SUT implementation.** Deliberate — the assessment wants a RED spec-first suite. `src/` stays empty.
- **Ranking assertions check dominant-factor behaviour, not exact scores.** Scenarios assert which activity is best-rated for a characteristic weather archetype (snow → skiing, and so on) and that scores/ratings are internally consistent — they do **not** pin precise numeric scores, which the ticket leaves to the implementation.
- **Weather archetypes are shortened, made-up fixtures.** Each `forecast.*.json` is a small payload that preserves Open-Meteo's real shape/units while clearly exhibiting one dominant factor — enough to drive its scenario without pages of data.
- **Low-level input validation** (e.g. out-of-range coordinates) is treated as an internal API-contract concern, not a user scenario — users pick a town from search results rather than typing coordinates.
- **MSW is not exercised end-to-end yet** because no SUT calls Open-Meteo. The handlers are wired to the fixtures and ready, but only fire once the SUT exists.
- **No live Open-Meteo calls.** Responses are recorded/shortened for determinism; a contract-refresh against the live API is left as future tooling.
- **Ranking is expressed as a per-activity `score` plus a per-day `topActivity`**, rather than an explicit `rank` index. Best-of-day is derived from the scores; adding a numeric rank field would be a small, backwards-compatible extension if a reviewer prefers it.
- **Single browser/runtime concern is out of scope** — this is an API suite only.
