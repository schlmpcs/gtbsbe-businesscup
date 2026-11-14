import { describe, expect, it, vi } from 'vitest';
import { loadShareImage, shareImageOrText, shareOrCopy } from './share';

const abort = () => Object.assign(new Error('closed'), { name: 'AbortError' });

describe('shareOrCopy', () => {
  it('uses the share sheet when there is one', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    expect(await shareOrCopy('grid', { share, clipboard: { writeText } })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'grid' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('closing the sheet is a cancel, not a copy', async () => {
    const writeText = vi.fn();
    expect(await shareOrCopy('grid', { share: vi.fn().mockRejectedValue(abort()), clipboard: { writeText } })).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies when sharing is missing, refused by canShare, or fails', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareOrCopy('a', { clipboard: { writeText } })).toBe('copied');
    expect(await shareOrCopy('b', { share: vi.fn(), canShare: () => false, clipboard: { writeText } })).toBe('copied');
    expect(await shareOrCopy('c', { share: vi.fn().mockRejectedValue(new Error('NotAllowed')), clipboard: { writeText } })).toBe('copied');
    expect(writeText.mock.calls.map((c) => c[0])).toEqual(['a', 'b', 'c']);
  });

  it('fails when neither works', async () => {
    expect(await shareOrCopy('x', {})).toBe('failed');
    expect(await shareOrCopy('x', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })).toBe('failed');
  });
});

describe('shareImageOrText', () => {
  const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'card.png', { type: 'image/png' });

  it('shares the image with the text when canShare accepts files', async () => {
    const image = png();
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn(() => true);
    expect(await shareImageOrText('grid', image, { share, canShare })).toBe('shared');
    expect(canShare).toHaveBeenCalledWith({ files: [image], text: 'grid' });
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({ files: [image], text: 'grid' });
  });

  it('shares the text when there is no image, no canShare, or canShare refuses files', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const filesRefused = (data?: ShareData) => !data?.files;
    expect(await shareImageOrText('a', null, { share, canShare: () => true })).toBe('shared');
    expect(await shareImageOrText('b', png(), { share })).toBe('shared');
    expect(await shareImageOrText('c', png(), { share, canShare: filesRefused })).toBe('shared');
    expect(share.mock.calls.map((c) => c[0])).toEqual([{ text: 'a' }, { text: 'b' }, { text: 'c' }]);
  });

  it('closing the sheet is a cancel; any other failure falls back to the text, then the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareImageOrText('x', png(), { share: vi.fn().mockRejectedValue(abort()), canShare: () => true, clipboard: { writeText } }))
      .toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();

    const share = vi.fn().mockRejectedValueOnce(new Error('NotAllowed')).mockResolvedValueOnce(undefined);
    expect(await shareImageOrText('y', png(), { share, canShare: () => true, clipboard: { writeText } })).toBe('shared');
    expect(share.mock.calls[1]![0]).toEqual({ text: 'y' });

    const broken = vi.fn().mockRejectedValue(new Error('NotAllowed'));
    expect(await shareImageOrText('z', png(), { share: broken, canShare: () => true, clipboard: { writeText } })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('z');
  });
});

describe('loadShareImage', () => {
  it('downloads the PNG as a named image file', async () => {
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }));
    const file = await loadShareImage('/api/share?resultId=x&format=9x16', 'duel.png', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('/api/share?resultId=x&format=9x16');
    expect(file).toBeInstanceOf(File);
    expect(file).toMatchObject({ name: 'duel.png', type: 'image/png', size: 3 });
  });

  it('answers null (share the text instead) on an error reply, a non-PNG or a network failure', async () => {
    const reply = (status: number, type: string) => vi.fn(async () => new Response('{}', { status, headers: { 'content-type': type } }));
    expect(await loadShareImage('/a', 'a.png', reply(404, 'application/json'))).toBeNull();
    expect(await loadShareImage('/a', 'a.png', reply(200, 'text/html'))).toBeNull();
    expect(await loadShareImage('/a', 'a.png', vi.fn().mockRejectedValue(new TypeError('offline')))).toBeNull();
  });
});
