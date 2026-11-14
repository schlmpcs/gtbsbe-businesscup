'use client';

import { loan as t } from '@/copy';
import { Button, Card, Field, NumberInput, Row, Stack, Tabs } from '@/ui-kit';
import type { LoanLabVM, LoanOfferVM } from '../model/types';

function OfferFields({ offer, name, onChange, onRemove }: {
  offer: LoanOfferVM;
  name: string;
  onChange: LoanLabVM['updateOffer'];
  onRemove: () => void;
}) {
  const { input } = offer;
  const error = (path: string) => (offer.invalidFields.includes(path) ? t.edit.errors[path] : undefined);
  // An emptied required field becomes NaN so the view-model flags it as invalid (and the box shows empty).
  const required = (v: number | null) => v ?? Number.NaN;

  return (
    <Stack gap="md">
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <Field label={t.edit.amount} error={error('amount')}>
          <NumberInput name="amount" prefix="$" value={input.amount} onValueChange={(v) => onChange(offer.id, { amount: required(v) })} />
        </Field>
        <Field label={t.edit.apr} error={error('apr')}>
          <NumberInput
            name="apr"
            percent
            max={1}
            suffix="%"
            value={input.apr}
            onValueChange={(v) => onChange(offer.id, { apr: required(v) })}
          />
        </Field>
        <Field label={t.edit.termMonths} error={error('termMonths')}>
          <NumberInput
            name="termMonths"
            maxFractionDigits={0}
            max={600}
            suffix={t.edit.termSuffix}
            value={input.termMonths}
            onValueChange={(v) => onChange(offer.id, { termMonths: required(v) })}
          />
        </Field>
        <Field label={t.edit.downPayment} error={error('downPayment')}>
          <NumberInput
            name="downPayment"
            prefix="$"
            value={input.downPayment ?? 0}
            onValueChange={(v) => onChange(offer.id, { downPayment: v ?? 0 })}
          />
        </Field>
        <Field label={t.edit.fees} hint={t.edit.feesHint} error={error('fees')}>
          <NumberInput name="fees" prefix="$" value={input.fees ?? 0} onValueChange={(v) => onChange(offer.id, { fees: v ?? 0 })} />
        </Field>
      </div>
      <Row>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          {t.edit.remove(name)}
        </Button>
      </Row>
    </Stack>
  );
}

export type OfferEditorProps = Pick<
  LoanLabVM,
  'offers' | 'selectedOfferId' | 'selectOffer' | 'updateOffer' | 'removeOffer' | 'addOffer' | 'canAddOffer'
>;

/** One tab per offer (the selected tab is the selected offer); add or remove offers. */
export function OfferEditor({ offers, selectedOfferId, selectOffer, updateOffer, removeOffer, addOffer, canAddOffer }: OfferEditorProps) {
  const name = (i: number) => t.offerName(i + 1);
  return (
    <Card
      title={t.edit.title}
      action={
        <Button size="sm" variant="secondary" disabled={!canAddOffer} onClick={() => addOffer()}>
          {t.edit.add}
        </Button>
      }
    >
      {offers.length === 0 ? (
        <p className="text-sm text-text-muted">{t.edit.empty}</p>
      ) : (
        <Tabs
          label={t.edit.tabsLabel}
          fullWidth
          value={selectedOfferId ?? undefined}
          onValueChange={selectOffer}
          tabs={offers.map((o, i) => ({
            id: o.id,
            label: name(i),
            panel: <OfferFields offer={o} name={name(i)} onChange={updateOffer} onRemove={() => removeOffer(o.id)} />,
          }))}
        />
      )}
      {!canAddOffer && <p className="mt-md text-xs text-text-muted">{t.edit.full}</p>}
    </Card>
  );
}
