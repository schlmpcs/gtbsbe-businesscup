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

/** What the Pro plan includes (the Plan on /plan and the wishlist), with a note on what the demo gates. */
export function IncludesList() {
  return (
    <Card title={copy.includes.title} className="w-full text-left">
      <ul className="flex flex-col gap-sm">
        {copy.includes.now.map((item) => (
          <li key={item} className="flex items-start gap-md">
            <Check />
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-md text-xs text-text-muted">{copy.includes.demoNote}</p>
    </Card>
  );
}
