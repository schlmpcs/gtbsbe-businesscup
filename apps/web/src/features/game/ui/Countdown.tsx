import { game as t } from '@/copy';
import { Button, Card } from '@/ui-kit';
import type { StreamerVM } from '../model/types';

/** S4: the streamer countdown. The view-model locks the guess in when it reaches zero. */
export function Countdown({ streamer }: { streamer: StreamerVM }) {
  const { countdown, locked } = streamer;
  return (
    <Card tone="muted" className="flex flex-col items-center gap-md text-center">
      <p className="text-lg font-medium text-text-muted">{t.streamer.countdown}</p>
      <p
        role="timer"
        aria-label={t.streamer.secondsLabel(countdown.secondsLeft)}
        className="text-display font-bold leading-tight tabular-nums"
      >
        {t.streamer.seconds(countdown.secondsLeft)}
      </p>
      {locked ? (
        <p role="status" className="text-xl font-semibold">
          {t.streamer.lockedIn}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap justify-center gap-sm">
            {countdown.running ? (
              <Button variant="secondary" size="lg" onClick={streamer.stopCountdown}>
                {t.streamer.pause}
              </Button>
            ) : (
              <Button size="lg" onClick={streamer.startCountdown}>
                {t.streamer.start}
              </Button>
            )}
            <Button variant="ghost" size="lg" onClick={streamer.resetCountdown}>
              {t.streamer.reset}
            </Button>
          </div>
          <p className="text-base text-text-muted">{t.streamer.autoLock}</p>
        </>
      )}
    </Card>
  );
}
