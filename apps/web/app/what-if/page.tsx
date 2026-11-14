'use client';

// What if? Two choices, two futures (`/what-if`): thin route. The view-model hook feeds the presentational screen.
import { useWhatIf } from '@/features/what-if/model/useWhatIf';
import { WhatIfScreen } from '@/features/what-if/ui/WhatIfScreen';

export default function WhatIfPage() {
  return <WhatIfScreen vm={useWhatIf()} />;
}
