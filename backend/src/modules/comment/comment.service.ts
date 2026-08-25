import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { assertProjectMember } from '../project/project.service';
import { getActiveTaskOrThrow } from '../task/task.service';
import type { CreateCommentInput, UpdateCommentInput } from './comment.schema';

const AUTHOR_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} as const;

const COMMENT_INCLUDE = {
  author: { select: AUTHOR_SELECT },
  mentions: { include: { user: { select: AUTHOR_SELECT } } },
} as const;

/**
 * Tim cac thanh vien du an duoc nhac ten (@Ten thanh vien) trong noi dung binh luan.
 * Vi User khong co username rieng, doi chieu truc tiep theo ten day du (khong phan biet hoa/thuong).
 */
async function findMentionedUserIds(projectId: string, content: string) {
  const lowerContent = content.toLowerCase();

  const members = await prisma.projectMember.findMany({
    where: { projectId, deletedAt: null },
    include: { user: { select: { id: true, name: true } } },
  });

  return members
    .filter((m) => lowerContent.includes(`@${m.user.name.toLowerCase()}`))
    .map((m) => m.user.id);
}

async function getActiveCommentOrThrow(commentId: string) {
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, deletedAt: null },
  });
  if (!comment) {
    throw new AppError('Khong tim thay binh luan', 404);
  }
  return comment;
}

export async function createComment(
  userId: string,
  taskId: string,
  input: CreateCommentInput
) {
  const task = await getActiveTaskOrThrow(taskId);
  await assertProjectMember(task.projectId, userId);

  if (input.parentId) {
    const parent = await getActiveCommentOrThrow(input.parentId);
    if (parent.taskId !== taskId) {
      throw new AppError('Binh luan cha khong thuoc cong viec nay', 400);
    }
  }

  const mentionedUserIds = await findMentionedUserIds(task.projectId, input.content);

  const comment = await prisma.comment.create({
    data: {
      taskId,
      authorId: userId,
      content: input.content,
      parentId: input.parentId,
      mentions: {
        create: mentionedUserIds.map((mentionedUserId) => ({
          userId: mentionedUserId,
        })),
      },
    },
    include: COMMENT_INCLUDE,
  });

  return comment;
}

export async function listComments(userId: string, taskId: string) {
  const task = await getActiveTaskOrThrow(taskId);
  await assertProjectMember(task.projectId, userId);

  return prisma.comment.findMany({
    where: { taskId, deletedAt: null },
    include: COMMENT_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });
}

export async function updateComment(
  userId: string,
  commentId: string,
  input: UpdateCommentInput
) {
  const comment = await getActiveCommentOrThrow(commentId);

  if (comment.authorId !== userId) {
    throw new AppError('Ban chi co the sua binh luan cua chinh minh', 403);
  }

  const task = await getActiveTaskOrThrow(comment.taskId);
  const mentionedUserIds = await findMentionedUserIds(task.projectId, input.content);

  const [, , updated] = await prisma.$transaction([
    prisma.commentMention.deleteMany({ where: { commentId } }),
    prisma.commentMention.createMany({
      data: mentionedUserIds.map((mentionedUserId) => ({
        commentId,
        userId: mentionedUserId,
      })),
    }),
    prisma.comment.update({
      where: { id: commentId },
      data: { content: input.content },
      include: COMMENT_INCLUDE,
    }),
  ]);

  return updated;
}

export async function deleteComment(userId: string, commentId: string) {
  const comment = await getActiveCommentOrThrow(commentId);

  if (comment.authorId !== userId) {
    throw new AppError('Ban chi co the xoa binh luan cua chinh minh', 403);
  }

  await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
}
