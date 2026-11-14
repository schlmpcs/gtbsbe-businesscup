'use client';

// Step 1: one guess, before anything is shown. Quick picks beside the box.
import { subscriptions as t } from '@/copy';
import { Button, Card, Field, formatMoney, NumberInput, Row, Stack } from '@/ui-kit';
import type { SubscriptionsVM } from '../model/types';

export type GuessStepProps = { guess: SubscriptionsVM['guess']; onNext: () => void };

export function GuessStep({ guess, onNext }: GuessStepProps) {
  return (
    <Card title={t.guess.title}>
      <Stack gap="lg">
        <Field label={t.guess.label} hint={t.guess.hint}>
          <NumberInput value={guess.value} onValueChange={guess.set} max={100_000} prefix="$" suffix="/mo" />
        </Field>
        <Stack gap="xs">
          <p className="text-sm text-text-muted">{t.guess.presets}</p>
          <Row gap="sm">
            {guess.presets.map((preset) => (
              <Button key={preset} variant="secondary" size="sm" onClick={() => guess.set(preset)}>
                {formatMoney(preset)}
              </Button>
            ))}
          </Row>
        </Stack>
        <Row gap="sm">
          <Button size="lg" onClick={onNext}>
            {t.guess.next}
          </Button>
          {guess.value !== null && (
            <Button variant="ghost" onClick={() => guess.set(null)}>
              {t.guess.skip}
            </Button>
          )}
        </Row>
      </Stack>
    </Card>
  );
}
