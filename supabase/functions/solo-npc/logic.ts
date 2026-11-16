// Solo Empyrean Live NPCs (D-38): the pure part of the solo-npc function. No Deno, database or
// network code, so the app's tests run it too.
// - remember: after a DM post, each roster NPC in the scene keeps at most one memory of the rider
//   and moves its attitude at most one step.
// - build: Quick Build turns a short description into a custom NPC.
// The phone keeps the results (table solo_npcs); this function only asks the model.

export const MAX_SCENE_CHARS = 6000;
export const MAX_NPCS_PER_SCENE = 8;
export const MAX_MEMORY_CHARS = 200;
export const MAX_DESCRIPTION_CHARS = 1500;
export const FOE_KINDS = ["cadet", "rider", "soldier", "flier", "wyvern", "venin", "beast"] as const;
export const CHALLENGES = ["easy", "moderate", "hard", "deadly"] as const;

export function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function list(v: unknown, maxItems: number, maxChars: number): string[] {
  return Array.isArray(v) ? v.map((x) => text(x, maxChars)).filter(Boolean).slice(0, maxItems) : [];
}

function clampStep(v: unknown): -1 | 0 | 1 {
  const n = Math.round(Number(v));
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

function clampAttitude(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(-3, Math.min(3, n)) : 0;
}

// ── remember ──

export interface SceneNpc { key: string; name: string; personality: string; attitude: number; recent: string[] }
export interface RememberInput { riderName: string; era: string; scene: string; npcs: SceneNpc[] }

export function readRememberInput(body: Record<string, unknown>): RememberInput | null {
  const riderName = text(body.riderName, 80) || "the rider";
  const era = text(body.era, 120);
  const scene = typeof body.scene === "string" ? body.scene.trim().slice(-MAX_SCENE_CHARS) : "";
  if (!scene || !Array.isArray(body.npcs)) return null;
  const npcs: SceneNpc[] = [];
  for (const raw of body.npcs.slice(0, MAX_NPCS_PER_SCENE)) {
    const n = raw as Record<string, unknown>;
    const key = text(n?.key, 80);
    const name = text(n?.name, 80);
    if (!key || !name || npcs.some((x) => x.key === key)) continue;
    npcs.push({ key, name, personality: text(n.personality, 300), attitude: clampAttitude(n.attitude), recent: list(n.recent, 3, MAX_MEMORY_CHARS) });
  }
  return npcs.length ? { riderName, era, scene, npcs } : null;
}

export const REMEMBER_TOOL = {
  name: "record_memories",
  description: "Record what each listed NPC remembers about the rider from this scene, and how their feelings shift.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string", description: "The NPC's key, exactly as given." },
            memory: { type: "string", description: "One short sentence from the NPC's point of view about the rider in this scene. Empty if the NPC had no real part in it." },
            attitude_change: { type: "integer", enum: [-1, 0, 1], description: "+1 if the rider's actions warmed this NPC toward them, -1 if they cooled, 0 otherwise. Most scenes are 0." },
          },
          required: ["key", "memory", "attitude_change"],
        },
      },
    },
    required: ["items"],
  },
};

export function rememberSystem(input: RememberInput): string {
  const roster = input.npcs.map((n) =>
    `- key "${n.key}": ${n.name}. ${n.personality} Current attitude toward ${input.riderName}: ${n.attitude} (-3 hostile … +3 devoted).${n.recent.length ? ` Already remembers: ${n.recent.join(" / ")}` : ""}`
  ).join("\n");
  return [
    `You keep the memories of NPCs in a solo Fourth Wing campaign (${input.era || "Basgiath War College"}). The player's rider is ${input.riderName}.`,
    "For each NPC below, read the scene and decide what that NPC personally saw or heard of the rider, and how it changes their feelings.",
    "Rules:",
    "- Only what the NPC could know: they must be present or told. If an NPC had no real part in the scene, give an empty memory and 0.",
    "- One short sentence per NPC, in the NPC's own perspective (\"Kylar kept quiet when Dain asked who broke formation.\"). No dice, numbers or game terms.",
    "- attitude_change is -1, 0 or +1, judged by this NPC's personality and values. Most scenes are 0. Never repeat a memory they already have.",
    "- Call record_memories once, with one item per NPC listed.",
    "",
    "NPCs:",
    roster,
  ].join("\n");
}

export interface MemoryResult { key: string; memory: string; attitudeChange: -1 | 0 | 1 }

export function readRememberResult(toolInput: Record<string, unknown> | null, input: RememberInput): MemoryResult[] {
  const items = Array.isArray(toolInput?.items) ? toolInput?.items as Array<Record<string, unknown>> : [];
  const out: MemoryResult[] = [];
  for (const item of items) {
    const key = text(item?.key, 80);
    if (!input.npcs.some((n) => n.key === key) || out.some((o) => o.key === key)) continue;
    const memory = text(item.memory, MAX_MEMORY_CHARS);
    const change = memory ? clampStep(item.attitude_change) : 0;
    if (!memory && change === 0) continue;
    out.push({ key, memory, attitudeChange: change });
  }
  return out;
}

// ── build ──

export interface BuildInput { description: string; era: string; riderName: string }

export function readBuildInput(body: Record<string, unknown>): BuildInput | null {
  const description = text(body.description, MAX_DESCRIPTION_CHARS);
  if (description.length < 3) return null;
  return { description, era: text(body.era, 120), riderName: text(body.riderName, 80) || "the rider" };
}

export const BUILD_TOOL = {
  name: "create_npc",
  description: "Create one original NPC for a solo Fourth Wing campaign.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      role: { type: "string", description: "Their place in the world right now, e.g. 'Second-year rider, Claw Section, Third Wing'." },
      look: { type: "string", description: "One sentence." },
      personality: { type: "string", description: "One or two sentences." },
      voice: { type: "string", description: "How they talk, one sentence." },
      wants: { type: "string", description: "What they want, one sentence." },
      facts: { type: "array", items: { type: "string" }, description: "Up to 4 open facts: dragon (color and tail), signet, background." },
      secrets: { type: "array", items: { type: "string" }, description: "Up to 3 things they hide." },
      attitude: { type: "integer", minimum: -3, maximum: 3, description: "Starting attitude toward the rider." },
      fight_kind: { type: "string", enum: [...FOE_KINDS] },
      fight_challenge: { type: "string", enum: [...CHALLENGES] },
      can_fight: { type: "boolean" },
    },
    required: ["name", "role", "look", "personality", "voice", "wants", "facts", "secrets", "attitude", "fight_kind", "fight_challenge", "can_fight"],
  },
};

export function buildSystem(input: BuildInput): string {
  return [
    `You create original NPCs for a solo Fourth Wing campaign set in ${input.era || "Violet Sorrengail's years at Basgiath"}. The player's rider is ${input.riderName}.`,
    "Make an original character that fits the world: Navarre, Basgiath War College, dragons and signets, gryphon fliers, the venin. Never copy a named character from the books, and never quote the books.",
    "Dragons follow canon: a color and a tail type (daggertail, swordtail, clubtail, scorpiontail, morningstartail). Keep every field short.",
    "Call create_npc once.",
  ].join("\n");
}

export interface CustomNpc {
  name: string; role: string; look: string; personality: string; voice: string; wants: string;
  facts: string[]; secrets: string[]; attitude: number;
  fight: { kind: (typeof FOE_KINDS)[number]; challenge: (typeof CHALLENGES)[number] } | null;
}

export function readBuildResult(toolInput: Record<string, unknown> | null): CustomNpc | null {
  if (!toolInput) return null;
  const name = text(toolInput.name, 80);
  const personality = text(toolInput.personality, 400);
  if (!name || !personality) return null;
  const kind = FOE_KINDS.find((k) => k === toolInput.fight_kind) ?? "rider";
  const challenge = CHALLENGES.find((c) => c === toolInput.fight_challenge) ?? "moderate";
  return {
    name,
    role: text(toolInput.role, 160),
    look: text(toolInput.look, 300) || "Dressed for their station.",
    personality,
    voice: text(toolInput.voice, 200) || "Plain-spoken.",
    wants: text(toolInput.wants, 200) || "To survive the war.",
    facts: list(toolInput.facts, 4, 240),
    secrets: list(toolInput.secrets, 3, 240),
    attitude: clampAttitude(toolInput.attitude),
    fight: toolInput.can_fight === false ? null : { kind, challenge },
  };
}
