'use client';

// Shared pieces of the tool-screen design previews: the banner, the page shell and a segmented toggle.
import type { ReactNode } from 'react';
import { previewB as t } from '@/copy';
import { PageHeader, Stack, Tag, cx } from '@/ui-kit';

/** Top strip on every preview page: these are designs with sample numbers, not the app. */
export function PreviewBanner() {
  return (
    <div role="note" className="w-full border-b border-dashed border-text-muted bg-surface-strong px-lg py-sm text-center text-sm font-medium text-text">
      {t.banner}
    </div>
  );
}

export type ToolShellProps = {
  id: string;
  title: string;
  intro: string;
  /** Hide the back link (the hub itself). */
  hub?: boolean;
  note?: string;
  aside?: ReactNode;
  children: ReactNode;
};

/** Page frame: back link, title with the screen ID tag, intro, content, and the disclaimer. */
export function ToolShell({ id, title, intro, hub, note, aside, children }: ToolShellProps) {
  return (
    <>
      <PreviewBanner />
      <main className="mx-auto w-full max-w-(--container-3xl) px-lg py-xl">
        <Stack gap="xl">
          <Stack gap="sm">
            {!hub && (
              <a href="/preview/tools" className="w-fit text-sm font-medium text-text-muted underline-offset-2 hover:text-text hover:underline">
                {t.backToTools}
              </a>
            )}
            <PageHeader
              title={title}
              intro={intro}
              aside={aside}
            />
            <div className="flex flex-wrap gap-sm">
              <Tag variant="dashed">{id}</Tag>
              <Tag>{t.noSignUp}</Tag>
            </div>
          </Stack>
          {children}
          <p className="text-xs text-text-muted">
            {note ?? t.sampleNote}
          </p>
        </Stack>
      </main>
    </>
  );
}

export type SegmentOption<T extends string> = { value: T; label: string };
export type SegmentedProps<T extends string> = {
  label: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  /** arena: on the orange card (translucent track). */
  tone?: 'default' | 'arena';
  className?: string;
};

/** A compact pill group of toggle buttons (aria-pressed); the chosen one is ink. */
export function Segmented<T extends string>({ label, value, options, onChange, size = 'sm', tone = 'default', className }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={cx('inline-flex w-fit shrink-0 rounded-full p-xs', tone === 'arena' ? 'bg-surface/20' : 'bg-surface-strong', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-full font-semibold transition-colors',
            size === 'sm' ? 'px-md py-xs text-sm' : 'px-lg py-sm text-base',
            value === o.value ? 'bg-ink text-on-primary' : 'text-text-muted hover:text-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A small rounded box for a single stat line inside cards. */
export function Pill({ children, tone = 'muted', className }: { children: ReactNode; tone?: 'muted' | 'positive' | 'ink' | 'primary' | 'outline'; className?: string }) {
  const tones = {
    muted: 'bg-surface-strong text-text',
    positive: 'bg-positive-soft text-positive',
    ink: 'bg-ink text-on-primary',
    primary: 'bg-primary-soft text-primary',
    outline: 'border border-text bg-surface text-text',
  } as const;
  return <span className={cx('inline-flex w-fit items-center rounded-full px-sm py-xs text-xs font-semibold leading-tight', tones[tone], className)}>{children}</span>;
}

/** Thin divider-separated list. */
export function RowList({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="flex flex-col divide-y divide-border">
      {children}
    </ul>
  );
}
