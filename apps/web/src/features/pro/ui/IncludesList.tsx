import { useId } from 'react';
import { pro as copy } from '@/copy';

function Check() {
  return (
    <span aria-hidden="true" className="font-bold">
      ✓
    </span>
  );
}

/** What Pro unlocks in this build, then what is planned (dimmer, so nothing is oversold). White on the orange band. */
export function IncludesList() {
  const headingId = useId();
  const comingId = useId();
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
      <h3 id={comingId} className="text-sm font-bold uppercase tracking-wide">
        {copy.includes.comingTitle}
      </h3>
      <ul aria-labelledby={comingId} className="grid gap-x-xl gap-y-xs text-on-primary/80 sm:grid-cols-2">
        {copy.includes.coming.map((item) => (
          <li key={item} className="flex gap-sm">
            <Check />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
