// The landing's decision and the stored record.
import { describe, expect, it } from 'vitest';
import { chapterHref, parseRecord } from './onboardingStore';
import { landingMode } from './useLanding';

describe('landing and the stored record', () => {
  it('sends finished stories and old ladder profiles to the dashboard; resumes a story in progress', () => {
    expect(landingMode(null, 'demo')).toEqual({ mode: 'fresh', resumeChapter: null });
    expect(landingMode(null, 'closestLife').mode).toBe('redirect');
    expect(landingMode({ chapter: 4, done: true, practiceError: null }, 'demo').mode).toBe('redirect');
    expect(landingMode({ chapter: 3, done: false, practiceError: 0.2 }, 'user')).toEqual({ mode: 'continue', resumeChapter: 3 });
    expect(landingMode({ chapter: 1, done: false, practiceError: null }, 'demo').mode).toBe('fresh');
  });

  it('reads only well-formed records', () => {
    expect(parseRecord(null)).toBeNull();
    expect(parseRecord('nope')).toBeNull();
    expect(parseRecord('{"chapter":7,"done":false}')).toBeNull();
    expect(parseRecord('{"chapter":2,"done":false,"practiceError":-1}')).toEqual({ chapter: 2, done: false, practiceError: null });
    expect(parseRecord('{"chapter":4,"done":true,"practiceError":0.3}')).toEqual({ chapter: 4, done: true, practiceError: 0.3 });
  });

  it('puts chapters 2–4 in the URL', () => {
    expect(chapterHref(1)).toBe('/start');
    expect(chapterHref(4)).toBe('/start?ch=4');
  });
});
