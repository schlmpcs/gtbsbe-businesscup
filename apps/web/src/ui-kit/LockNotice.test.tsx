// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LockNotice } from './LockNotice';

describe('LockNotice', () => {
  it('shows the title, body and a link to where it unlocks', () => {
    render(<LockNotice title="A Pro feature" body="Saving is part of Pro." ctaLabel="See Pro" href="/pro" />);
    expect(screen.getByRole('heading', { level: 3, name: 'A Pro feature' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Saving is part of Pro.');
    expect(screen.getByRole('link', { name: 'See Pro' })).toHaveAttribute('href', '/pro');
  });

  it('takes a heading level', () => {
    render(<LockNotice title="Locked" body="b" ctaLabel="c" href="/pro" headingLevel={2} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Locked' })).toBeInTheDocument();
  });
});
