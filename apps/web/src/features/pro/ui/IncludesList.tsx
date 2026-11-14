import { pro as copy } from '@/copy';
import { Card } from '@/ui-kit';

function Check() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-xl shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary"
    >
      ✓
    </span>
  );
}

/** What Pro unlocks in this build, and nothing more (no "coming soon" list, so nothing is oversold). */
export function IncludesList() {
  return (
    <Card title={copy.includes.title} className="w-full text-left">
      <ul className="flex flex-col gap-sm">
        {copy.includes.now.map((item) => (
          <li key={item} className="flex items-center gap-md">
            <Check />
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}
