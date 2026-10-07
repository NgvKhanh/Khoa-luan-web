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
  engine?: 'legacy' | 'v2';
}

export interface ChatConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  turnCount: number;
}
export interface ChatConversationList {
  conversations: ChatConversationSummary[];
  page: number;
  hasMore: boolean;
}
export interface ChatConversationHistory {
  conversation: { id: string; title: string; updatedAt: string };
  turns: { id: number; question: string; reply: ChatReply | null; error: string | null; createdAt: string }[];
  hasMore: boolean;
  before: number | null;
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
  blocks?: ChatV2Block[];
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
  summary?: string;
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
  version?: 'v2';
  mode?: 'AI' | 'BASIC';
  conversationId: string;
  conversationReset?: true;
  understood: ChatUnderstood;
  answer: ChatAnswer;
}

export interface ChatV2Task {
  id: string; title: string; status: CardStatus; isDone: boolean;
  boardId: string; boardName: string; columnId: string; columnName: string;
  dueDate: string | null; completedAt: string | null; createdAt: string; overdue: boolean;
  assignees: { id: string; name: string }[];
}
export interface ChatV2Event {
  id: string; boardId: string; cardId: string | null; cardTitle: string | null; redacted: boolean;
  type: string; createdAt: string; actor: { id: string; name: string } | null;
  data: Record<string, string | null>;
}
export interface ChatV2Source {
  id: string; generatedAt: string; scope: ChatScope; scopeLabel: string;
  appliedInput: Record<string, unknown>; ranges: { from: string; to: string }[];
}
interface V2Page { total: number; page: number; pageSize: number; hasMore: boolean }
interface BlockBase { id: string; title: string; status: 'OK'; source: ChatV2Source; pagination: { page: number; hasMore: boolean } }
export type ChatV2Block = (BlockBase & (
  | { tool: 'query_tasks'; data: V2Page & { cards: ChatV2Task[] } }
  | { tool: 'aggregate_tasks'; data: V2Page & { totalCards: number; groupBy: 'ASSIGNEE' | 'BOARD' | 'COLUMN' | 'STATUS' | 'DATE'; highestCount: number; leaderIds: string[]; rows: { id: string; label: string; count: number }[]; outsideAssignments: number; deletedAccountAssignments: number; unassignedCards: number; assignmentCounting: string } }
  | { tool: 'query_activities'; data: V2Page & { mode: 'EVENTS' | 'CHANGED_CARDS'; eventCount: number; changedCardCount: number; events: ChatV2Event[]; cards: { id: string; title: string | null; eventCount: number; lastChangedAt: string; events: ChatV2Event[]; eventsTruncated: boolean }[]; coverage: string } }
  | { tool: 'query_catalog'; data: V2Page & (
    | { kind: 'BOARDS'; rows: { id: string; name: string; workspaceId: string; workspaceName: string; myRole: string | null }[] }
    | { kind: 'WORKSPACES'; rows: { id: string; name: string; myRole: string | null; boards: number; members: number }[] }
    | { kind: 'MEMBERS'; rows: { id: string; name: string; role: string | null }[] }
  ) }
)) | { id: string; title: string; status: 'ERROR'; error: string };
