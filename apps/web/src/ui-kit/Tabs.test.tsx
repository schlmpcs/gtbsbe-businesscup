// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './Tabs';

const tabs = [
  { id: 'a', label: 'Offer A', panel: <p>Panel A</p> },
  { id: 'b', label: 'Offer B', panel: <p>Panel B</p> },
  { id: 'c', label: 'Offer C', panel: <p>Panel C</p> },
] as const;

describe('Tabs', () => {
  it('shows the first tab by default and wires tabs to panels', () => {
    render(<Tabs label="Loan offers" tabs={tabs} />);
    expect(screen.getByRole('tablist', { name: 'Loan offers' })).toBeInTheDocument();
    const a = screen.getByRole('tab', { name: 'Offer A' });
    expect(a).toHaveAttribute('aria-selected', 'true');
    expect(a).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Offer B' })).toHaveAttribute('tabindex', '-1');
    const panel = screen.getByRole('tabpanel', { name: 'Offer A' });
    expect(panel).toHaveTextContent('Panel A');
    expect(a).toHaveAttribute('aria-controls', panel.id);
    expect(screen.getByText('Panel B')).not.toBeVisible();
  });

  it('switches on click and reports the new tab', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Tabs label="Loan offers" tabs={tabs} onValueChange={onValueChange} />);
    await user.click(screen.getByRole('tab', { name: 'Offer B' }));
    expect(onValueChange).toHaveBeenCalledWith('b');
    expect(screen.getByRole('tab', { name: 'Offer B' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Offer A' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Panel B')).toBeVisible();
    expect(screen.getByText('Panel A')).not.toBeVisible();
  });

  it('moves with arrow keys, Home and End, wrapping around', async () => {
    const user = userEvent.setup();
    render(<Tabs label="Loan offers" tabs={tabs} />);
    await user.click(screen.getByRole('tab', { name: 'Offer A' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Offer B' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Offer B' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Offer C' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Offer A' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Offer C' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Offer A' })).toHaveAttribute('aria-selected', 'true');
  });

  it('skips disabled tabs', async () => {
    const user = userEvent.setup();
    render(
      <Tabs
        label="Loan offers"
        tabs={[tabs[0], { ...tabs[1], disabled: true }, tabs[2]]}
      />,
    );
    await user.click(screen.getByRole('tab', { name: 'Offer A' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Offer C' })).toHaveAttribute('aria-selected', 'true');
  });

  it('follows the value prop when controlled', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState<'a' | 'b' | 'c'>('c');
      return (
        <>
          <Tabs label="Loan offers" tabs={tabs} value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue('a')}>
            Reset
          </button>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByRole('tab', { name: 'Offer C' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: 'Offer B' }));
    expect(screen.getByRole('tab', { name: 'Offer B' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('tab', { name: 'Offer A' })).toHaveAttribute('aria-selected', 'true');
  });
});
