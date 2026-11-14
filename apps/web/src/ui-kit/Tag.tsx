import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';

export type TagVariant = 'solid' | 'dashed';

const VARIANT: Record<TagVariant, string> = {
  solid: 'border border-border',
  dashed: 'border border-dashed border-text-muted',
};

export type TagProps = ComponentPropsWithRef<'span'> & {
  /** solid (default): a fact about a number, such as who made it. dashed: something we chose or defaulted. */
  variant?: TagVariant;
};

/** A small pill label ("AI estimate", "our assumption"). Colors come from tokens only. */
export function Tag({ variant = 'solid', className, ...rest }: TagProps) {
  return (
    <span
      className={cx(
        'inline-flex w-fit items-center rounded-full px-sm text-xs font-medium leading-normal text-text-muted',
        VARIANT[variant],
        className,
      )}
      {...rest}
    />
  );
}
