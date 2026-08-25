import type { User } from './auth';

export type TeamRole = 'LEADER' | 'MEMBER';

export interface Team {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamListItem extends Team {
  memberCount: number;
  myRole: TeamRole;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
  user: User;
}

export interface TeamDetail extends Team {
  members: TeamMember[];
}
