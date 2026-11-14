'use client';

// S21 Subscription audit (`/tools/subscriptions`): thin route. The view-model hook feeds the
// presentational screen (SubscriptionsTool). Streamer mode (`?stream=1`) never shows it: the tool is
// about the person's own money, so nothing of it is built there. There is no tools hub; this page has
// its own entry in the app navigation (lib/screens.ts).
import { use } from 'react';
import { subscriptions as t } from '@/copy';
import { SubscriptionsTool } from '@/features/subscriptions/SubscriptionsTool';
import { useSubscriptionsDeps } from '@/features/subscriptions/model/wiring';
import { PageHeader } from '@/ui-kit';

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto w-full max-w-(--container-2xl) px-lg py-xl">
      <PageHeader title={title} intro={body} />
    </main>
  );
}

function Connected() {
  const deps = useSubscriptionsDeps();
  return deps ? <SubscriptionsTool deps={deps} /> : <Notice title={t.screens.S21} body={t.notConnected} />;
}

export default function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ stream?: string | string[] }> }) {
  const { stream } = use(searchParams);
  return stream === '1' ? <Notice title={t.streamer.title} body={t.streamer.body} /> : <Connected />;
}
