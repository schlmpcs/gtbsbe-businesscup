'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';

export type TabItem<Id extends string = string> = {
  id: Id;
  label: ReactNode;
  panel: ReactNode;
  disabled?: boolean;
};

export type TabsProps<Id extends string = string> = {
  /** Accessible name of the tab list (e.g. "Loan offers"). */
  label: string;
  tabs: readonly TabItem<Id>[];
  /** Controlled selected tab. Leave out (and use defaultValue) to let Tabs keep its own state. */
  value?: Id;
  defaultValue?: Id;
  onValueChange?: (id: Id) => void;
  /** Stretch the tabs to fill the row (good on phones with 2–4 tabs). */
  fullWidth?: boolean;
  className?: string;
};

/**
 * WAI-ARIA tabs: arrow keys / Home / End move between tabs and select them. All panels stay mounted
 * (hidden when inactive), so inputs inside keep their state when you switch.
 */
export function Tabs<Id extends string = string>({
  label,
  tabs,
  value,
  defaultValue,
  onValueChange,
  fullWidth = false,
  className,
}: TabsProps<Id>) {
  const baseId = useId();
  const firstEnabled = tabs.find((t) => !t.disabled)?.id;
  const [internal, setInternal] = useState<Id | undefined>(defaultValue ?? firstEnabled);
  const selected = value ?? internal ?? firstEnabled;
  const tabRefs = useRef(new Map<Id, HTMLButtonElement>());

  const tabId = (id: Id) => `${baseId}-tab-${id}`;
  const panelId = (id: Id) => `${baseId}-panel-${id}`;

  const select = (id: Id) => {
    if (value === undefined) setInternal(id);
    onValueChange?.(id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = tabs.filter((t) => !t.disabled);
    const index = enabled.findIndex((t) => t.id === selected);
    if (index < 0 || enabled.length === 0) return;
    let next: number;
    switch (e.key) {
      case 'ArrowRight':
        next = (index + 1) % enabled.length;
        break;
      case 'ArrowLeft':
        next = (index - 1 + enabled.length) % enabled.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = enabled.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const target = enabled[next];
    if (!target) return;
    select(target.id);
    tabRefs.current.get(target.id)?.focus();
  };

  return (
    <div className={cx('flex flex-col gap-md', className)}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cx('flex gap-xs overflow-x-auto rounded-md bg-surface p-xs', fullWidth && 'w-full')}
      >
        {tabs.map((t) => {
          const isSelected = t.id === selected;
          return (
            <button
              key={t.id}
              ref={(el) => {
                if (el) tabRefs.current.set(t.id, el);
                else tabRefs.current.delete(t.id);
              }}
              type="button"
              role="tab"
              id={tabId(t.id)}
              aria-selected={isSelected}
              aria-controls={panelId(t.id)}
              tabIndex={isSelected ? 0 : -1}
              disabled={t.disabled}
              onClick={() => select(t.id)}
              className={cx(
                'whitespace-nowrap rounded-sm px-md py-sm text-sm font-medium transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                fullWidth && 'flex-1',
                isSelected ? 'bg-bg text-text shadow-sm' : 'text-text-muted hover:text-text',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={panelId(t.id)}
          aria-labelledby={tabId(t.id)}
          hidden={t.id !== selected}
          tabIndex={0}
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}
