import { game } from '@/copy';
import { ScreenPage } from '../_components/ScreenPage';

// S2 Explore the home; S3 Reveal is the state after a guess; S4 Streamer mode with ?stream=1.
export default async function PlayPage({ searchParams }: { searchParams: Promise<{ stream?: string | string[] }> }) {
  const { stream } = await searchParams;
  const streamer = stream === '1';
  return (
    <ScreenPage id={streamer ? 'S4' : 'S2'}>
      <p className="mt-sm text-sm text-text-muted">{game.revealStateNote}</p>
    </ScreenPage>
  );
}
