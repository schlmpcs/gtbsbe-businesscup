import { expect, it, vi } from 'vitest';
import type { LlmClient } from '../ai/client';
import { reply } from '../ai/testUtils';
import { categorizeStatement } from './categorize';

it.each([
  'Online Payment #1234 To John Power 10/01',
  'BILL PAY TO Jane Water',
  'CHECK #1234 PAYEE Sam Grill',
  'Deposit from Mary Kitchen',
  'ACH CREDIT Pat Pub',
])('masks a raw counterparty again before calling the model: %s', async (label) => {
  const create = vi.fn().mockResolvedValue(reply(JSON.stringify({ labels: [{ id: 1, class: 'other', oneOff: false }] })));
  const client = { messages: { create } } as unknown as LlmClient;
  const result = await categorizeStatement([{ label, amount: 25, month: '2026-10', day: 1 }], client);
  expect(create).toHaveBeenCalledOnce();
  const prompt = create.mock.calls[0]![0].messages[0].content;
  expect(prompt).toContain('[name]');
  expect(prompt).not.toMatch(/John Power|Jane Water|Sam Grill|Mary Kitchen|Pat Pub|1234|10\/01/);
  expect(JSON.stringify(result)).not.toMatch(/John Power|Jane Water|Sam Grill|Mary Kitchen|Pat Pub/);
});
