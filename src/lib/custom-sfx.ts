import { supabase } from '@/integrations/supabase/client';

const CUSTOM_SFX_MODE_KEY = 'dnd-sfx-mode'; // 'static' | 'context' | 'custom'
const CUSTOM_SFX_URL_KEY = 'dnd-custom-sfx-url';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export type SfxMode = 'static' | 'context' | 'custom';

export function loadSfxMode(): SfxMode {
  try {
    const v = localStorage.getItem(CUSTOM_SFX_MODE_KEY);
    if (v === 'static' || v === 'context' || v === 'custom') return v;
    // Migrate from old toggles
    const contextEnabled = localStorage.getItem('dnd-elevenlabs-context-sfx-enabled') === 'true';
    return contextEnabled ? 'context' : 'static';
  } catch {
    return 'static';
  }
}

export function saveSfxMode(mode: SfxMode): void {
  try { localStorage.setItem(CUSTOM_SFX_MODE_KEY, mode); } catch {}
}

export function loadCustomSfxUrl(): string | null {
  try { return localStorage.getItem(CUSTOM_SFX_URL_KEY); } catch { return null; }
}

export function saveCustomSfxUrl(url: string | null): void {
  try {
    if (url) localStorage.setItem(CUSTOM_SFX_URL_KEY, url);
    else localStorage.removeItem(CUSTOM_SFX_URL_KEY);
  } catch {}
}

export async function uploadCustomSfx(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File must be under 2MB');
  }
  if (!file.type.startsWith('audio/')) {
    throw new Error('Only audio files are allowed');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to upload custom SFX');

  const filePath = `${user.id}/custom-sfx.mp3`;

  // Delete existing first (ignore errors)
  await supabase.storage.from('custom-sfx').remove([filePath]);

  const { error } = await supabase.storage
    .from('custom-sfx')
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (error) throw new Error(error.message);

  const { data: urlData } = await supabase.storage
    .from('custom-sfx')
    .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

  if (!urlData?.signedUrl) throw new Error('Failed to get file URL');

  saveCustomSfxUrl(urlData.signedUrl);
  return urlData.signedUrl;
}

export async function deleteCustomSfx(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const filePath = `${user.id}/custom-sfx.mp3`;
  await supabase.storage.from('custom-sfx').remove([filePath]);
  saveCustomSfxUrl(null);
}

export async function fetchCustomSfxBlob(signal?: AbortSignal): Promise<Blob | null> {
  const url = loadCustomSfxUrl();
  if (!url) return null;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return res.blob();
  } catch {
    return null;
  }
}
