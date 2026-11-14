// Saving a text file from the browser (M6), with no server in the loop: the text becomes a Blob in
// memory and the browser saves it. Nothing is uploaded, so merchant labels in the file never leave
// the device.
//
// Browser-only. Outside a browser (no `document`) nothing is done and the result is 'failed'.
import { track } from './events';
import { renewalsToIcs, type IcsOptions, type RenewalItem } from './ics';

/**
 * 'downloaded': the browser was asked to save the file. 'opened': it could not, so the text was opened
 * as a `data:` URL in a new tab (where a phone's calendar app offers to add it). 'failed': neither
 * worked (no browser, or the new tab was blocked).
 */
export type DownloadOutcome = 'downloaded' | 'opened' | 'failed';

/**
 * How long a blob URL stays valid after the click. Freeing it at once can cancel the save in Safari and
 * older Firefox, which read the blob after the click returns.
 */
export const DOWNLOAD_REVOKE_DELAY_MS = 30_000;

export const RENEWALS_FILE_NAME = 'lifeguessr-renewals.ics';
const RENEWALS_MIME = 'text/calendar';

/** Clicks a hidden anchor that points at a blob. False when the browser cannot, or the click failed. */
function saveBlob(name: string, type: string, text: string): boolean {
  const anchor = document.createElement('a');
  // No download attribute (older iOS Safari) or no blob URLs: the anchor would navigate instead of saving.
  if (!('download' in anchor) || typeof URL.createObjectURL !== 'function') return false;
  let url: string | undefined;
  try {
    url = URL.createObjectURL(new Blob([text], { type }));
    anchor.href = url;
    anchor.download = name;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    try {
      anchor.click();
    } finally {
      anchor.remove();
    }
  } catch {
    if (url !== undefined) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Nothing left to free.
      }
    }
    return false;
  }
  const saved = url;
  setTimeout(() => URL.revokeObjectURL(saved), DOWNLOAD_REVOKE_DELAY_MS);
  return true;
}

/** Opens the text as a `data:` URL in a new tab. False when the tab was blocked. */
function openDataUrl(type: string, text: string): boolean {
  try {
    const tab = window.open(`data:${type},${encodeURIComponent(text)}`, '_blank');
    if (!tab) return false;
    try {
      tab.opener = null; // the data: page is another origin and holds only text, but it needs no way back
    } catch {
      // Cross-origin already: nothing to cut.
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves `text` as the file `name` (`mime` is its media type, e.g. 'text/calendar'; the text is UTF-8).
 * Never throws; the result says what happened.
 */
export function downloadTextFile(name: string, mime: string, text: string): DownloadOutcome {
  if (typeof document === 'undefined' || typeof window === 'undefined') return 'failed';
  const type = `${mime};charset=utf-8`;
  if (saveBlob(name, type, text)) return 'downloaded';
  return openDataUrl(type, text) ? 'opened' : 'failed';
}

/**
 * The renewals calendar for the audit's findings (see `renewalsFromFindings`), saved as an .ics file.
 * The clock is read here and nowhere else: `opts.now` defaults to the current time. Records
 * `renewals_exported` (an event with no props) when the file was saved or opened.
 *
 * Whoever calls this decides who may: the Pro lock on the button, if there is one, is a UI lock (the
 * file is built in the browser), not a server gate.
 */
export function downloadRenewalsCalendar(items: readonly RenewalItem[], opts: Partial<IcsOptions> = {}): DownloadOutcome {
  const text = renewalsToIcs(items, { ...opts, now: opts.now ?? new Date() });
  const outcome = downloadTextFile(RENEWALS_FILE_NAME, RENEWALS_MIME, text);
  if (outcome !== 'failed') track({ name: 'renewals_exported' });
  return outcome;
}
