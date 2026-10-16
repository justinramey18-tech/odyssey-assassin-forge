import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
const m = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), upload: vi.fn(), remove: vi.fn(), sign: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  storage: { from: () => ({ upload: m.upload, remove: m.remove, createSignedUrl: m.sign }) },
  from: () => {
    let updating = false;
    const q = { select: () => q, eq: () => q, is: () => q,
      update: (v: unknown) => { updating = true; m.save(v); return q; },
      single: () => updating ? Promise.resolve(m.save.mock.results.at(-1)?.value) : m.read() };
    return q;
  },
} }));
import { validateSceneVideo, uploadPartySceneVideo, SceneVideoAttachment } from '../PartyDMScreen';
beforeEach(() => {
  cleanup(); vi.clearAllMocks();
  m.read.mockResolvedValue({ data: { scene_video_path: 'party/message/old.mp4' }, error: null });
  m.upload.mockResolvedValue({ error: null });
  m.save.mockReturnValue({ data: { id: 'message' }, error: null });
  m.remove.mockResolvedValue({ error: null });
  m.sign.mockResolvedValue({ data: { signedUrl: '/clip.webm' }, error: null });
});
describe('scene video rules', () => {
  it('accepts only MP4 and WebM', () => {
    expect(validateSceneVideo({ name: 'clip.MP4', type: 'video/mp4', size: 1 })).toBe('mp4');
    expect(validateSceneVideo({ name: 'clip.webm', type: 'video/webm', size: 1 })).toBe('webm');
    expect(() => validateSceneVideo({ name: 'clip.mov', type: 'video/quicktime', size: 1 })).toThrow();
    expect(() => validateSceneVideo({ name: 'clip.mp4', type: 'image/png', size: 1 })).toThrow();
  });
  it('enforces 50 MiB before upload', async () => {
    expect(validateSceneVideo({ name: 'clip.mp4', type: '', size: 50 * 1024 * 1024 })).toBe('mp4');
    await expect(uploadPartySceneVideo('party', 'message', { name: 'clip.mp4', type: '', size: 50 * 1024 * 1024 + 1 } as File)).rejects.toThrow('50 MiB');
    expect(m.upload).not.toHaveBeenCalled();
  });
  it('stores only a private path and removes old clip after row success', async () => {
    const path = await uploadPartySceneVideo('party', 'message', new File(['video'], 'clip.webm', { type: 'video/webm' }));
    expect(path).toMatch(/^party\/message\/[\da-f-]+\.webm$/);
    expect(m.save).toHaveBeenCalledWith({ scene_video_path: path });
    expect(m.remove).toHaveBeenCalledWith(['party/message/old.mp4']);
    expect(m.upload.mock.invocationCallOrder[0]).toBeLessThan(m.save.mock.invocationCallOrder[0]);
    expect(m.save.mock.invocationCallOrder[0]).toBeLessThan(m.remove.mock.invocationCallOrder[0]);
  });
  it('removes only new upload when attachment fails', async () => {
    m.save.mockReturnValue({ data: null, error: new Error('failed') });
    await expect(uploadPartySceneVideo('party', 'message', new File(['video'], 'clip.mp4', { type: 'video/mp4' }))).rejects.toThrow('unchanged');
    expect(m.remove).toHaveBeenCalledExactlyOnceWith([m.upload.mock.calls[0][0]]);
  });
  it('signs once per path for 900 seconds and refreshes playback only once', async () => {
    const view = render(<SceneVideoAttachment path="party/message/clip.webm" />);
    await waitFor(() => expect(view.container.querySelector('video')).not.toBeNull());
    expect(m.sign).toHaveBeenCalledWith('party/message/clip.webm', 900);
    view.rerender(<SceneVideoAttachment path="party/message/clip.webm" />);
    expect(m.sign).toHaveBeenCalledTimes(1);
    const video = view.container.querySelector('video');
    if (!video) throw new Error('Missing video');
    fireEvent.error(video);
    await waitFor(() => expect(m.sign).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(view.container.querySelector('video')).not.toBeNull());
    const refreshed = view.container.querySelector('video');
    if (!refreshed) throw new Error('Missing refreshed video');
    fireEvent.error(refreshed);
    await waitFor(() => expect(view.getByRole('alert')).toBeDefined());
    expect(m.sign).toHaveBeenCalledTimes(2);
  });
});
