export interface Board {
  id: string;
  ownerId: string;
  name: string;
  color: string;
  backgroundImage: string | null;
  createdAt: string;
  updatedAt: string;
  // Chi co trong danh sach bang (GET /api/boards)
  memberCount?: number;
  isOwner?: boolean;
}

export type BoardRole = 'OWNER' | 'MEMBER';

export interface BoardMember {
  id: string;
  boardId: string;
  userId: string;
  role: BoardRole;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}
