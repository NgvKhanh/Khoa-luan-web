import type { CardStatus } from './card';

// Hop dong API /api/chat (CHATBOT_MODULE.md §12). Chi doc: tro ly khong tao / sua / xoa gi.

export type ChatScope =
  | { kind: 'MY' }
  | { kind: 'WORKSPACE'; workspaceId: string }
  | { kind: 'BOARD'; boardId: string };

export type ChatIntent =
  | 'MY_TASKS'
  | 'MY_PRIORITIES'
  | 'MEMBER_TASKS'
  | 'TEAM_SUMMARY'
  | 'TEAM_WORKLOAD'
  // Danh muc truy van (§18): bang, khong gian, thanh vien, dem the
  | 'MY_BOARDS'
  | 'MY_WORKSPACES'
  | 'MEMBER_LIST'
  | 'CARD_COUNTS'
  | 'UNSUPPORTED'
  | 'NONE';
export type ChatPeriod = 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'NEXT_WEEK' | 'LAST_WEEK' | 'NEXT_7_DAYS';
export type ChatFocus = 'OPEN' | 'OVERDUE' | 'DONE' | 'BLOCKED';
export type ChatParser = 'RULE' | 'LLM' | 'HYBRID';
export type ChatSlot = 'period' | 'focus' | 'member';
export type PriorityReason = 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'LATER';

export interface ChatStatus {
  llmAvailable: boolean;
}

export interface ChatCard {
  id: string;
  title: string;
  boardId: string;
  boardName: string;
  listName: string;
  status: CardStatus;
  dueDate: string | null;
  completedAt: string | null;
  overdue: boolean;
  checklistDone: number;
  checklistTotal: number;
  assignees: string[];
  /** Chi co o cau hoi "nen lam gi truoc". */
  reason?: PriorityReason;
}

export interface ChatFact {
  key: string;
  label: string;
  value: number;
}

export interface ChatSection {
  key: 'BLOCKED' | 'DONE' | 'OVERDUE';
  label: string;
  total: number;
  cards: ChatCard[];
}

export interface ChatWorkloadRow {
  userId: string;
  name: string;
  open: number;
  overdue: number;
  /** Chi truong nhom thay; null = chua khai (mac dinh). */
  capacity?: number | null;
  pausedUntil?: string | null;
}

export interface ChatClarifyOption {
  id: string;
  label: string;
  /** USER: chon nguoi; WORKSPACE: chon khong gian; TARGET: chon bang / khong gian khi trung ten (§18). */
  kind: 'USER' | 'WORKSPACE' | 'TARGET';
}

/** Bang ket qua chung cua cau tra loi danh muc (§18.5). Dong co `boardId` la lien ket mo bang. */
export interface ChatTableRow {
  cells: (string | number)[];
  boardId?: string;
}
export interface ChatTable {
  columns: string[];
  rows: ChatTableRow[];
  /** Tong so dong that (co the lon hon so dong hien khi bi cat). */
  total: number;
}

export interface ChatAnswer {
  kind: 'ANSWER' | 'CLARIFY' | 'UNSUPPORTED';
  text: string;
  scopeLabel: string;
  generatedAt: string;
  facts: ChatFact[];
  cards: ChatCard[];
  total: number;
  page: number;
  pageSize: number;
  sections: ChatSection[];
  rows?: ChatWorkloadRow[];
  /** Chi cau tra loi danh muc (§18). */
  table?: ChatTable;
  ignoredSlots: ChatSlot[];
  notes: string[];
  clarify?: { question: string; options: ChatClarifyOption[] };
  suggestions: string[];
  comment?: { text: string; source: 'AI' };
}

export interface ChatUnderstood {
  intent: ChatIntent;
  period: ChatPeriod | null;
  focus: ChatFocus | null;
  memberName: string | null;
  /** Cau danh muc: ten bang / khong gian DA nhan dien (khong phai chuoi go). */
  targetName?: string | null;
  columnName?: string | null;
  parser: ChatParser;
}

export interface ChatReply {
  conversationId: string;
  conversationReset?: true;
  understood: ChatUnderstood;
  answer: ChatAnswer;
}
