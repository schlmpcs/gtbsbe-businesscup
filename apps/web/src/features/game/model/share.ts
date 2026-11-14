// Share the day's result text: the Web Share API where the browser has it (phones), else copy to
// the clipboard. The PNG share card (T5's /api/share) is linked separately on the summary.

/** What happened: shared via the share sheet, copied, the user closed the sheet, or neither worked. */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** The browser APIs this needs (injectable for tests). */
export type ShareTarget = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data?: ShareData) => boolean;
  clipboard?: Pick<Clipboard, 'writeText'>;
};

function isAbort(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError';
}

/**
 * Share `text` with the share sheet; if there is none, or it fails for a reason other than the
 * user closing it, copy the text instead.
 */
export async function shareOrCopy(
  text: string,
  target: ShareTarget | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): Promise<ShareOutcome> {
  const data: ShareData = { text };
  if (target?.share && (!target.canShare || target.canShare(data))) {
    try {
      await target.share(data);
      return 'shared';
    } catch (err) {
      if (isAbort(err)) return 'cancelled';
      // Not allowed here (e.g. no user gesture, insecure context): fall back to the clipboard.
    }
  }
  if (target?.clipboard?.writeText) {
    try {
      await target.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  return 'failed';
}
