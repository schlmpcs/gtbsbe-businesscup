'use client';

// S27 Manage Pro (design preview). Spec: docs/design/USER-JOURNEY.md → S27. Pause and cancel switch
// local state only; the cancel modal shows the value check first, with "Pause instead" and
// "Cancel Pro" the same size.
import { useState } from 'react';
import { previewA } from '@/copy';
import { Button, Card, formatMoney, formatRate, Money, Sheet } from '@/ui-kit';
import type { ManageProPreviewProps } from '../model/types';
import { Pill, PreviewHeader, PreviewMain, PreviewStates } from './shared';

const t = previewA.manage;

type Status = 'active' | 'paused' | 'cancelled';
type Months = 1 | 2 | 3;
const MONTHS: readonly Months[] = [1, 2, 3];

function ValueCheck({ value }: { value: ManageProPreviewProps['value'] }) {
  const items = [
    { id: 'paid', label: previewA.checkin.valueBody(formatMoney(value.paidDown), formatMoney(value.vsForecast, { signed: true })) },
    { id: 'checkins', label: t.valueCheckins(value.checkinsSaved) },
    { id: 'goal', label: t.valueGoal(value.goalName, formatRate(value.goalShare, 0)) },
  ];
  return (
    <ul className="flex flex-col gap-sm" data-testid="pro-value-check">
      {items.map((i) => (
        <li key={i.id} className="rounded-lg bg-surface-strong p-md font-semibold">
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export function ManageProPreview({ plan, price, priceInterval, renewsOn, pausedUntil, value }: ManageProPreviewProps) {
  const [status, setStatus] = useState<Status>('active');
  const [months, setMonths] = useState<Months>(1);
  const [modalOpen, setModalOpen] = useState(false);

  const statusLine =
    status === 'active' ? t.statusActive : status === 'paused' ? t.statusPaused(pausedUntil[months]) : t.statusCancelled(renewsOn);

  const pause = () => {
    setStatus('paused');
    setModalOpen(false);
  };

  return (
    <PreviewMain narrow>
      <PreviewStates
        options={[
          { id: 'active', label: t.states.active },
          { id: 'paused', label: t.states.paused },
          { id: 'cancelled', label: t.states.cancelled },
        ]}
        value={status}
        onChange={setStatus}
      />
      <PreviewHeader title={t.title} />

      <Card data-testid="pro-plan">
        <div className="flex flex-col gap-lg">
          <Pill tone={status === 'active' ? 'positive' : 'outline'} className="text-sm">
            {statusLine}
          </Pill>
          <dl className="grid grid-cols-[auto_1fr] gap-x-lg gap-y-sm">
            <dt className="text-text-muted">{t.planLabel}</dt>
            <dd className="font-semibold">{plan}</dd>
            <dt className="text-text-muted">{t.priceLabel}</dt>
            <dd className="font-semibold">
              <Money value={price} cents /> <span className="font-normal text-text-muted">{priceInterval}</span>
            </dd>
            <dt className="text-text-muted">{status === 'cancelled' ? t.endsLabel : t.renewsLabel}</dt>
            <dd className="font-semibold">{renewsOn}</dd>
          </dl>
          {status !== 'cancelled' && <p className="text-sm text-text-muted">{t.reminder}</p>}
        </div>
      </Card>

      {status === 'active' && (
        <>
          <Card title={t.pauseTitle} data-testid="pro-pause">
            <div className="flex flex-col gap-lg">
              <p className="text-text-muted">{t.pauseBody}</p>
              <fieldset className="flex flex-col gap-sm">
                <legend className="mb-sm text-sm font-semibold">{t.pauseLegend}</legend>
                <div className="grid grid-cols-3 gap-sm">
                  {MONTHS.map((n) => (
                    <label
                      key={n}
                      className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-border bg-surface px-sm py-md text-center font-semibold has-checked:border-ink has-checked:bg-surface-strong has-focus-visible:outline-2 has-focus-visible:outline-ink"
                    >
                      <input
                        type="radio"
                        name="pause-months"
                        value={n}
                        checked={months === n}
                        onChange={() => setMonths(n)}
                        className="sr-only"
                      />
                      {t.pauseMonths(n)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button variant="dark" size="lg" fullWidth onClick={pause}>
                {t.pause(months)}
              </Button>
            </div>
          </Card>

          <Card title={t.cancelTitle} data-testid="pro-cancel">
            <div className="flex flex-col gap-lg">
              <p className="text-text-muted">{t.cancelBody}</p>
              <Button variant="secondary" size="lg" fullWidth onClick={() => setModalOpen(true)}>
                {t.cancel}
              </Button>
            </div>
          </Card>
        </>
      )}

      {status === 'paused' && (
        <Card data-testid="pro-paused" className="flex flex-col gap-lg">
          <p className="text-lg">{t.pausedBody(pausedUntil[months])}</p>
          <Button variant="dark" size="lg" fullWidth onClick={() => setStatus('active')}>
            {t.resume}
          </Button>
        </Card>
      )}

      {status === 'cancelled' && (
        <Card data-testid="pro-cancelled" className="flex flex-col gap-lg">
          <p className="text-lg">{t.cancelledBody(renewsOn)}</p>
          <Button variant="dark" size="lg" fullWidth onClick={() => setStatus('active')}>
            {t.keep}
          </Button>
        </Card>
      )}

      <Sheet
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t.modalTitle}
        description={t.modalDescription}
        footer={
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <Button variant="secondary" size="lg" fullWidth onClick={pause}>
              {t.pauseInstead}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => {
                setStatus('cancelled');
                setModalOpen(false);
              }}
            >
              {t.confirmCancel}
            </Button>
          </div>
        }
      >
        <ValueCheck value={value} />
      </Sheet>
    </PreviewMain>
  );
}
