// @vitest-environment jsdom
// The overpaying screen on the real view-model, with the fake engine, areas and events from
// model/testUtils.ts (the real overpayingCheck is not in this branch yet). Checks what the person sees.
import type { Profile } from '@lifeguessr/types';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { overpaying as t } from '@/copy';
import { cloneProfileDemo } from '@/fixtures';
import { resetClientState } from '@/test/clientState';
import { UNCOVERED_ZIP, fakeDeps, onlyLines, sampleOverpayingResult } from './model/testUtils';
import type { OverpayingDeps } from './model/types';
import { useOverpaying } from './model/useOverpaying';
import { OverpayingScreen } from './ui/OverpayingScreen';

beforeEach(resetClientState);

function Harness({ profile, deps, streamer }: { profile: Profile | null; deps: OverpayingDeps; streamer?: boolean }) {
  return <OverpayingScreen vm={useOverpaying(profile, { deps, streamer })} />;
}

async function open(opts: { profile?: Profile | null; deps?: OverpayingDeps; streamer?: boolean } = {}) {
  const user = userEvent.setup();
  render(<Harness profile={opts.profile ?? null} deps={opts.deps ?? fakeDeps()} streamer={opts.streamer} />);
  await screen.findByRole('heading', { level: 1 });
  return user;
}

const zipBox = () => screen.getByRole('textbox', { name: t.form.zip });
const amountBox = (line: keyof typeof t.lines) => screen.getByRole('textbox', { name: t.lines[line] });

async function cold(user: ReturnType<typeof userEvent.setup>, rent = '3000') {
  await user.type(zipBox(), '75206');
  await user.type(amountBox('rent'), rent);
}

describe('the cold path', () => {
  it('shows the title without an internal screen ID, the form, and asks for a ZIP', async () => {
    await open();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.screens.S23);
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toMatch(/\bS\d{1,2}\b/);
    expect(await screen.findByText(t.needs.zip)).toBeInTheDocument();
    expect(screen.getByText(t.form.noWriteBack)).toBeInTheDocument();
  });

  it('a covered ZIP and a rent give one row per line with where you sit, the gap, and the source', async () => {
    const user = await open();
    await cold(user);
    const rows = await screen.findAllByTestId('benchmark-row');
    expect(rows.map((r) => [r.dataset.line, r.dataset.position])).toEqual([
      ['rent', 'above'], ['carInsurance', 'below'], ['groceries', 'inRange'], ['childcare', 'above'],
    ]);

    const rent = rows[0]!;
    // The position is a word, with an icon that is hidden from screen readers.
    expect(within(rent).getByText(t.result.positions.above)).toBeInTheDocument();
    expect(rent.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(within(rent).getByRole('heading', { name: t.lines.rent })).toBeInTheDocument();
    // 3000 against 1784 to 2676: $324 a month above, $3,888 a year.
    expect(within(rent).getByText('$3,000')).toBeInTheDocument();
    expect(within(rent).getByText(t.result.typicalRange('$1,784', '$2,676'))).toBeInTheDocument();
    expect(within(rent).getByTestId('gap')).toHaveTextContent(t.result.gap('$324', '$3,888'));
    expect(within(rent).getByRole('img', { name: t.result.barLabel('$3,000', '$1,784', '$2,230', '$2,676') })).toBeInTheDocument();
    // Source and year, and the estimate tag the fake result carries.
    expect(within(rent).getByText(/^Source:/)).toHaveTextContent(/2027$/);
    expect(within(rent).getByRole('link', { name: /HUD/ })).toHaveAttribute('href', expect.stringContaining('huduser.gov'));
    expect(within(rent).getByText(t.result.estimate)).toBeInTheDocument();

    // Below is neutral, in range is just in range.
    expect(within(rows[1]!).getByText(t.result.positions.below)).toBeInTheDocument();
    expect(within(rows[1]!).getByText(t.result.belowNote)).toBeInTheDocument();
    expect(within(rows[2]!).getByText(t.result.positions.inRange)).toBeInTheDocument();
    for (const row of rows) expect(within(row).getByText(/^Source:/)).toBeInTheDocument(); // every number has its source

    // Each position has its own icon shape, so the position never rests on colour alone.
    const shape = (row: HTMLElement) => row.querySelector('svg[aria-hidden="true"] path')?.getAttribute('d');
    const shapes = [shape(rows[1]!), shape(rows[2]!), shape(rows[0]!)]; // below, in range, above
    expect(shapes.every((d) => !!d)).toBe(true);
    expect(new Set(shapes).size).toBe(3);
    expect(shape(rows[3]!)).toBe(shape(rows[0]!)); // both above
  });

  it('the summary counts the lines and adds the gaps; without a profile the 10-year effect asks for one', async () => {
    const user = await open();
    await cold(user);
    const summary = await screen.findByTestId('overpaying-summary');
    expect(within(summary).getByText(t.result.summaryLine(4, 2))).toBeInTheDocument();
    expect(within(summary).getByText('$9,782')).toBeInTheDocument(); // 3 888 + 5 894.352 a year
    expect(within(summary).getByText(t.result.effectNone)).toBeInTheDocument();
    expect(within(summary).getByRole('link', { name: t.result.effectNeedsProfileLink })).toHaveAttribute('href', '/me/balance');
    expect(screen.queryByTestId('effect10y')).toBeNull();
  });

  it('only some amounts entered: the blank lines are listed as left blank', async () => {
    const deps = fakeDeps({ result: onlyLines(sampleOverpayingResult(), ['rent']) });
    const user = await open({ deps });
    await cold(user);
    const skipped = await screen.findByTestId('skipped');
    expect(within(skipped).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      t.result.skipped.notEntered(t.lines.carInsurance),
      t.result.skipped.notEntered(t.lines.groceries),
      t.result.skipped.notEntered(t.lines.childcare),
    ]);
  });

  it('a bad ZIP and an amount of 0 are said beside their boxes, and nothing is compared', async () => {
    const user = await open();
    await user.type(zipBox(), 'SW1A 1AA');
    await user.type(amountBox('rent'), '0');
    expect(zipBox()).toHaveAccessibleDescription(expect.stringContaining(t.form.errors.zip));
    expect(amountBox('rent')).toHaveAccessibleDescription(expect.stringContaining(t.form.errors.amount));
    expect(screen.queryByTestId('benchmark-row')).toBeNull();
  });

  it('uses no wording that tells anyone what to do', async () => {
    const user = await open();
    await cold(user);
    await screen.findAllByTestId('benchmark-row');
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/overpay|ripped off|too much|switch|renegotiat|negotiat|\bcancel|\bshould\b|cheaper/i);
  });
});

describe('with a profile of the person\'s own', () => {
  it('prefills from it, says so, shows the 10-year effect, and typing never changes it', async () => {
    const profile = cloneProfileDemo();
    const copy = structuredClone(profile);
    const user = await open({ profile });
    expect(zipBox()).toHaveValue('75206');
    expect(amountBox('rent')).toHaveValue('1,950');
    expect(amountBox('rent')).toHaveAccessibleDescription(t.form.fromProfile);
    expect(amountBox('groceries')).toHaveValue('520');
    expect(amountBox('carInsurance')).toHaveValue(''); // car insurance is always asked
    const rows = await screen.findAllByTestId('benchmark-row');
    // The gap is yours minus the top of the range ($3,000 − $2,676 = $324); the effect is for the middle ($3,000 − $2,230 = $770).
    expect(within(rows[0]!).getByTestId('gap')).toHaveTextContent(t.result.gap('$324', '$3,888'));
    expect(within(rows[0]!).getByTestId('effect10y')).toHaveTextContent(t.result.effect('$770', '$40,000'));
    expect(within(rows[0]!).getByTestId('effect10y')).toHaveTextContent('$770'); // the monthly figure the effect is for is on screen
    expect(within(within(rows[0]!).getByTestId('effect10y')).getByText(t.result.estimate)).toBeInTheDocument(); // a projection carries the estimate tag
    const summary = await screen.findByTestId('overpaying-summary');
    expect(within(summary).getByText('$49,000')).toBeInTheDocument(); // both lines above the range have an effect: the total is of both
    expect(within(summary).getByText(t.result.estimate)).toBeInTheDocument(); // and the total carries the tag too

    await user.clear(amountBox('rent'));
    await user.type(amountBox('rent'), '2400');
    expect(amountBox('rent')).not.toHaveAccessibleDescription(t.form.fromProfile);
    expect(profile).toEqual(copy);
  });
});

describe('a 10-year total that is not of every line above the range', () => {
  it('is not shown: no partial sum, and each line keeps its own effect', async () => {
    const result = sampleOverpayingResult();
    result.lines[3]!.effect10y = 0; // childcare is above the range, but the profile cannot take the change
    await open({ profile: cloneProfileDemo(), deps: fakeDeps({ result }) });
    const summary = await screen.findByTestId('overpaying-summary');
    expect(within(summary).queryByText('$40,000')).toBeNull();
    expect(within(summary).queryByText('$49,000')).toBeNull();
    expect(within(summary).getByText(t.result.effectNone)).toBeInTheDocument();
    expect(within(summary).getByText(t.result.effectPartial)).toBeInTheDocument();
    const rows = await screen.findAllByTestId('benchmark-row');
    expect(within(rows[0]!).getByTestId('effect10y')).toHaveTextContent('$40,000');
    expect(within(rows[3]!).queryByTestId('effect10y')).toBeNull();
  });
});

describe('a 10-year figure nobody could work out', () => {
  it('says so for the lines above the range instead of showing $0', async () => {
    const result = sampleOverpayingResult();
    result.lines[0]!.effect10y = 0;
    result.lines[3]!.effect10y = 0;
    await open({ profile: cloneProfileDemo(), deps: fakeDeps({ result }) });
    const summary = await screen.findByTestId('overpaying-summary');
    expect(within(summary).getByText(t.result.effectNoneAbove)).toBeInTheDocument();
    expect(screen.queryByTestId('effect10y')).toBeNull();
  });
});

describe('a ZIP we do not cover', () => {
  it('says what we cover, offers the metro picker, and labels the result approximate', async () => {
    const user = await open();
    await user.type(zipBox(), UNCOVERED_ZIP);
    await user.type(amountBox('rent'), '2000');
    const notice = await screen.findByTestId('coverage');
    expect(notice).toHaveAttribute('data-coverage', 'none');
    expect(within(notice).getByText(t.coverage.none(UNCOVERED_ZIP, 4, 3))).toBeInTheDocument();
    expect(screen.queryByTestId('benchmark-row')).toBeNull();

    await user.selectOptions(screen.getByRole('combobox', { name: t.picker.metro }), 'Dallas-Fort Worth, TX');
    expect(screen.getByRole('radio', { name: t.picker.tiers.mid })).toBeChecked();
    const approx = await screen.findByTestId('coverage');
    expect(approx).toHaveAttribute('data-coverage', 'metro');
    expect(within(approx).getByText(t.coverage.approximate)).toBeInTheDocument();
    expect(await screen.findAllByTestId('benchmark-row')).toHaveLength(4);
    expect(screen.getAllByText(t.result.estimate).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('radio', { name: t.picker.tiers.cheap }));
    expect(screen.getByRole('radio', { name: t.picker.tiers.cheap })).toBeChecked();
  });
});

describe('when the engine is not there', () => {
  it('says the comparison is not available yet instead of showing numbers', async () => {
    const user = await open({ deps: { ...fakeDeps(), check: undefined } });
    await cold(user);
    expect(await screen.findByTestId('overpaying-error')).toHaveTextContent(t.errors.notImplemented);
    expect(screen.queryByTestId('benchmark-row')).toBeNull();
  });
});

describe('streamer mode', () => {
  it('hides the tool and points back to the game', async () => {
    await open({ streamer: true });
    const notice = screen.getByTestId('streamer-notice');
    expect(within(notice).getByRole('link', { name: t.streamer.back })).toHaveAttribute('href', '/play?stream=1');
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
