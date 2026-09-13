import { api } from '../axios';
import type {
  Card,
  CardAttachment,
  CardComment,
  CardDetail,
  Checklist,
  ChecklistItem,
  Label,
} from '../../types/card';

export async function createCard(listId: string, title: string): Promise<Card> {
  const res = await api.post<{ data: { card: Card } }>(
    `/lists/${listId}/cards`,
    { title }
  );
  return res.data.data.card;
}

export async function fetchCardDetail(cardId: string): Promise<CardDetail> {
  const res = await api.get<{ data: { card: CardDetail } }>(`/cards/${cardId}`);
  return res.data.data.card;
}

export interface MyCard {
  id: string;
  title: string;
  isDone: boolean;
  startDate: string | null;
  dueDate: string | null;
  coverColor: string | null;
  list: {
    id: string;
    name: string;
    boardId: string;
    board: { id: string; name: string };
  };
  labels: { labelId: string; label: Label }[];
}

// Tat ca cac the minh duoc gan, tren moi bang
export async function fetchMyCards(): Promise<MyCard[]> {
  const res = await api.get<{ data: { cards: MyCard[] } }>('/cards/mine');
  return res.data.data.cards;
}

interface CalendarListBrief {
  id: string;
  name: string;
  boardId: string;
  board: { id: string; name: string; color: string };
}

export interface CalendarCard {
  id: string;
  title: string;
  isDone: boolean;
  startDate: string | null;
  dueDate: string;
  list: CalendarListBrief;
}

export interface CalendarChecklistItem {
  id: string;
  content: string;
  isDone: boolean;
  dueDate: string;
  checklist: { card: { id: string; title: string; list: CalendarListBrief } };
}

export interface CalendarData {
  cards: CalendarCard[];
  checklistItems: CalendarChecklistItem[];
}

// Cac the co khoang [startDate, dueDate] giao voi [from, to], kem muc
// checklist co han trong khoang do
export async function fetchCalendarCards(
  fromISO: string,
  toISO: string
): Promise<CalendarData> {
  const res = await api.get<{ data: CalendarData }>(
    `/cards/calendar?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`
  );
  return res.data.data;
}

export interface SearchCard {
  id: string;
  title: string;
  isDone: boolean;
  dueDate: string | null;
  coverColor: string | null;
  list: {
    id: string;
    name: string;
    boardId: string;
    board: { id: string; name: string; color: string };
  };
  labels: { labelId: string; label: Label }[];
  members: { userId: string; user: { id: string; name: string; avatarUrl: string | null } }[];
}

// Tim the theo tu khoa, tren moi bang minh co quyen truy cap
export async function searchCards(query: string): Promise<SearchCard[]> {
  const res = await api.get<{ data: { cards: SearchCard[] } }>(
    `/cards/search?q=${encodeURIComponent(query)}`
  );
  return res.data.data.cards;
}

export async function updateCard(
  cardId: string,
  input: {
    title?: string;
    description?: string | null;
    isDone?: boolean;
    startDate?: string | null;
    dueDate?: string | null;
    coverColor?: string | null;
    coverImageUrl?: string | null;
  }
): Promise<Card> {
  const res = await api.patch<{ data: { card: Card } }>(
    `/cards/${cardId}`,
    input
  );
  return res.data.data.card;
}

export async function deleteCard(cardId: string): Promise<void> {
  await api.delete(`/cards/${cardId}`);
}

export async function copyCard(
  cardId: string,
  input: { title?: string; listId?: string }
): Promise<Card> {
  const res = await api.post<{ data: { card: Card } }>(
    `/cards/${cardId}/copy`,
    input
  );
  return res.data.data.card;
}

// Luu tru / khoi phuc / xoa han the
export async function archiveCard(cardId: string): Promise<void> {
  await api.post(`/cards/${cardId}/archive`);
}
export async function restoreCard(cardId: string): Promise<void> {
  await api.post(`/cards/${cardId}/restore`);
}
export async function purgeCard(cardId: string): Promise<void> {
  await api.delete(`/cards/${cardId}/purge`);
}

// ----- Nhac han (rieng cho nguoi dat) -----
export const REMINDER_OFFSETS = [10, 60, 1440] as const;
export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];

export interface CardReminder {
  id: string;
  cardId: string;
  userId: string;
  offsetMinutes: number;
  sentAt: string | null;
  createdAt: string;
}

export async function fetchCardReminders(cardId: string): Promise<CardReminder[]> {
  const res = await api.get<{ data: { reminders: CardReminder[] } }>(
    `/cards/${cardId}/reminders`
  );
  return res.data.data.reminders;
}

export async function addCardReminder(
  cardId: string,
  offsetMinutes: ReminderOffset
): Promise<CardReminder> {
  const res = await api.post<{ data: { reminder: CardReminder } }>(
    `/cards/${cardId}/reminders`,
    { offsetMinutes }
  );
  return res.data.data.reminder;
}

export async function removeCardReminder(
  cardId: string,
  offsetMinutes: ReminderOffset
): Promise<void> {
  await api.delete(`/cards/${cardId}/reminders/${offsetMinutes}`);
}

// Theo doi / bo theo doi the: nhan thong bao hoat dong du khong phai thanh vien duoc gan
export async function setCardWatch(
  cardId: string,
  watching: boolean
): Promise<void> {
  await api.put(`/cards/${cardId}/watch`, { watching });
}

export async function moveCard(
  cardId: string,
  input: { listId: string; position: number }
): Promise<Card> {
  const res = await api.patch<{ data: { card: Card } }>(
    `/cards/${cardId}/move`,
    input
  );
  return res.data.data.card;
}

// ----- Thanh vien the -----
export async function addCardMember(cardId: string, userId: string) {
  await api.post(`/cards/${cardId}/members`, { userId });
}
export async function removeCardMember(cardId: string, userId: string) {
  await api.delete(`/cards/${cardId}/members/${userId}`);
}

// ----- Nhan tren the -----
export async function attachCardLabel(cardId: string, labelId: string) {
  await api.put(`/cards/${cardId}/labels/${labelId}`);
}
export async function detachCardLabel(cardId: string, labelId: string) {
  await api.delete(`/cards/${cardId}/labels/${labelId}`);
}

// ----- Checklist -----
export async function addChecklist(
  cardId: string,
  title: string,
  copyFromChecklistId?: string
): Promise<Checklist> {
  const res = await api.post<{ data: { checklist: Checklist } }>(
    `/cards/${cardId}/checklists`,
    { title, copyFromChecklistId }
  );
  return res.data.data.checklist;
}
export async function deleteChecklist(checklistId: string) {
  await api.delete(`/checklists/${checklistId}`);
}
export async function addChecklistItem(
  checklistId: string,
  content: string
): Promise<ChecklistItem> {
  const res = await api.post<{ data: { item: ChecklistItem } }>(
    `/checklists/${checklistId}/items`,
    { content }
  );
  return res.data.data.item;
}
export async function updateChecklistItem(
  itemId: string,
  input: {
    content?: string;
    isDone?: boolean;
    assigneeId?: string | null;
    dueDate?: string | null;
  }
): Promise<ChecklistItem> {
  const res = await api.patch<{ data: { item: ChecklistItem } }>(
    `/checklist-items/${itemId}`,
    input
  );
  return res.data.data.item;
}
export async function deleteChecklistItem(itemId: string) {
  await api.delete(`/checklist-items/${itemId}`);
}
export async function reorderChecklistItems(
  checklistId: string,
  itemIds: string[]
) {
  await api.patch(`/checklists/${checklistId}/reorder`, { itemIds });
}
export async function convertItemToCard(itemId: string): Promise<Card> {
  const res = await api.post<{ data: { card: Card } }>(
    `/checklist-items/${itemId}/convert-to-card`
  );
  return res.data.data.card;
}

// ----- Tep dinh kem -----
export async function addAttachment(
  cardId: string,
  file: File
): Promise<CardAttachment> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<{ data: { attachment: CardAttachment } }>(
    `/cards/${cardId}/attachments`,
    form
  );
  return res.data.data.attachment;
}
export async function deleteAttachment(attachmentId: string): Promise<void> {
  await api.delete(`/attachments/${attachmentId}`);
}

// ----- Binh luan -----
export async function addComment(
  cardId: string,
  text: string
): Promise<CardComment> {
  const res = await api.post<{ data: { comment: CardComment } }>(
    `/cards/${cardId}/comments`,
    { text }
  );
  return res.data.data.comment;
}
export async function updateComment(
  commentId: string,
  text: string
): Promise<CardComment> {
  const res = await api.patch<{ data: { comment: CardComment } }>(
    `/comments/${commentId}`,
    { text }
  );
  return res.data.data.comment;
}
export async function deleteComment(commentId: string) {
  await api.delete(`/comments/${commentId}`);
}

// ----- Nhan cua bang -----
export async function fetchBoardLabels(boardId: string): Promise<Label[]> {
  const res = await api.get<{ data: { labels: Label[] } }>(
    `/boards/${boardId}/labels`
  );
  return res.data.data.labels;
}

export async function createBoardLabel(
  boardId: string,
  input: { name?: string; color: string }
): Promise<Label> {
  const res = await api.post<{ data: { label: Label } }>(
    `/boards/${boardId}/labels`,
    input
  );
  return res.data.data.label;
}

export async function updateLabel(
  labelId: string,
  input: { name?: string; color?: string }
): Promise<Label> {
  const res = await api.patch<{ data: { label: Label } }>(
    `/labels/${labelId}`,
    input
  );
  return res.data.data.label;
}

export async function deleteLabel(labelId: string): Promise<void> {
  await api.delete(`/labels/${labelId}`);
}
