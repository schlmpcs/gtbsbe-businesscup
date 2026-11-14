import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'border border-border bg-bg text-text hover:bg-surface',
  ghost: 'text-primary hover:bg-surface',
};

// md and lg keep a ≥ 44px touch target (12px padding × 2 + 24px line).
const SIZE: Record<ButtonSize, string> = {
  sm: 'px-md py-xs text-sm',
  md: 'px-lg py-md text-base',
  lg: 'px-xl py-md text-lg',
};

export type ButtonStyleOptions = { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean };

/** Button classes, for elements that must look like a button but aren't one (e.g. a Next <Link>). */
export function buttonClassName({ variant = 'primary', size = 'md', fullWidth = false }: ButtonStyleOptions = {}) {
  return cx(
    'inline-flex items-center justify-center gap-sm rounded-md font-semibold leading-normal transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
    VARIANT[variant],
    SIZE[size],
    fullWidth && 'w-full',
  );
}

export type ButtonProps = ComponentPropsWithRef<'button'> & ButtonStyleOptions;

/** A button. `type` defaults to "button" so it never submits a form by accident. */
export function Button({ variant, size, fullWidth, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cx(buttonClassName({ variant, size, fullWidth }), className)} {...rest} />;
}
