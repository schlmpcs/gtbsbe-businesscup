// Today's game progress (Zustand, persisted): the day's public cards, opened clues, slider values
// and reveals, so a reload keeps your place. A new US Eastern date starts a fresh day.
// Shared state because the ladder reads it too (S5 bridge, S6 closest life).
import type { ClueReveal, GuessReveal, Money, PublicCard } from '@lifeguessr/types';
import { z } from 'zod';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ClueRevealSchema, GuessRevealSchema, PublicCardSchema, type DailyProgress } from '@/lib/api/gameSchemas';
import { safeStateStorage } from '@/lib/safeStorage';

export type GameData = {
  /** US Eastern date of the set ('YYYY-MM-DD'), null before the first load. */
  date: string | null;
  cards: PublicCard[];
  /** Index of the card on screen. */
  index: number;
  /** Slider value per card id (not sent until the guess). */
  guesses: Record<string, Money>;
  /** Clues opened per card id, in the order they were opened. */
  clues: Record<string, ClueReveal[]>;
  /** Server reveal per guessed card id. */
  reveals: Record<string, GuessReveal>;
};

export type GameActions = {
  /** Load a day's cards. A different date resets progress; the same date keeps it. */
  startDay: (date: string, cards: PublicCard[]) => void;
  /**
   * Merge what the game source recorded for this player today (after startDay). Its guesses win;
   * its clues come first, then any opened only here. A browser with no result of its own yet
   * moves to the first home without one, so a cleared tab resumes where the player was.
   */
  mergeProgress: (progress: DailyProgress) => void;
  addClue: (reveal: ClueReveal) => void;
  setGuess: (cardId: string, value: Money) => void;
  setReveal: (cardId: string, reveal: GuessReveal) => void;
  setIndex: (index: number) => void;
  reset: () => void;
};

export type GameState = GameData & GameActions;

export const GAME_STORE_KEY = 'lifeguessr.game';

export function initialGameData(): GameData {
  return { date: null, cards: [], index: 0, guesses: {}, clues: {}, reveals: {} };
}

const PersistedGameSchema = z.object({
  date: z.string().nullable(),
  cards: z.array(PublicCardSchema),
  index: z.number().int().min(0),
  guesses: z.record(z.string(), z.number()),
  clues: z.record(z.string(), z.array(ClueRevealSchema)),
  reveals: z.record(z.string(), GuessRevealSchema),
});

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      ...initialGameData(),
      startDay: (date, cards) =>
        set((s) => {
          const sameSet = s.date === date && s.cards.length === cards.length && s.cards.every((c, i) => c.id === cards[i]?.id);
          if (sameSet) return { cards };
          return { ...initialGameData(), date, cards };
        }),
      mergeProgress: (progress) =>
        set((s) => {
          const inSet = new Set(s.cards.map((c) => c.id));
          const hadResults = s.cards.some((c) => s.reveals[c.id]);
          const clues = { ...s.clues };
          const reveals = { ...s.reveals };
          const guesses = { ...s.guesses };
          for (const [cardId, recorded] of Object.entries(progress.clues)) {
            if (!inSet.has(cardId)) continue;
            const localOnly = (clues[cardId] ?? []).filter((l) => !recorded.some((r) => r.clue === l.clue));
            clues[cardId] = [...recorded, ...localOnly];
          }
          for (const [cardId, played] of Object.entries(progress.guesses)) {
            if (!inSet.has(cardId)) continue;
            reveals[cardId] = played.reveal;
            guesses[cardId] = played.guess;
          }
          if (hadResults) return { clues, reveals, guesses };
          const firstOpen = s.cards.findIndex((c) => !reveals[c.id]);
          return { clues, reveals, guesses, index: firstOpen === -1 ? s.cards.length : firstOpen };
        }),
      addClue: (reveal) =>
        set((s) => {
          const opened = s.clues[reveal.cardId] ?? [];
          if (opened.some((c) => c.clue === reveal.clue)) return {};
          return { clues: { ...s.clues, [reveal.cardId]: [...opened, reveal] } };
        }),
      setGuess: (cardId, value) => set((s) => ({ guesses: { ...s.guesses, [cardId]: value } })),
      setReveal: (cardId, reveal) => set((s) => ({ reveals: { ...s.reveals, [cardId]: reveal } })),
      setIndex: (index) => set({ index }),
      reset: () => set(initialGameData()),
    }),
    {
      name: GAME_STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStateStorage),
      skipHydration: true,
      partialize: (s): GameData => ({
        date: s.date, cards: s.cards, index: s.index, guesses: s.guesses, clues: s.clues, reveals: s.reveals,
      }),
      merge: (saved, current) => {
        const parsed = PersistedGameSchema.safeParse(saved);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);
