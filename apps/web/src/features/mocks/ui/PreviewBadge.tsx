import { mocks as t } from '@/copy';
import { buttonClassName, cx, Sticker, type StickerTone } from '@/ui-kit';
import type { ProPreviewVM } from '../model/types';
import type { LinkComponent } from './shared';

type Props = {
  /** Only for screens that are part of Pro; free tools pass none. */
  pro?: ProPreviewVM;
  Link: LinkComponent;
  /** Sticker text (default "Preview"). */
  label?: string;
  tone?: StickerTone;
  /** Offer the link to Pro to free users (off on screens whose tool is free). */
  showPro?: boolean;
  align?: 'start' | 'center';
};

/** Marks a mock screen: a tilted "Preview" sticker, a one-line note, and (optionally) a link to Pro for free users. */
export function PreviewBadge({ pro, Link, label = t.preview.sticker, tone = 'soft', showPro = true, align = 'start' }: Props) {
  return (
    <div
      role="note"
      aria-label={t.preview.sticker}
      data-testid="preview-note"
      className={cx('flex flex-wrap items-center gap-sm text-xs text-text-muted', align === 'center' && 'flex-col justify-center')}
    >
      <Sticker tone={tone} tilt={-3}>
        {label}
      </Sticker>
      <span>{pro?.isPro && showPro ? t.preview.proNote : t.preview.note}</span>
      {showPro && pro && !pro.isPro && (
        <Link href={pro.href} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
          {t.preview.cta}
        </Link>
      )}
    </div>
  );
}
