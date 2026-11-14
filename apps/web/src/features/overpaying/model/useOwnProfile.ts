// The profile the overpaying check may use: the person's own, never the sample one. The store always
// holds a profile (the demo household until the person makes their own), and its rent and groceries are
// not theirs, so a visitor who has not built one starts cold instead of seeing someone else's numbers
// as "yours".
import type { Profile } from '@lifeguessr/types';
import { useAppStore } from '@/state';

export function useOwnProfile(): Profile | null {
  const profile = useAppStore((s) => s.profile);
  const origin = useAppStore((s) => s.profileOrigin);
  return origin === 'demo' ? null : profile;
}
