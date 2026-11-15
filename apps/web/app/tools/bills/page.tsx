'use client';

// Bills calendar (/tools/bills): thin route. The view-model hook feeds the presentational screen.
// Due days and paydays live in this browser's store (`bills`); nothing here reaches a server.
import Link from 'next/link';
import { useBills } from '@/features/bills/model/useBills';
import { BillsScreen } from '@/features/bills/ui/BillsScreen';
import { BackToTools } from '../../_components/BackToTools';

export default function BillsPage() {
  return (
    <>
      <BackToTools />
      <BillsScreen vm={useBills()} Link={Link} />
    </>
  );
}
