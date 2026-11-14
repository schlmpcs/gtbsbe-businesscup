// Strings for the daily game (S2–S4). Owner: Amir (Y8).
export const game = {
  screens: {
    S2: 'Explore the home',
    S3: 'Reveal',
    S4: 'Streamer mode',
  },
  revealStateNote: 'S3 (Reveal) is the state of this page after a guess.',
  /** The spoiler-free share grid (PRODUCT.md → Game design): 🟩 in range, 🟨 500+ points, 🟥 below. */
  share: {
    header: (date: string) => `LifeGuessr ${date}`.trim(),
    tiles: { green: '🟩', yellow: '🟨', red: '🟥' },
    score: (points: string, max: string) => `${points} / ${max}`,
  },
} as const;
