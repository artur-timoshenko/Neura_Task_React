import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
const { sign } = vi.hoisted(() => ({ sign: vi.fn(async (path: string) => ({ data: { signedUrl: '/signed/' + path }, error: null })) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { storage: { from: () => ({ createSignedUrl: sign }) } } }));
import { useSignedGuideFileUrls } from '@/lib/guideFileUrl';

describe('guide file previews and downloads', () => {
  it('signs the original path and keeps download options separate', async () => {
    const path = 'guide-id/video.mp4';
    const { result } = renderHook(() => useSignedGuideFileUrls([path], { download: 'video.mp4' }));
    await waitFor(() => expect(result.current[path]).toBe('/signed/' + path));
    expect(sign).toHaveBeenCalledWith(path, 3600, { download: 'video.mp4' });
  });
  it('returns an empty map without signing a phantom filename', async () => {
    sign.mockClear();
    const { result } = renderHook(() => useSignedGuideFileUrls([]));
    await waitFor(() => expect(result.current).toEqual({}));
    expect(sign).not.toHaveBeenCalled();
  });
});
