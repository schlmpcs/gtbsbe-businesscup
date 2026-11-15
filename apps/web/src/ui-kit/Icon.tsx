// Line icons (24×24, stroke = currentColor). Used instead of emoji so every platform draws the same thing.
import type { SVGProps } from 'react';

export type IconName =
  | 'home' | 'kid' | 'beach' | 'lock' | 'check' | 'arrowRight' | 'arrowLeft' | 'shield' | 'bank' | 'spark'
  | 'cash' | 'repeat' | 'fork' | 'card' | 'car' | 'cart' | 'piggy';

const PATHS: Record<IconName, string[]> = {
  home: ['M3 11.5 12 4l9 7.5', 'M5.5 9.5V20h13V9.5', 'M10 20v-5h4v5'],
  kid: ['M12 8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M7 21v-5.5a5 5 0 0 1 10 0V21', 'M9.5 21v-3', 'M14.5 21v-3'],
  beach: ['M12 21V9', 'M12 9c-1-3-4-4.5-7.5-3.5C7 6 9.5 7 12 9Z', 'M12 9c1-3 4-4.5 7.5-3.5C17 6 14.5 7 12 9Z', 'M3 21h18'],
  lock: ['M6 11h12v10H6z', 'M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11', 'M12 15v2.5'],
  check: ['M5 12.5 10 17.5 19 7'],
  arrowRight: ['M5 12h14', 'M13 6l6 6-6 6'],
  arrowLeft: ['M19 12H5', 'M11 6l-6 6 6 6'],
  shield: ['M12 3 4.5 6v5.5c0 4.5 3.2 8.3 7.5 9.5 4.3-1.2 7.5-5 7.5-9.5V6Z', 'M8.5 12l2.5 2.5 4.5-5'],
  bank: ['M3 9.5 12 4l9 5.5', 'M4 20h16', 'M6 10.5V17', 'M10 10.5V17', 'M14 10.5V17', 'M18 10.5V17'],
  cash: ['M3 7h18v10H3z', 'M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 'M6 10v.01', 'M18 14v.01'],
  repeat: ['M17 3l3 3-3 3', 'M4 11V9a3 3 0 0 1 3-3h13', 'M7 21l-3-3 3-3', 'M20 13v2a3 3 0 0 1-3 3H4'],
  fork: ['M7 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3', 'M9 12v9', 'M17 21V3c-2 1.5-3 4-3 7v3h3'],
  card: ['M3 6h18v12H3z', 'M3 10h18', 'M7 15h4'],
  car: ['M5 16h14', 'M5 16v2.5', 'M19 16v2.5', 'M3.5 16v-4l2-5h13l2 5v4', 'M3.5 12h17', 'M7.5 14h.01', 'M16.5 14h.01'],
  cart: ['M3 4h2.5l2.2 10.5h10.6L20.5 7H6.5', 'M9.5 19.5h.01', 'M17 19.5h.01'],
  piggy: ['M19 11c0-3.3-3.1-6-7-6S5 7.7 5 11c0 1.8.9 3.4 2.4 4.5V19h3v-2h3.2v2h3v-3.5A6 6 0 0 0 19 11Z', 'M3 10.5c.5 1 1.2 1.5 2 1.5', 'M15.5 10h.01', 'M10 7.5h4'],
  spark: ['M12 3v4', 'M12 17v4', 'M3 12h4', 'M17 12h4', 'M6 6l2.5 2.5', 'M15.5 15.5 18 18', 'M18 6l-2.5 2.5', 'M8.5 15.5 6 18'],
};

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { name: IconName; size?: number; strokeWidth?: number };

/** A decorative line icon (aria-hidden); give the control its own accessible name. */
export function Icon({ name, size = 20, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}
    >
      {PATHS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
