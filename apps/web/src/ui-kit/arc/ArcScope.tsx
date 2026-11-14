import type { ReactNode } from 'react';
import './arc-theme.css';

/** Gives Arc components their tokens (mapped onto ours in arc-theme.css) inside this subtree. */
export function ArcScope({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `arc ${className}` : 'arc'}>{children}</div>;
}
