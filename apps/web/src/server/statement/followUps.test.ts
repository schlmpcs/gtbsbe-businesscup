import type { StatementFollowUp } from '@lifeguessr/types';
import { describe, expect, it, vi } from 'vitest';
import type { LlmClient } from '../ai/client';
import { reply } from '../ai/testUtils';
import { questionProblem, wordFollowUps } from './followUps';

const followUps: StatementFollowUp[] = [
  { id: 'missing:groceries', kind: 'missing', key: 'groceries', category: 'groceries', monthly: 0 },
  { id: 'merchant:ZELLE TO', kind: 'merchant', key: 'ZELLE TO', label: 'Zelle to [name]', monthly: 45 },
];
const clientAnswering = (...answers: unknown[]) => {
  const create = vi.fn();
  for (const a of answers) {
    if (a instanceof Error) create.mockRejectedValueOnce(a);
    else create.mockResolvedValueOnce(a);
  }
  return { client: { messages: { create } } as unknown as LlmClient, create };
};

describe('questionProblem', () => {
  it('accepts a short question with no numbers and no masks', () => {
    expect(questionProblem('What do you mostly buy at Target?')).toBeNull();
    expect(questionProblem('  Do you pay for groceries from another card?  ')).toBeNull();
  });
  it.each([
    ['Target?', 'is too short'],
    ['What do you mostly buy at Target', 'does not end with a question mark'],
    ['You spent $54 at CVS: what for?', 'contains a number'],
    ['What are your two Zelle payments for?', 'contains a number'],
    ['What do you pay [name] for?', 'repeats a mask'],
    [`${'Why '.repeat(45)}?`, 'is longer than 160 characters'],
  ])('rejects %j: %s', (text, problem) => {
    expect(questionProblem(text)).toBe(problem);
  });
});

describe('wordFollowUps', () => {
  it('without a model, or with nothing to ask, sends nothing', async () => {
    expect(await wordFollowUps(followUps, null)).toEqual(followUps);
    const { client, create } = clientAnswering();
    expect(await wordFollowUps([], client)).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it('names a missing category in words and never sends an amount', async () => {
    const { client, create } = clientAnswering(reply(JSON.stringify({ questions: [
      { id: 1, text: 'Do you buy groceries with another card or cash?' },
      { id: 2, text: 'What are your Zelle payments to someone usually for?' },
    ] })));
    const out = await wordFollowUps(followUps, client);
    expect(create).toHaveBeenCalledOnce();
    const content = create.mock.calls[0]![0].messages[0].content as string;
    expect(content).toContain('1\tmissing\tgroceries');
    expect(content).toContain('2\tmerchant\tZelle to [name]');
    expect(content).not.toContain('45');
    expect(out.map((f) => f.question)).toEqual([
      'Do you buy groceries with another card or cash?', 'What are your Zelle payments to someone usually for?',
    ]);
    expect(out.map(({ question: _q, ...rest }) => rest)).toEqual(followUps); // nothing else changes
  });

  it('never throws: a provider error, a refusal or a broken answer leave the template', async () => {
    for (const answer of [new Error('overloaded'), reply('', 'refusal'), { content: null }]) {
      const { client } = clientAnswering(answer, answer);
      expect(await wordFollowUps(followUps, client)).toEqual(followUps);
    }
  });
});
