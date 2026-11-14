// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { common } from '@/copy';
import { Button } from './Button';
import { Sheet } from './Sheet';

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open sheet</Button>
      <Sheet
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="What we keep"
        description="Only category totals."
        footer={<Button>Got it</Button>}
      >
        <a href="#details">Details</a>
      </Sheet>
    </>
  );
}

describe('Sheet', () => {
  it('renders nothing visible while closed', () => {
    render(<Sheet open={false} onClose={() => {}} title="Hidden" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('opens as a labelled, described dialog and moves focus inside', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open sheet' }));
    const dialog = screen.getByRole('dialog', { name: 'What we keep' });
    expect(dialog).toHaveAccessibleDescription('Only category totals.');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes with Esc and returns focus to the opener', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Open sheet' });
    await user.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes with the close button', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open sheet' }));
    await user.click(screen.getByRole('button', { name: common.kit.close }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('traps Tab focus inside the sheet', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open sheet' }));
    const close = screen.getByRole('button', { name: common.kit.close });
    const link = screen.getByRole('link', { name: 'Details' });
    const gotIt = screen.getByRole('button', { name: 'Got it' });

    close.focus();
    await user.tab();
    expect(link).toHaveFocus();
    await user.tab();
    expect(gotIt).toHaveFocus();
    await user.tab(); // wraps to the first item, never reaching the opener behind the sheet
    expect(close).toHaveFocus();
    await user.tab({ shift: true }); // and backwards
    expect(gotIt).toHaveFocus();
  });
});
