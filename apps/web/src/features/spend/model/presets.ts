// One-tap chips for the daily log. The prices are typical amounts we picked so a tap logs
// something close; they are estimates (isEstimate: true, tagged in the UI), not data, and the
// user types the line instead for the exact amount.
import type { SpendPresetVM } from './types';

export const SPEND_PRESETS: SpendPresetVM[] = [
  { id: 'coffee', emoji: '☕', category: 'eatingOut', amount: 5, isEstimate: true },
  { id: 'lunch', emoji: '🍔', category: 'eatingOut', amount: 15, isEstimate: true },
  { id: 'groceries', emoji: '🛒', category: 'groceries', amount: 60, isEstimate: true },
  { id: 'taxi', emoji: '🚕', category: 'other', amount: 18, isEstimate: true },
  { id: 'gas', emoji: '⛽', category: 'car', amount: 40, isEstimate: true },
];
