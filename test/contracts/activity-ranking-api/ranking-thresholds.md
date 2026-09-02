# Ranking thresholds & scoring contract

This document is the **single source of truth** for the scoring rules the Activity Ranking API
must implement and the BDD suite enforces. The golden shape files (`locations.response.json`,
`ranking.response.json`) pin the response *shape*; this document and the Gherkin scenarios pin
the *behaviour*. If a product decision changes a rule here, update this file, the boundary
fixtures and the feature wording together.

The SUT derives its scores from the Open-Meteo forecast response. The mock in
`test/mocks/openMeteo/` serves deterministic forecasts with exactly Open-Meteo's real response
structure (see "Data relations the mock guarantees" below), so every rule below is testable
without the live API.

---

## 1. Score, rating bands and rank

Each day rates all four activities — `Skiing`, `Surfing`, `OutdoorSightseeing`,
`IndoorSightseeing` — with:

| Field | Rule |
| --- | --- |
| `score` | Suitability measure, `0–100`. |
| `rating` | Band derived from the score: `0–24` → `Poor`, `25–49` → `Fair`, `50–74` → `Good`, `75–100` → `Excellent`. A score must always carry its matching band. |
| `rank` | Position of the activity within the day, `1` (best) to `4` (worst). The four activities of a day occupy ranks `1–4` exactly once. |
| `reasoning` | Non-empty human-readable string; the snowy archetype's winning reason must mention snow. |

Rank semantics:

- `rank: 1` must equal the day's `topActivity`.
- Scores must be **non-increasing** as rank increases (`score(rank 1) >= score(rank 2) >= ...`).
- **Tie policy:** tied scores may be ranked in either order — the suite asserts rank uniqueness
  and score ordering, not a specific tie-break. (The test helpers treat the first activity of a
  tie as best when deriving from scores alone.)

The rank contract is asserted explicitly, per day, by the *Every day ranks the four activities
from best to worst* scenario, and is enforced on every ranking response by the shared response
assertion.

---

## 2. Per-activity score drivers (dominant weather factor)

The ticket leaves the scoring formula to the implementation; the suite pins the **dominant
factor** per activity and the exact threshold values below. Every threshold is **inclusive at
the stated value** and is exercised by a below / exact / above boundary triplet.

### Skiing — snowfall + freezing temperature

| Condition | Effect on score |
| --- | --- |
| Snowfall present **and** temperature ≤ `0 °C` (inclusive) | Favoured — can be the best-rated activity; reasoning should reference snow. |
| Snowfall present but temperature > `0 °C` (just above freezing) | Not snow-favoured — Skiing must not win. |
| No snowfall (even when cold and dry) | Not favoured — Skiing must not win. |
| Warm temperatures | Penalised. |

Boundary fixtures: `forecast.boundary-freeze-low.json` (`-0.1 °C`), `forecast.boundary-freeze.json`
(`0.0 °C`), `forecast.boundary-thaw.json` (`+0.1 °C`), each with snowfall; plus the week profiles'
cold/dry days (`forecast.week-b.json` day 2).

### Surfing — strong wind with warm, dry conditions

| Condition | Effect on score |
| --- | --- |
| Wind speed ≥ `25 km/h` (inclusive) with warm, dry weather | Favoured — can be the best-rated activity. |
| Wind speed < `25 km/h` | Not wind-favoured. |
| Severe wet and windy weather (storm: rain + poor visibility + dangerous wind) | Penalised — wind alone does not make surfing suitable. |
| Calm, cold or wet conditions | Penalised. |

Boundary fixtures: `forecast.boundary-wind-low.json` (`24.9 km/h`),
`forecast.boundary-wind-exact.json` (`25.0 km/h`), `forecast.boundary-wind-high.json`
(`25.1 km/h`), all warm and dry; plus the week profiles' storm and calm days.

### OutdoorSightseeing — clear skies, good visibility, mild temperatures

| Condition | Effect on score |
| --- | --- |
| Visibility ≥ `5000 m` (inclusive), low cloud cover, mild temperature, low UV, dry | Favoured — can be the best-rated activity. |
| Visibility < `5000 m` | Not favoured. |
| Extreme heat and very high UV | Penalised — must not win. |
| Persistent rain, cold with limited visibility, overcast | Penalised. |

Boundary fixtures: `forecast.boundary-visibility-low.json` (`4999 m`),
`forecast.boundary-visibility-exact.json` (`5000 m`), `forecast.boundary-visibility-high.json`
(`5001 m`), all otherwise mild and clear; plus the week profiles' hot/UV and overcast days.

### IndoorSightseeing — the bad-weather fallback

| Condition | Effect on score |
| --- | --- |
| Rain ≥ `5 mm/h` (inclusive), or poor visibility, or cold | Favoured — can be the best-rated activity. |
| Rain < `5 mm/h` with otherwise pleasant weather | Not rain-favoured. |
| Warm, dry, calm, clear weather | Penalised — must not win. |

Boundary fixtures: `forecast.boundary-rain-low.json` (`4.9 mm/h`),
`forecast.boundary-rain-exact.json` (`5.0 mm/h`), `forecast.boundary-rain-high.json`
(`5.1 mm/h`); plus the week profiles' clear/calm days.

---

## 3. Daylight (sunrise/sunset) relation

The daily `sunrise`/`sunset` values are how the SUT makes use of the hourly data: they define the
**daylight window** for each day, and the SUT is expected to use that window to work out which
hourly samples apply when scoring — e.g. aggregating temperature, wind, rain and visibility over
the daylight hours for the outdoor activities, and over the full day (or the night hours) where a
rule calls for it. The window may also modulate the score itself (e.g. reducing
outdoor-sightseeing suitability on short days). No daylight-threshold scenario exists yet — the
scoring rule is intentionally unpinned until a product decision is made — but the window-to-hourly
data relation the SUT relies on is deterministic:

- A fixture profile may declare `daylight: { "sunriseHour", "sunsetHour" }` (whole hours,
  `0 ≤ sunrise < sunset ≤ 23`). It defaults to `06:00–18:00` (a deterministic 12-hour day).
- `daily.sunrise[day]` / `daily.sunset[day]` are derived from that window.
- The three hourly **day-part values align to the window**: *morning* covers
  `[sunriseHour, 12)`, *afternoon* covers `[12, sunsetHour)`, and the remaining hours (before
  sunrise and after sunset) carry the *evening/night* value.

So a future short-day or long-day scenario only sets the window on a fixture profile — the
hourly ranges follow automatically and stay consistent with the reported sunrise/sunset.

---

## 4. Data relations the mock guarantees (mirroring real Open-Meteo)

### 4.1 Response payload assumption

The SUT requests the forecast with the fixed query:

```
https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}
  &daily=uv_index_max,precipitation_hours,sunrise,sunset
  &hourly=temperature_2m,rain,showers,snowfall,wind_speed_10m,visibility,cloud_cover
  &format=json&timeformat=unixtime
```

**Assumption:** for this request, the Open-Meteo response payload contains **only** the following
properties — and the SUT must not depend on anything else:

- **Top level:** `latitude`, `longitude`, `generationtime_ms`, `utc_offset_seconds`, `timezone`,
  `timezone_abbreviation`, `elevation`, `hourly_units`, `hourly`, `daily_units`, `daily`.
- **`hourly_units` / `hourly`:** `time` plus exactly the seven requested variables
  (`temperature_2m`, `rain`, `showers`, `snowfall`, `wind_speed_10m`, `visibility`,
  `cloud_cover`).
- **`daily_units` / `daily`:** `time` plus exactly the four requested values
  (`uv_index_max`, `precipitation_hours`, `sunrise`, `sunset`).

No other variables (e.g. `apparent_temperature`, `weather_code`, `is_day`, `precipitation`) are
expected in the payload. If a future implementation needs a variable outside this list, the
request above, this assumption and the mock fixtures must be updated together. The mock serves
exactly this structure, and the direct MSW tests enforce the key sets so a drift fails loudly.

### 4.2 Guaranteed relations

| Relation | Guarantee |
| --- | --- |
| `hourly.time` | 168 contiguous unixtime values, 3600 s apart, starting at a midnight. |
| `daily.time[day]` | Equals `hourly.time[day * 24]` (midnight alignment, 7 days). |
| `daily.sunrise[day]` / `sunset[day]` | Strictly inside the day: `day < sunrise < sunset < day + 86400`. |
| Day-part ↔ daylight | Hourly values follow the sunrise/sunset window (Section 3). |
| `daily.precipitation_hours[day]` | Derived: the count of that day's 24 hours with `rain > 0 || showers > 0 || snowfall > 0`. |
| Top-level metadata | `latitude`/`longitude` echo the requested coordinates; `generationtime_ms`, `utc_offset_seconds` (`0`), `timezone`, `timezone_abbreviation` (`GMT`), `elevation` (from the profile) are present as in real responses. |
| Unknown coordinates | `404` with an `error` field — never a silent fallback. |
| Outage coordinate (`0,0`) | `503` with an `error` field, which the SUT must surface as `502`. |

The direct MSW tests (`test/mocks/openMeteo/server.test.ts`) enforce the key sets, lengths,
alignment and derivation rules above.

---

## 5. Error semantics

| Situation | Expected SUT response |
| --- | --- |
| Missing / blank `/locations?name=` | `400` with an `error` field. |
| Unknown town name | `200` with `"results": []` (type-ahead friendly; not `404`). |
| Missing / out-of-range `/rankings` coordinates | `400` with an `error` field. |
| Open-Meteo outage (mock `503`) | `502` with an `error` field. |
| Any error body | Carries an `error` field. |
