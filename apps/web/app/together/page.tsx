'use client';

// /together: start a couple's shared plan. Thin route: the view-model hook feeds the screen.
import { useTogetherStart } from '@/features/together/model/useTogetherStart';
import { TogetherStartScreen } from '@/features/together/ui/TogetherStartScreen';

export default function TogetherPage() {
  return <TogetherStartScreen vm={useTogetherStart()} />;
}
