// Dieu phoi mot luot hoi (CHATBOT_MODULE.md §3, §9, §12).
//
//   cau hoi -> hieu cau (tiem vao: bo luat o buoc 4, lai LLM o buoc 5) -> cau noi tiep
//   -> kiem pham vi + quyen (DOC LAI moi luot) -> nhan dien nguoi -> tham so hieu luc
//   -> truy van -> dung cau tra loi theo mau.
//
// Quyen va pham vi luon doc lai tu CSDL (resolveScope / loadRoster), ke ca o /choice va
// /more: phien chi giu y dinh, tham so, id nguoi da chon - khong giu quyen hay du lieu.
// `now` do controller truyen vao (tep duy nhat doc dong ho). Khong ghi log noi dung.

import { AppError } from '../../utils/AppError';
import {
  renderAnswer,
  renderAskWho,
  renderClarifyMember,
  renderClarifyWorkspace,
  renderMemberNotFound,
  renderUnsupported,
  type ChatAnswer,
  type ScopeInfo,
} from './chat.answer';
import { applyFollowUp, type FollowUpContext } from './chat.followup';
import { resolveSlots, type ChatFocus, type ChatIntent, type ChatPeriod, type FinalQuestion, type ParsedQuestion } from './chat.intent';
import { resolveMemberRef, type RosterMember } from './chat.members';
import { runQuery } from './chat.queries';
import { parseByRules } from './chat.rules';
import {
  listChoosableWorkspaces,
  loadMyRoster,
  loadRoster,
  resolveScope,
  type ChatScopeInput,
  type ResolvedScope,
} from './chat.scope';
import { scopeKeyOf, type ChatSessionState, type ChatSessionStore, type Parser } from './chat.session';

/** Bo "hieu cau hoi": nhan cau hoi + danh sach nguoi (chi o server) + ngu canh luot truoc. */
export type Understand = (
  question: string,
  roster: readonly RosterMember[],
  prev: FollowUpContext | null
) => Promise<{ parsed: ParsedQuestion; parser: Parser }>;

/** Buoc 4: chi bo luat (nhanh B0). Buoc 5 thay bang ban gop luat + LLM. */
export const understandByRules: Understand = async (question, roster) => ({
  parsed: parseByRules(question, roster),
  parser: 'RULE',
});

export interface ChatContext {
  now: Date;
  sessions: ChatSessionStore;
  understand?: Understand;
}

export interface Understood {
  intent: ChatIntent;
  period: ChatPeriod | null;
  focus: ChatFocus | null;
  /** Ten DA nhan dien (tu CSDL), khong phai chuoi go. */
  memberName: string | null;
  parser: Parser;
}

export interface ChatReply {
  conversationId: string;
  conversationReset?: true;
  understood: Understood;
  answer: ChatAnswer;
}

const TEAM_INTENTS: readonly ChatIntent[] = ['MEMBER_TASKS', 'TEAM_SUMMARY', 'TEAM_WORKLOAD'];
const CONVERSATION_GONE = 'Hoi thoai da het han hoac khong ton tai, hay hoi lai';
const BAD_CHOICE = 'Lua chon khong hop le';

export function scopeInfoOf(scope: ResolvedScope): ScopeInfo {
  return {
    kind: scope.kind,
    workspaceName: scope.workspace?.name ?? null,
    boardName: scope.board?.name ?? null,
    boardCount: scope.boardCount,
    isLeader: scope.isLeader,
  };
}

function scopeInputOf(scope: ResolvedScope): ChatScopeInput {
  if (scope.kind === 'BOARD' && scope.board) return { kind: 'BOARD', boardId: scope.board.id };
  if (scope.kind === 'WORKSPACE' && scope.workspace) return { kind: 'WORKSPACE', workspaceId: scope.workspace.id };
  return { kind: 'MY' };
}

function understoodOf(q: FinalQuestion, parser: Parser, memberName: string | null): Understood {
  const r = resolveSlots(q);
  return { intent: r.intent, period: r.period, focus: r.focus, memberName, parser };
}

/**
 * Tra loi mot cau hoi da qua buoc noi tiep, trong pham vi da kiem quyen. Ghi ngu canh +
 * truy van cuoi vao phien; tao cau hoi lai (dat `pending`) khi can.
 */
async function answerQuestion(
  session: ChatSessionState,
  scope: ResolvedScope,
  question: FinalQuestion,
  parser: Parser,
  now: Date
): Promise<{ understood: Understood; answer: ChatAnswer }> {
  const info = scopeInfoOf(scope);

  // Hoi ve nhom / nguoi khac o pham vi ca nhan -> chon khong gian (1 khong gian thi dung luon)
  if (scope.kind === 'MY' && TEAM_INTENTS.includes(question.intent)) {
    const options = await listChoosableWorkspaces(scope.userId);
    if (options.length === 1) {
      const only = await resolveScope(scope.userId, { kind: 'WORKSPACE', workspaceId: options[0].id });
      return answerQuestion(session, only, question, parser, now);
    }
    session.pending = {
      kind: 'WORKSPACE',
      question,
      scopeInput: { kind: 'MY' },
      optionIds: options.map((o) => o.id),
      parser,
    };
    return { understood: understoodOf(question, parser, null), answer: renderClarifyWorkspace(options, info, now) };
  }

  const resolved = resolveSlots(question);
  const roster = scope.kind === 'MY' ? [] : await loadRoster(scope);
  let target: RosterMember | null = null;

  if (resolved.intent === 'MEMBER_TASKS') {
    if (question.memberText === null && question.memberUserId === null) {
      session.pending = null;
      return { understood: understoodOf(question, parser, null), answer: renderAskWho(info, now) };
    }
    const match = resolveMemberRef(question, roster);
    if (match.kind === 'NONE') {
      // Khong noi nguoi do co ton tai o noi khac hay khong (§8.3)
      return {
        understood: understoodOf(question, parser, null),
        answer: renderMemberNotFound(question.memberText ?? 'người bạn hỏi', info, now),
      };
    }
    if (match.kind === 'MANY') {
      session.pending = {
        kind: 'MEMBER',
        question: { ...question, memberText: null, memberUserId: null },
        scopeInput: scopeInputOf(scope),
        optionIds: match.members.map((m) => m.userId),
        parser,
      };
      return {
        understood: understoodOf(question, parser, null),
        answer: renderClarifyMember(question.memberText ?? '', match.members, info, now),
      };
    }
    target = match.member;
  }

  const result = await runQuery({ scope, now, page: 1 }, resolved, { target, roster });
  const answer = renderAnswer({ query: resolved, scope: info, result, memberName: target?.name ?? null, now });

  // Ngu canh cho cau noi tiep: tham so NGUOI DUNG da noi (truoc mac dinh) + nguoi da nhan dien
  session.context = {
    intent: resolved.intent,
    period: question.period,
    focus: question.focus,
    memberUserId: target?.userId ?? null,
  };
  session.lastQuery = { resolved, memberUserId: target?.userId ?? null, scopeInput: scopeInputOf(scope), parser };
  session.pending = null;
  return { understood: understoodOf(question, parser, target?.name ?? null), answer };
}

function openSession(
  ctx: ChatContext,
  userId: string,
  scopeInput: ChatScopeInput,
  conversationId: string | undefined
): { id: string; state: ChatSessionState; reset: boolean } {
  const nowMs = ctx.now.getTime();
  const key = scopeKeyOf(scopeInput);
  if (conversationId) {
    const state = ctx.sessions.get(conversationId, userId, nowMs);
    if (state) {
      if (state.scopeKey !== key) {
        // Doi pham vi: KHONG ke thua ngu canh / cau hoi lai / truy van cuoi
        state.scopeKey = key;
        state.context = null;
        state.pending = null;
        state.lastQuery = null;
      }
      return { id: conversationId, state, reset: false };
    }
  }
  const created = ctx.sessions.create(userId, key, nowMs);
  return { ...created, reset: conversationId !== undefined };
}

export async function handleMessage(
  userId: string,
  input: { message: string; scope: ChatScopeInput; conversationId?: string },
  ctx: ChatContext
): Promise<ChatReply> {
  // Kiem pham vi TRUOC khi tao / sua phien: sai quyen thi khong de lai gi
  const scope = await resolveScope(userId, input.scope);
  const { id, state, reset } = openSession(ctx, userId, input.scope, input.conversationId);
  state.pending = null; // cau hoi moi bo cau hoi lai dang cho

  const roster = scope.kind === 'MY' ? await loadMyRoster(userId) : await loadRoster(scope);
  const understand = ctx.understand ?? understandByRules;
  const { parsed, parser } = await understand(input.message, roster, state.context);
  const fu = applyFollowUp(parsed, state.context);

  const base = { conversationId: id, ...(reset ? { conversationReset: true as const } : {}) };
  if (fu.kind === 'UNSUPPORTED') {
    return {
      ...base,
      understood: { intent: 'UNSUPPORTED', period: null, focus: null, memberName: null, parser },
      answer: renderUnsupported(scopeInfoOf(scope), ctx.now),
    };
  }
  return { ...base, ...(await answerQuestion(state, scope, fu.question, parser, ctx.now)) };
}

/** Tra loi cau hoi lai (chon nguoi / chon khong gian) - KHONG goi LLM (§9.3). */
export async function handleChoice(
  userId: string,
  input: { conversationId: string; userId?: string; workspaceId?: string },
  ctx: ChatContext
): Promise<ChatReply> {
  const state = ctx.sessions.get(input.conversationId, userId, ctx.now.getTime());
  if (!state) throw new AppError(CONVERSATION_GONE, 404);
  const pending = state.pending;
  if (!pending) throw new AppError('Khong co cau hoi lai nao dang cho', 400);

  const chosen = pending.kind === 'MEMBER' ? input.userId : input.workspaceId;
  if (!chosen || !pending.optionIds.includes(chosen)) throw new AppError(BAD_CHOICE, 400);

  const scopeInput: ChatScopeInput =
    pending.kind === 'WORKSPACE' ? { kind: 'WORKSPACE', workspaceId: chosen } : pending.scopeInput;
  const scope = await resolveScope(userId, scopeInput); // kiem lai quyen
  const question: FinalQuestion =
    pending.kind === 'MEMBER' ? { ...pending.question, memberText: null, memberUserId: chosen } : pending.question;
  state.pending = null;
  return { conversationId: input.conversationId, ...(await answerQuestion(state, scope, question, pending.parser, ctx.now)) };
}

/** Trang tiep theo cua cau tra loi truoc - KHONG goi LLM, kiem lai pham vi va nguoi. */
export async function handleMore(
  userId: string,
  input: { conversationId: string; page: number },
  ctx: ChatContext
): Promise<ChatReply> {
  const state = ctx.sessions.get(input.conversationId, userId, ctx.now.getTime());
  if (!state) throw new AppError(CONVERSATION_GONE, 404);
  const last = state.lastQuery;
  if (!last) throw new AppError('Chua co cau tra loi nao de xem them', 400);

  const scope = await resolveScope(userId, last.scopeInput);
  const info = scopeInfoOf(scope);
  const roster = await loadRoster(scope);
  let target: RosterMember | null = null;
  if (last.memberUserId !== null) {
    const match = resolveMemberRef({ memberText: null, memberUserId: last.memberUserId }, roster);
    if (match.kind !== 'ONE') {
      return {
        conversationId: input.conversationId,
        understood: { intent: last.resolved.intent, period: last.resolved.period, focus: last.resolved.focus, memberName: null, parser: last.parser },
        answer: renderMemberNotFound('người bạn hỏi', info, ctx.now),
      };
    }
    target = match.member;
  }
  const result = await runQuery({ scope, now: ctx.now, page: input.page }, last.resolved, { target, roster });
  return {
    conversationId: input.conversationId,
    understood: {
      intent: last.resolved.intent,
      period: last.resolved.period,
      focus: last.resolved.focus,
      memberName: target?.name ?? null,
      parser: last.parser,
    },
    answer: renderAnswer({ query: last.resolved, scope: info, result, memberName: target?.name ?? null, now: ctx.now }),
  };
}

/** Buoc 4 chua dung LLM; buoc 5 bao that. KHONG BAO GIO tra 503 vi thieu khoa. */
export function getChatStatus(): { llmAvailable: boolean } {
  return { llmAvailable: false };
}
