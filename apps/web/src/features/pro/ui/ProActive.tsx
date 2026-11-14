import { useEffect, useRef } from 'react';
import { pro as copy } from '@/copy';
import { buttonClassName, Card, cx } from '@/ui-kit';
import type { PaywallProVM } from '../model/types';

type Props = {
  pro: PaywallProVM;
  /** Unlocked just now: say so and move focus here, since the form the user was in is gone. */
  justUnlocked: boolean;
  continueHref: string;
};

/** The active entitlement: how it was unlocked and since when. No purchase buttons. */
export function ProActive({ pro, justUnlocked, continueHref }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (justUnlocked) headingRef.current?.focus();
  }, [justUnlocked]);

  return (
    <Card>
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold leading-tight">
        {justUnlocked ? copy.active.successTitle : copy.active.title}
      </h2>
      {justUnlocked && <p className="mt-sm">{copy.active.successBody}</p>}
      <dl className="mt-md grid grid-cols-[auto_1fr] gap-x-lg gap-y-xs text-sm">
        <dt className="text-text-muted">{copy.active.sourceLabel}</dt>
        <dd>{copy.active.sources[pro.source]}</dd>
        {pro.plan && (
          <>
            <dt className="text-text-muted">{copy.active.planLabel}</dt>
            <dd>{copy.plans.names[pro.plan]}</dd>
          </>
        )}
        <dt className="text-text-muted">{copy.active.sinceLabel}</dt>
        <dd>{pro.sinceLabel}</dd>
      </dl>
      <a href={continueHref} className={cx(buttonClassName({ fullWidth: true }), 'mt-lg')}>
        {copy.active.continue}
      </a>
    </Card>
  );
}
