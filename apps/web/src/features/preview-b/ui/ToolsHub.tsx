'use client';

// S20 Tools hub (design preview): one card per tool, each opens its preview.
import { previewB as t } from '@/copy';
import { buttonClassName, cx } from '@/ui-kit';
import type { ToolCardVM, ToolsHubVM } from '../model/types';
import { Pill, ToolShell } from './shared';

const ACCENT: Record<ToolCardVM['accent'], string> = {
  primary: 'bg-primary',
  'chart-1': 'bg-chart-1',
  'chart-2': 'bg-chart-2',
  'chart-3': 'bg-chart-3',
  'chart-4': 'bg-chart-4',
  'chart-5': 'bg-chart-5',
};

export function ToolsHub({ vm }: { vm: ToolsHubVM }) {
  return (
    <ToolShell id="S20" title={t.hub.title} intro={t.hub.intro} hub>
      <ul className="grid grid-cols-1 gap-lg sm:grid-cols-2">
        {vm.tools.map((tool) => {
          const c = t.hub.tools[tool.slug];
          return (
            <li key={tool.slug}>
              <a
                href={tool.href}
                className="group flex h-full flex-col gap-md rounded-xl bg-surface p-xl shadow-md transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <div className="flex items-center justify-between gap-md">
                  <span aria-hidden="true" className={cx('size-xl rounded-full', ACCENT[tool.accent])} />
                  <span className="text-xs text-text-muted">{c.id}</span>
                </div>
                <h2 className="font-display text-2xl font-extrabold leading-tight">{c.title}</h2>
                <p className="text-base text-text-muted">{c.blurb}</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-sm pt-sm">
                  <div className="flex flex-wrap gap-xs">
                    <Pill tone="positive">{t.noSignUp}</Pill>
                    <Pill>{t.hub.minutes(tool.minutes)}</Pill>
                  </div>
                  <span className={buttonClassName({ variant: 'secondary', size: 'sm' })}>{t.open} →</span>
                </div>
              </a>
            </li>
          );
        })}
      </ul>
    </ToolShell>
  );
}
