// @vitest-environment jsdom
// The overpaying screen on the real view-model, with the fake engine, areas and events from
// model/testUtils.ts (the real overpayingCheck is not in this branch yet). Checks what the person sees.
import type { Profile } from '@lifeguessr/types';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { overpaying as t } from '@/copy';
import { cloneProfileDemo } from '@/fixtures';
import { resetClientState } from '@/test/clientState';
import { UNCOVERED_ZIP, fakeDeps, onlyLines, sampleOverpayingResult } from './model/testUtils';
import type { OverpayingDeps } from './model/types';
import { useOverpaying } from './model/useOverpaying';
import { overpayingMoveId, useOverpayingImpacts } from './model/planMoves';
import { OverpayingScreen } from './ui/OverpayingScreen';
import { planImpact as pi } from '@/copy';
import { resetPlanStore, usePlanStore } from '@/features/plan/model/planStore';

beforeEach(() => {
  resetClientState();
  resetPlanStore();
});
afterEach(() => vi.unstubAllEnvs());

function Harness({ profile, deps, streamer }: { profile: Profile | null; deps: OverpayingDeps; streamer?: boolean }) {
  const vm = useOverpaying(profile, { deps, streamer });
  return <OverpayingScreen vm={vm} impacts={useOverpayingImpacts(vm.result)} />;
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

  it('answers first: a pill, the gap per year in one sentence, and the biggest gap first as the next step', async () => {
    const user = await open();
    await cold(user);
    const summary = await screen.findByTestId('overpaying-summary');
    expect(summary).toHaveAttribute('data-verdict', 'above');
    expect(within(summary).getByText(t.result.verdict.pill.above)).toBeInTheDocument();
    expect(within(summary).getByText(t.result.verdict.above('$9,782'))).toBeInTheDocument(); // 3 888 + 5 894.352 a year
    expect(within(summary).getByText(t.result.summaryLine(4, 2))).toBeInTheDocument();
    expect(within(summary).getByText('$9,782')).toBeInTheDocument();
    const steps = within(within(summary).getByTestId('next-steps')).getAllByRole('listitem');
    expect(steps.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Childcare'), // $5,894 a year above, the biggest gap
      expect.stringContaining(t.result.next.rent('$2,230').slice(0, 20)),
    ]);
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
    // The gap is yours minus the top of the range ($3,000 − $2,676 = $324); the plan change is to the middle ($3,000 − $2,230 = $770).
    expect(within(rows[0]!).getByTestId('gap')).toHaveTextContent(t.result.gap('$324', '$3,888'));

    await user.clear(amountBox('rent'));
    await user.type(amountBox('rent'), '2400');
    expect(amountBox('rent')).not.toHaveAccessibleDescription(t.form.fromProfile);
    expect(profile).toEqual(copy);
  });
});

describe('which household the result is about', () => {
  it('says it compared against the default household, with an estimate tag, until the person enters one', async () => {
    await open({ profile: cloneProfileDemo() });
    const note = await screen.findByTestId('household-note');
    expect(note).toHaveTextContent('2 bedrooms, 1 adult, no children');
    expect(note).toHaveTextContent('(default)');
    expect(within(note).getByText(t.result.estimate)).toBeInTheDocument();
    expect(note).not.toHaveTextContent(/you entered/i);
  });

  it('switches to "based on the household you entered" after an edit', async () => {
    const user = await open({ profile: cloneProfileDemo() });
    await screen.findByTestId('household-note');
    const adults = screen.getByRole('group', { name: t.form.adults });
    await user.click(within(adults).getByRole('radio', { name: '2' }));
    const note = await screen.findByTestId('household-note');
    expect(note).toHaveTextContent('Based on the household you entered');
    expect(note).toHaveTextContent('2 bedrooms, 2 adults, no children');
    expect(note).not.toHaveTextContent('(default)');
    expect(within(note).queryByText(t.result.estimate)).toBeNull();
  });

  it('is on a cold result too, and says "1 child" and "studio" in plain words', async () => {
    const user = await open();
    await cold(user);
    expect(await screen.findByTestId('household-note')).toHaveTextContent('(default)');
    const bedrooms = screen.getByRole('group', { name: t.form.bedrooms });
    await user.click(within(bedrooms).getByRole('radio', { name: t.form.bedroomOptions[0]! }));
    await user.type(screen.getByRole('textbox', { name: t.form.kidAges.infant }), '1');
    expect(screen.getByTestId('household-note')).toHaveTextContent('Based on the household you entered: studio, 1 adult, 1 child');
  });
});

describe('what paying the typical middle does to the plan', () => {
  it('measures each line above the range on the plan and adds it from the row', async () => {
    const user = await open();
    await cold(user);
    const rows = await screen.findAllByTestId('benchmark-row');
    const rent = within(rows[0]!).getByTestId('row-impact');
    expect(rent).toHaveTextContent(t.result.planLead('$770'));
    expect(within(rent).getByText(pi.source)).toBeInTheDocument();
    expect(within(rent).getByTestId('impact-10y')).toHaveTextContent(/^\+\$/);
    await user.click(within(rent).getByRole('button', { name: pi.add }));
    expect(within(rent).getByText(pi.added)).toBeInTheDocument();
    const st = usePlanStore.getState();
    expect(st.movesApplied[st.activeId]?.map((m) => m.id)).toEqual([overpayingMoveId('rent')]);
    // Childcare is above the range, but the sample plan holds no childcare to lower: not measured, said so.
    expect(within(rows[3]!).queryByTestId('row-impact')).toBeNull();
    expect(within(rows[3]!).getByText(t.result.planNotMeasured)).toBeInTheDocument();
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

describe('when the engine answers with numbers the contract does not allow', () => {
  it('says so instead of showing them', async () => {
    const bad = sampleOverpayingResult();
    bad.lines[0]!.typical = { low: 3000, mid: 2230, high: 2676 }; // a range must be low ≤ mid ≤ high
    const user = await open({ deps: fakeDeps({ result: bad }) });
    await cold(user);
    expect(await screen.findByTestId('overpaying-error')).toHaveTextContent(t.errors.invalidResponse);
    expect(screen.queryByTestId('benchmark-row')).toBeNull();
  });
});

describe('streamer mode', () => {
  it('hides the tool and points back to the game', async () => {
    await open({ streamer: true });
    const notice = screen.getByTestId('streamer-notice');
    expect(within(notice).getByRole('link', { name: t.streamer.back })).toHaveAttribute('href', '/play');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('points back to the slider game\'s streamer mode while /play is the slider game (the rollback)', async () => {
    vi.stubEnv('NEXT_PUBLIC_GAME_MODE', 'slider');
    await open({ streamer: true });
    const notice = screen.getByTestId('streamer-notice');
    expect(within(notice).getByRole('link', { name: t.streamer.back })).toHaveAttribute('href', '/play?stream=1');
  });
});
