import type { Task } from './task';

// Danh sach (cot) tren bang kieu Trello
export interface BoardList {
  id: string;
  projectId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  // Chi co khi tai bang qua GET /projects/:id/lists; khi tao/sua cot moi thi rong
  tasks: Task[];
}
