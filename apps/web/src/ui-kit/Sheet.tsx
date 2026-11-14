'use client';

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type SyntheticEvent } from 'react';
import { common } from '@/copy';
import { cx } from './cx';

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('hidden') && !el.closest('[hidden]') && el.tabIndex >= 0,
  );
}

export type SheetProps = {
  open: boolean;
  /** Called on Esc, the close button, a tap on the backdrop, or the system back gesture. */
  onClose: () => void;
  /** Heading; also the dialog's accessible name. */
  title: ReactNode;
  /** Optional line under the title; becomes the dialog's description. */
  description?: ReactNode;
  /** Sticky actions at the bottom (e.g. a primary Button). */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/**
 * A modal sheet: slides up from the bottom on phones, a centered dialog on wider screens.
 * Built on <dialog> (showModal makes the rest of the page inert); focus is trapped inside, Esc closes,
 * page scroll is locked while open, and focus returns to the opener on close.
 */
export function Sheet({ open, onClose, title, description, footer, children, className }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  const openRef = useRef(open);

  useEffect(() => {
    onCloseRef.current = onClose;
    openRef.current = open;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // showModal is missing only in very old browsers and in jsdom; fall back to a plain open dialog.
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      const auto = panel.querySelector<HTMLElement>('[autofocus],[data-autofocus]');
      (auto ?? focusableIn(panel)[0] ?? panel).focus();
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'Escape') {
      // Handle Esc ourselves so the parent's `open` stays the source of truth.
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = focusableIn(panelRef.current);
    if (items.length === 0) {
      e.preventDefault();
      panelRef.current.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  // The browser's own cancel (e.g. Android back) must not close a dialog the parent still says is open.
  const onCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    onClose();
  };

  // A native close we didn't ask for (e.g. a <form method="dialog">): tell the parent.
  const onNativeClose = () => {
    if (openRef.current) onCloseRef.current();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onKeyDown={onKeyDown}
      onCancel={onCancel}
      onClose={onNativeClose}
      className={cx(
        'fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 text-text',
        'backdrop:bg-transparent open:flex open:flex-col open:items-center open:justify-end sm:open:justify-center',
      )}
    >
      {open && (
        <>
          {/* Backdrop: a tap outside the panel closes the sheet. Keyboard users have Esc and the close button. */}
          <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-text/40" />
          <div
            ref={panelRef}
            tabIndex={-1}
            className={cx(
              'relative flex max-h-[90dvh] w-full flex-col rounded-t-lg bg-bg shadow-lg sm:max-w-(--container-lg) sm:rounded-lg',
              className,
            )}
          >
            <div className="flex items-start justify-between gap-md border-b border-border p-lg">
              <div className="flex min-w-0 flex-col gap-xs">
                <h2 id={titleId} className="text-lg font-semibold leading-tight">
                  {title}
                </h2>
                {description && (
                  <p id={descriptionId} className="text-sm text-text-muted">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={common.kit.close}
                className="-m-sm shrink-0 rounded-md p-sm text-text-muted hover:bg-surface hover:text-text"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor">
                  <path d="M6 6l12 12M18 6L6 18" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div
              className={cx(
                'min-h-0 flex-1 overflow-y-auto p-lg',
                !footer && 'pb-[max(var(--spacing-lg),env(safe-area-inset-bottom))]',
              )}
            >
              {children}
            </div>
            {footer && (
              <div className="border-t border-border p-lg pb-[max(var(--spacing-lg),env(safe-area-inset-bottom))]">
                {footer}
              </div>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
