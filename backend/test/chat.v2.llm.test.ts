import { afterEach, describe, expect, it, vi } from 'vitest';
import { callChatModel } from '../src/modules/chat/v2/chat.v2.llm';
import { MODEL_SCHEMAS } from '../src/modules/chat/v2/chat.v2.registry';
const cfg = (suffix: string) => ({ baseUrl: `https://mock-${suffix}.invalid/v1`, apiKey: 'test-secret', model: 'test', timeoutMs: 500 });
const messages = [{ role: 'user' as const, content: 'Synthetic only' }];
afterEach(() => vi.unstubAllGlobals());
describe('chat v2 provider adapter', () => {
  it('supports multiple native calls and preserves thought signatures for the next round', async () => {
    const calls = ['query_tasks', 'aggregate_tasks'].map((name, i) => ({ id: `call-${i}`, type: 'function', function: { name, arguments: JSON.stringify(name === 'query_tasks' ? {} : { groupBy: 'ASSIGNEE' }) }, extra_content: { google: { thought_signature: 'provider-signature' } } }));
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { tool_calls: calls } }], usage: { prompt_tokens: 12, completion_tokens: 4 } })));
    vi.stubGlobal('fetch', fetchMock);
    const r = await callChatModel(messages, 500, cfg('native'), false);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('failed');
    expect(r.adapter).toBe('NATIVE'); expect(r.message.tool_calls).toEqual(calls);
    expect(r.calls.map((c) => c.name)).toEqual(['query_tasks', 'aggregate_tasks']);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools.map((t: { function: { name: string } }) => t.function.name)).toEqual(Object.keys(MODEL_SCHEMAS));
    expect(JSON.stringify(body)).not.toContain('test-secret');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-secret');
  });
  it('falls back after unsupported native schema and caches provider capability, not query data', async () => {
    const json = () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ calls: [{ name: 'query_tasks', arguments: { filters: { assignment: 'UNASSIGNED' } } }] }) } }] }));
    const mock = vi.fn().mockResolvedValueOnce(new Response('Schema rejected', { status: 400 })).mockImplementation(async () => json());
    vi.stubGlobal('fetch', mock);
    const c = cfg('fallback');
    const first = await callChatModel(messages, 500, c, false);
    expect(first.ok && first.adapter).toBe('JSON'); expect(mock).toHaveBeenCalledTimes(2);
    await callChatModel(messages, 500, c, false); expect(mock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(mock.mock.calls[2][1].body).response_format).toEqual({ type: 'json_object' });
  });
  it('fails safely on HTTP/invalid JSON/timeout and never returns provider text or keys', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('test-secret provider failure', { status: 500 })));
    expect(await callChatModel(messages, 500, cfg('http'), false)).toEqual({ ok: false, reason: 'HTTP' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('invalid json')));
    expect(await callChatModel(messages, 500, cfg('bad'), false)).toEqual({ ok: false, reason: 'INVALID' });
    vi.stubGlobal('fetch', (_url: string, opts: RequestInit) => new Promise((_resolve, reject) => opts.signal!.addEventListener('abort', () => reject(new Error('abort')))));
    expect(await callChatModel(messages, 20, cfg('timeout'), false)).toEqual({ ok: false, reason: 'TIMEOUT' });
  });
  it('rejects malformed tool arguments and returns DISABLED without network for absent key', async () => {
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ id: 'x', function: { name: 'query_tasks', arguments: '{oops' } }] } }] })));
    vi.stubGlobal('fetch', mock);
    expect(await callChatModel(messages, 500, cfg('args'), false)).toEqual({ ok: false, reason: 'INVALID' });
    expect(await callChatModel(messages, 500, { ...cfg('off'), apiKey: '' }, false)).toEqual({ ok: false, reason: 'DISABLED' });
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
