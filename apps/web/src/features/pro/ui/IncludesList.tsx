import { pro as copy } from '@/copy';
import { Card } from '@/ui-kit';

/** What Pro unlocks in this build, then what is planned (muted, so nothing is oversold). */
export function IncludesList() {
  return (
    <Card title={copy.includes.title} headingLevel={2}>
      <ul className="flex list-disc flex-col gap-xs pl-lg">
        {copy.includes.now.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h3 className="mt-lg text-sm font-semibold text-text-muted">{copy.includes.comingTitle}</h3>
      <ul className="mt-xs flex list-disc flex-col gap-xs pl-lg text-sm text-text-muted">
        {copy.includes.coming.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Card>
  );
}
