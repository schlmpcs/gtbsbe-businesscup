'use client';
// The app shell's view-model: the nav for the current pathname and the phone's More sheet.
import { usePathname } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { shellNav } from './nav';
import type { ShellVM } from './types';

export function useShell(): ShellVM {
  const pathname = usePathname() ?? '/';
  // The sheet belongs to the page it was opened on: a new page closes it (state reset per pathname).
  const [openOn, setOpenOn] = useState<string | null>(null);
  const nav = useMemo(() => shellNav(pathname), [pathname]);
  const openMore = useCallback(() => setOpenOn(pathname), [pathname]);
  const closeMore = useCallback(() => setOpenOn(null), []);
  return { ...nav, moreOpen: openOn === pathname, openMore, closeMore };
}
