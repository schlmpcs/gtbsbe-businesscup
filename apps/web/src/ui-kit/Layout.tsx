import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

/** Spacing steps from tokens.json (spacing.*). */
export type Gap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

// Full class names (not built from strings) so Tailwind can find them.
const GAP: Record<Gap, string> = {
  none: 'gap-0',
  xs: 'gap-xs',
  sm: 'gap-sm',
  md: 'gap-md',
  lg: 'gap-lg',
  xl: 'gap-xl',
  '2xl': 'gap-2xl',
  '3xl': 'gap-3xl',
};

const ALIGN = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  baseline: 'items-baseline',
  stretch: 'items-stretch',
} as const;

const JUSTIFY = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
} as const;

export type LayoutProps = HTMLAttributes<HTMLElement> & {
  gap?: Gap;
  align?: keyof typeof ALIGN;
  justify?: keyof typeof JUSTIFY;
  /** Render as another element (section, ul, form…). Default div. */
  as?: ElementType;
  children?: ReactNode;
};

/** Vertical flow with token spacing between children. */
export function Stack({ gap = 'md', align, justify, as: Tag = 'div', className, children, ...rest }: LayoutProps) {
  return (
    <Tag
      className={cx('flex flex-col', GAP[gap], align && ALIGN[align], justify && JUSTIFY[justify], className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export type RowProps = LayoutProps & {
  /** Wrap onto the next line when out of room (default true, so a phone screen never scrolls sideways). */
  wrap?: boolean;
};

/** Horizontal flow with token spacing. */
export function Row({
  gap = 'sm',
  align = 'center',
  justify,
  wrap = true,
  as: Tag = 'div',
  className,
  children,
  ...rest
}: RowProps) {
  return (
    <Tag
      className={cx(
        'flex flex-row',
        wrap ? 'flex-wrap' : 'flex-nowrap',
        GAP[gap],
        ALIGN[align],
        justify && JUSTIFY[justify],
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
