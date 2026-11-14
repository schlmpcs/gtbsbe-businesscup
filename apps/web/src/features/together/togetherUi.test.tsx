// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { together as t } from '@/copy';
import { cloneProfileDemo, togetherPartnerSample } from '@/fixtures';
import type { TogetherPartner } from '@lifeguessr/types';
import { profilePartner, togetherResult } from './model/compute';
import type { TogetherPlanVM } from './model/types';
import { TogetherPlanScreen } from './ui/TogetherPlanScreen';

const result = togetherResult({
  id: 'AAAAAAAAAAAAAAAAAAAAAA',
  partner1: profilePartner(cloneProfileDemo(), ''),
  partner2: structuredClone(togetherPartnerSample) as TogetherPartner,
  goal: { target: 100_000, years: 10 },
  createdAt: '2026-11-14T12:00:00.000Z',
  expiresAt: '2026-12-14T12:00:00.000Z',
});

const ready = (over: Partial<Extract<TogetherPlanVM, { status: 'ready' }>> = {}): TogetherPlanVM => ({
  status: 'ready',
  role: 'partner1',
  storage: 'api',
  names: { p1: null, p2: 'Sam' },
  expiresOn: 'December 14, 2026',
  share: { url: 'http://localhost/together/AAAAAAAAAAAAAAAAAAAAAA', copy: vi.fn(), share: null, copied: false },
  waiting: false,
  refresh: null,
  form: null,
  submit: vi.fn(),
  submitting: false,
  submitError: null,
  editMine: null,
  cancelEdit: null,
  result,
  resultError: null,
  ...over,
});

describe('TogetherPlanScreen', () => {
  it('shows the split with neutral labels, the 10-year view tagged as a rules estimate, and the goal', () => {
    render(<TogetherPlanScreen vm={ready()} startHref="/together" />);
    expect(screen.getByTestId('together-split-line')).toHaveTextContent(/^Partner 1 pays \$2,282, Sam pays \$1,668$/);
    expect(screen.getByText(t.result.rulesTag)).toBeInTheDocument();
    expect(screen.getByTestId('together-goal')).toHaveTextContent('$100,000 in 10 years');
    expect(screen.getByTestId('together-link')).toHaveValue('http://localhost/together/AAAAAAAAAAAAAAAAAAAAAA');
  });

  it('tells partner 1 it is waiting, and says when a plan is gone', () => {
    const { unmount } = render(<TogetherPlanScreen vm={ready({ waiting: true, result: null })} startHref="/together" />);
    expect(screen.getByTestId('together-waiting')).toHaveTextContent(t.plan.waiting('Sam'));
    unmount();
    render(<TogetherPlanScreen vm={{ status: 'notFound' }} startHref="/together" />);
    expect(screen.getByTestId('together-not-found')).toHaveTextContent(t.plan.notFound);
  });
});
