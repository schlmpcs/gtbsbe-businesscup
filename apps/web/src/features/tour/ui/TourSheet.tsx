// The 2-minute tour: numbered stops, each a link to a working screen, in a ui-kit Sheet.
// Presentational: steps and the promo code come from the view-model; the link component from the app.
import type { ComponentType, ReactNode } from 'react';
import { tour as t } from '@/copy';
import { Sheet } from '@/ui-kit';
import type { TourStepVM, TourVM } from '../model/types';

/** The router's link (next/link), passed in by the app: ui/ may not import next/*. */
export type TourLinkComponent = ComponentType<{
  href: string;
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
  'data-tour-step'?: string;
}>;

/** The sheet. `children` (the steps) render only while it is open. */
export function TourSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children?: ReactNode }) {
  return (
    <Sheet open={open} onClose={onClose} title={t.title} description={t.description}>
      {children}
    </Sheet>
  );
}

/** The numbered stops and one honest line on what is not built yet. `onFollow` runs when a stop is opened. */
export function TourSteps({ vm, Link, onFollow }: { vm: TourVM; Link: TourLinkComponent; onFollow: () => void }) {
  return (
    <div className="flex flex-col gap-lg" data-testid="tour">
      <ol aria-label={t.stepsLabel} className="flex flex-col gap-md">
        {vm.steps.map((step, i) => (
          <TourStep key={step.id} n={i + 1} step={step} promoCode={vm.promoCode} Link={Link} onFollow={onFollow} />
        ))}
      </ol>
      <p className="rounded-md bg-surface-strong p-md text-sm text-text-muted" data-testid="tour-preview-note">
        {t.preview}
      </p>
    </div>
  );
}

function TourStep({
  n,
  step,
  promoCode,
  Link,
  onFollow,
}: {
  n: number;
  step: TourStepVM;
  promoCode: string | null;
  Link: TourLinkComponent;
  onFollow: () => void;
}) {
  const s = t.steps[step.id];
  return (
    <li className="flex gap-md">
      <span
        aria-hidden="true"
        className="flex size-xl shrink-0 items-center justify-center rounded-full bg-primary font-display font-extrabold text-on-primary"
      >
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-xs">
        <Link
          href={step.href}
          onClick={onFollow}
          data-tour-step={step.id}
          className="flex min-h-11 items-center self-start font-semibold text-text underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
        >
          {s.title}
          <span aria-hidden="true" className="ml-xs no-underline">
            →
          </span>
        </Link>
        <p className="text-sm text-text-muted">{s.body}</p>
        {step.id === 'pro' && promoCode && (
          <p
            className="self-start rounded-md border border-dashed border-text-muted px-sm py-xs font-mono text-sm"
            data-testid="tour-promo"
          >
            {t.steps.pro.code(promoCode)}
          </p>
        )}
      </div>
    </li>
  );
}
