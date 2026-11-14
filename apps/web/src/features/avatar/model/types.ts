import type {
  AvatarFacts,
  AvatarOwner,
  AvatarPreview,
} from '@lifeguessr/types';
import type { Loadable } from '@/lib/model/types';
export type {
  AvatarFacts,
  AvatarPreview,
  AvatarPublic,
} from '@lifeguessr/types';
export type AvatarVM = {
  enabled: boolean;
  open: boolean;
  setOpen: (value: boolean) => void;
  owner: Loadable<AvatarOwner>;
  preview: Loadable<AvatarPreview | null>;
  facts: AvatarFacts;
  setFacts: (value: AvatarFacts) => void;
  consentChecked: boolean;
  setConsent: (value: boolean) => void;
  busy: boolean;
  canPublish: boolean;
  error: string | null;
  loadPreview: () => Promise<void>;
  publish: () => Promise<void>;
  unpublish: () => Promise<void>;
};
