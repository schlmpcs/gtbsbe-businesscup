'use client';

import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
import { useFieldControl } from './Field';

export type SelectVariant = 'field' | 'pill';
export type SelectSize = 'sm' | 'md';

export type SelectProps = Omit<ComponentPropsWithRef<'select'>, 'size'> & {
  /** 'field': a form box like NumberInput. 'pill': a compact rounded chip (inline pickers in lists). */
  variant?: SelectVariant;
  size?: SelectSize;
  /** Red border, and aria-invalid. A surrounding <Field error> sets this too. */
  invalid?: boolean;
  /** Dashed amber border: the current value is a guess the user should check. */
  needsReview?: boolean;
  /** Stretch to the container width (default true). */
  fullWidth?: boolean;
  /** Classes for the wrapper (positioning, width); `className` goes on the <select> itself. */
  wrapperClassName?: string;
};

const VARIANT: Record<SelectVariant, Record<SelectSize, string>> = {
  // min-h-11 keeps a 44px touch target; pr leaves room for the chevron badge.
  field: {
    md: 'min-h-11 rounded-lg border-2 bg-surface py-sm pr-[2.75rem] pl-md text-base font-semibold',
    sm: 'min-h-11 rounded-md border-2 bg-surface py-xs pr-[2.5rem] pl-md text-sm font-semibold sm:min-h-9',
  },
  pill: {
    md: 'min-h-11 rounded-full border-2 bg-surface-strong py-xs pr-[2.5rem] pl-lg text-sm font-semibold',
    sm: 'min-h-11 rounded-full border bg-surface-strong py-0 pr-[2rem] pl-lg text-xs font-semibold sm:min-h-8',
  },
};

/**
 * A native <select> dressed in the app's style: tokens, 2px border, an orange chevron badge, primary
 * hover/focus. It stays a real <select> (phone pickers, keyboard, screen readers, tests all work), and
 * in browsers that support `appearance: base-select` the opened list is styled too (see globals.css).
 * Inside a <Field> it picks up the label, hint and error wiring.
 */
export function Select({
  variant = 'field',
  size = 'md',
  invalid = false,
  needsReview = false,
  fullWidth = true,
  wrapperClassName,
  className,
  disabled,
  children,
  ...rest
}: SelectProps) {
  const field = useFieldControl();
  const isInvalid = invalid || field['aria-invalid'] === true;
  const compact = variant === 'pill' && size === 'sm';
  return (
    <span
      className={cx(
        'group/select relative inline-flex min-w-0 max-w-full items-center',
        fullWidth && 'w-full',
        disabled && 'opacity-60',
        wrapperClassName,
      )}
    >
      <select
        {...field}
        {...rest}
        disabled={disabled}
        aria-invalid={isInvalid ? true : rest['aria-invalid']}
        className={cx(
          'ui-select w-full min-w-0 cursor-pointer appearance-none truncate text-text transition-colors',
          'hover:border-primary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-soft',
          'disabled:cursor-not-allowed disabled:hover:border-border',
          VARIANT[variant][size],
          isInvalid
            ? 'border-negative'
            : needsReview
              ? 'border-dashed border-warning'
              : variant === 'pill'
                ? 'border-transparent'
                : 'border-border',
          className,
        )}
      >
        {children}
      </select>
      <span
        aria-hidden="true"
        className={cx(
          'pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full text-primary transition-colors',
          'group-hover/select:bg-primary group-hover/select:text-on-primary',
          compact ? 'right-xs size-5 bg-transparent' : 'right-sm size-6 bg-primary-soft',
        )}
      >
        <svg width={compact ? 12 : 14} height={compact ? 12 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" focusable="false">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </span>
  );
}
