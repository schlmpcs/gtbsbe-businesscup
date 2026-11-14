import { mocks as t } from '@/copy';
import { Sticker } from '@/ui-kit';

/** Marks a mock screen: a small tilted "Preview" sticker and a one-line note on sample data. */
export function PreviewBadge() {
  return (
    <div role="note" aria-label={t.preview.sticker} className="flex flex-wrap items-center gap-sm text-xs text-text-muted">
      <Sticker tone="soft" tilt={-3}>
        {t.preview.sticker}
      </Sticker>
      <span>{t.preview.note}</span>
    </div>
  );
}
