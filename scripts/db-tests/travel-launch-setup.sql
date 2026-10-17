-- Load into a DISPOSABLE PostgreSQL database only, never the managed project.
-- Then load atlas validation/guard from 0025, the 0028 envelope fix, and
-- migrations 0034, 0035 and 0040 before running travel-launch-storage.test.ts
-- with TRAVEL_LAUNCH_ISOLATED_TESTS=1. The test uses only /tmp/travel-launch/pg:55433.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE TABLE parties(id uuid PRIMARY KEY, created_by uuid);
CREATE TABLE party_shared_state(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), party_id uuid, user_id uuid,
  state_type text, state_data jsonb, updated_at timestamptz DEFAULT now()
);
CREATE TABLE party_dm_messages(id uuid PRIMARY KEY);
GRANT ALL ON parties, party_shared_state, party_dm_messages TO service_role;
CREATE FUNCTION handle_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = clock_timestamp(); RETURN NEW; END $$;