import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../axios', () => ({ api: mocks }));

import {
  fetchAssignProfile,
  fetchAssignSuggestions,
  fetchAssignWeights,
  recordAssignOutcome,
  resetAssignWeights,
  saveAssignProfile,
  saveAssignWeights,
} from './assign';

// Lop goi API cua module goi y phan cong: dung DUONG DAN (ma hoa id), dung THAN yeu cau, tra `res.data.data`.
// Cac test giao dien mock lop nay nen day la cho DUY NHAT kiem tra no.

beforeEach(() => {
  vi.resetAllMocks();
});

describe('lib/api/assign', () => {
  it('fetchAssignSuggestions: GET /cards/:id/assignment-suggestions (id duoc ma hoa), tra data.data', async () => {
    const data = { runId: 'r1', candidates: [] };
    mocks.get.mockResolvedValue({ data: { data } });
    await expect(fetchAssignSuggestions('c1')).resolves.toBe(data);
    expect(mocks.get).toHaveBeenCalledWith('/cards/c1/assignment-suggestions');
    await fetchAssignSuggestions('a/b?c');
    expect(mocks.get).toHaveBeenLastCalledWith('/cards/a%2Fb%3Fc/assignment-suggestions');
  });

  it('recordAssignOutcome: POST /assignment/runs/:runId/outcome voi { chosenUserId }, tra data.data', async () => {
    const data = { runId: 'r1', accepted: true };
    mocks.post.mockResolvedValue({ data: { data } });
    await expect(recordAssignOutcome('r1', 'u1')).resolves.toBe(data);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledWith('/assignment/runs/r1/outcome', { chosenUserId: 'u1' });
    await recordAssignOutcome('r/1', 'u1');
    expect(mocks.post).toHaveBeenLastCalledWith('/assignment/runs/r%2F1/outcome', { chosenUserId: 'u1' });
  });

  it('fetchAssignWeights: GET /workspaces/:id/assignment-weights', async () => {
    const data = { weights: { experience: 0.45 } };
    mocks.get.mockResolvedValue({ data: { data } });
    await expect(fetchAssignWeights('w1')).resolves.toBe(data);
    expect(mocks.get).toHaveBeenCalledWith('/workspaces/w1/assignment-weights');
    await fetchAssignWeights('w/1');
    expect(mocks.get).toHaveBeenLastCalledWith('/workspaces/w%2F1/assignment-weights'); // id duoc ma hoa
  });

  it('saveAssignWeights: PUT cung duong dan, than la ba trong so (khong them khoa nao khac)', async () => {
    const data = { custom: true };
    mocks.put.mockResolvedValue({ data: { data } });
    const w = { experience: 0.5, reliability: 0.3, availability: 0.2 };
    await expect(saveAssignWeights('w1', w)).resolves.toBe(data);
    expect(mocks.put).toHaveBeenCalledWith('/workspaces/w1/assignment-weights', w);
    await saveAssignWeights('w/1', w);
    expect(mocks.put).toHaveBeenLastCalledWith('/workspaces/w%2F1/assignment-weights', w);
  });

  it('resetAssignWeights: DELETE cung duong dan, tra data.data', async () => {
    const data = { custom: false };
    mocks.delete.mockResolvedValue({ data: { data } });
    await expect(resetAssignWeights('w1')).resolves.toBe(data);
    expect(mocks.delete).toHaveBeenCalledWith('/workspaces/w1/assignment-weights');
    await resetAssignWeights('w/1');
    expect(mocks.delete).toHaveBeenLastCalledWith('/workspaces/w%2F1/assignment-weights');
  });

  it('fetchAssignProfile / saveAssignProfile: /workspaces/:id/assignment-profile, than { maxParallelCards, pausedUntil }', async () => {
    const data = { maxParallelCards: 5 };
    mocks.get.mockResolvedValue({ data: { data } });
    await expect(fetchAssignProfile('w/1')).resolves.toBe(data);
    expect(mocks.get).toHaveBeenCalledWith('/workspaces/w%2F1/assignment-profile');

    mocks.put.mockResolvedValue({ data: { data: { maxParallelCards: 3 } } });
    const input = { maxParallelCards: 3, pausedUntil: '2026-10-05T16:59:59.999Z' };
    await expect(saveAssignProfile('w1', input)).resolves.toEqual({ maxParallelCards: 3 });
    expect(mocks.put).toHaveBeenCalledWith('/workspaces/w1/assignment-profile', input);
    await saveAssignProfile('w1', { maxParallelCards: 5, pausedUntil: null });
    expect(mocks.put).toHaveBeenLastCalledWith('/workspaces/w1/assignment-profile', { maxParallelCards: 5, pausedUntil: null });
  });

  it('loi cua may chu duoc day nguyen (khong nuot): giao dien tu lay thong diep', async () => {
    const err = Object.assign(new Error('429'), { response: { status: 429 } });
    mocks.get.mockRejectedValue(err);
    await expect(fetchAssignSuggestions('c1')).rejects.toBe(err);
    mocks.post.mockRejectedValue(err);
    await expect(recordAssignOutcome('r1', 'u1')).rejects.toBe(err);
  });
});
