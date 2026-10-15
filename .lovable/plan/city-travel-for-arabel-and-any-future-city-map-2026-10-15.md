# City Travel for Arabel (and any future city map)

## What exists today
- Arabel is installed inside the World map with 13 places (Wailing Wheel Inn, Market Square, the four gates, etc.), all pinned and discovered.
- It has **no streets** connecting them and **no scale** set, and it is set to "tap a place, arrive instantly".
- The World map already has the full travel system: pick a destination, the app finds the quickest roads, the party moves along them in real time, the shared clock advances, the DM is told "still travelling".
- That travel system is built for the wilderness: miles, 2/3/4 miles per hour, and a forced stop after 8 hours of walking per day.

## The goal
Arabel moves exactly like the World map (pick a place, watch the party walk the streets, time passes, DM can't skip ahead), but at city scale: minutes instead of days, feet/yards instead of miles, no "end of travel day" stops.

## How it will work for players
1. **A new map setting: "Travel style: Wilderness / City."** The host sets Arabel to City. The World stays Wilderness. Nothing changes on any map unless the host chooses it.
2. **Streets instead of roads.** On a City map the Roads section is called Streets. The host draws streets between places the same way roads are drawn.
3. **Quick street setup.** Because Arabel has 13 places and no streets, the host gets a **"Suggest streets"** button: the app connects each place to its nearest neighbours and shows the proposed streets for review. Nothing is saved until the host taps Accept. The host can then delete or redraw any street.
4. **Easy city scale.** Instead of measuring a known distance in miles, the host can type "this map is about ___ across" (for example 1 mile, or 2,000 yards). Every street then gets a real length automatically. A typed length on any single street still overrides that.
5. **Walking speeds that make sense in town:** Careful (sneaking, crowds), Walk, Hurry. Crossing Arabel gate to gate on foot takes roughly 20–40 in-world minutes; the inn to the market a few minutes.
6. **No travel-day stops in the city.** A city trip always goes straight to the destination. The 8-hour limit stays on the World map only.
7. **Times shown in minutes and distances in feet/yards** ("Market Square — 340 yards, about 4 minutes"), while the World keeps miles and hours.
8. **Same controls as the World:** destination list, route highlight, moving marker, pause/resume, stop where you are, host "finish now", fights pause travel.
9. **Gates link the city and the world.** Arriving at Arabel by road still drops the party at its entry point (a gate). Leaving the city works as it does today, returning the party to Arabel on the World map.
10. **DM knows the scale.** During a city trip the DM is told the party is walking the streets toward a named place, how far along they are, and that they haven't arrived yet; no talk of camping or travel days.

## What stays the same
- One shared campaign clock for every map.
- Only the host can change the map, streets, or start/stop travel.
- Existing World roads, journeys, saves and Map Packs behave exactly as now.
- Any map not switched to City keeps working as it does today.

## Order of work
1. City scale rules and the setting (no visible change until switched on), with tests.
2. Streets on area maps, city scale input, Suggest streets with review.
3. City destination list, speeds, minutes/yards display, moving marker.
4. DM wording for city trips; final checks across saving, loading, entering and leaving.

## Technical details
- Add optional `travelScale?: 'overland' | 'city'` to `CampaignMapState` (sanitized; missing = overland). Kept in map state, not `AtlasMapNode`, so atlas/version parsing and the `write_campaign_atlas` validator stay unchanged; confirm the server validator accepts the extra state key before relying on it (if it doesn't, stop and report rather than editing the database).
- Arabel's `navigationMode` is switched to `regional` by the host via the existing setting; City scale only changes the rules inside regional travel. `moveLocal` remains for true room maps.
- Internal unit stays miles so `planJourneyRoute`, `travelNow`, `settleTravelState`, `freezeTravel`, `resolveAtlasAt` and `applyArrivalEntry` are reused untouched.
- `buildJourneyTranche`/`maxLegalLeg`: when `travelScale === 'city'`, skip the 480-minute cap (single tranche to destination), with a minimum of 1 game minute per leg so trips never finish instantly; NaN/zero guards via `Number.isFinite`.
- City calibration helper: "map width in yards/miles" -> `createCalibration` across the image width, converted to miles.
- Suggest streets: pure function, k-nearest (2-3) pinned discovered places, de-duplicated, no crossings check beyond skipping duplicates; returns staged routes for host review, saved via existing `addRoute` / compare-and-set path.
- Remove the root-only restriction on roads in `AreaMapEditor`/`CampaignMapPanel` for maps in regional mode; Play View travel controls use the active map.
- Display helpers: `formatDistance(miles, scale)` and `formatDuration(minutes, scale)`.
- `buildDmLogisticsContext`: city wording branch; no travel-day text.
- Tests (vitest, alongside existing campaign-map tests): city trip has no 8-hour stop; 0.25-mile street at Walk = 5 minutes; overland unchanged; missing/invalid scale = overland; suggested streets connect all 13-style layouts without duplicates; save/load keeps `travelScale`; DM city text has no "travel day".
- No database or sign-in changes. Arabel's streets are created by the host in the app, not written directly.
