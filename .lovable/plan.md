

# Updated Phased Plan: Human DM Mode, AI Approval Mode + Whisper Authoring

## What's New

In both **Human DM** and **AI Approval** modes, the host can attach whispers (Action, Tactics, and per-character Whispers) to their messages. This means the compose/review panels need a whisper editor — a UI for adding, editing, and removing whisper blocks that get serialized into the HTML comment delimiters before the message is stored.

## Whisper Serialization

A new utility function `serializeWhispers(narrative: string, whispers: Whisper[]): string` will take clean narrative text and a whisper array, then produce the final content string with the delimiter tags appended:

```text
[narrative text here]
<!--ACTION-->Roll a DC 15 Perception check<!--/ACTION-->
<!--WHISPER:Kael-->You notice the bartender palming a dagger<!--/WHISPER:Kael-->
```

This is the inverse of `parseWhispers` from `whisper-parser.ts`. When the message is stored in `party_dm_messages`, it goes through the normal parse pipeline on read — so the WhisperTray renders automatically.

## Whisper Editor Component

A new `WhisperEditor.tsx` component lets the host build whisper blocks:
- "Add Whisper" button opens a row with: type selector (Action / Tactics / Whisper), optional target name (for Whisper type, populated from party member names), and a textarea for content
- Each whisper is a removable card
- Returns a `Whisper[]` array to the parent

This component is shared by both `DMComposePanel` and `DraftReviewPanel`.

---

## Revised Phase Breakdown

### Phase 1: Data model + mode selector (2 files)
- **`src/hooks/use-party-dm.ts`** — Add `dmMode` to `DmSessionConfig` interface, default `'ai'`
- **`src/components/ai-dm/PartyDMSettings.tsx`** — Add DM Mode selector (host-only)

### Phase 2: Whisper utilities + editor component (2 files)
- **`src/lib/whisper-parser.ts`** — Add `serializeWhispers(narrative, whispers)` function
- **`src/components/ai-dm/WhisperEditor.tsx`** (new) — Reusable whisper block editor: add/remove/edit Action, Tactics, and per-character Whisper entries. Accepts party member names for the target dropdown.

### Phase 3: Human DM mode — compose + send (3 files)
- **`src/hooks/use-party-dm.ts`** — Gate auto-generation on `dmMode === 'ai'`; add `sendManualDmMessage(content: string)` that inserts as `role: 'assistant'`
- **`src/components/ai-dm/DMComposePanel.tsx`** (new) — Textarea for narrative + embedded `WhisperEditor` + "Send as DM" button. Calls `serializeWhispers` before `sendManualDmMessage`.
- **`src/components/ai-dm/PartyDMScreen.tsx`** — Render `DMComposePanel` when `dmMode === 'human'` and all ready

### Phase 4: AI Approval mode — draft + review (3 files)
- **`src/hooks/use-party-dm.ts`** — Add `pendingDraft` state; in `ai-approval` mode collect stream into draft instead of broadcasting; add `approveDraft(editedContent)` and `discardDraft()`
- **`src/components/ai-dm/DraftReviewPanel.tsx`** (new) — Shows AI draft with edit toggle + embedded `WhisperEditor` (pre-populated by parsing the draft). Approve serializes whispers back into content before inserting. Regenerate/Discard buttons.
- **`src/components/ai-dm/PartyDMScreen.tsx`** — Render `DraftReviewPanel` when `pendingDraft` is set

### Phase 5: Player indicators + polish (2 files)
- **`src/components/ai-dm/PartyDMScreen.tsx`** — "DM is crafting a response..." indicator for non-hosts; hide streaming bubble in approval mode; handle mid-session mode switching
- **`src/components/ai-dm/PartyDMSettings.tsx`** — Mode descriptions and active badge

---

## Technical Notes

- **No database changes** — `dmMode` stored in existing JSONB in `party_shared_state`
- **No new edge functions** — Human DM bypasses AI; Approval mode reuses existing `ai-dm` function
- **Draft is client-only** — `pendingDraft` lives in React state, only inserted on approval
- **Whisper round-trip**: Host authors whispers via `WhisperEditor` → `serializeWhispers` embeds delimiters into stored content → `parseWhispers` extracts them on read → `WhisperTray` renders them. In AI Approval mode, `parseWhispers` pre-populates the editor from the AI draft so the host can modify whispers before approving.
- **`WhisperEditor` target dropdown** pulls character names from the party members list (already available in `PartyDMScreen`)

