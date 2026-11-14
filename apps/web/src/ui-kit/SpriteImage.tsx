import { cx } from './cx';

export type SpriteImageProps = {
  /** A sprite id from the house kit (engine scene.ts SPRITE_IDS), e.g. "layout/2bed" or "garage/economy". */
  id: string;
  /** Empty string when the facts next to it already say what it shows (the default). */
  alt?: string;
  className?: string;
};

/** One image of the house sprite kit (apps/web/public/scene/<id>.webp, D1). */
export function SpriteImage({ id, alt = '', className }: SpriteImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static local sprite, no optimizer needed
    <img
      src={`/scene/${id}.webp`}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cx('block h-auto w-full', className)}
    />
  );
}
