import type { CardStatus } from './card';

// Hop dong API /api/chat (CHATBOT_MODULE.md §12). Doc la chinh; "hanh dong" (Phase 1) chi la 7 thao tac an toan tren MOT bang,
// qua xem truoc + nut Ap dung hoac tu chay khi cau lenh ro rang (CHATBOT_V2_ACTIONS_PLAN.md).

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
  /** Lenh GHI chay duoc: server bat CHAT_ACTIONS va co AI. Khong co truong = may chu cu, coi nhu chi doc. */
  actions?: boolean;
}

// ===================== Hanh dong (Phase 1: mot thao tac, Phase 2: nhieu thao tac trong mot bang) =====================
// Khoi xem truoc / ket qua do SERVER dung tu ke hoach da phan giai (ten lay tu CSDL), khong phai chu AI viet.

export type ChatPlanStatus = 'NEEDS_CHOICE' | 'PROPOSED' | 'EXECUTING' | 'EXECUTED' | 'FAILED' | 'STALE' | 'CANCELLED' | 'EXPIRED';
export type ChatPlanRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export interface ChatPlanReason {
  code: 'AUTO_DISABLED' | 'DELEGATED_TO_DATA' | 'NOT_GROUNDED' | 'FUZZY_DATE' | 'QUESTION_FORM' | 'MULTI_OP' | 'NEW_STRUCTURE';
  /** Cau giai thich vi sao lenh nay chua tu chay (hien nguyen van cho nguoi dung). */
  text: string;
}
export interface ChatPlanItem {
  index: number;
  verb: string;
  text: string;
  detail?: string;
  cardId?: string;
}
export interface ChatActionPlan {
  planId: string;
  /** Dau van tay cua ban xem truoc: gui lai khi bam Ap dung. */
  checksum: string;
  status: ChatPlanStatus;
  risk: ChatPlanRisk;
  requiresConfirmation: boolean;
  /** Nut "Ap dung" con dung duoc (cho xac nhan va chua het han). */
  canConfirm: boolean;
  reasons: ChatPlanReason[];
  expiresAt: string;
  boardId: string;
  boardName: string;
  items: ChatPlanItem[];
  /** So thao tac cua ke hoach (may chu cu khong gui: coi nhu bang so dong). */
  opCount?: number;
  warnings: string[];
}
export type ChatResultStatus = 'EXECUTED' | 'FAILED' | 'STALE' | 'CANCELLED' | 'EXPIRED';
export interface ChatActionResult {
  planId: string;
  status: ChatResultStatus;
  /** Da tu chay vi lenh ro rang va du an toan (khong qua nut Ap dung). */
  autoExecuted: boolean;
  /** Ap dung lan hai tro di: ket qua luu tu lan dau. */
  alreadyApplied?: boolean;
  summary: string;
  boardId: string;
  cardId?: string;
  error?: { code: string; text: string };
  warnings: string[];
  /** Ke hoach nhieu thao tac: so thao tac va mot cau cho moi thao tac (da lam / da co san). */
  opCount?: number;
  details?: string[];
  cardIds?: string[];
}
export type ChatActionView = { kind: 'PLAN'; plan: ChatActionPlan } | { kind: 'RESULT'; result: ChatActionResult };

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
  /** Ban xem truoc hoac ket qua cua MOT thao tac (khong nam trong blocks). */
  action?: ChatActionView;
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
