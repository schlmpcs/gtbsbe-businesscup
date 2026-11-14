import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';
import type { ToolsState } from '@lifeguessr/types';
export { expect };
/** Tool specs can seed only browser-local settings, keeping cold paths independent of a profile. */
export const test = base.extend<{
  toolState: ToolsState;
  statementPath: string;
  seedTools: undefined;
}>({
  toolState: [{}, { option: true }],
  statementPath: async ({ browserName: _browserName }, provide) =>
    provide(
      fileURLToPath(
        new URL(
          '../../../../packages/data/fixtures/statement.sample.csv',
          import.meta.url,
        ),
      ),
    ),
  seedTools: [
    async ({ context, toolState }, provide) => {
      await context.addInitScript(
        ({ tools }) => {
          if (!localStorage.getItem('lifeguessr.app'))
            localStorage.setItem(
              'lifeguessr.app',
              JSON.stringify({ version: 1, state: { tools } }),
            );
        },
        { tools: toolState },
      );
      await provide(undefined);
    },
    { auto: true },
  ],
});
