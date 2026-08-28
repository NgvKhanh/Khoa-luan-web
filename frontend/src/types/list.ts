import type { Card } from './card';

// Danh sach (cot) trong bang
export interface BoardList {
  id: string;
  boardId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  cards: Card[];
}
