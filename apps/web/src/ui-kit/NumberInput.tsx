'use client';

import { useLayoutEffect, useRef, useState, type FocusEvent, type InputHTMLAttributes, type MouseEvent } from 'react';
import { cx } from './cx';
import { useFieldControl } from './Field';
import { clamp, cleanFloat, formatPlainNumber, parseTypedNumber } from './numbers';

export type NumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'min' | 'max' | 'step' | 'prefix'
> & {
  /** Current value in model units (dollars, or a decimal rate when `percent`). null = empty. */
  value: number | null;
  /** Called with each valid value while typing (null when cleared), and with the clamped value on blur. */
  onValueChange: (value: number | null) => void;
  /** Lowest allowed value (default 0). Pass a negative min to allow negatives; phones then show a full keyboard. */
  min?: number;
  max?: number;
  /** The value is a decimal rate (0.228) shown and typed as a percent (22.8). */
  percent?: boolean;
  /** Most decimals shown at rest (default 2). */
  maxFractionDigits?: number;
  /** Text before the number, e.g. "$". */
  prefix?: string;
  /** Text after the number, e.g. "/mo", "%", "months". */
  suffix?: string;
};

/** Selects the whole text of a focused input (setSelectionRange: iOS ignores select() at times). */
function selectAll(el: HTMLInputElement | null) {
  if (el && el.ownerDocument.activeElement === el) el.setSelectionRange(0, el.value.length);
}

/**
 * A text box for numbers: shows "1,234" at rest, accepts "1234", "$1,234" or "1,234.50" while typing,
 * never jumps the caret, and clamps to min/max when you leave it. Focusing it (tap, click or Tab) selects
 * the whole number, so typing replaces it instead of appending. Put it inside a <Field> for its label.
 */
export function NumberInput({
  value,
  onValueChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  percent = false,
  maxFractionDigits = 2,
  prefix,
  suffix,
  className,
  onFocus,
  onBlur,
  onMouseUp,
  onKeyDown,
  disabled,
  ...rest
}: NumberInputProps) {
  const field = useFieldControl();
  // While the box has focus we show exactly what was typed (draft); otherwise the formatted value.
  const [draft, setDraft] = useState<string | null>(null);
  const edited = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Set on focus: select everything once the plain draft text is in the box (see the layout effect).
  const selectPending = useRef(false);
  // Set on focus until the first mouseup/keydown: Safari (desktop and iOS) collapses a selection made
  // during focus on the mouseup that follows the click/tap, so that one mouseup is cancelled.
  const keepSelection = useRef(false);

  // Focus swaps "1,200" for "1200", and React writing the new value puts the caret at the end. So the
  // selection is made after that commit (layout effect, before paint), and again on the next frame in
  // case the browser placed the caret after our handlers ran (some mobile browsers do on tap).
  useLayoutEffect(() => {
    if (!selectPending.current || draft === null) return;
    selectPending.current = false;
    selectAll(inputRef.current);
    const frame = requestAnimationFrame(() => {
      if (keepSelection.current) selectAll(inputRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [draft]);

  const toModel = (n: number) => (percent ? cleanFloat(n / 100) : n);
  const toText = (v: number | null, grouped: boolean) =>
    v === null || !Number.isFinite(v) ? '' : formatPlainNumber(percent ? cleanFloat(v * 100) : v, maxFractionDigits, grouped);

  const parsedDraft = draft === null ? null : parseTypedNumber(draft);
  const invalid = draft !== null && parsedDraft === undefined;

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (draft !== null && edited.current) {
      const typed = parseTypedNumber(draft);
      if (typed !== null && typed !== undefined) {
        const model = toModel(typed);
        const clamped = clamp(model, min, max);
        if (clamped !== model) onValueChange(clamped);
      }
    }
    edited.current = false;
    selectPending.current = false;
    keepSelection.current = false;
    setDraft(null);
    onBlur?.(e);
  };

  return (
    <div
      className={cx(
        'flex items-center gap-xs rounded-md border bg-bg px-md',
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
        invalid || field['aria-invalid'] ? 'border-negative' : 'border-border',
        disabled && 'cursor-not-allowed bg-surface opacity-60',
        className,
      )}
    >
      {prefix && (
        <span aria-hidden="true" className="text-text-muted">
          {prefix}
        </span>
      )}
      <input
        {...field}
        {...rest}
        ref={inputRef}
        type="text"
        inputMode={min < 0 ? 'text' : 'decimal'}
        autoComplete="off"
        disabled={disabled}
        aria-invalid={invalid || field['aria-invalid'] ? true : undefined}
        value={draft ?? toText(value, true)}
        onFocus={(e) => {
          edited.current = false;
          selectPending.current = true;
          keepSelection.current = true;
          setDraft(toText(value, false));
          selectAll(e.currentTarget); // covers a focus where the text doesn't change (no re-render)
          onFocus?.(e);
        }}
        onMouseUp={(e: MouseEvent<HTMLInputElement>) => {
          if (keepSelection.current) {
            keepSelection.current = false;
            const el = e.currentTarget;
            // Only while the selection we made is intact: a drag-select by the user is left alone.
            if (el.selectionStart === 0 && el.selectionEnd === el.value.length) e.preventDefault();
          }
          onMouseUp?.(e);
        }}
        onKeyDown={(e) => {
          keepSelection.current = false;
          onKeyDown?.(e);
        }}
        onChange={(e) => {
          edited.current = true;
          keepSelection.current = false;
          const text = e.target.value;
          setDraft(text);
          const typed = parseTypedNumber(text);
          if (typed === null) onValueChange(null);
          else if (typed !== undefined) onValueChange(toModel(typed));
        }}
        onBlur={handleBlur}
        className="min-w-0 flex-1 bg-transparent py-md text-base tabular-nums focus-visible:outline-none disabled:cursor-not-allowed"
      />
      {suffix && (
        <span aria-hidden="true" className="shrink-0 text-text-muted">
          {suffix}
        </span>
      )}
    </div>
  );
}
