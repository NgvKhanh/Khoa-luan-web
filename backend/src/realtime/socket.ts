import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { verifyToken } from '../utils/jwt';

// Cac su kien server -> client
export type RealtimeEvent =
  | 'board:lists-changed' // the / danh sach / checklist / binh luan ... doi
  | 'board:members-changed' // thanh vien / vai tro / yeu cau tham gia doi
  | 'board:meta-changed' // ten bang / mau / anh nen / kha nang hien thi doi
  | 'board:removed' // nguoi nhan vua bi xoa khoi bang (gui vao phong user)
  | 'notification:new'; // co thong bao moi (gui vao phong user)

let io: Server | null = null;

const boardRoom = (boardId: string) => `board:${boardId}`;
const userRoom = (userId: string) => `user:${userId}`;

// Doc cookie "token" tu chuoi header Cookie (tu parse, khong can thu vien)
function tokenFromHandshake(socket: Socket): string | null {
  const raw = socket.handshake.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name === 'token') {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

/**
 * Gan Socket.IO vao HTTP server dang chay. Neu loi -> chi ghi log,
 * app REST van hoat dong binh thuong (realtime la lop tang cuong).
 */
export function initRealtime(httpServer: HttpServer): void {
  io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: env.corsOrigins, credentials: true },
  });

  // Xac thuc: bat buoc co JWT hop le trong cookie
  io.use(async (socket, next) => {
    try {
      const token = tokenFromHandshake(socket);
      if (!token) return next(new Error('unauthorized'));
      const { userId } = verifyToken(token);
      const user = await prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { id: true },
      });
      if (!user) return next(new Error('unauthorized'));
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    // Phong rieng cua nguoi dung -> nhan thong bao / su kien bi xoa khoi bang
    void socket.join(userRoom(userId));

    // Vao phong 1 bang sau khi kiem tra quyen xem
    socket.on('join-board', async (boardId: unknown) => {
      if (typeof boardId !== 'string' || !boardId) return;
      const board = await prisma.board.findFirst({
        where: { id: boardId, deletedAt: null },
        select: { ownerId: true, visibility: true },
      });
      if (!board) return;
      const allowed =
        board.ownerId === userId ||
        board.visibility === 'PUBLIC' ||
        (await prisma.boardMember.findFirst({
          where: { boardId, userId, deletedAt: null },
          select: { id: true },
        })) !== null;
      if (allowed) void socket.join(boardRoom(boardId));
    });

    socket.on('leave-board', (boardId: unknown) => {
      if (typeof boardId === 'string' && boardId) {
        void socket.leave(boardRoom(boardId));
      }
    });
  });
}

// ---- Ham phat su kien (an toan: bo qua neu io chua san sang) ----

export function emitToBoard(
  boardId: string | null | undefined,
  event: RealtimeEvent
): void {
  if (!io || !boardId) return;
  try {
    io.to(boardRoom(boardId)).emit(event, { boardId });
  } catch {
    // bo qua
  }
}

export function emitToUser(
  userId: string | null | undefined,
  event: RealtimeEvent,
  payload: Record<string, unknown> = {}
): void {
  if (!io || !userId) return;
  try {
    io.to(userRoom(userId)).emit(event, payload);
  } catch {
    // bo qua
  }
}

export function shutdownRealtime(): void {
  io?.close();
  io = null;
}
