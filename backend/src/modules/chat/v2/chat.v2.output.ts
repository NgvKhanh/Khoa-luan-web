import { z } from 'zod';
import { CardStatus } from '../../../generated/prisma/enums';
import { ENTITY_KINDS, EVENT_TYPES } from './chat.v2.schema';

const text = z.string();
const count = z.number().int().nonnegative();
const iso = z.string().datetime();
const person = z.object({ id: text, name: text }).strict();
const page = { total: count, page: z.number().int().positive(), pageSize: z.number().int().positive(), hasMore: z.boolean() };
const task = z.object({
  id: text, title: text, status: z.enum(CardStatus), isDone: z.boolean(), boardId: text, boardName: text,
  columnId: text, columnName: text, dueDate: iso.nullable(), completedAt: iso.nullable(), createdAt: iso,
  overdue: z.boolean(), assignees: z.array(person),
}).strict();
const event = z.object({
  id: text, boardId: text, cardId: text.nullable(), cardTitle: text.nullable(), redacted: z.boolean(),
  type: z.enum(EVENT_TYPES), createdAt: iso, actor: person.nullable(), data: z.record(text, text.nullable()),
}).strict();
const catalog = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('BOARDS'), ...page, rows: z.array(z.object({ id: text, name: text, workspaceId: text, workspaceName: text, myRole: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).nullable() }).strict()) }).strict(),
  z.object({ kind: z.literal('WORKSPACES'), ...page, rows: z.array(z.object({ id: text, name: text, myRole: z.enum(['OWNER', 'ADMIN', 'MEMBER']).nullable(), boards: count, members: count }).strict()) }).strict(),
  z.object({ kind: z.literal('MEMBERS'), ...page, rows: z.array(z.object({ id: text, name: text, role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).nullable() }).strict()) }).strict(),
]);
export const TOOL_OUTPUT_SCHEMAS = {
  resolve_entities: z.object({ status: z.enum(['RESOLVED', 'CLARIFY', 'NOT_FOUND']), total: count, options: z.array(z.object({ id: text, name: text, kind: z.enum(ENTITY_KINDS), parentName: text.optional() }).strict()), truncated: z.boolean() }).strict(),
  query_catalog: catalog,
  query_tasks: z.object({ ...page, cards: z.array(task) }).strict(),
  aggregate_tasks: z.object({
    ...page, totalCards: count, groupBy: z.enum(['ASSIGNEE', 'BOARD', 'COLUMN', 'STATUS', 'DATE']), highestCount: count,
    leaderIds: z.array(text), rows: z.array(z.object({ id: text, label: text, count }).strict()), outsideAssignments: count,
    deletedAccountAssignments: count, unassignedCards: count, assignmentCounting: text,
  }).strict(),
  query_activities: z.object({
    ...page, mode: z.enum(['EVENTS', 'CHANGED_CARDS']), eventCount: count, changedCardCount: count, events: z.array(event),
    cards: z.array(z.object({ id: text, title: text.nullable(), eventCount: count, lastChangedAt: iso, events: z.array(event), eventsTruncated: z.boolean() }).strict()), coverage: text,
  }).strict(),
} as const;
