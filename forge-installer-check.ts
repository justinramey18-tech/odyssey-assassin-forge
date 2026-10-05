import { ROW_GUIDE_MAX_CHARS } from '@/lib/magic/rowGuides';

type Any = any;
let idn = 0;
let FAIL_LAND = false;
const registry: Record<string, Any> = {};

const sc: Any = {
  state: { preparedSpells: [] as string[], knownSpells: [] as string[] },
  prepareSpell(id: string) { if (!FAIL_LAND) this.state.preparedSpells.push(id); },
  learnSpell(id: string) { if (!FAIL_LAND) this.state.knownSpells.push(id); },
};
const cust: Any = {
  homebrewSpells: [] as Any[],
  addSpell(s: Any) { this.homebrewSpells.push(s); registry[s.id] = s; },
  updateSpell(id: string, patch: Any) {
    const s = this.homebrewSpells.find((x: Any) => x.id === id);
    if (s) Object.assign(s, patch);
  },
};
const spellForgeRef: Any = { current: { combatSpellcasting: sc, spellCustomization: cust, isPreparedCaster: true } };
const getSpellById = (id: string) => registry[id];
const generateHomebrewSpellId = () => 'sb-' + (++idn);

async function installer(draft: Any, options?: Any) {

      const { combatSpellcasting: sc, spellCustomization: cust, isPreparedCaster } = spellForgeRef.current;
      const now = Date.now();
      // Single mapping shared by the new-spell and update paths so both
      // produce identical fields (null becomes undefined, level clamped 0-9).
      const mapDraftToFields = () => ({
        name: draft.name,
        level: Math.min(9, Math.max(0, Math.floor(draft.level))) as HomebrewSpell['level'],
        school: draft.school as SpellSchool,
        castingTime: draft.castingTime as CastingTime,
        range: draft.range,
        duration: draft.duration,
        concentration: !!draft.concentration,
        ritual: !!draft.ritual,
        components: {
          verbal: !!draft.components?.verbal,
          somatic: !!draft.components?.somatic,
          material: draft.components?.material ? draft.components.material : undefined,
        },
        attackType: (draft.attackType as AttackType) || undefined,
        saveStat: (draft.saveStat as SaveStat) || undefined,
        damageFormula: draft.damageFormula || undefined,
        damageType: draft.damageType || undefined,
        healingFormula: draft.healingFormula || undefined,
        higherLevels: draft.higherLevels || undefined,
        description: draft.description,
      });
      // Row guides ride along with the draft: only keys "1" to "20" holding a
      // non-empty string, trimmed and capped. Anything else is dropped.
      const cleanRowGuides = (): Record<string, string> => {
        const guides: Record<string, string> = {};
        const raw = draft.rowGuides;
        if (!raw || typeof raw !== 'object') return guides;
        for (let roll = 1; roll <= 20; roll++) {
          const value = (raw as Record<string, unknown>)[String(roll)];
          if (typeof value !== 'string') continue;
          const trimmed = value.trim();
          if (!trimmed) continue;
          guides[String(roll)] = trimmed.slice(0, ROW_GUIDE_MAX_CHARS);
        }
        return guides;
      };
      const rowGuides = cleanRowGuides();
      const guideFields = () => (Object.keys(rowGuides).length > 0 ? { rowGuides } : {});
      const ensureLanded = async (spellId: string): Promise<boolean> => {
        // Wait for the spell to resolve through the same lookup prepareSpell uses.
        const deadline = Date.now() + 1000;
        while (!getSpellById(spellId) && Date.now() < deadline) {
          await new Promise(r => setTimeout(r, 50));
        }
        if (!getSpellById(spellId)) return false;
        if (isPreparedCaster) sc.prepareSpell(spellId);
        else sc.learnSpell(spellId);
        // Confirm the id actually landed before reporting success.
        await new Promise(r => setTimeout(r, 100));
        return spellForgeRef.current.combatSpellcasting.state.preparedSpells.includes(spellId)
          || spellForgeRef.current.combatSpellcasting.state.knownSpells.includes(spellId);
      };
      const limitMessage = (spell: HomebrewSpell) => {
        if (spell.level > 0) {
          return `${spell.name} is in your spellbook, but you're at your prepared limit. Unprepare a spell to use it from Quick Actions.`;
        }
        return null;
      };

      // Rework path: replace an existing homebrew spell in place (same id, so
      // it stays prepared/learned and syncs to the cloud as an update).
      const replaceId = options?.replaceId;
      if (replaceId) {
        const existing = cust.homebrewSpells.find(s => s.id === replaceId);
        if (existing) {
          // Merge with the guides the spell already carries so notes written
          // in earlier sessions are never lost.
          const merged = { ...(existing.rowGuides ?? {}), ...rowGuides };
          const mergedFields = Object.keys(merged).length > 0 ? { rowGuides: merged } : {};
          cust.updateSpell(replaceId, { ...mapDraftToFields(), aiGenerated: true, ...mergedFields });
          const landed = await ensureLanded(replaceId);
          if (!landed) {
            const limit = limitMessage({ ...existing, ...mapDraftToFields() });
            if (limit) return { ok: true, message: limit, spellId: replaceId };
            return { ok: false, message: 'Install failed. Try again.' };
          }
          return { ok: true, message: `${draft.name} updated. Quick Actions has the new version.`, spellId: replaceId };
        }
        // Old id not found — fall through and install as a brand-new spell.
        const spell: HomebrewSpell = {
          id: generateHomebrewSpellId(),
          ...mapDraftToFields(),
          ...guideFields(),
          iconName: 'Sparkles',
          personalityQuips: { thunderhead: '', jarvis: '', deadpool: '' },
          isHomebrew: true,
          aiGenerated: true,
          createdAt: now,
          updatedAt: now,
        };
        cust.addSpell(spell);
        const landed = await ensureLanded(spell.id);
        if (!landed) {
          const limit = limitMessage(spell);
          if (limit) return { ok: true, message: limit, spellId: spell.id };
          return { ok: false, message: 'Install failed. Try again.' };
        }
        return { ok: true, message: `${draft.name} was saved as a new spell (the old one wasn't found).`, spellId: spell.id };
      }

      // New-spell path (unchanged behavior when no options are passed).
      const spell: HomebrewSpell = {
        id: generateHomebrewSpellId(),
        ...mapDraftToFields(),
        ...guideFields(),
        iconName: 'Sparkles',
        personalityQuips: { thunderhead: '', jarvis: '', deadpool: '' },
        isHomebrew: true,
        aiGenerated: true,
        createdAt: now,
        updatedAt: now,
      };
      cust.addSpell(spell);
      const landed = await ensureLanded(spell.id);
      if (!landed) {
        const limit = limitMessage(spell);
        if (limit) return { ok: true, message: limit, spellId: spell.id };
        return { ok: false, message: 'Install failed. Try again.' };
      }
      return { ok: true, message: `${spell.name} is ready in Quick Actions.`, spellId: spell.id };
}

const rows = Array.from({ length: 20 }, (_, i) => `${i + 1}: Outcome ${i + 1}.`).join('\n');
const base = (over: Any = {}): Any => ({
  name: 'Harness Hex', level: 2, school: 'evocation', castingTime: 'action', range: '60 feet',
  duration: 'instantaneous', concentration: false, ritual: false,
  components: { verbal: true, somatic: true, material: null },
  attackType: 'spell', saveStat: 'dex', damageFormula: '4d6', damageType: 'fire',
  healingFormula: null, higherLevels: '+1d6 per slot',
  description: `Roll a d20.\n${rows}`, ...over,
});

let pass = 0, fail = 0;
function check(label: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log('PASS', label); }
  else { fail++; console.log('FAIL', label, extra); }
}

const junk = { '1': 'Guide one.', '3': '  Guide three with padding.  ', '5': '   ', '8': 12, '21': 'Out of range key.', '20': 'Guide twenty.' };

// 1. New spell, junky guides -> only cleaned rows stored, spellId returned
const r1 = await installer(base({ rowGuides: junk }));
const s1 = cust.homebrewSpells[cust.homebrewSpells.length - 1];
check('new: guides cleaned', JSON.stringify(s1.rowGuides) === JSON.stringify({ '1': 'Guide one.', '3': 'Guide three with padding.', '20': 'Guide twenty.' }), JSON.stringify(s1.rowGuides));
check('new: spellId is new id', r1.ok === true && r1.spellId === s1.id && !!r1.spellId, JSON.stringify(r1));

// 2. New spell, no guides -> key absent
const r2 = await installer(base({ name: 'No Guides' }));
const s2 = cust.homebrewSpells[cust.homebrewSpells.length - 1];
check('new: no rowGuides key', !('rowGuides' in s2), JSON.stringify(Object.keys(s2).includes('rowGuides')));
check('new: spellId present without guides', r2.ok === true && r2.spellId === s2.id, JSON.stringify(r2));

// 3. Long guide capped
const r3 = await installer(base({ name: 'Long Guide', rowGuides: { '7': 'x'.repeat(9000) } }));
const s3 = cust.homebrewSpells[cust.homebrewSpells.length - 1];
check('new: guide capped at ROW_GUIDE_MAX_CHARS', s3.rowGuides['7'].length === ROW_GUIDE_MAX_CHARS, String(s3.rowGuides['7'].length));
check('new: capped install returns spellId', r3.ok === true && r3.spellId === s3.id, JSON.stringify(r3));

// 4. Update merges with existing guides
const keep = base({ name: 'Old Hex', rowGuides: { '2': 'old two', '3': 'old three' } });
cust.addSpell({ ...keep, id: 'sb-keep', isHomebrew: true, aiGenerated: true, iconName: 'Sparkles', personalityQuips: { thunderhead: '', jarvis: '', deadpool: '' }, createdAt: 1, updatedAt: 1 });
registry['sb-keep'] = cust.homebrewSpells[cust.homebrewSpells.length - 1];
const r4 = await installer(base({ rowGuides: { '3': 'new three', '7': 'new seven' } }), { replaceId: 'sb-keep' });
const s4 = cust.homebrewSpells.find((x: Any) => x.id === 'sb-keep');
check('update: merged guides', JSON.stringify(s4.rowGuides) === JSON.stringify({ '2': 'old two', '3': 'new three', '7': 'new seven' }), JSON.stringify(s4.rowGuides));
check('update: spellId is replaceId', r4.ok === true && r4.spellId === 'sb-keep', JSON.stringify(r4));

// 5. Update with no new guides keeps existing ones
const r5 = await installer(base({ name: 'Old Hex' }), { replaceId: 'sb-keep' });
const s5 = cust.homebrewSpells.find((x: Any) => x.id === 'sb-keep');
check('update: existing guides survive empty draft', JSON.stringify(s5.rowGuides) === JSON.stringify({ '2': 'old two', '3': 'new three', '7': 'new seven' }), JSON.stringify(s5.rowGuides));
check('update: empty-draft install returns spellId', r5.ok === true && r5.spellId === 'sb-keep', JSON.stringify(r5));

// 6. Unknown replaceId -> installs new with cleaned guides and the NEW id
const r6 = await installer(base({ name: 'Ghost Rework', rowGuides: junk }), { replaceId: 'sb-missing' });
const s6 = cust.homebrewSpells[cust.homebrewSpells.length - 1];
check('missing id: installs new with cleaned guides', JSON.stringify(s6.rowGuides) === JSON.stringify({ '1': 'Guide one.', '3': 'Guide three with padding.', '20': 'Guide twenty.' }), JSON.stringify(s6.rowGuides));
check('missing id: spellId is the new id', r6.ok === true && r6.spellId === s6.id && r6.spellId !== 'sb-missing', JSON.stringify(r6));

// 7. Prepared-limit path still reports spellId
FAIL_LAND = true;
const r7 = await installer(base({ name: 'Limited Hex' }));
const s7 = cust.homebrewSpells[cust.homebrewSpells.length - 1];
check('limit: ok true with limit message and spellId', r7.ok === true && /prepared limit/.test(r7.message) && r7.spellId === s7.id, JSON.stringify(r7).slice(0, 160));
FAIL_LAND = false;

console.log(`\n${pass} passed, ${fail} failed`);
