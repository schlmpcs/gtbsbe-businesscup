import { describe, expect, it, vi } from 'vitest';
import { shareOrCopy } from './share';

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
