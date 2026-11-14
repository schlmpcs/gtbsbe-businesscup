// Share the day's result: the Web Share API where the browser has it (phones), else copy the text
// to the clipboard. The slider game shares text and links its PNG card (GET /api/share) separately
// on the summary; the duel hands the PNG itself to the share sheet where the platform takes files
// (shareImageOrText), so it can go straight into a story.

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

/**
 * Share the result image along with the text when the platform can share files, else the text
 * alone (shareOrCopy: share sheet, then clipboard).
 *
 * Only `canShare` can say whether files are accepted: desktop browsers with a share sheet often take
 * text but not files, and a browser without `canShare` predates file sharing altogether. The text
 * rides along with the image so the challenge link still reaches apps that keep it.
 *
 * If the file share fails for any reason other than the user closing the sheet, the text share
 * still runs: the player pressed Share and should get something out of it.
 */
export async function shareImageOrText(
  text: string,
  image: File | null,
  target: ShareTarget | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): Promise<ShareOutcome> {
  if (image && target?.share && target.canShare) {
    const data: ShareData = { files: [image], text };
    if (target.canShare(data)) {
      try {
        await target.share(data);
        return 'shared';
      } catch (err) {
        if (isAbort(err)) return 'cancelled';
      }
    }
  }
  return shareOrCopy(text, target);
}

/**
 * Downloads a share card PNG as a File for the share sheet, or null when it can't be had (offline,
 * an error reply, anything that isn't a PNG). Null just means the share falls back to text, so
 * nothing here throws.
 */
export async function loadShareImage(url: string, fileName: string, fetchImpl: typeof fetch = fetch): Promise<File | null> {
  try {
    const res = await fetchImpl(url);
    if (!res.ok || !res.headers.get('content-type')?.startsWith('image/png')) return null;
    return new File([await res.blob()], fileName, { type: 'image/png' });
  } catch {
    return null;
  }
}
