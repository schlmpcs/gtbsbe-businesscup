import { describe, expect, it } from 'vitest';
import { listSyntheticStatements, readSyntheticStatement } from './fixtures/node';
import { DEMO_BANKS, demoBankAccount, findDemoBank } from './demoBanks';

const rows = readSyntheticStatement('labels/households.csv').trim().split('\n').slice(1);

describe('DEMO_BANKS', () => {
  it('cover every synthetic statement once, under its own bank', () => {
    const files = DEMO_BANKS.flatMap((b) => b.accounts.map((a) => a.file)).sort();
    expect(files).toEqual(listSyntheticStatements());
    for (const b of DEMO_BANKS) for (const a of b.accounts) {
      const row = rows.find((r) => r.startsWith(`${a.file},`))!;
      expect(row).toContain(`,${b.bankStyle},`);
      expect(row).toContain(`"${a.metro}"`);
    }
  });

  it('serve the next customer on each connection, wrapping around', () => {
    const b = findDemoBank('chase')!;
    expect(demoBankAccount(b, 0)).toBe(b.accounts[0]);
    expect(demoBankAccount(b, 1)).toBe(b.accounts[1]);
    expect(demoBankAccount(b, b.accounts.length)).toBe(b.accounts[0]);
    expect(demoBankAccount(b, -1)).toBe(b.accounts.at(-1));
    expect(findDemoBank('meridian')).toBeNull();
  });
});
