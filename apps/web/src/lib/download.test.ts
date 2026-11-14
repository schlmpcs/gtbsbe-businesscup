// @vitest-environment jsdom
// M6: the browser-side download. jsdom has no downloads, so the browser parts are mocked: `Blob` records
// what it was given, `URL.createObjectURL` hands out a fixed URL, and a click on an anchor is recorded
// instead of navigating. No real browser is involved; the click-through is checked by hand.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadRenewalsCalendar, downloadTextFile, DOWNLOAD_REVOKE_DELAY_MS, type DownloadOutcome } from './download';
import { track } from './events';
import type { RenewalItem } from './ics';

vi.mock('./events', () => ({ track: vi.fn() }));

const TEXT = 'BEGIN:VCALENDAR\r\nSUMMARY:Café · 🎬\r\nEND:VCALENDAR\r\n';

type Click = { href: string; download: string; attached: boolean };
let clicks: Click[];
let blobs: { parts: unknown[]; type: string | undefined }[];
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let open: ReturnType<typeof vi.fn>;

const setUrlApi = (create: unknown, revoke: unknown) => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: create });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revoke });
};

beforeEach(() => {
  vi.useFakeTimers();
  clicks = [];
  blobs = [];
  vi.stubGlobal('Blob', class {
    constructor(parts: unknown[], options?: { type?: string }) {
      blobs.push({ parts, type: options?.type });
    }
  });
  createObjectURL = vi.fn(() => 'blob:mock-1');
  revokeObjectURL = vi.fn();
  setUrlApi(createObjectURL, revokeObjectURL);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push({ href: this.href, download: this.download, attached: document.body.contains(this) });
  });
  open = vi.fn(() => ({}) as Window);
  vi.stubGlobal('open', open);
});

afterEach(() => {
  setUrlApi(undefined, undefined);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.mocked(track).mockClear();
  document.body.innerHTML = '';
});

describe('downloadTextFile', () => {
  it('saves the text through a Blob and a clicked anchor, then removes the anchor', () => {
    const outcome = downloadTextFile('renewals.ics', 'text/calendar', TEXT);
    expect(outcome).toBe('downloaded');
    expect(blobs).toEqual([{ parts: [TEXT], type: 'text/calendar;charset=utf-8' }]);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0]![0]).toBeDefined();
    expect(clicks).toEqual([{ href: 'blob:mock-1', download: 'renewals.ics', attached: true }]);
    expect(document.querySelector('a')).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it('gives the browser time to read the file before it frees the URL', () => {
    downloadTextFile('renewals.ics', 'text/calendar', TEXT);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DOWNLOAD_REVOKE_DELAY_MS - 1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:mock-1');
  });

  it('opens the text as a data: URL when the browser cannot make a blob URL', () => {
    createObjectURL.mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(downloadTextFile('renewals.ics', 'text/calendar', TEXT)).toBe('opened');
    expect(open).toHaveBeenCalledExactlyOnceWith(`data:text/calendar;charset=utf-8,${encodeURIComponent(TEXT)}`, '_blank');
    expect(clicks).toEqual([]);
    expect(document.querySelector('a')).toBeNull();
  });

  it('does the same when URL.createObjectURL does not exist', () => {
    setUrlApi(undefined, undefined);
    expect(downloadTextFile('renewals.ics', 'text/calendar', TEXT)).toBe('opened');
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('does the same when anchors have no download attribute (older iOS Safari)', () => {
    vi.spyOn(document, 'createElement').mockImplementation(() => ({ href: '', click: vi.fn() }) as unknown as HTMLElement);
    expect(downloadTextFile('renewals.ics', 'text/calendar', TEXT)).toBe('opened');
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('frees the blob URL at once and falls back when the click itself fails', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('click refused');
    });
    expect(downloadTextFile('renewals.ics', 'text/calendar', TEXT)).toBe('opened');
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:mock-1');
    expect(document.querySelector('a')).toBeNull();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('percent-encodes everything that would break a data: URL (line breaks, #, %, non-ASCII)', () => {
    createObjectURL.mockImplementation(() => {
      throw new Error('blocked');
    });
    downloadTextFile('a.txt', 'text/plain', 'a#b%c\r\né');
    expect(open).toHaveBeenCalledWith('data:text/plain;charset=utf-8,a%23b%25c%0D%0A%C3%A9', '_blank');
  });

  it('reports "failed", without throwing, when nothing could open (popup blocked, or window.open throws)', () => {
    createObjectURL.mockImplementation(() => {
      throw new Error('blocked');
    });
    open.mockReturnValue(null);
    expect(downloadTextFile('renewals.ics', 'text/calendar', TEXT)).toBe('failed');
    open.mockImplementation(() => {
      throw new Error('no popups');
    });
    expect(downloadTextFile('renewals.ics', 'text/calendar', TEXT)).toBe('failed');
  });

  it('reports "failed" outside a browser (no document), without throwing', () => {
    vi.stubGlobal('document', undefined);
    expect(downloadTextFile('renewals.ics', 'text/calendar', TEXT)).toBe('failed');
  });
});

describe('downloadRenewalsCalendar', () => {
  const NOW = new Date('2026-11-14T09:30:05Z');
  const items: RenewalItem[] = [
    { id: 'spotify-usa-ny', label: 'SPOTIFY USA # NY', amount: 11.99, cadence: 'monthly', next: { month: '2026-12', day: 12 } },
  ];
  const savedText = (): string => String((blobs[0]!.parts as unknown[])[0]);

  it('downloads lifeguessr-renewals.ics, stamped with the clock, and records renewals_exported once, with no props', () => {
    vi.setSystemTime(NOW);
    expect(downloadRenewalsCalendar(items)).toBe('downloaded');
    expect(blobs[0]!.type).toBe('text/calendar;charset=utf-8');
    expect(savedText()).toContain('\r\nDTSTAMP:20261114T093005Z\r\n');
    expect(savedText()).toContain('\r\nUID:sub-spotify-usa-ny-20261212@lifeguessr\r\n');
    expect(clicks.map((c) => c.download)).toEqual(['lifeguessr-renewals.ics']);
    expect(track).toHaveBeenCalledTimes(1);
    expect(vi.mocked(track).mock.calls[0]).toEqual([{ name: 'renewals_exported' }]);
  });

  it('takes `now`, the calendar name and the alarm from the options when they are given', () => {
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    downloadRenewalsCalendar(items, { now: NOW, calendarName: 'Mine', alarmDaysBefore: 2 });
    expect(savedText()).toContain('\r\nDTSTAMP:20261114T093005Z\r\n');
    expect(savedText()).toContain('\r\nX-WR-CALNAME:Mine\r\n');
    expect(savedText()).toContain('\r\nTRIGGER:-P2D\r\n');
  });

  it('records the export when the file was opened as a data: URL, and does not when nothing worked', () => {
    createObjectURL.mockImplementation(() => {
      throw new Error('blocked');
    });
    const outcomes: DownloadOutcome[] = [downloadRenewalsCalendar(items, { now: NOW })];
    expect(outcomes).toEqual(['opened']);
    expect(track).toHaveBeenCalledTimes(1);

    vi.mocked(track).mockClear();
    open.mockReturnValue(null);
    expect(downloadRenewalsCalendar(items, { now: NOW })).toBe('failed');
    expect(track).not.toHaveBeenCalled();
  });
});
