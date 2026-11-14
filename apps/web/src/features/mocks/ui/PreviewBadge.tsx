import { mocks as t } from '@/copy';
import { buttonClassName, Sticker } from '@/ui-kit';
import type { ProPreviewVM } from '../model/types';
import type { LinkComponent } from './shared';

/**
 * Marks a mock screen: a small tilted "Preview" sticker and a one-line note. With `pro` (a screen
 * that is part of Pro), free users also get a link to Pro; free tools pass no `pro`.
 */
export function PreviewBadge({ pro, Link }: { pro?: ProPreviewVM; Link: LinkComponent }) {
  return (
    <div
      role="note"
      aria-label={t.preview.sticker}
      data-testid="preview-note"
      className="flex flex-wrap items-center gap-sm text-xs text-text-muted"
    >
      <Sticker tone="soft" tilt={-3}>
        {t.preview.sticker}
      </Sticker>
      <span>{pro?.isPro ? t.preview.proNote : t.preview.note}</span>
      {pro && !pro.isPro && (
        <Link href={pro.href} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
          {t.preview.cta}
        </Link>
      )}
    </div>
  );
}
