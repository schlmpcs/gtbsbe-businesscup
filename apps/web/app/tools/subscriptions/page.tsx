'use client';

// S21 Subscription audit (`/tools/subscriptions`): thin route. The view-model hook feeds the
// presentational screen (SubscriptionsTool). Streamer mode (`?stream=1`) never shows it: the tool is
// about the person's own money, so nothing of it is built there. "← What if?" goes back to the hub (/tools).
import Link from 'next/link';
import { use } from 'react';
import { subscriptions as t } from '@/copy';
import { SubscriptionsTool } from '@/features/subscriptions/SubscriptionsTool';
import { useSubscriptionsDeps } from '@/features/subscriptions/model/wiring';
import { PageHeader } from '@/ui-kit';
import { BackToTools } from '../../_components/BackToTools';

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto w-full max-w-(--container-5xl) px-lg py-xl">
      <PageHeader title={title} intro={body} />
    </main>
  );
}

function Connected() {
  return <SubscriptionsTool deps={useSubscriptionsDeps()} Link={Link} />;
}

export default function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ stream?: string | string[] }> }) {
  const { stream } = use(searchParams);
  return (
    <>
      <BackToTools width="5xl" />
      {stream === '1' ? <Notice title={t.streamer.title} body={t.streamer.body} /> : <Connected />}
    </>
  );
}
