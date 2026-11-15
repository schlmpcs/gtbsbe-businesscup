import { avatar as t } from '@/copy';
import { Button, Card, Select } from '@/ui-kit';
import type { AvatarVM } from '../model/types';
import { AvatarCard } from './AvatarCard';
export function AvatarOptIn({ vm }: { vm: AvatarVM }) {
  if (!vm.enabled) return null;
  const preview = vm.preview.status === 'ready' ? vm.preview.data : null;
  return (
    <Card>
      <details
        open={vm.open}
        onToggle={(event) => vm.setOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer font-bold">{t.offer}</summary>
        <div className="mt-md flex flex-col gap-md">
          <p>{t.intro}</p>
          <fieldset className="flex flex-wrap gap-md">
            <legend>{t.facts}</legend>
            <label>
              {t.fields['facts.hasCar']}{' '}
              <input
                type="checkbox"
                checked={vm.facts.hasCar}
                onChange={(event) =>
                  vm.setFacts({
                    ...vm.facts,
                    hasCar: event.currentTarget.checked,
                  })
                }
              />
            </label>
            <label>
              {t.fields['facts.kids']}{' '}
              <Select
                size="sm"
                fullWidth={false}
                value={vm.facts.kids}
                onChange={(event) =>
                  vm.setFacts({
                    ...vm.facts,
                    kids: Number(event.currentTarget.value) as 0 | 1 | 2 | 3,
                  })
                }
              >
                {[0, 1, 2, 3].map((value) => (
                  <option key={value} value={value}>
                    {value === 3 ? '3+' : value}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              {t.fields['facts.householdAdults']}{' '}
              <Select
                size="sm"
                fullWidth={false}
                value={vm.facts.householdAdults}
                onChange={(event) =>
                  vm.setFacts({
                    ...vm.facts,
                    householdAdults: Number(event.currentTarget.value) as 1 | 2,
                  })
                }
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </Select>
            </label>
          </fieldset>
          <Button
            disabled={vm.busy || vm.preview.status === 'loading'}
            variant="secondary"
            onClick={() => void vm.loadPreview()}
          >
            {preview ? t.refresh : t.open}
          </Button>
          {vm.preview.status === 'loading' && <p>{t.loading}</p>}
          {preview && (
            <>
              <h3 className="font-bold">{t.preview}</h3>
              <AvatarCard preview={preview} />
              {preview.outOfBounds.length > 0 && (
                <div role="alert">
                  <p>{t.bounds}</p>
                  <ul>
                    {preview.outOfBounds.map((issue) => (
                      <li key={issue.field}>{t.fields[issue.field]}</li>
                    ))}
                  </ul>
                  <a href="/me/balance" className="text-primary underline">
                    {t.fix}
                  </a>
                </div>
              )}
              <p className="text-sm text-text-muted">{t.retention}</p>
              <label className="flex gap-sm">
                <input
                  type="checkbox"
                  checked={vm.consentChecked}
                  onChange={(event) =>
                    vm.setConsent(event.currentTarget.checked)
                  }
                />
                {t.consent}
              </label>
              <Button
                disabled={!vm.canPublish}
                onClick={() => void vm.publish()}
              >
                {vm.owner.status === 'ready' &&
                vm.owner.data.status.state === 'published'
                  ? t.republish
                  : t.publish}
              </Button>
            </>
          )}
          {vm.error && <p role="alert">{t.errors[vm.error] ?? t.error}</p>}
        </div>
      </details>
    </Card>
  );
}
