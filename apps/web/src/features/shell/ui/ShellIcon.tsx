// Line icons for the shell's links (24px, currentColor). Decorative: the link's text names it.
import type { ShellIcon as IconName } from '../model/types';

const PATHS: Record<IconName, string[]> = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h5v-6h4v6h5V9.5'],
  plan: ['M3 20h18', 'M4 16l5-5 4 3 7-8', 'M15 6h5v5'],
  accounts: ['M3 9.5 12 4l9 5.5', 'M5 10v8M9.5 10v8M14.5 10v8M19 10v8', 'M3 20.5h18'],
  transactions: ['M4 7h13', 'M14 4l3 3-3 3', 'M20 17H7', 'M10 14l-3 3 3 3'],
  cashflow: ['M3 6h6c4 0 4 12 8 12h4', 'M3 18h6c1.5 0 2.4-1.7 3-4', 'M14 9c.7-1.8 1.6-3 3-3h4'],
  budget: ['M12 3v9l7.5 4.5', 'M21 12a9 9 0 1 1-9-9'],
  recurring: ['M20 11a8 8 0 0 0-14.7-4.3', 'M4 4v4h4', 'M4 13a8 8 0 0 0 14.7 4.3', 'M20 20v-4h-4'],
  goals: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M12 12h.01'],
  future: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v5l3 2'],
  whatIf: ['M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6', 'M12 17.5h.01', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z'],
  play: ['M6 4.5v15l13-7.5Z'],
  pro: ['M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9Z'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
};

export function ShellIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'more' ? 3 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'size-6 shrink-0'}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** The house logo from the Figma screens. */
export function ShellLogo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className="shrink-0">
      <path d="M13 1.5L24.5 10V24.5H1.5V10Z" className="fill-primary" />
      <path
        d="M10.2 11.2c0-1.7 1.3-2.9 3-2.9s3 1.1 3 2.7c0 1.3-.8 2-1.7 2.5-.7.4-.9.7-.9 1.3v.5h-1.9v-.7c0-1.1.5-1.7 1.4-2.2.7-.4 1.1-.7 1.1-1.3 0-.6-.5-1-1.1-1s-1.1.4-1.1 1.1Z"
        className="fill-on-primary"
      />
      <circle cx="12.7" cy="18.6" r="1.2" className="fill-on-primary" />
    </svg>
  );
}
