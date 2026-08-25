import type { User } from './auth';

export interface CommentMention {
  id: string;
  commentId: string;
  userId: string;
  user: User;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: User;
  mentions: CommentMention[];
}
