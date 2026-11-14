// S15 Pro paywall: a demo (Stripe test mode or the promo code shown on screen, no real money).
import type { Metadata } from 'next';
import { common, screenTitles } from '@/copy';
import { ProScreen } from './ProScreen';

export const metadata: Metadata = {
  title: `${screenTitles.S15} · ${common.appName}`,
};

const single = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

export default async function ProPage({ searchParams }: PageProps<'/pro'>) {
  // Stripe sends the user back to /pro?checkout=success&session_id=… (or ?checkout=cancelled).
  // Read on the server so the first paint already says "confirming" instead of flashing the offer.
  const query = await searchParams;
  const checkout = single(query.checkout);
  return (
    <main className="mx-auto w-full max-w-(--container-2xl) px-lg py-xl">
      {/* The page's h1 is the paywall's headline ("Keep building your future"). */}
      <ProScreen checkoutReturn={checkout ? { checkout, sessionId: single(query.session_id) } : undefined} />
    </main>
  );
}
