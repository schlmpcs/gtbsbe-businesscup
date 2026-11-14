import { hasPublishedAvatarHint, rememberAvatarPublished } from './cache';
import { useEffect, useState } from 'react';
import { avatarStatus } from '@/lib/api/avatar';
import { getAnonId } from '@/state';
/** S9 discloses persisted published fields, not the user's unsaved draft. */
export function usePublishedAvatar(ready: boolean): boolean {
  const [published, setPublished] = useState(false);
  useEffect(() => {
    if (!ready || !hasPublishedAvatarHint()) return;
    let active = true;
    void avatarStatus(getAnonId())
      .then((result) => {
        if (active) {
          rememberAvatarPublished(result.status.state === 'published');
          setPublished(result.status.state === 'published');
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ready]);
  return published;
}
