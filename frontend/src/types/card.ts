// The nam trong 1 danh sach
export interface Card {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  isDone: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}
