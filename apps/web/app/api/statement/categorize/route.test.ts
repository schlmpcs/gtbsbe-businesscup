import { readStatementSampleCsv } from '@lifeguessr/data/fixtures/node';
import { CategoryTotalsSchema, COST_CATEGORIES, type StatementItem } from '@lifeguessr/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readStatementCsv, toStatementItems } from '@/lib/statement/read';
import { aiRateLimiter, AI_RATE_LIMITS } from '@/server/ai/http';
import { postRequest, reply } from '@/server/ai/testUtils';
import { AI_CHUNK_LABELS, SYSTEM } from '@/server/statement/categorize';
import { FOLLOW_UP_SYSTEM } from '@/server/statement/followUps';
import { POST } from './route';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create };
  },
}));

const post = (body: unknown, headers?: Record<string, string>) => POST(postRequest('/api/statement/categorize', body, headers));
const sampleItems = (): StatementItem[] => toStatementItems(readStatementCsv(readStatementSampleCsv()).transactions);
type CreateParams = { system: string; messages: { content: string }[] };
/** The calls that sorted labels (the follow-up wording is a separate call, after them). */
const labelCalls = () => (create.mock.calls as [CreateParams][]).filter(([p]) => p.system === SYSTEM);
const wordingCalls = () => (create.mock.calls as [CreateParams][]).filter(([p]) => p.system === FOLLOW_UP_SYSTEM);
const sentContent = (call: number) => labelCalls()[call]![0].messages[0].content;

/** The labels of one LLM call: `id \t direction \t label` lines inside <labels>. */
function sentLabels(call: number) {
  const block = /<labels>\n([\s\S]*?)\n<\/labels>/.exec(sentContent(call))![1]!;
  return block.split('\n').map((line) => {
    const [id, direction, label] = line.split('\t');
    return { id: Number(id), direction: direction as 'in' | 'out', label: label! };
  });
}

/** Answers every label of a call with `pick`. */
function answerAll(call: number, pick: (l: { direction: string; label: string }) => { class: string; oneOff?: boolean }) {
  return reply(JSON.stringify({ labels: sentLabels(call).map((l) => ({ id: l.id, oneOff: false, ...pick(l) })) }));
}

beforeEach(() => {
  create.mockReset();
  aiRateLimiter.reset();
  vi.stubEnv('ANTHROPIC_API_KEY', '');
  vi.stubEnv('ANTHROPIC_MODEL', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/statement/categorize without an API key (keyword rules)', () => {
  it('turns the sample statement into CategoryTotals per month, summed in code', async () => {
    const res = await post({ items: sampleItems() });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.categorizedBy).toBe('rules');
    expect(create).not.toHaveBeenCalled();

    const months = body.months as { month: string; totals: Record<string, number>; oneOffs: { label: string; amount: number }[]; detectedPay?: number }[];
    expect(months.map((m) => m.month)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    for (const m of months) {
      expect(CategoryTotalsSchema.safeParse(m).success).toBe(true);
      expect(Object.keys(m.totals).sort()).toEqual([...COST_CATEGORIES].sort());
    }
    const oct = months[3]!;
    // Hand-checked against statement.sample.csv (October 2026).
    expect(oct.totals).toEqual({
      rentUtilities: 1955.37, // rent 1,720 + TXU 132.57 + Atmos 32.80 + Spectrum 70
      car: 287.18,
      childcare: 0,
      groceries: 509.26,
      eatingOut: 227.67,
      subscriptions: 57.96,
      debtPayments: 662, // Capital One 250 + Toyota 412
      other: 248.57,     // includes the Zelle payment to a person; not the $200 transfer to savings
    });
    expect(oct.detectedPay).toBe(4800); // two paychecks; the $32.50 Venmo from a friend is not pay
    expect(months[0]!.detectedPay).toBe(7200); // July had three biweekly paychecks

    // One-offs are listed and kept out of the totals.
    expect(months[1]!.oneOffs).toEqual([{ label: 'AMAZON PRIME*[ref] Amzn.com/bill WA', amount: 139 }]);
    expect(months[1]!.totals.subscriptions).toBe(57.96);
    expect(months[2]!.oneOffs).toEqual([{ label: 'DFW ANIMAL HOSPITAL DALLAS TX', amount: 642.8 }]);
    expect(months[2]!.totals.other).toBe(196.39);
  });

  it('masks labels again on the server and never echoes a name back', async () => {
    const res = await post({ items: [
      { label: 'Zelle payment to Tom Becker 4111111111111111', amount: 2000, month: '2026-10', day: 1 },
      { label: 'Zelle payment to Tom Becker', amount: 2000, month: '2026-11', day: 1 },
      { label: 'VET EMERGENCY CLINIC', amount: 900, month: '2026-11', day: 2 },
    ] });
    const text = await res.text();
    expect(text).not.toMatch(/Tom|Becker|4111/);
    expect(JSON.parse(text).months[1].oneOffs).toEqual([{ label: 'VET EMERGENCY CLINIC', amount: 900 }]);
  });
});

/** The items of a follow-up wording call: `id \t kind \t subject` lines inside <items>. */
function sentItems(params: CreateParams) {
  const block = /<items>\n([\s\S]*?)\n<\/items>/.exec(params.messages[0]!.content)![1]!;
  return block.split('\n').map((line) => {
    const [id, kind, subject] = line.split('\t');
    return { id: Number(id), kind: kind!, subject: subject! };
  });
}

describe('POST /api/statement/categorize with the AI', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    // Unless a test says otherwise, the wording call gets an answer that words nothing (the
    // questions then keep the template), so the label tests below count only label calls.
    create.mockImplementation(async (params: CreateParams) =>
      reply(JSON.stringify(params.system === FOLLOW_UP_SYSTEM ? { questions: [] } : { labels: [] })));
  });

  it('sends only distinct masked labels with their direction: no amounts, dates or names', async () => {
    create.mockImplementationOnce(async () => answerAll(0, (l) => (l.direction === 'in' ? { class: 'transfer' } : { class: 'other' })));
    const items = sampleItems();
    await post({ items });
    expect(labelCalls()).toHaveLength(1);
    const params = create.mock.calls[0]![0];
    expect(params.model).toBe('claude-haiku-5-5');
    expect(params.output_config.format.type).toBe('json_schema');
    const content = sentContent(0);
    expect(content).not.toMatch(/\d+\.\d\d|2026-|1720|Tom|Becker|Priya|Shah|Maria|Lopez/);
    const labels = sentLabels(0);
    expect(new Set(labels.map((l) => `${l.direction} ${l.label}`)).size).toBe(labels.length);
    expect(labels.length).toBeLessThan(items.length);
    expect(labels).toContainEqual(expect.objectContaining({ direction: 'out', label: 'Zelle to [name]' }));
  });

  it('uses the AI classes, and the code still does every sum', async () => {
    create.mockImplementationOnce(async () => answerAll(0, (l) => {
      if (l.direction === 'in') return { class: /PAYROLL/.test(l.label) ? 'pay' : 'transfer' };
      if (/TARGET/.test(l.label)) return { class: 'groceries' };
      if (/^Transfer to savings$/.test(l.label)) return { class: 'transfer' };
      return { class: 'other', oneOff: /ANIMAL HOSPITAL/.test(l.label) };
    }));
    const body = await (await post({ items: sampleItems() })).json();
    expect(body.categorizedBy).toBe('ai');
    const oct = body.months[3];
    expect(oct.totals.groceries).toBe(30.74); // Target only (10/27)
    expect(oct.detectedPay).toBe(4800);
    expect(body.months[2].oneOffs).toEqual([{ label: 'DFW ANIMAL HOSPITAL DALLAS TX', amount: 642.8 }]);
  });

  it('retries once with the problems, then fills what is still missing with the rules', async () => {
    create
      .mockImplementationOnce(async () => reply(JSON.stringify({ labels: [{ id: 1, class: 'groceries', oneOff: false }, { id: 2, class: 'pay', oneOff: false }] })))
      .mockImplementationOnce(async () => reply(JSON.stringify({ labels: [{ id: 1, class: 'groceries', oneOff: false }] })));
    const body = await (await post({ items: [
      { label: 'CORNER STORE', amount: 20, month: '2026-10', day: 1 },
      { label: 'KROGER', amount: 30, month: '2026-10', day: 2 },
    ] })).json();
    expect(labelCalls()).toHaveLength(2);
    expect(sentContent(1)).toContain('id 2: "pay" is only for "in" lines');
    expect(body.categorizedBy).toBe('mixed');
    // CORNER STORE from the AI (groceries); KROGER by the rules (groceries): the AI never gave it a valid class.
    expect(body.months[0].totals.groceries).toBe(50);
  });

  it('falls back to the rules when the answer is never valid JSON', async () => {
    create.mockResolvedValue(reply('not json'));
    const body = await (await post({ items: sampleItems() })).json();
    expect(labelCalls()).toHaveLength(2);
    expect(body.categorizedBy).toBe('rules');
    // The wording got the same broken answer: the questions are still asked, in the template's words.
    expect(body.followUps.length).toBeGreaterThan(0);
    for (const f of body.followUps) expect(f).not.toHaveProperty('question');
    expect(body.months[3].totals.rentUtilities).toBe(1955.37);
  });

  it('falls back to the rules when the provider fails or refuses', async () => {
    create.mockRejectedValueOnce(new Error('overloaded'));
    expect((await (await post({ items: sampleItems() })).json()).categorizedBy).toBe('rules');
    create.mockResolvedValueOnce(reply('', 'refusal'));
    expect((await (await post({ items: sampleItems() })).json()).categorizedBy).toBe('rules');
  });

  it(`splits more than ${AI_CHUNK_LABELS} distinct labels over several calls`, async () => {
    create.mockImplementation(async (params: CreateParams) => {
      if (params.system === FOLLOW_UP_SYSTEM) return reply(JSON.stringify({ questions: [] }));
      return answerAll(labelCalls().length - 1, () => ({ class: 'other' }));
    });
    const items = Array.from({ length: AI_CHUNK_LABELS + 5 }, (_, i) => ({
      label: `SHOP ${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`, amount: 1, month: '2026-10', day: 1,
    }));
    const body = await (await post({ items })).json();
    expect(labelCalls()).toHaveLength(2);
    expect(sentLabels(0)).toHaveLength(AI_CHUNK_LABELS);
    expect(sentLabels(1)).toHaveLength(5);
    expect(body.categorizedBy).toBe('ai');
    expect(body.months[0].totals.other).toBe(AI_CHUNK_LABELS + 5);
  });
});

describe('POST /api/statement/categorize follow-up questions (JF6)', () => {
  it('without an API key: finds them in code, with amounts, and leaves the wording to the screen', async () => {
    const items = sampleItems();
    const body = await (await post({ items })).json();
    expect(create).not.toHaveBeenCalled();
    // The sample, sorted by the keyword rules: one $100 cash withdrawal, and CVS and Target in 'other'.
    // Amounts are per month over July to October (November stops on the 12th, so it isn't a full month).
    expect(body.followUps).toEqual([
      { id: 'cash:cash', kind: 'cash', key: 'cash', label: 'ATM WITHDRAWAL #/# GREENVILLE AVE', monthly: 25 },
      expect.objectContaining({ id: 'merchant:CVS PHARMACY DALLAS TX', kind: 'merchant', label: 'CVS/PHARMACY # DALLAS TX' }),
      expect.objectContaining({ id: 'merchant:TARGET DALLAS TX', kind: 'merchant', label: 'TARGET # DALLAS TX' }),
    ]);
    // And how each line was sorted, in request order, so the browser can re-sort an answered merchant.
    expect(body.lines).toHaveLength(items.length);
    const at = (re: RegExp) => body.lines[items.findIndex((i) => re.test(i.label))];
    expect(at(/^SPOTIFY/)).toEqual({ cls: 'subscriptions', oneOffHint: false });
    expect(at(/PAYROLL/)).toEqual({ cls: 'pay', oneOffHint: false });
    expect(at(/ANIMAL HOSPITAL/)).toEqual({ cls: 'other', oneOffHint: true });
  });

  it('with the AI: sends only the kind and the masked label, and keeps a question only if it has no number', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    create.mockImplementation(async (params: CreateParams) => {
      if (params.system !== FOLLOW_UP_SYSTEM) return reply(JSON.stringify({ labels: [] })); // labels: the rules sort them
      const [cash, cvs, target] = sentItems(params);
      return reply(JSON.stringify({ questions: [
        { id: cash!.id, text: 'What do you usually spend your cash on?' },
        { id: cvs!.id, text: 'You spend $54 at CVS. What is it for?' },       // a number: dropped
        { id: target!.id, text: 'What do you mostly buy at Target?' },
      ] }));
    });
    const body = await (await post({ items: sampleItems() })).json();
    const [first, retry] = wordingCalls();
    expect(sentItems(first![0])).toEqual([
      { id: 1, kind: 'cash', subject: 'ATM WITHDRAWAL #/# GREENVILLE AVE' },
      { id: 2, kind: 'merchant', subject: 'CVS/PHARMACY # DALLAS TX' },
      { id: 3, kind: 'merchant', subject: 'TARGET # DALLAS TX' },
    ]);
    expect(first![0].messages[0]!.content).not.toMatch(/\d+\.\d\d|\$|2026|per month/);
    // One retry with the problem listed; it gave the same answer, so CVS keeps the template.
    expect(retry![0].messages[0]!.content).toContain('id 2: the question contains a number');
    expect(body.followUps.map((f: { question?: string }) => f.question)).toEqual([
      'What do you usually spend your cash on?', undefined, 'What do you mostly buy at Target?',
    ]);
  });

  it('asks nothing when every line has a clear category', async () => {
    const body = await (await post({ items: [
      { label: 'OAKWOOD APTS', amount: 1720, month: '2026-10', day: 1 },
      { label: 'KROGER #', amount: 400, month: '2026-10', day: 30 },
    ] })).json();
    expect(body.followUps).toEqual([]);
  });
});

describe('POST /api/statement/categorize input checks', () => {
  const item = { label: 'KROGER', amount: 30, month: '2026-10', day: 2 };

  it('rejects a bad body with 400', async () => {
    for (const body of ['nope', {}, { items: [] }, { items: [{ ...item, day: 31, month: '2026-11' }] }, { items: [{ ...item, amount: 'x' }] }]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('bad_request');
    }
  });

  it('rejects a body over the size cap with 413', async () => {
    const res = await post({ items: [item], pad: 'x'.repeat(1_600_000) });
    expect(res.status).toBe(413);
  });

  it('rate-limits per anonymous id', async () => {
    const headers = { 'x-anon-id': 'anon-12345678' };
    for (let i = 0; i < AI_RATE_LIMITS.perAnonId.limit; i++) expect((await post({ items: [item] }, headers)).status).toBe(200);
    const res = await post({ items: [item] }, headers);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
  });
});
