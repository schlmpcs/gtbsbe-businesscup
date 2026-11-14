'use client';
import { useAvatar } from '@/features/avatar/model/useAvatar';
import { AvatarManage } from '@/features/avatar/ui/AvatarManage';
import { AvatarOptIn } from '@/features/avatar/ui/AvatarOptIn';
/** Managing an existing avatar remains possible even with new opt-ins disabled. */
export function AvatarPanel({ forecastSeen }: { forecastSeen: boolean }) {
  const vm = useAvatar(
    forecastSeen && process.env.NEXT_PUBLIC_AVATARS_ENABLED === 'true',
  );
  return (
    <div className="mt-lg flex flex-col gap-lg">
      <AvatarManage vm={vm} />
      <AvatarOptIn vm={vm} />
    </div>
  );
}
