import { avatar as t } from '@/copy';
import { Button, Card } from '@/ui-kit';
import type { AvatarVM } from '../model/types';
import { AvatarCard } from './AvatarCard';
export function AvatarManage({ vm }: { vm: AvatarVM }) {
  if (vm.owner.status === 'error')
    return (
      <Card className="flex flex-col gap-md">
        <p role="alert">{t.error}</p>
        <Button disabled={vm.busy} onClick={() => void vm.unpublish()}>
          {t.unpublish}
        </Button>
      </Card>
    );
  if (
    vm.owner.status !== 'ready' ||
    vm.owner.data.status.state !== 'published' ||
    !vm.owner.data.published
  )
    return null;
  const owner = vm.owner.data;
  return (
    <Card className="flex flex-col gap-md">
      <h2 className="text-xl font-bold">{t.published}</h2>
      <AvatarCard
        preview={{
          payload: owner.published!,
          estimatedFields: [],
          outOfBounds: [],
        }}
      />
      <p>
        {owner.status.state === 'published'
          ? t.expiry(owner.status.publishedOn, owner.status.expiresOn)
          : ''}
      </p>
      <p className="text-sm text-text-muted">{t.retention}</p>
      <Button disabled={vm.busy} onClick={() => void vm.unpublish()}>
        {t.unpublish}
      </Button>
      {vm.error && <p role="alert">{t.errors[vm.error] ?? t.error}</p>}
    </Card>
  );
}
