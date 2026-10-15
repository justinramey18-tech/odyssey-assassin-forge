# Connector area installs (bridge)

The authenticated Odyssey connector (`supabase/functions/claude-bridge`) can add **one new local area map**
plus its private guides under an existing place, without the party host being signed in. This is a
dedicated connector authority, not a change to app permissions: in the app, map and guide editing stay
host-only (`write_campaign_atlas`, `party_location_guides` policies). See the atlas rule in `AGENTS.md`.

## Deployment order

1. Database: `drizzle/migrations/0027_bridge_campaign_area_installer.sql`, then the fixes
   `0028_fix_campaign_atlas_is_envelope_null.sql` and `0030_fix_bridge_install_guide_alias_apply.sql`
   (`0029` is an empty placeholder). Without 0028 legacy maps are never recognized; without 0030 every
   install that has guides fails.
2. Then deploy the `claude-bridge` function (`campaign-install.ts`, wired in `index.ts`).

## Supported scope

- Adds exactly one `local` area attached to an existing place that has no area yet.
- Party position, the active map, the campaign clock and time speed, other maps, routes, calibration,
  discoveries, unrelated guides and host ownership are left unchanged.
- A single legacy map is wrapped unchanged as the world root (`revision 0`); an existing atlas gets
  `revision + 1`.
- Not supported: replacing areas, entering the area, moving the party, travel, world replacement,
  calibration, rewards or character changes.

## Tools (behind the bridge key / approved-owner OAuth gate)

`preview_campaign_area_install` (read-only) and `install_campaign_area` take the same arguments:

| field | notes |
|---|---|
| `party_id` | UUID. The server resolves the host; no host, role or actor is accepted from input. |
| `image_ticket` | From `prepare_campaign_image_upload`. Re-verified on preview and install; its party must match. The image URL and size come only from verification. |
| `parent_map_id` | Existing map UUID, or `null` only when the party still has a legacy single map. |
| `parent_location_id` | Existing place on that map with no attached area. |
| `area_name` | 1–120 characters. |
| `map` | `locations` (1–500), `routes` (≤1000), `currentLocationId` (arrival = entry point), `defaultPace`. Unknown fields (image URL, travel, calibration…) are rejected. |
| `guides` | ≤501 entries `{scope: map|location, location_id?, name, content ≤30,000, enabled?}`; one per scope. |

The preview returns counts, guide names/scopes/lengths (never text), the current map version, the
unchanged position/clock, `payload_digest`, a fresh `request_id` and a 15-minute `preview_token`.
The token is HMAC-signed with a purpose-separated key and binds actor, party, host, expected
`updated_at`, revision or legacy marker, request id and the payload digest. **A preview is not
approval**; the user must confirm before install. Install requires identical arguments plus the token.

## Receipt fields

`requestId, partyId, actor, mapId, parentMapId, parentLocationId, guideIds, guideCount, revision,
updatedAt, convertedLegacy, payloadDigest, installedAt, replayed`. The private table
`bridge_campaign_installs` (service role only) additionally holds the pre-install snapshot
(`original_state_data`, `original_updated_at`), host, row id and an internal input digest.

## Conflicts and retries

- Map changed (updated_at / revision / format), host changed → conflict; run a new preview. Never forced.
- Same actor + party + request + payload → original receipt (`replayed: true`), even after the preview or
  upload ticket expired. Same request with different content → rejected.
- An expired preview that was never installed → rejected.
- Lost response → the bridge checks the receipt; `committed: true` means do **not** retry. If only the
  read-back fails, the response says the install is committed.
- Error codes from the database: `22023` invalid, `40001` stale, `23505` occupied / reused id,
  `54000` guide budget, `55000` inactive party, `P0002` missing.

## Verification

- `src/lib/__tests__/bridge-campaign-install.test.ts` — tool logic with injected dependencies.
- `scripts/db-tests/bridge-install.pglite.ts` — real Postgres (in-memory PGlite, synthetic data only)
  running the actual migrations: grants, legacy and atlas installs, preservation, forced guide-insert
  rollback, replay, reuse, stale/host/occupied/validation/budget failures, host-only app path.
- **Gaps:** PGlite is single-connection, so truly concurrent identical requests were not raced (safety
  relies on the party row lock + unique receipt key). Unapproved OAuth users are rejected by the
  existing bridge gate, which was not re-tested with a real unapproved token. No live install was run.

## Operator recovery (undo one install)

Never exposed as a player or unauthenticated tool; done by an operator with service-role access.

1. Load the receipt row for `(party_id, actor, request_id)`.
2. Compare: the current `campaign_map` row `updated_at` must equal the receipt's `new_updated_at`, and
   its revision must equal `new_revision`. The installed guide rows (`guide_ids`) must be unchanged since
   install (`updated_at` equal to `created_at`). If anything differs — travel, gameplay or other edits
   happened — **stop**: do not blindly restore the snapshot; remove the area by hand instead.
3. Build the restored state, never writing the old revision back (the atlas guard requires a strictly
   newer revision; do not disable it):
   - existing-atlas install: `original_state_data` with `revision = new_revision + 1`;
   - legacy-origin install: keep the current atlas envelope and remove the installed map from `maps`,
     leaving the original world as the only node, with `revision = new_revision + 1`. Do not write the
     legacy shape back.
4. In one transaction: update the map row (`WHERE id = state_row_id AND updated_at = new_updated_at`),
   set `enabled = false` on exactly the `guide_ids` rows, and leave every other row untouched.
