// /together: partner 1 fills in their numbers and taps "Plan together"; the plan is created
// (server or this browser, ./client.ts) and they land on its page with the link to share.
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toVMError } from '@/lib/model/errors';
import { useAppReady } from '@/state';
import { createTogetherClient, rememberRole, type TogetherClient } from './client';
import type { TogetherStartVM, VMError } from './types';
import { usePartnerForm } from './usePartnerForm';

export function useTogetherStart(client?: TogetherClient): TogetherStartVM {
  const ready = useAppReady();
  const router = useRouter();
  const api = useMemo(() => client ?? createTogetherClient(), [client]);
  const form = usePartnerForm();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<VMError | null>(null);

  const create = () => {
    const built = form.build();
    if (!built || creating) return;
    setCreating(true);
    setError(null);
    api
      .create(built.partner, built.goal)
      .then((plan) => {
        rememberRole(plan.id, 'partner1');
        router.push(api.sharePath(plan));
      })
      .catch((err: unknown) => {
        setError(toVMError(err));
        setCreating(false);
      });
  };

  return { ready, form: form.vm, create, creating, error, storage: api.source };
}
