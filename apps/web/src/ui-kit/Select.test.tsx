// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Field } from './Field';
import { Select } from './Select';

describe('Select', () => {
  it('stays a native combobox labelled by its Field, and reports changes', async () => {
    const onChange = vi.fn();
    render(
      <Field label="Compare with" hint="Pick a scenario">
        <Select value="a" onChange={(e) => onChange(e.target.value)}>
          <option value="a">Scenario 1</option>
          <option value="b">Scenario 2</option>
        </Select>
      </Field>,
    );
    const box = screen.getByRole('combobox', { name: 'Compare with' });
    expect(box).toHaveAccessibleDescription('Pick a scenario');
    await userEvent.selectOptions(box, 'b');
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('is aria-invalid when invalid or inside a Field with an error', () => {
    render(
      <>
        <Select aria-label="Own" invalid defaultValue="x">
          <option value="x">x</option>
        </Select>
        <Field label="From field" error="Pick one">
          <Select defaultValue="x">
            <option value="x">x</option>
          </Select>
        </Field>
      </>,
    );
    expect(screen.getByRole('combobox', { name: 'Own' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('combobox', { name: 'From field' })).toHaveAttribute('aria-invalid', 'true');
  });
});
