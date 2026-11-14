'use client';

// Life events timeline: thin route. The view-model hook feeds the presentational screen; it runs on
// the profile in the app store (the demo household until the person makes their own).
import { useLifeEvents } from '@/features/lifeEvents/model/useLifeEvents';
import { LifeEventsScreen } from '@/features/lifeEvents/ui/LifeEventsScreen';
import { useAppStore } from '@/state';

export default function LifeEventsPage() {
  const profile = useAppStore((s) => s.profile);
  return <LifeEventsScreen vm={useLifeEvents(profile)} />;
}
