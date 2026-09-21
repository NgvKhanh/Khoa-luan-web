import { api } from '../axios';
import type {
  AssignOutcomeResult,
  AssignProfile,
  AssignProfileInput,
  AssignSuggestionResult,
  AssignWeights,
  AssignWeightsView,
} from '../../types/assign';

// Lop goi API cua module goi y phan cong (ASSIGN_MODULE.md §10). Moi ham tra `res.data.data`.

// GET /api/cards/:cardId/assignment-suggestions - xep hang nhung nguoi co the nhan the.
// LUU Y: co ghi 1 dong nhat ky o server va co gioi han toc do (60 luot / 10 phut) -> chi goi khi nguoi dung MO o Thanh vien.
export async function fetchAssignSuggestions(cardId: string): Promise<AssignSuggestionResult> {
  const res = await api.get<{ data: AssignSuggestionResult }>(
    `/cards/${encodeURIComponent(cardId)}/assignment-suggestions`
  );
  return res.data.data;
}

// POST /api/assignment/runs/:runId/outcome - ghi nguoi thuc su duoc giao (nguoi do phai DANG o trong the).
export async function recordAssignOutcome(
  runId: string,
  chosenUserId: string
): Promise<AssignOutcomeResult> {
  const res = await api.post<{ data: AssignOutcomeResult }>(
    `/assignment/runs/${encodeURIComponent(runId)}/outcome`,
    { chosenUserId }
  );
  return res.data.data;
}

const weightsUrl = (workspaceId: string) =>
  `/workspaces/${encodeURIComponent(workspaceId)}/assignment-weights`;
const profileUrl = (workspaceId: string) =>
  `/workspaces/${encodeURIComponent(workspaceId)}/assignment-profile`;

// GET .../assignment-weights - moi thanh vien khong gian xem duoc (kem lich su doi va so lieu phan hoi).
export async function fetchAssignWeights(workspaceId: string): Promise<AssignWeightsView> {
  const res = await api.get<{ data: AssignWeightsView }>(weightsUrl(workspaceId));
  return res.data.data;
}

// PUT .../assignment-weights - chi OWNER/ADMIN. Moi so trong [0,05; 0,70], tong = 1 (server tu choi neu sai).
export async function saveAssignWeights(
  workspaceId: string,
  weights: AssignWeights
): Promise<AssignWeightsView> {
  const res = await api.put<{ data: AssignWeightsView }>(weightsUrl(workspaceId), weights);
  return res.data.data;
}

// DELETE .../assignment-weights - dat lai 45/30/25 va dua so luot phan hoi ve 0 (chi OWNER/ADMIN).
export async function resetAssignWeights(workspaceId: string): Promise<AssignWeightsView> {
  const res = await api.delete<{ data: AssignWeightsView }>(weightsUrl(workspaceId));
  return res.data.data;
}

// GET .../assignment-profile - ho so lam viec cua CHINH nguoi goi trong khong gian.
export async function fetchAssignProfile(workspaceId: string): Promise<AssignProfile> {
  const res = await api.get<{ data: AssignProfile }>(profileUrl(workspaceId));
  return res.data.data;
}

// PUT .../assignment-profile - so the song song toi da (1-30) va tam nghi den (ISO co Z, hoac null).
export async function saveAssignProfile(
  workspaceId: string,
  input: AssignProfileInput
): Promise<AssignProfile> {
  const res = await api.put<{ data: AssignProfile }>(profileUrl(workspaceId), input);
  return res.data.data;
}
