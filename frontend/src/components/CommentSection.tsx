import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  createComment,
  deleteComment,
  fetchComments,
  updateComment,
} from '../lib/api/comment';
import { getErrorMessage } from '../lib/errorMessage';
import type { Comment } from '../types/comment';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN');
}

interface CommentItemProps {
  comment: Comment;
  currentUserId: string | undefined;
  onReply: (commentId: string) => void;
  onEdit: (comment: Comment) => void;
  onDelete: (commentId: string) => void;
}

function CommentItem({ comment, currentUserId, onReply, onEdit, onDelete }: CommentItemProps) {
  const isOwner = comment.authorId === currentUserId;

  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-800">{comment.author.name}</span>
        <span className="text-xs text-slate-400">{formatTime(comment.createdAt)}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{comment.content}</p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={() => onReply(comment.id)}
          className="text-xs font-medium text-indigo-600 hover:underline"
        >
          Trả lời
        </button>
        {isOwner && (
          <>
            <button
              type="button"
              onClick={() => onEdit(comment)}
              className="text-xs font-medium text-slate-500 hover:underline"
            >
              Sửa
            </button>
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              Xoá
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CommentSection({ taskId }: { taskId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newContent, setNewContent] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      setComments(await fetchComments(taskId));
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được bình luận.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function handleSubmitNew(e: FormEvent) {
    e.preventDefault();
    if (!newContent.trim()) return;
    setError(null);
    try {
      await createComment(taskId, newContent.trim(), replyToId ?? undefined);
      setNewContent('');
      setReplyToId(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Không gửi được bình luận.'));
    }
  }

  async function handleSubmitEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !editContent.trim()) return;
    setError(null);
    try {
      await updateComment(editingId, editContent.trim());
      setEditingId(null);
      setEditContent('');
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Không sửa được bình luận.'));
    }
  }

  async function handleDelete(commentId: string) {
    setError(null);
    try {
      await deleteComment(commentId);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Không xoá được bình luận.'));
    }
  }

  const topLevel = comments.filter((c) => !c.parentId);
  const repliesOf = (parentId: string) => comments.filter((c) => c.parentId === parentId);
  const replyTarget = replyToId ? comments.find((c) => c.id === replyToId) : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Bình luận</h2>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {isLoading && <p className="text-sm text-slate-500">Đang tải...</p>}

      <div className="mb-3 flex flex-col gap-3">
        {topLevel.map((comment) => (
          <div key={comment.id} className="flex flex-col gap-2">
            {editingId === comment.id ? (
              <form onSubmit={handleSubmitEdit} className="flex flex-col gap-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={2}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    Lưu
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600"
                  >
                    Huỷ
                  </button>
                </div>
              </form>
            ) : (
              <CommentItem
                comment={comment}
                currentUserId={user?.id}
                onReply={setReplyToId}
                onEdit={(c) => {
                  setEditingId(c.id);
                  setEditContent(c.content);
                }}
                onDelete={handleDelete}
              />
            )}

            {repliesOf(comment.id).length > 0 && (
              <div className="ml-6 flex flex-col gap-2 border-l-2 border-slate-100 pl-3">
                {repliesOf(comment.id).map((reply) =>
                  editingId === reply.id ? (
                    <form key={reply.id} onSubmit={handleSubmitEdit} className="flex flex-col gap-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={2}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                        >
                          Lưu
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600"
                        >
                          Huỷ
                        </button>
                      </div>
                    </form>
                  ) : (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      currentUserId={user?.id}
                      onReply={setReplyToId}
                      onEdit={(c) => {
                        setEditingId(c.id);
                        setEditContent(c.content);
                      }}
                      onDelete={handleDelete}
                    />
                  )
                )}
              </div>
            )}
          </div>
        ))}
        {!isLoading && topLevel.length === 0 && (
          <p className="text-sm text-slate-400">Chưa có bình luận nào.</p>
        )}
      </div>

      <form onSubmit={handleSubmitNew} className="flex flex-col gap-2">
        {replyTarget && (
          <div className="flex items-center justify-between rounded-md bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700">
            <span>Đang trả lời {replyTarget.author.name}</span>
            <button type="button" onClick={() => setReplyToId(null)}>
              Huỷ
            </button>
          </div>
        )}
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={2}
          placeholder="Viết bình luận... gõ @Tên thành viên để nhắc"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          className="self-start rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Gửi bình luận
        </button>
      </form>
    </div>
  );
}
