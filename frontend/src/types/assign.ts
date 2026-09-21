// Kieu du lieu cua module goi y phan cong (khop dung phan hoi cua backend, xem ASSIGN_MODULE.md §10).
// Thoi diem di qua JSON nen la chuoi ISO.

export type AssignFlag = 'NO_HISTORY' | 'NO_SIMILAR' | 'OVERLOADED' | 'PAUSED' | 'NO_DATA';
export type AssignConfidenceLevel = 'THIN' | 'FAIR' | 'GOOD';
export type AssignEvidenceOutcome = 'ON_TIME' | 'ON_TIME_REOPENED' | 'LATE' | 'NO_DUE';

/** Ba thanh phan cua diem: kinh nghiem, do tin cay, kha dung. */
export interface AssignWeights {
  experience: number;
  reliability: number;
  availability: number;
}

export type AssignWeightKey = keyof AssignWeights;

export interface AssignComponent {
  /** Gia tri THO trong [0,1]; null = chua co du lieu. */
  value: number | null;
  weight: number;
  /** Gia tri da chuan hoa trong nhom ung vien (dung de cong vao diem). */
  scaled: number | null;
  share: number;
}

export interface AssignEvidence {
  cardId: string;
  /** null = the thuoc bang RIENG TU ma nguoi hoi khong xem duoc. */
  title: string | null;
  sim: number;
  weight: number;
  outcome: AssignEvidenceOutcome;
  completedAt: string;
  dueDate: string | null;
}

export interface AssignSuggestion {
  rank: number;
  user: { id: string; name: string; avatarUrl: string | null };
  /** Diem TUONG DOI trong nhom ung vien cua the nay (0-100); null = khong du du lieu. */
  score: number | null;
  rawScore: number | null;
  confidence: number;
  confidenceLevel: AssignConfidenceLevel;
  components: Record<AssignWeightKey, AssignComponent>;
  fit: number;
  evidenceMass: number;
  load: number;
  capacity: number;
  flags: AssignFlag[];
  assigned: boolean;
  evidence: AssignEvidence[];
}

export interface AssignSuggestionResult {
  /** null = khong co ung vien nao (khong ghi nhat ky). */
  runId: string | null;
  card: { id: string; title: string; boardId: string; workspaceId: string };
  algorithmVersion: string;
  generatedAt: string;
  weights: AssignWeights & { custom: boolean };
  groupOnTimeRate: number | null;
  candidateCount: number;
  candidates: AssignSuggestion[];
}

export type AssignLearnReason =
  | 'LEARNED'
  | 'NO_TOP'
  | 'ACCEPTED'
  | 'TOO_EARLY'
  | 'NOT_CANDIDATE'
  | 'MISSING_COMPONENT'
  | 'TIE'
  | 'NO_CHANGE';

export interface AssignOutcomeResult {
  runId: string;
  chosenUserId: string;
  topUserId: string | null;
  accepted: boolean;
  decidedAt: string;
  learned: boolean;
  /** Chi co o lan ghi dau tien. */
  learning?: { learned: boolean; reason: AssignLearnReason };
  feedbackCount?: number;
  weights?: AssignWeights;
}

export interface AssignWeightHistoryEntry {
  id: string;
  at: string;
  weights: AssignWeights;
  feedbackCount: number;
  /** LEARNED = do he thong tu hoc tu mot luot phan hoi; MANUAL = chinh tay hoac dat lai. */
  source: 'LEARNED' | 'MANUAL';
  runId: string | null;
}

export interface AssignWeightsView {
  workspaceId: string;
  weights: AssignWeights;
  defaults: AssignWeights;
  custom: boolean;
  feedbackCount: number;
  updatedAt: string | null;
  learning: { minFeedback: number; eta: number; active: boolean };
  /** Luot da co ket qua / trong do giao dung nguoi xep dau. */
  feedback: { decided: number; accepted: number };
  history: AssignWeightHistoryEntry[];
}

export interface AssignProfile {
  workspaceId: string;
  maxParallelCards: number;
  defaultMaxParallelCards: number;
  pausedUntil: string | null;
  isDefault: boolean;
  updatedAt: string | null;
}

export interface AssignProfileInput {
  maxParallelCards: number;
  /** ISO co Z, hoac null de bo tam nghi. */
  pausedUntil: string | null;
}
