import { game as t } from '@/copy';
import { Button } from '@/ui-kit';
import type { StreamerVM } from '../model/types';

/** S4: the streamer countdown, giant and white on the orange page. The view-model locks the guess in at zero. */
export function Countdown({ streamer }: { streamer: StreamerVM }) {
  const { countdown, locked } = streamer;
  return (
    <div className="flex flex-col gap-md">
      <p className="text-sm font-bold uppercase tracking-wide">{t.streamer.countdown}</p>
      <p
        role="timer"
        aria-label={t.streamer.secondsLabel(countdown.secondsLeft)}
        className="font-display text-[length:calc(var(--text-display)*2)] font-extrabold leading-display tabular-nums sm:text-[length:calc(var(--text-display)*3)]"
      >
        {t.streamer.seconds(countdown.secondsLeft)}
      </p>
      {locked ? (
        <p role="status" className="text-2xl font-semibold">
          {t.streamer.lockedIn}
        </p>
      ) : (
        <div className="flex flex-wrap gap-sm">
          {countdown.running ? (
            <Button variant="dark" size="lg" onClick={streamer.stopCountdown}>
              {t.streamer.pause}
            </Button>
          ) : (
            <Button variant="dark" size="lg" onClick={streamer.startCountdown}>
              {t.streamer.start}
            </Button>
          )}
          <Button variant="secondary" size="lg" onClick={streamer.resetCountdown}>
            {t.streamer.reset}
          </Button>
        </div>
      )}
    </div>
  );
}
