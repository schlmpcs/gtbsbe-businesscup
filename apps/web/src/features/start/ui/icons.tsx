// Small inline icons for the /start screens (stroke = currentColor).
type P = { className?: string };
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const SparkIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="20" height="20" className={className} {...base}>
    <path d="M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16.4l-1.8-4.9L5 9.7l5.2-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
  </svg>
);
export const UploadIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="20" height="20" className={className} {...base}>
    <path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </svg>
);
export const BankIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="20" height="20" className={className} {...base}>
    <path d="M3 10l9-6 9 6" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" /><path d="M3 20h18" />
  </svg>
);
export const PeopleIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="20" height="20" className={className} {...base}>
    <circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.2c2.8.3 5 2.7 5 5.8" />
  </svg>
);
export const CheckIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="16" height="16" className={className} {...base} strokeWidth={2.6}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);
export const ArrowIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="18" height="18" className={className} {...base}>
    <path d="M5 12h14" /><path d="M13 6l6 6-6 6" />
  </svg>
);
export const BackIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="18" height="18" className={className} {...base}>
    <path d="M19 12H5" /><path d="M11 18l-6-6 6-6" />
  </svg>
);
export const LockIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width="16" height="16" className={className} {...base}>
    <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
