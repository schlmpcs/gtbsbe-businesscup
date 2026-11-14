import { hasPublishedAvatarHint, rememberAvatarPublished } from './cache';
import { useEffect, useRef, useState } from 'react';
import {
  SessionResponseSchema,
  type AvatarFacts,
  type AvatarOwner,
  type AvatarPreview,
  type Profile,
} from '@lifeguessr/types';
import { useAppReady, useAppStore, getAnonId } from '@/state';
import {
  avatarPreview,
  avatarPublish,
  avatarStatus,
  avatarUnpublish,
} from '@/lib/api/avatar';
import { postJson, ApiError } from '@/lib/api/http';
import { track } from '@/lib/events';
import { toVMError } from '@/lib/model/errors';
import type { Loadable } from '@/lib/model/types';
import type { AvatarVM } from './types';
const DEFAULT_FACTS: AvatarFacts = {
  hasCar: false,
  kids: 0,
  householdAdults: 1,
};
/** Explicit opt-in. A payload digest binds publish consent to the exact server-generated preview. */
export function useAvatar(enabled: boolean): AvatarVM {
  const ready = useAppReady(),
    profile = useAppStore((s) => s.profile);
  const [owner, setOwner] = useState<Loadable<AvatarOwner>>({
    status: 'loading',
  });
  const [preview, setPreview] = useState<Loadable<AvatarPreview | null>>({
    status: 'ready',
    data: null,
  });
  const [open, setOpen] = useState(false),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    profile: Profile;
    token: string;
  } | null>(null);
  const epoch = useRef(0);
  const ownerEpoch = useRef(0);
  useEffect(() => {
    if (!ready) return;
    if (!enabled && !hasPublishedAvatarHint()) {
      void Promise.resolve().then(() =>
        setOwner({
          status: 'ready',
          data: { status: { state: 'none' }, published: null },
        }),
      );
      return;
    }
    let active = true;
    const token = ownerEpoch.current;
    void avatarStatus(getAnonId())
      .then((result) => {
        if (active && token === ownerEpoch.current) {
          rememberAvatarPublished(result.status.state === 'published');
          setOwner({ status: 'ready', data: result });
        }
      })
      .catch((err) => {
        if (active && token === ownerEpoch.current)
          setOwner({ status: 'error', error: toVMError(err) });
      });
    return () => {
      active = false;
    };
  }, [ready, enabled]);
  const fail = (err: unknown) =>
    setError(
      err instanceof ApiError ? (err.code ?? 'unavailable') : 'unavailable',
    );
  const loadPreview = async () => {
    const request = ++epoch.current,
      snapshot = profile;
    setDraft(null);
    setConsent(false);
    setPreview({ status: 'loading' });
    setError(null);
    try {
      const anonId = getAnonId();
      await postJson(
        '/api/session',
        { anonId, profile: snapshot },
        SessionResponseSchema,
        { anonId },
      );
      const result = await avatarPreview(anonId);
      if (request !== epoch.current) return;
      setDraft({ profile: snapshot, token: result.token });
      setPreview({ status: 'ready', data: result.preview });
      track({ name: 'avatar_preview_viewed' });
    } catch (err) {
      if (request === epoch.current) {
        fail(err);
        setPreview({ status: 'error', error: toVMError(err) });
      }
    }
  };
  const current = draft?.profile === profile;
  const canPublish =
    enabled &&
    consent &&
    current &&
    preview.status === 'ready' &&
    !!preview.data &&
    !preview.data.outOfBounds.length &&
    !busy;
  const publish = async () => {
    if (!canPublish || !draft) return;
    ownerEpoch.current++;
    setBusy(true);
    setError(null);
    try {
      const result = await avatarPublish(getAnonId(), draft.token);
      {
        rememberAvatarPublished(result.status.state === 'published');
        setOwner({ status: 'ready', data: result });
      }
      setConsent(false);
    } catch (err) {
      fail(err);
      setConsent(false);
    } finally {
      setBusy(false);
    }
  };
  const unpublish = async () => {
    if (busy) return;
    epoch.current++;
    ownerEpoch.current++;
    setBusy(true);
    setError(null);
    try {
      const result = await avatarUnpublish(getAnonId());
      {
        rememberAvatarPublished(result.status.state === 'published');
        setOwner({ status: 'ready', data: result });
      }
      setConsent(false);
      setDraft(null);
      setPreview({ status: 'ready', data: null });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };
  return {
    enabled,
    open,
    setOpen,
    owner,
    preview,
    facts: profile.household ?? DEFAULT_FACTS,
    setFacts: (facts) => {
      setConsent(false);
      setDraft(null);
      setPreview({ status: 'ready', data: null });
      useAppStore
        .getState()
        .setProfile({ ...profile, household: facts }, 'user');
    },
    consentChecked: consent && current,
    setConsent: (value) => setConsent(current && value),
    busy,
    canPublish,
    error,
    loadPreview,
    publish,
    unpublish,
  };
}
