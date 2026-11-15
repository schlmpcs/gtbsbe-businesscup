'use client';

// /together/<id>: a shared plan, opened from its link. Thin route.
import { useParams } from 'next/navigation';
import { useTogetherPlan } from '@/features/together/model/useTogetherPlan';
import { TogetherPlanScreen } from '@/features/together/ui/TogetherPlanScreen';
import { BackToTools } from '../../_components/BackToTools';

export default function TogetherPlanPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  return (
    <>
      <BackToTools width="3xl" />
      <TogetherPlanScreen vm={useTogetherPlan(id)} startHref="/together" />
    </>
  );
}
