import { cx } from './cx';

export type PhotoProps = {
  src: string;
  /** Empty for a decorative picture. */
  alt: string;
  className?: string;
  /** Load eagerly (above the fold). */
  priority?: boolean;
};

/** A static local picture (public/), cropped to fill its box. */
export function Photo({ src, alt, className, priority = false }: PhotoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static local webp, already sized; no optimizer needed
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={cx('block h-full w-full object-cover', className)}
    />
  );
}
