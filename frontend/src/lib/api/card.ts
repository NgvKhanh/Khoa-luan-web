import { api } from '../axios';
import type { Card } from '../../types/card';

export async function createCard(listId: string, title: string): Promise<Card> {
  const res = await api.post<{ data: { card: Card } }>(
    `/lists/${listId}/cards`,
    { title }
  );
  return res.data.data.card;
}

export async function updateCard(
  cardId: string,
  input: { title?: string; description?: string | null }
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

// Keo tha: chuyen the sang danh sach listId, chen vao vi tri position (tu 0)
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
