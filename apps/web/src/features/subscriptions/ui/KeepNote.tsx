'use client';

// "What we keep": what this tool saves in the browser, what it never saves, what is sent to sort the
// lines and to whom, what the cancel plan's forecast sends, and a button to clear it. It follows the
// privacy design (docs/ARCHITECTURE.md): labels pass through the language-model provider only to be
// sorted and are not stored. Stays on screen under every step.
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
          <Stack gap="md" className="mt-sm">
            <div>
              <p className="font-semibold">{t.keep.savedTitle}</p>
              <ul className="mt-xs flex flex-col gap-xs">
                {t.keep.saved.map((item) => (
                  <li key={item} className="flex gap-sm">
                    <span aria-hidden="true" className="shrink-0 font-bold text-positive">
                      {t.keep.kept}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-xs text-text-muted">{t.keep.savedWhere}</p>
            </div>
            <div>
              <p className="font-semibold">{t.keep.neverTitle}</p>
              <ul className="mt-xs flex flex-col gap-xs">
                {t.keep.never.map((item) => (
                  <li key={item} className="flex gap-sm">
                    <span aria-hidden="true" className="shrink-0 font-bold text-primary">
                      {t.keep.notKeptMark}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-text-muted">{t.keep.masking}</p>
            <p className="rounded-md bg-bg p-md">
              <span className="font-semibold">{t.keep.sentTitle}</span> {t.keep.sent}
            </p>
            <p className="rounded-md bg-bg p-md">{t.keep.forecastSent}</p>
          </Stack>
        </details>
        {hasLocalData && (
          <Stack gap="xs" className="items-start">
            <Button size="sm" variant="secondary" onClick={onClear}>
              {t.keep.clear}
            </Button>
            <p className="text-xs text-text-muted">{t.keep.clearNote}</p>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
