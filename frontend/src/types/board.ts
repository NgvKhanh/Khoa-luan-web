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

export type BoardRole = 'OWNER' | 'ADMIN' | 'MEMBER';

interface BoardUserBrief {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface BoardMember {
  id: string;
  boardId: string;
  userId: string;
  role: BoardRole;
  user: BoardUserBrief;
}

export interface JoinRequest {
  id: string;
  boardId: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  user: BoardUserBrief;
}

export interface InviteLink {
  token: string | null;
  url: string | null;
}

// Xem truoc khi vao bang bang link moi
export interface InvitePreview {
  board: {
    id: string;
    name: string;
    color: string;
    backgroundImage: string | null;
  };
  status: 'member' | 'pending' | 'none';
}
