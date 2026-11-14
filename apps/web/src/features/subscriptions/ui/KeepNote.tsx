'use client';

// "What we keep": what this tool saves in the browser, what it never saves, what is sent to sort the
// lines, and a button to clear it. Stays on screen under every step.
import { subscriptions as t } from '@/copy';
import { Button, Card, Stack, Tag } from '@/ui-kit';

export type KeepNoteProps = { hasLocalData: boolean; onClear: () => void };

export function KeepNote({ hasLocalData, onClear }: KeepNoteProps) {
  return (
    <Card title={t.keep.title} headingLevel={2} tone="muted" action={<Tag>{t.keep.tag}</Tag>}>
      <Stack gap="sm" className="text-sm">
        <p className="text-text-muted">{hasLocalData ? t.keep.gist : t.keep.none}</p>
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-text-muted">{t.keep.details}</summary>
          <Stack gap="sm" className="mt-sm">
            <ul className="flex flex-col gap-xs">
              {t.keep.items.map((item) => (
                <li key={item} className="flex gap-sm">
                  <span aria-hidden="true" className="shrink-0 font-bold text-positive">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="flex gap-sm">
              <span aria-hidden="true" className="shrink-0 font-bold text-primary">
                ✕
              </span>
              {t.keep.notKept}
            </p>
            <p className="rounded-md bg-bg p-md">{t.keep.sent}</p>
          </Stack>
        </details>
        {hasLocalData && (
          <div>
            <Button size="sm" variant="secondary" onClick={onClear}>
              {t.keep.clear}
            </Button>
          </div>
        )}
      </Stack>
    </Card>
  );
}
