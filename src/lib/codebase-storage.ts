import JSZip from 'jszip';
import { get, set, del, keys } from 'idb-keyval';

// --- Types ---

export interface CodebaseFileEntry {
  path: string;
  sizeBytes: number;
  firstLines: string;
  category: 'component' | 'hook' | 'lib' | 'page' | 'edge-function' | 'type' | 'config' | 'other';
}

export interface CodebaseIndex {
  files: CodebaseFileEntry[];
  extractedAt: string;
  totalFiles: number;
  totalSizeBytes: number;
}

// --- Helpers ---

const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.css']);
const MAX_FILE_SIZE = 100 * 1024; // 100KB
const INDEX_KEY = 'codebase-index';
const FILE_PREFIX = 'codebase-file:';

function getExtension(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(dot).toLowerCase();
}

function categorize(path: string): CodebaseFileEntry['category'] {
  const lower = path.toLowerCase();
  const filename = path.split('/').pop() || '';

  if (filename.endsWith('.d.ts') || filename.endsWith('types.ts')) return 'type';
  if (lower.startsWith('src/components/')) return 'component';
  if (lower.startsWith('src/hooks/')) return 'hook';
  if (lower.startsWith('src/lib/')) return 'lib';
  if (lower.startsWith('src/pages/')) return 'page';
  if (lower.startsWith('supabase/functions/')) return 'edge-function';

  const configFiles = ['vite.config', 'tailwind.config', 'tsconfig', 'package.json', 'postcss.config'];
  if (!path.includes('/') && configFiles.some(c => filename.startsWith(c))) return 'config';

  return 'other';
}

function firstNLines(text: string, n: number): string {
  return text.split('\n').slice(0, n).join('\n');
}

function shouldSkip(path: string): boolean {
  if (path.includes('node_modules')) return true;
  if (path.endsWith('.lock') || path.includes('.lock.')) return true;
  const ext = getExtension(path);
  if (!ALLOWED_EXTENSIONS.has(ext)) return true;
  return false;
}

// Strip leading directory from zip paths (e.g. "project-main/src/..." -> "src/...")
function normalizePath(rawPath: string): string {
  const parts = rawPath.split('/');
  if (parts.length > 1) {
    return parts.slice(1).join('/');
  }
  return rawPath;
}

// --- Public API ---

export async function extractAndStoreCodebase(zipFile: File): Promise<CodebaseIndex> {
  const zip = await JSZip.loadAsync(zipFile);
  const entries: CodebaseFileEntry[] = [];
  let totalSize = 0;

  const promises: Promise<void>[] = [];

  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;
    const normalized = normalizePath(relativePath);
    if (shouldSkip(normalized)) return;

    promises.push(
      zipEntry.async('string').then(async (content) => {
        const size = new TextEncoder().encode(content).length;
        if (size > MAX_FILE_SIZE) return;

        await set(FILE_PREFIX + normalized, content);

        entries.push({
          path: normalized,
          sizeBytes: size,
          firstLines: firstNLines(content, 3),
          category: categorize(normalized),
        });
        totalSize += size;
      })
    );
  });

  await Promise.all(promises);

  entries.sort((a, b) => a.path.localeCompare(b.path));

  const index: CodebaseIndex = {
    files: entries,
    extractedAt: new Date().toISOString(),
    totalFiles: entries.length,
    totalSizeBytes: totalSize,
  };

  await set(INDEX_KEY, index);
  return index;
}

export async function getCodebaseIndex(): Promise<CodebaseIndex | null> {
  return (await get<CodebaseIndex>(INDEX_KEY)) ?? null;
}

export async function getFileContents(filePaths: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  await Promise.all(
    filePaths.map(async (p) => {
      const content = await get<string>(FILE_PREFIX + p);
      if (content !== undefined) result[p] = content;
    })
  );
  return result;
}

export async function clearCodebase(): Promise<void> {
  const allKeys = await keys();
  const toDelete = allKeys.filter(
    (k) => typeof k === 'string' && (k.startsWith(FILE_PREFIX) || k === INDEX_KEY)
  );
  await Promise.all(toDelete.map((k) => del(k)));
}

export async function getCodebaseStats(): Promise<{ fileCount: number; totalSize: number; lastUpdated: string } | null> {
  const index = await getCodebaseIndex();
  if (!index) return null;
  return {
    fileCount: index.totalFiles,
    totalSize: index.totalSizeBytes,
    lastUpdated: index.extractedAt,
  };
}

// --- Dev Assistant Instructions (localStorage) ---

const INSTRUCTIONS_KEY = 'odyssey-dev-assistant-instructions';

export function saveDevAssistantInstructions(text: string): void {
  localStorage.setItem(INSTRUCTIONS_KEY, text);
}

export function loadDevAssistantInstructions(): string {
  return localStorage.getItem(INSTRUCTIONS_KEY) || '';
}
