import { game as t } from '@/copy';
import { Button, Sticker } from '@/ui-kit';
import type { StreamerVM } from '../model/types';

/** S4: the streamer countdown, giant and white on the orange page. The view-model locks the guess in at zero. */
export function Countdown({ streamer }: { streamer: StreamerVM }) {
  const { countdown, locked } = streamer;
  return (
    <div className="flex flex-col gap-md">
      <Sticker tone="ink" tilt={-3} className="text-sm">
        {t.streamer.countdown}
      </Sticker>
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
          {/* A white button on the orange page (the secondary outline would vanish on orange). */}
          <button
            type="button"
            onClick={streamer.resetCountdown}
            className="inline-flex items-center justify-center rounded-lg bg-surface px-2xl py-lg text-xl font-bold text-text shadow-md transition-colors hover:bg-primary-soft"
          >
            {t.streamer.reset}
          </button>
        </div>
      )}
    </div>
  );
}
