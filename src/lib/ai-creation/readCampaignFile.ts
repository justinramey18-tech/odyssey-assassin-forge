import JSZip from 'jszip';

export interface CampaignContext {
  name: string;       // file name without extension, e.g. "ares-campaign-export"
  text: string;       // all readable files joined together
  fileCount: number;  // how many files were read
  truncated: boolean; // true if the text was cut to fit the limit
}

export const CAMPAIGN_MAX_CHARS = 180000;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const TEXT_FILE = /\.(md|markdown|txt|json|csv)$/i;

type ZipEntry = { path: string; content: string };

function baseName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function isReadableEntry(path: string): boolean {
  if (!TEXT_FILE.test(path)) return false;
  const segments = path.split('/');
  if (segments.some(s => s.startsWith('.'))) return false;
  if (path.includes('__MACOSX/')) return false;
  return true;
}

/** Read an uploaded campaign file (zip of text files, or one .md/.txt/.json/csv file). */
export async function readCampaignFile(file: File): Promise<CampaignContext> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('That file is too big (max 20 MB).');
  }

  const dot = file.name.lastIndexOf('.');
  const name = (dot > 0 ? file.name.slice(0, dot) : file.name).trim().slice(0, 80) || 'campaign';

  const isZip = /\.zip$/i.test(file.name) || (typeof file.type === 'string' && file.type.includes('zip'));
  let entries: ZipEntry[];

  if (isZip) {
    const zip = await JSZip.loadAsync(file);
    const readable = Object.values(zip.files)
      .filter(e => !e.dir && isReadableEntry(e.name))
      .sort((a, b) => {
        const aReadme = baseName(a.name).toLowerCase().startsWith('readme') ? 0 : 1;
        const bReadme = baseName(b.name).toLowerCase().startsWith('readme') ? 0 : 1;
        if (aReadme !== bReadme) return aReadme - bReadme;
        return a.name.localeCompare(b.name);
      });
    if (readable.length === 0) {
      throw new Error('That zip has no .md, .txt or .json files in it.');
    }
    entries = await Promise.all(readable.map(async e => ({ path: e.name, content: await e.async('string') })));
  } else if (TEXT_FILE.test(file.name)) {
    entries = [{ path: file.name, content: await file.text() }];
  } else {
    throw new Error('Pick a .zip, .md, .txt or .json file.');
  }

  let text = '';
  let fileCount = 0;
  let truncated = false;

  for (const entry of entries) {
    const header = `=== FILE: ${entry.path} ===\n`;
    const content = entry.content.trim();
    if (text.length + header.length + content.length + 2 <= CAMPAIGN_MAX_CHARS) {
      text += header + content + '\n\n';
      fileCount += 1;
    } else {
      const remaining = CAMPAIGN_MAX_CHARS - text.length - header.length;
      if (remaining > 0) {
        text += header + content.slice(0, remaining) + '\n\n';
        fileCount += 1;
      }
      truncated = true;
      break;
    }
  }

  return { name, text, fileCount, truncated };
}
