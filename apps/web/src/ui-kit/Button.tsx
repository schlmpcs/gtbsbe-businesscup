import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dark';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary shadow-sm hover:bg-primary-hover',
  secondary: 'border-2 border-primary bg-transparent text-text hover:bg-primary-soft',
  ghost: 'text-primary hover:bg-surface',
  /** Black button, for use on an orange "arena" surface (Figma: Card tone="arena"). */
  dark: 'bg-ink text-on-primary shadow-md hover:opacity-90',
};

// md and lg keep a ≥ 44px touch target (12px padding × 2 + 24px line).
const SIZE: Record<ButtonSize, string> = {
  sm: 'px-md py-xs text-sm',
  md: 'px-lg py-md text-base',
  lg: 'px-2xl py-lg text-xl font-bold',
};

export type ButtonStyleOptions = { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean };

/** Button classes, for elements that must look like a button but aren't one (e.g. a Next <Link>). */
export function buttonClassName({ variant = 'primary', size = 'md', fullWidth = false }: ButtonStyleOptions = {}) {
  return cx(
    'inline-flex items-center justify-center gap-sm rounded-lg font-bold leading-normal transition-colors',
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
