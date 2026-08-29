// The nam trong 1 danh sach
export interface Card {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  isDone: boolean;
  dueDate?: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  // Chi co khi tai kem (danh sach the trong bang) - dung ve huy hieu
  labels?: { labelId: string; label: Label }[];
  members?: { userId: string; user: CardUserBrief }[];
  checklists?: { id: string; items: { id: string; isDone: boolean }[] }[];
  comments?: { id: string }[];
}

interface CardUserBrief {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface Label {
  id: string;
  boardId: string;
  name: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  checklistId: string;
  content: string;
  isDone: boolean;
  position: number;
  assigneeId?: string | null;
  assignee?: { id: string; name: string; avatarUrl: string | null } | null;
  dueDate?: string | null;
}

export interface Checklist {
  id: string;
  cardId: string;
  title: string;
  position: number;
  items: ChecklistItem[];
}

export interface CardComment {
  id: string;
  text: string;
  createdAt: string;
  user: CardUserBrief;
}

export interface CardActivity {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
}

// Tra ve tu GET /api/cards/:id
export interface CardDetail {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  isDone: boolean;
  dueDate: string | null;
  createdAt: string;
  list: { id: string; name: string; boardId: string };
  members: { userId: string; user: CardUserBrief }[];
  labels: { labelId: string; label: Label }[];
  checklists: Checklist[];
  comments: CardComment[];
  activities: CardActivity[];
}
