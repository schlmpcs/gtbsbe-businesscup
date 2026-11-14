'use client';

// Site header from the Figma screens: the house logo, the main links and "Go Pro".
// The links hide on narrow phones (the logo and Go Pro stay) so nothing scrolls sideways.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { common, tour } from '@/copy';
import { useTourOpen } from '@/features/tour/model/useTour';
import { buttonClassName, cx } from '@/ui-kit';

const t = common.siteNav;

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const { show: showTour } = useTourOpen();
  return (
    <header className="mx-auto flex w-full max-w-(--container-7xl) items-center gap-sm px-lg pt-lg sm:gap-lg">
      <Link href="/" aria-label={t.home} className="flex shrink-0 items-center gap-sm">
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
          <path d="M13 1.5L24.5 10V24.5H1.5V10Z" className="fill-primary" />
          <path
            d="M10.2 11.2c0-1.7 1.3-2.9 3-2.9s3 1.1 3 2.7c0 1.3-.8 2-1.7 2.5-.7.4-.9.7-.9 1.3v.5h-1.9v-.7c0-1.1.5-1.7 1.4-2.2.7-.4 1.1-.7 1.1-1.3 0-.6-.5-1-1.1-1s-1.1.4-1.1 1.1Z"
            className="fill-on-primary"
          />
          <circle cx="12.7" cy="18.6" r="1.2" className="fill-on-primary" />
        </svg>
        <span className="font-display text-xl font-extrabold lowercase">{common.appName}</span>
      </Link>
      <nav aria-label={t.label} className="ml-auto hidden md:block">
        <ul className="flex items-center gap-xl text-sm">
          {t.links.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? 'page' : undefined}
                  className={cx('hover:text-text', active ? 'font-semibold text-text' : 'text-text-muted')}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <button
        type="button"
        onClick={showTour}
        data-testid="tour-open"
        className={cx(buttonClassName({ variant: 'ghost', size: 'sm' }), 'ml-auto whitespace-nowrap md:ml-0')}
      >
        {tour.open}
      </button>
      <Link href="/pro" className={cx(buttonClassName({ variant: 'secondary', size: 'sm' }), 'whitespace-nowrap')}>
        {t.pro}
      </Link>
    </header>
  );
}
