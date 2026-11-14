// @vitest-environment jsdom
// The subscription audit screen on its real view-model hook, with the catalogue, the tool's slice of the
// store, the categorizer and the event sender faked (apps/web/src/test/subscriptions.ts).
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forecast as forecastCopy, ladder, subscriptions as t } from '@/copy';
import { useAppStore } from '@/state';
import { resetClientState } from '@/test/clientState';
import { mockForecastRoute } from '@/test/forecastApi';
import { csvFile, fakeCategorize, realisticCatalogue, sampleStatementFile, testCatalogue, useMemoryStore } from '@/test/subscriptions';
import type { KnownService } from '@lifeguessr/types';
import { useSubscriptions } from './model/useSubscriptions';
import { SubscriptionsScreen } from './ui/SubscriptionsScreen';

const track = vi.fn();

function Tool({ categorize = fakeCategorize(), catalogue = testCatalogue }: { categorize?: ReturnType<typeof fakeCategorize>; catalogue?: readonly KnownService[] }) {
  const store = useMemoryStore();
  const profile = useAppStore((s) => s.profile);
  const vm = useSubscriptions(profile, { catalogue, store, track, categorize, downloadRenewals: () => 'downloaded' });
  return <SubscriptionsScreen vm={vm} />;
}

beforeEach(() => {
  resetClientState();
  track.mockClear();
  mockForecastRoute();
});

/** Guess $40 and tick Netflix (standard), Spotify and Planet Fitness: $17.99 + $11.99 + $24.99 = $54.97 a month. */
async function coldPath(user: ReturnType<typeof userEvent.setup>) {
  render(<Tool />);
  const guess = await screen.findByLabelText(t.guess.label);
  await user.clear(guess);
  await user.type(guess, '40');
  await user.click(screen.getByRole('button', { name: t.guess.next }));
  await user.selectOptions(screen.getByRole('combobox', { name: t.ticks.planLabel('Netflix') }), 'standard');
  await user.click(screen.getByRole('checkbox', { name: 'Spotify' }));
  await user.click(screen.getByRole('checkbox', { name: 'Planet Fitness' }));
}

describe('SubscriptionsScreen: the cold path', () => {
  it('guess, tick, see the gap, with no profile and no upload', async () => {
    const user = userEvent.setup();
    await coldPath(user);

    const total = screen.getByRole('status');
    expect(within(total).getByText(/\$54\.97 a month/)).toBeInTheDocument();
    expect(within(total).getByText(/\$659\.64 a year/)).toBeInTheDocument();
    expect(within(total).getByText(t.ticks.count(3), { exact: false })).toBeInTheDocument();
    // Every price carries its year and an estimate tag; the source can be opened.
    const netflixRow = screen.getByRole('checkbox', { name: 'Netflix' }).closest('li')!;
    expect(within(netflixRow).getByText(/catalogue price, 2026/)).toBeInTheDocument();
    expect(within(netflixRow).getByText('estimate')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.ticks.next }));
    const reveal = screen.getByRole('heading', { name: t.reveal.title }).closest('section')!;
    expect(within(reveal).getByText('$40')).toBeInTheDocument();
    expect(within(reveal).getByText('$54.97')).toBeInTheDocument();
    expect(within(reveal).getByText(t.reveal.gap.lower('$14.97'))).toBeInTheDocument(); // 54.97 − 40
    expect(within(reveal).getByText(/Guess ÷ total: 0\.73/)).toBeInTheDocument();
    // The survey figure with its source, and the words that say it is not the person's data.
    expect(within(reveal).getByText(t.reveal.survey('$86', '$219'))).toBeInTheDocument();
    expect(within(reveal).getByText(t.reveal.surveyNote)).toBeInTheDocument();
    expect(within(reveal).getByText(/C\+R Research survey of 1,000 consumers/)).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith({ name: 'subs_revealed', props: { miss: '0.5to0.8' } }, { once: 'subs:revealed' });
  });

  it('a guess skipped: the total on its own, no factor', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(await screen.findByRole('button', { name: t.guess.next }));
    await user.click(screen.getByRole('checkbox', { name: 'Spotify' }));
    await user.click(screen.getByRole('button', { name: t.ticks.next }));
    expect(screen.getByText(t.reveal.noGuess)).toBeInTheDocument();
    expect(screen.queryByText(/Guess ÷ total/)).not.toBeInTheDocument();
  });

  it('the steps ahead of what is possible are off: no statement, no findings and no plan yet', async () => {
    render(<Tool />);
    await screen.findByLabelText(t.guess.label);
    expect(screen.getByRole('button', { name: new RegExp(t.stepper.steps.findings) })).toBeDisabled();
    expect(screen.getByRole('button', { name: new RegExp(t.stepper.steps.plan) })).toBeDisabled();
    expect(screen.getByRole('button', { name: new RegExp(t.stepper.steps.reveal) })).toBeDisabled();
    expect(screen.getByRole('button', { name: new RegExp(t.stepper.steps.guess) })).toHaveAttribute('aria-current', 'step');
  });
});

describe('SubscriptionsScreen: estimate tags', () => {
  it('every tick price is tagged an estimate, a checked catalogue price included, on a catalogue shaped like the real one', async () => {
    const user = userEvent.setup();
    render(<Tool catalogue={realisticCatalogue} />);
    await user.click(await screen.findByRole('button', { name: t.guess.next }));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument(); // one plan per service: no plan picker
    for (const name of ['Netflix', 'Spotify', 'Planet Fitness']) {
      const row = screen.getByRole('checkbox', { name }).closest('li')!;
      expect(within(row).getByText('estimate'), name).toBeInTheDocument();
      expect(within(row).getByText(/catalogue price, 2026/), name).toBeInTheDocument();
    }
  });

  it('the cancel saving carries the tag next to the number when a marked line is an estimate, and not when none is', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(await screen.findByRole('button', { name: t.guess.next }));
    await user.click(screen.getByRole('checkbox', { name: 'Spotify' }));
    await user.click(screen.getByRole('button', { name: new RegExp(t.stepper.steps.plan) }));
    const plan = screen.getByRole('heading', { name: t.plan.title }).closest('section')!;
    await user.click(within(plan).getByRole('checkbox', { name: t.plan.mark('Spotify') }));
    for (const label of [t.plan.marked(1), t.plan.yearLabel]) {
      expect(within(within(plan).getByText(label).parentElement!).getByText('estimate'), label).toBeInTheDocument();
    }
    expect(within(plan).getByText('$11.99')).toBeInTheDocument();
    expect(within(plan).getByText('$143.88')).toBeInTheDocument();
  });

  it('a measured saving (a charge seen every month) has no tag', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(await screen.findByRole('button', { name: new RegExp(t.stepper.steps.statement) }));
    await user.upload(screen.getByLabelText(t.statement.pickerLabel), sampleStatementFile());
    await user.click(await screen.findByRole('button', { name: t.findings.next }));
    const plan = screen.getByRole('heading', { name: t.plan.title }).closest('section')!;
    await user.click(within(plan).getByRole('checkbox', { name: t.plan.mark('Planet Fitness') }));
    for (const label of [t.plan.marked(1), t.plan.yearLabel]) {
      expect(within(within(plan).getByText(label).parentElement!).queryByText('estimate'), label).not.toBeInTheDocument();
    }
  });
});

describe('SubscriptionsScreen: the statement, the findings and the plan', () => {
  it('finds the ones forgotten, builds a cancel plan with a 10-year number and puts the total in the plan', async () => {
    const user = userEvent.setup();
    await coldPath(user);
    await user.click(screen.getByRole('button', { name: t.ticks.next }));
    await user.click(screen.getByRole('button', { name: t.reveal.findOnes }));

    // The S9 look: read on this device, then the file goes to the picker.
    expect(screen.getByText(t.statement.readOnDevice)).toBeInTheDocument();
    await user.upload(screen.getByLabelText(t.statement.pickerLabel), sampleStatementFile());

    const findings = (await screen.findByRole('heading', { name: t.findings.title })).closest('section')!;
    expect(within(findings).getByText(t.findings.headline(5, 3))).toBeInTheDocument();
    expect(within(findings).getByText('$69.54')).toBeInTheDocument();
    expect(within(findings).getByText(t.findings.flag.seenOnce('yearly', 'August'))).toBeInTheDocument();
    // Prime and Apple were found and not ticked.
    expect(within(findings).getAllByText(t.findings.forgot)).toHaveLength(2);

    await user.click(within(findings).getByRole('button', { name: t.findings.next }));
    const plan = screen.getByRole('heading', { name: t.plan.title }).closest('section')!;
    expect(within(plan).getByText(t.plan.empty)).toBeInTheDocument();
    await user.click(within(plan).getByRole('checkbox', { name: t.plan.mark('Netflix') }));
    await user.click(within(plan).getByRole('checkbox', { name: t.plan.mark('Spotify') }));
    expect(within(plan).getByText(t.plan.marked(2))).toBeInTheDocument();
    expect(within(plan).getByText('$29.98')).toBeInTheDocument(); // 17.99 + 11.99
    expect(within(plan).getByText('$359.76')).toBeInTheDocument(); // × 12

    // The 10-year number with who measured it, and the wording that never tells anyone to cancel.
    expect(await within(plan).findByText(t.plan.in10y)).toBeInTheDocument();
    expect(within(plan).getByText(forecastCopy.source.rules)).toBeInTheDocument();
    expect(within(plan).getByText(t.plan.todaysDollars, { exact: false })).toBeInTheDocument();
    expect(within(plan).getByText(t.plan.sampleProfile)).toBeInTheDocument();

    await user.click(within(plan).getByRole('button', { name: t.plan.addAsMove }));
    expect(within(plan).getByText(t.plan.moveAdded)).toBeInTheDocument();
    expect(useAppStore.getState().profile.committedMoveId).toBe('cancelSubscriptions:audit');

    // "Use this in my plan": a sheet that says what changes; Cancel has the focus; nothing changes until Update.
    await user.click(within(plan).getByRole('button', { name: t.plan.useInPlan }));
    const sheet = screen.getByRole('dialog', { name: t.apply.title });
    expect(within(sheet).getByRole('button', { name: t.apply.cancel })).toHaveFocus();
    expect(within(sheet).getByText('$85.00')).toBeInTheDocument();   // the profile today
    expect(within(sheet).getByText('$69.54')).toBeInTheDocument();   // the statement total
    expect(within(sheet).getAllByText(t.apply.measured)).toHaveLength(2); // the profile's $85 is measured too
    expect(useAppStore.getState().profile.spending.subscriptions.value).toBe(85);
    await user.click(within(sheet).getByRole('button', { name: t.apply.confirm }));
    expect(useAppStore.getState().profile.spending.subscriptions).toEqual({ value: 69.54, isEstimate: false });
    await waitFor(() => expect(screen.getByText(t.plan.inPlan)).toBeInTheDocument());
  });

  it('the calendar: says to import once and does not promise a reminder in Google Calendar', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(await screen.findByRole('button', { name: new RegExp(t.stepper.steps.statement) }));
    await user.upload(screen.getByLabelText(t.statement.pickerLabel), sampleStatementFile());
    await user.click(await screen.findByRole('button', { name: t.findings.next }));
    const renewals = screen.getByRole('heading', { name: t.renewals.title }).closest('section')!;
    expect(within(renewals).getByText(t.renewals.body(5))).toBeInTheDocument();
    expect(within(renewals).getByText(t.renewals.importOnce)).toBeInTheDocument();
    const reminders = within(renewals).getByText(t.renewals.reminders);
    expect(reminders).toHaveTextContent(/Google Calendar/);
    expect(reminders).toHaveTextContent(/can ignore it/);
    await user.click(within(renewals).getByRole('button', { name: t.renewals.button }));
    expect(within(renewals).getByText(t.renewals.outcome.downloaded)).toBeInTheDocument();
  });

  it('a low-confidence finding is asked about, left out of the totals, and counted after "Yes"', async () => {
    const user = userEvent.setup();
    const categorize = fakeCategorize((items) => [...new Set(items.map((i) => i.label))].map((label) => ({ label, class: 'subscriptions' as const })));
    render(<Tool categorize={categorize} />);
    await user.click(await screen.findByRole('button', { name: new RegExp(t.stepper.steps.statement) }));
    await user.upload(screen.getByLabelText(t.statement.pickerLabel), csvFile(['2026-10-05,MYSTERY APP,-4.99', '2026-11-05,MYSTERY APP,-4.99']));
    const findings = (await screen.findByRole('heading', { name: t.findings.title })).closest('section')!;
    expect(within(findings).getByText(t.findings.headline(0, 0))).toBeInTheDocument();
    expect(within(findings).getByText(t.findings.toConfirmQuestion)).toBeInTheDocument();
    expect(within(findings).getByText(t.findings.notCounted)).toBeInTheDocument();
    expect(within(findings).getByText(/\$0\.00 a month/)).toBeInTheDocument();
    await user.click(within(findings).getByRole('button', { name: `${t.findings.yes}: MYSTERY APP` }));
    expect(within(findings).getByText(t.findings.headline(1, 0))).toBeInTheDocument();
    expect(within(findings).getByText(/\$4\.99 a month/)).toBeInTheDocument();
  });

  it('with nothing counted there is no cancel plan to make: the button is off and the screen says why', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(await screen.findByRole('button', { name: new RegExp(t.stepper.steps.statement) }));
    await user.upload(screen.getByLabelText(t.statement.pickerLabel), csvFile(['2026-10-07,SOME SHOP,-12.00', '2026-11-08,OTHER PLACE,-9.00']));
    const findings = (await screen.findByRole('heading', { name: t.findings.title })).closest('section')!;
    expect(within(findings).getByText(t.findings.none)).toBeInTheDocument();
    expect(within(findings).getByRole('button', { name: t.findings.next })).toBeDisabled();
  });

  it('a charge still to confirm is not counted either: the plan button waits for a yes', async () => {
    const user = userEvent.setup();
    const categorize = fakeCategorize((items) => [...new Set(items.map((i) => i.label))].map((label) => ({ label, class: 'subscriptions' as const })));
    render(<Tool categorize={categorize} />);
    await user.click(await screen.findByRole('button', { name: new RegExp(t.stepper.steps.statement) }));
    await user.upload(screen.getByLabelText(t.statement.pickerLabel), csvFile(['2026-10-05,MYSTERY APP,-4.99', '2026-11-05,MYSTERY APP,-4.99']));
    const findings = (await screen.findByRole('heading', { name: t.findings.title })).closest('section')!;
    const next = within(findings).getByRole('button', { name: t.findings.next });
    expect(next).toBeDisabled();
    expect(within(findings).getByText(t.findings.planWaits)).toBeInTheDocument();
    await user.click(within(findings).getByRole('button', { name: `${t.findings.yes}: MYSTERY APP` }));
    expect(within(findings).getByRole('button', { name: t.findings.next })).toBeEnabled();
    expect(within(findings).queryByText(t.findings.planWaits)).not.toBeInTheDocument();
  });

  it('a short statement says why most findings are only possible subscriptions', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(await screen.findByRole('button', { name: new RegExp(t.stepper.steps.statement) }));
    await user.upload(screen.getByLabelText(t.statement.pickerLabel), csvFile(['2026-11-07,NETFLIX.COM,-17.99', '2026-11-08,SOME SHOP,-12.00']));
    expect(await screen.findByText(t.findings.short)).toBeInTheDocument();
  });

  it('a file that is not a CSV gets the S9 message, and the ticks still work', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<Tool />);
    await user.click(await screen.findByRole('button', { name: new RegExp(t.stepper.steps.statement) }));
    await user.upload(screen.getByLabelText(t.statement.pickerLabel), new File(['x'], 'statement.pdf', { type: 'application/pdf' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ladder.upload.errors.unreadable.notCsv);
    await user.click(screen.getByRole('button', { name: new RegExp(t.stepper.steps.ticks) }));
    await user.click(screen.getByRole('checkbox', { name: 'Spotify' }));
    expect(within(screen.getByRole('status')).getByText(/\$11\.99 a month/)).toBeInTheDocument();
  });
});

describe('SubscriptionsScreen: what we keep', () => {
  it('says what stays in the browser and clears it on request', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(await screen.findByRole('button', { name: t.guess.next }));
    const keep = screen.getByRole('heading', { name: t.keep.title }).closest('section')!;
    expect(within(keep).getByText(t.keep.tag)).toBeInTheDocument();
    expect(within(keep).getByText(t.keep.none)).toBeInTheDocument();
    expect(within(keep).queryByRole('button', { name: t.keep.clear })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Spotify' }));
    expect(within(keep).getByText(t.keep.gist)).toBeInTheDocument();
    await user.click(within(keep).getByRole('button', { name: t.keep.clear }));
    await waitFor(() => expect(screen.getByLabelText(t.guess.label)).toBeInTheDocument());
    expect(within(keep).getByText(t.keep.none)).toBeInTheDocument();
    await act(async () => {});
  });
});
