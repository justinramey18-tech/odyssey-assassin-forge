import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// Explicitly provisioned disposable local database only; never use managed PG env vars.
describe.skipIf(process.env.COMBAT_BUFF_ISOLATED_TESTS !== '1')('atomic temporary-HP inbox (isolated database)', () => {
  it('emits separate deltas exactly once and rolls back the fighter and inbox together', () => {
    const output = execFileSync('psql', ['-h', '/tmp/combat-buff-pg', '-p', '55439', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], {
      encoding: 'utf8', input: `BEGIN;
INSERT INTO party_fight_combatants(id,fight_id,party_id,kind,user_id,name) VALUES ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','player','00000000-0000-4000-8000-000000000003','Test');
UPDATE party_fight_combatants SET temp_hp=10;
UPDATE party_fight_combatants SET temp_hp=10;
UPDATE party_fight_combatants SET temp_hp=3;
SELECT CASE WHEN count(*)=2 AND sum(temp_hp_delta)=3 AND sum(hp_delta)=0 THEN 'PASS separate deltas' ELSE 'FAIL' END FROM party_fight_events;
SAVEPOINT failed_write;
UPDATE party_fight_combatants SET temp_hp=0;
ROLLBACK TO failed_write;
SELECT CASE WHEN (SELECT count(*) FROM party_fight_events)=2 AND (SELECT temp_hp FROM party_fight_combatants)=3 THEN 'PASS atomic rollback' ELSE 'FAIL' END;
ROLLBACK;`,
    });
    expect(output.split('\n')).toContain('PASS separate deltas');
    expect(output.split('\n')).toContain('PASS atomic rollback');
    expect(output.split('\n')).not.toContain('FAIL');
  });
});