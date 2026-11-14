// S21 Little things: design preview with sample numbers. Not linked from the app.
// ?step=guess|reveal|decide opens a given step (for screenshots).
import type { Metadata } from 'next';
import { littleThingsSample } from '@/features/preview-b/model/samples';
import { LittleThings, type LittleThingsStep } from '@/features/preview-b/ui/LittleThings';

export const metadata: Metadata = { robots: { index: false } };

const STEPS: readonly LittleThingsStep[] = ['guess', 'reveal', 'decide'];

export default async function Page({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const { step } = await searchParams;
  const initialStep = STEPS.find((s) => s === step) ?? 'guess';
  return <LittleThings key={initialStep} vm={littleThingsSample} initialStep={initialStep} />;
}
