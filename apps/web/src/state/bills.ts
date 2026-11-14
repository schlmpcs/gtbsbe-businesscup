// Bills calendar settings (client state only, never sent to a server): the due day the user set for
// each bill and their paydays. Bill ids are 'rent', 'debt:<id>' and 'sub:<finding id>'; amounts and
// labels are not stored here (they come from the profile and the subscription audit).
import { z } from 'zod';

export const MAX_BILL_DUE_DAYS = 200;
export const MAX_PAYDAYS = 4;

const DaySchema = z.number().int().min(1).max(31);

export const BillsSettingsSchema = z.object({
  /** Bill id → day of the month (1-31) the user set. */
  dueDays: z.record(z.string().min(1).max(200), DaySchema),
  /** The user's paydays (days of the month), or null until they set them (the screen assumes the 1st and 15th). */
  paydays: z.array(DaySchema).min(1).max(MAX_PAYDAYS).nullable(),
});
export type BillsSettings = z.infer<typeof BillsSettingsSchema>;

export const initialBillsSettings = (): BillsSettings => ({ dueDays: {}, paydays: null });

/**
 * Saved settings, salvaged: storage from before this field existed (or broken) gives the defaults;
 * a broken due day drops only that entry, broken paydays fall back to "not set".
 */
export function restoreBills(raw: unknown): BillsSettings {
  const out = initialBillsSettings();
  if (!raw || typeof raw !== 'object') return out;
  const { dueDays, paydays } = raw as Record<string, unknown>;
  if (dueDays && typeof dueDays === 'object') {
    for (const [id, day] of Object.entries(dueDays).slice(0, MAX_BILL_DUE_DAYS)) {
      if (id.length > 0 && id.length <= 200 && DaySchema.safeParse(day).success) out.dueDays[id] = day as number;
    }
  }
  const p = BillsSettingsSchema.shape.paydays.safeParse(paydays);
  if (p.success) out.paydays = p.data && [...new Set(p.data)].sort((a, b) => a - b);
  return out;
}
