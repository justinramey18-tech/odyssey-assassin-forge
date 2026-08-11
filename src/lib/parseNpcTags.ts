export interface ParsedNpcTags {
  npcNames: string[];
  message: string;
}

export function parseNpcTags(text: string, knownNames: string[]): ParsedNpcTags | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('@')) return null;

  const sortedNames = [...knownNames].sort((a, b) => b.length - a.length);
  let remaining = trimmed;
  const tagged: string[] = [];

  while (remaining.startsWith('@')) {
    const afterAt = remaining.slice(1);
    const found = sortedNames.find((name) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`^${escaped}(\\s|$)`, 'i').test(afterAt);
    });
    if (!found) break;
    tagged.push(found);
    remaining = afterAt.slice(found.length).trimStart();
  }

  const message = remaining.trim();
  return tagged.length > 0 && message ? { npcNames: tagged, message } : null;
}