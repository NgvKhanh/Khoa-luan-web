import { api } from '../axios';
import type {
  Card,
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

export async function updateCard(
  cardId: string,
  input: {
    title?: string;
    description?: string | null;
    isDone?: boolean;
    startDate?: string | null;
    dueDate?: string | null;
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
