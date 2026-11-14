// The profile the overpaying check may use: only one the person made themselves. The store always
// holds a profile (the demo household until the person makes their own), and the profile of a life
// card they picked ('closestLife') is that card's numbers, not theirs: neither is "yours", so a visitor
// who has not edited their own numbers starts cold instead of seeing someone else's rent and groceries
// as theirs. An edit turns either one into the person's own (origin 'user').
import type { Profile } from '@lifeguessr/types';
import { useAppStore } from '@/state';

export function useOwnProfile(): Profile | null {
  const profile = useAppStore((s) => s.profile);
  const origin = useAppStore((s) => s.profileOrigin);
  return origin === 'user' ? profile : null;
}
