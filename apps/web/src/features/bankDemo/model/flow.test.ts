import { describe, expect, it } from 'vitest';
import { connectSteps, flowReducer, INITIAL_FLOW, type FlowAction, type FlowState } from './flow';
import type { DemoPreview } from './types';

const preview: DemoPreview = { text: 'csv', days: 120, accounts: [{ kind: 'card', payments: 1 }] };
const run = (...actions: FlowAction[]) => actions.reduce<FlowState>(flowReducer, INITIAL_FLOW);
const statuses = (s: FlowState) => connectSteps(s).map((x) => x.status);

describe('demo bank flow', () => {
  it('pick → sign in → connecting → connected once every step ran and the statement is read', () => {
    let s = run({ type: 'open' }, { type: 'pick', bankId: 'maple' });
    expect(s).toMatchObject({ step: 'signin', bankId: 'maple' });
    s = flowReducer(s, { type: 'connect' });
    expect(s).toMatchObject({ step: 'connecting', progress: 0, attempt: 1 });
    expect(statuses(s)).toEqual(['active', 'todo', 'todo']);
    s = flowReducer(s, { type: 'loaded', preview });
    expect(s.step).toBe('connecting');
    s = flowReducer(flowReducer(s, { type: 'tick' }), { type: 'tick' });
    expect(statuses(s)).toEqual(['done', 'done', 'active']);
    s = flowReducer(s, { type: 'tick' });
    expect(s.step).toBe('connected');
    expect(statuses(s)).toEqual(['done', 'done', 'done']);
  });

  it('a slow statement keeps the last step active; it lands as soon as it is read', () => {
    let s = run({ type: 'open' }, { type: 'pick', bankId: 'harbor' }, { type: 'connect' }, { type: 'tick' }, { type: 'tick' }, { type: 'tick' }, { type: 'tick' });
    expect(s).toMatchObject({ step: 'connecting', progress: 3 });
    expect(statuses(s)).toEqual(['done', 'done', 'active']);
    s = flowReducer(s, { type: 'loaded', preview });
    expect(s).toMatchObject({ step: 'connected', preview });
  });

  it('a failed download shows the error; retry downloads again', () => {
    let s = run({ type: 'open' }, { type: 'pick', bankId: 'harbor' }, { type: 'connect' }, { type: 'failed' });
    expect(s.step).toBe('error');
    s = flowReducer(s, { type: 'connect' });
    expect(s).toMatchObject({ step: 'connecting', attempt: 2, preview: null });
  });

  it('back walks one screen back; close resets; actions out of place are ignored', () => {
    const signin = run({ type: 'open' }, { type: 'search', query: 'har' }, { type: 'pick', bankId: 'harbor' });
    expect(signin.query).toBe('har');
    expect(flowReducer(signin, { type: 'back' })).toMatchObject({ step: 'pick', bankId: null });
    const connecting = flowReducer(signin, { type: 'connect' });
    expect(flowReducer(connecting, { type: 'back' })).toMatchObject({ step: 'signin', bankId: 'harbor', progress: 0 });
    expect(flowReducer(connecting, { type: 'close' })).toMatchObject({ step: 'closed', bankId: null, query: '' });
    expect(run({ type: 'tick' })).toEqual(INITIAL_FLOW);
    expect(run({ type: 'pick', bankId: 'maple' })).toEqual(INITIAL_FLOW);
    expect(flowReducer(signin, { type: 'loaded', preview }).preview).toBeNull();
    expect(flowReducer(signin, { type: 'search', query: 'x' }).query).toBe('har');
  });
});
