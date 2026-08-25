import { api } from '../axios';
import type { Comment } from '../../types/comment';

export async function fetchComments(taskId: string): Promise<Comment[]> {
  const res = await api.get<{ data: { comments: Comment[] } }>(
    `/tasks/${taskId}/comments`
  );
  return res.data.data.comments;
}

export async function createComment(
  taskId: string,
  content: string,
  parentId?: string
): Promise<Comment> {
  const res = await api.post<{ data: { comment: Comment } }>(
    `/tasks/${taskId}/comments`,
    { content, parentId }
  );
  return res.data.data.comment;
}

export async function updateComment(
  commentId: string,
  content: string
): Promise<Comment> {
  const res = await api.patch<{ data: { comment: Comment } }>(
    `/comments/${commentId}`,
    { content }
  );
  return res.data.data.comment;
}

export async function deleteComment(commentId: string): Promise<void> {
  await api.delete(`/comments/${commentId}`);
}
