/**
 * Export / Import character save files as JSON
 */

import { SaveData } from '@/hooks/use-auto-save';

const EXPORT_FORMAT_VERSION = 1;
const MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface ExportedSave {
  _odysseyExport: true;
  formatVersion: number;
  exportedAt: string;
  saveName: string;
  data: Omit<SaveData, 'savedAt' | 'version'>;
}

/** Download a SaveData object as a .json file */
export function exportSaveToFile(
  saveData: SaveData,
  saveName: string
): void {
  const { savedAt, version, ...data } = saveData;

  const exported: ExportedSave = {
    _odysseyExport: true,
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    saveName,
    data,
  };

  const json = JSON.stringify(exported, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const safeName = saveName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const dateStr = new Date().toISOString().slice(0, 10);

  const a = document.createElement('a');
  a.href = url;
  a.download = `odyssey-save_${safeName}_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Validate and parse an imported JSON file into SaveData */
export async function importSaveFromFile(file: File): Promise<{
  data: Omit<SaveData, 'savedAt' | 'version'>;
  saveName: string;
  error?: never;
} | {
  data?: never;
  saveName?: never;
  error: string;
}> {
  // Size check
  if (file.size > MAX_IMPORT_SIZE_BYTES) {
    return { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.` };
  }

  // Type check
  if (!file.name.endsWith('.json') && file.type !== 'application/json') {
    return { error: 'Only .json files are supported.' };
  }

  try {
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { error: 'Invalid JSON file.' };
    }

    // Check Odyssey format marker
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !(parsed as Record<string, unknown>)._odysseyExport
    ) {
      return { error: 'Not a valid Odyssey save file. Missing export marker.' };
    }

    const exported = parsed as ExportedSave;

    // Validate required fields
    if (!exported.data?.character) {
      return { error: 'Save file is missing character data.' };
    }

    return {
      data: exported.data,
      saveName: exported.saveName || 'Imported Character',
    };
  } catch (e) {
    return { error: `Failed to read file: ${e instanceof Error ? e.message : 'Unknown error'}` };
  }
}
