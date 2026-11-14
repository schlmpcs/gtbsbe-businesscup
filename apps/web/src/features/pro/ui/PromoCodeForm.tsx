import type { FormEvent } from 'react';
import { pro as copy } from '@/copy';
import { Button, Card, Field, useFieldControl } from '@/ui-kit';
import type { PaywallError } from '../model/types';
import { errorText } from './errorText';

type Props = {
  code: string;
  onCodeChange: (code: string) => void;
  onRedeem: () => void;
  busy: boolean;
  disabled: boolean;
  error: PaywallError | null;
};

function CodeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const control = useFieldControl();
  return (
    <input
      {...control}
      type="text"
      autoComplete="off"
      autoCapitalize="characters"
      spellCheck={false}
      maxLength={64}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border bg-bg px-md py-sm font-mono text-base"
    />
  );
}

/** "Judges: skip checkout": the promo code, prefilled by the screen and editable. */
export function PromoCodeForm({ code, onCodeChange, onRedeem, busy, disabled, error }: Props) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onRedeem();
  };
  return (
    <Card tone="muted" title={copy.promo.title} headingLevel={2}>
      <p className="mb-md text-sm text-text-muted">{copy.promo.body}</p>
      <form onSubmit={submit} className="flex flex-col gap-md">
        {/* Polite live region: the error under the field is announced when it appears. */}
        <div aria-live="polite">
          <Field label={copy.promo.label} error={error ? errorText(error) : undefined}>
            <CodeInput value={code} onChange={onCodeChange} />
          </Field>
        </div>
        <Button type="submit" variant="secondary" disabled={disabled} aria-busy={busy || undefined}>
          {busy ? copy.promo.busy : copy.promo.button}
        </Button>
      </form>
    </Card>
  );
}
