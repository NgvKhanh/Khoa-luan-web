import type { User } from './auth';

export type ProjectRole = 'MANAGER' | 'MEMBER';

export interface Project {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListItem extends Project {
  memberCount: number;
  myRole: ProjectRole;
  team: { id: string; name: string };
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
  user: User;
}

export interface ProjectDetail extends Project {
  team: { id: string; name: string };
  members: ProjectMember[];
}
