'use client';

// The 2-minute tour sheet, mounted once in the layout. The site header and S1 open it (useTourOpen).
import Link from 'next/link';
import { useTour, useTourOpen } from '@/features/tour/model/useTour';
import { TourSheet, TourSteps } from '@/features/tour/ui/TourSheet';

function TourContent({ onFollow }: { onFollow: () => void }) {
  const vm = useTour();
  return <TourSteps vm={vm} Link={Link} onFollow={onFollow} />;
}

export function Tour() {
  const { open, close } = useTourOpen();
  return (
    <TourSheet open={open} onClose={close}>
      {/* Mounted only while open: the content asks the server for the Pro status (the promo code). */}
      {open && <TourContent onFollow={close} />}
    </TourSheet>
  );
}
