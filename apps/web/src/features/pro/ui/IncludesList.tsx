import { useId } from 'react';
import { pro as copy } from '@/copy';

function Check() {
  return (
    <span aria-hidden="true" className="font-bold">
      ✓
    </span>
  );
}

/** What Pro unlocks in this build, and nothing else (no "coming soon" list). White on the orange band. */
export function IncludesList() {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex w-full flex-col items-center gap-md text-left">
      <h2 id={headingId} className="text-xl font-bold">
        {copy.includes.title}
      </h2>
      <ul className="flex flex-col gap-xs font-semibold">
        {copy.includes.now.map((item) => (
          <li key={item} className="flex gap-sm">
            <Check />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
