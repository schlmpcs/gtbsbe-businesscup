// /preview: one place to walk through every screen of the app, built or not. Built screens link to
// their real routes; screens without a backend yet link to a design preview with sample numbers.
// Not linked from the nav. Not indexed by search engines.
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Screen map · lifeguessr',
  robots: { index: false, follow: false },
};

type Row = { id: string; name: string; href: string; status: 'live' | 'flag' | 'preview' };

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'Game',
    rows: [
      { id: 'S1', name: 'Today (first visit)', href: '/', status: 'live' },
      { id: 'S2–S3', name: 'Duel: round, reveal, day result', href: '/duel', status: 'flag' },
      { id: 'S2–S4', name: 'Slider game (current /play)', href: '/play', status: 'live' },
      { id: 'S16', name: 'Leaderboard', href: '/preview/leaderboard', status: 'preview' },
    ],
  },
  {
    title: 'Your numbers',
    rows: [
      { id: 'S5', name: 'Your guess', href: '/me/guess', status: 'live' },
      { id: 'S6', name: 'Closest life', href: '/me/closest', status: 'live' },
      { id: 'S7', name: 'Your month', href: '/me/sliders', status: 'live' },
      { id: 'S8', name: 'Pay and savings', href: '/me/balance', status: 'live' },
      { id: 'S9', name: 'Make it exact (statement)', href: '/me/upload', status: 'live' },
      { id: 'S10', name: 'You in 10 years, goal, moves (sample life)', href: '/future?sample=1', status: 'live' },
    ],
  },
  {
    title: 'Money tools',
    rows: [
      { id: 'S11', name: 'Can I afford it?', href: '/afford', status: 'live' },
      { id: 'S12', name: 'Loan Lab', href: '/loan', status: 'live' },
      { id: 'S13', name: 'Decide (car)', href: '/decide', status: 'live' },
      { id: 'S30', name: 'What if? Two choices, two futures', href: '/what-if', status: 'live' },
      { id: 'S20', name: 'Tools hub', href: '/preview/tools', status: 'preview' },
      { id: 'S21', name: 'Little things (subscriptions and habits)', href: '/preview/tools/subscriptions', status: 'preview' },
      { id: 'S22', name: 'Household', href: '/preview/tools/household', status: 'preview' },
      { id: 'S23', name: 'Overpaying check', href: '/preview/tools/overpaying', status: 'preview' },
      { id: 'S24', name: 'Debt payoff', href: '/preview/tools/payoff', status: 'preview' },
      { id: 'S25', name: 'Runway', href: '/preview/tools/runway', status: 'preview' },
      { id: 'S26', name: 'Yearly bills', href: '/preview/tools/yearly', status: 'preview' },
    ],
  },
  {
    title: 'Coming back and paying',
    rows: [
      { id: 'S14', name: 'Monthly check-in (current)', href: '/checkin', status: 'live' },
      { id: 'S14', name: 'Monthly check-in with fast-forward', href: '/preview/checkin', status: 'preview' },
      { id: 'S15', name: 'Go Pro', href: '/pro', status: 'live' },
      { id: 'S27', name: 'Manage Pro: pause, cancel', href: '/preview/pro-manage', status: 'preview' },
      { id: 'S28', name: 'Decision calendar', href: '/preview/calendar', status: 'preview' },
      { id: 'S29', name: 'Shared decision for a partner', href: '/preview/shared-decision', status: 'preview' },
    ],
  },
];

const BADGE: Record<Row['status'], string> = {
  live: 'Live',
  flag: 'Built, behind a flag',
  preview: 'Design preview',
};

const BADGE_CLASS: Record<Row['status'], string> = {
  live: 'bg-surface-strong text-text',
  flag: 'bg-primary-soft text-primary',
  preview: 'border border-dashed border-text-muted text-text-muted',
};

export default function PreviewIndexPage() {
  return (
    <main className="mx-auto w-full max-w-(--container-2xl) px-lg py-xl">
      <h1 className="font-display text-4xl font-extrabold leading-display">Every screen</h1>
      <p className="mt-sm text-text-muted">
        Walk through the whole app. Design previews show the layout and buttons with sample numbers, not computed ones;
        they are not linked from the app.
      </p>
      <div className="mt-xl flex flex-col gap-xl">
        {GROUPS.map((g) => (
          <section key={g.title} className="flex flex-col gap-sm">
            <h2 className="text-lg font-bold">{g.title}</h2>
            <ul className="flex flex-col gap-xs">
              {g.rows.map((r) => (
                <li key={`${r.id}-${r.href}`}>
                  <Link
                    href={r.href}
                    className="flex items-center justify-between gap-md rounded-lg bg-surface px-lg py-md hover:bg-surface-strong"
                  >
                    <span className="flex min-w-0 items-baseline gap-sm">
                      <span className="shrink-0 text-sm font-bold text-text-muted">{r.id}</span>
                      <span className="font-semibold">{r.name}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-sm py-xs text-xs font-semibold ${BADGE_CLASS[r.status]}`}>
                      {BADGE[r.status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-xl text-xs text-text-muted">Educational simulation, not financial advice.</p>
    </main>
  );
}
