// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Field } from './Field';
import { NumberInput, type NumberInputProps } from './NumberInput';

type HarnessProps = Omit<NumberInputProps, 'value' | 'onValueChange'> & {
  initial: number | null;
  onValue?: (v: number | null) => void;
};

function Harness({ initial, onValue, ...props }: HarnessProps) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <Field label="Amount" hint="Per month">
      <NumberInput
        {...props}
        value={value}
        onValueChange={(v) => {
          onValue?.(v);
          setValue(v);
        }}
      />
    </Field>
  );
}

describe('Field + NumberInput', () => {
  it('labels the input, describes it with the hint, and shows a grouped value at rest', () => {
    render(<Harness initial={28000} prefix="$" />);
    const input = screen.getByRole('textbox', { name: 'Amount' });
    expect(input).toHaveAccessibleDescription('Per month');
    expect(input).toHaveValue('28,000');
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });

  it('emits numbers while typing and null when cleared', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness initial={100} onValue={onValue} />);
    const input = screen.getByRole('textbox', { name: 'Amount' });
    await user.click(input);
    expect(input).toHaveValue('100'); // ungrouped while editing
    await user.clear(input);
    expect(onValue).toHaveBeenLastCalledWith(null);
    await user.type(input, '1,250.5');
    expect(onValue).toHaveBeenLastCalledWith(1250.5);
    await user.tab();
    expect(input).toHaveValue('1,250.5');
  });

  it('does not emit text that is not a number, and flags it', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness initial={5} onValue={onValue} />);
    const input = screen.getByRole('textbox', { name: 'Amount' });
    await user.clear(input);
    onValue.mockClear();
    await user.type(input, '-');
    expect(onValue).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('clamps to min/max when leaving the box', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness initial={12} onValue={onValue} min={1} max={84} />);
    const input = screen.getByRole('textbox', { name: 'Amount' });
    await user.clear(input);
    await user.type(input, '120');
    expect(onValue).toHaveBeenLastCalledWith(120);
    await user.tab();
    expect(onValue).toHaveBeenLastCalledWith(84);
    expect(input).toHaveValue('84');
  });

  it('shows a decimal rate as a percent and emits decimals', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness initial={0.2436} onValue={onValue} percent suffix="%" />);
    const input = screen.getByRole('textbox', { name: 'Amount' });
    expect(input).toHaveValue('24.36');
    await user.clear(input);
    await user.type(input, '6.9');
    expect(onValue).toHaveBeenLastCalledWith(0.069);
  });

  it('marks the input invalid when the Field has an error', () => {
    render(
      <Field label="APR" error="Enter a rate">
        <NumberInput value={null} onValueChange={() => {}} />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'APR' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a rate');
  });
});
