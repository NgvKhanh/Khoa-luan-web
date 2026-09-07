import { api } from '../axios';
import type {
  Board,
  BoardMember,
  BoardRole,
  BoardVisibility,
  InviteLink,
  InvitePreview,
  JoinRequest,
} from '../../types/board';

export async function fetchMyBoards(): Promise<Board[]> {
  const res = await api.get<{ data: { boards: Board[] } }>('/boards');
  return res.data.data.boards;
}

// Lay 1 bang theo id (dung khi mo bang cong khai chua phai thanh vien)
export async function fetchBoard(boardId: string): Promise<Board> {
  const res = await api.get<{ data: { board: Board } }>(`/boards/${boardId}`);
  return res.data.data.board;
}

export interface ArchivedCard {
  id: string;
  title: string;
  archivedAt: string;
  list: { id: string; name: string };
}
export interface ArchivedList {
  id: string;
  name: string;
  archivedAt: string;
  cardCount: number;
}

// Cac muc da luu tru cua bang
export async function fetchBoardArchive(
  boardId: string
): Promise<{ cards: ArchivedCard[]; lists: ArchivedList[] }> {
  const res = await api.get<{
    data: { cards: ArchivedCard[]; lists: ArchivedList[] };
  }>(`/boards/${boardId}/archive`);
  return res.data.data;
}

export async function createBoard(input: {
  name: string;
  color?: string;
  backgroundImage?: string;
}): Promise<Board> {
  const res = await api.post<{ data: { board: Board } }>('/boards', input);
  return res.data.data.board;
}

export async function updateBoard(
  boardId: string,
  input: {
    name?: string;
    color?: string;
    backgroundImage?: string | null;
    visibility?: BoardVisibility;
  }
): Promise<Board> {
  const res = await api.patch<{ data: { board: Board } }>(
    `/boards/${boardId}`,
    input
  );
  return res.data.data.board;
}

export async function deleteBoard(boardId: string): Promise<void> {
  await api.delete(`/boards/${boardId}`);
}

// Danh dau / bo danh dau sao bang
export async function setBoardStar(
  boardId: string,
  starred: boolean
): Promise<void> {
  await api.put(`/boards/${boardId}/star`, { starred });
}

// Tai anh nen len (field "image", dang multipart/form-data)
export async function uploadBoardBackground(
  boardId: string,
  file: File
): Promise<Board> {
  const form = new FormData();
  form.append('image', file);
  const res = await api.post<{ data: { board: Board } }>(
    `/boards/${boardId}/background`,
    form
  );
  return res.data.data.board;
}

// Bo anh nen, quay ve dung mau
export async function clearBoardBackground(boardId: string): Promise<Board> {
  const res = await api.delete<{ data: { board: Board } }>(
    `/boards/${boardId}/background`
  );
  return res.data.data.board;
}

// ----- Thanh vien bang -----
export async function fetchBoardMembers(
  boardId: string
): Promise<BoardMember[]> {
  const res = await api.get<{ data: { members: BoardMember[] } }>(
    `/boards/${boardId}/members`
  );
  return res.data.data.members;
}

export async function addBoardMember(
  boardId: string,
  email: string,
  role: Exclude<BoardRole, 'OWNER'> = 'MEMBER'
): Promise<BoardMember> {
  const res = await api.post<{ data: { member: BoardMember } }>(
    `/boards/${boardId}/members`,
    { email, role }
  );
  return res.data.data.member;
}

export async function changeMemberRole(
  boardId: string,
  userId: string,
  role: Exclude<BoardRole, 'OWNER'>
): Promise<BoardMember> {
  const res = await api.patch<{ data: { member: BoardMember } }>(
    `/boards/${boardId}/members/${userId}`,
    { role }
  );
  return res.data.data.member;
}

export async function removeBoardMember(
  boardId: string,
  userId: string
): Promise<void> {
  await api.delete(`/boards/${boardId}/members/${userId}`);
}

// ----- Link moi -----
export async function getInviteLink(boardId: string): Promise<InviteLink> {
  const res = await api.get<{ data: InviteLink }>(
    `/boards/${boardId}/invite-link`
  );
  return res.data.data;
}

export async function createInviteLink(boardId: string): Promise<InviteLink> {
  const res = await api.post<{ data: InviteLink }>(
    `/boards/${boardId}/invite-link`
  );
  return res.data.data;
}

export async function disableInviteLink(boardId: string): Promise<void> {
  await api.delete(`/boards/${boardId}/invite-link`);
}

// ----- Yeu cau tham gia -----
export async function fetchJoinRequests(
  boardId: string
): Promise<JoinRequest[]> {
  const res = await api.get<{ data: { requests: JoinRequest[] } }>(
    `/boards/${boardId}/join-requests`
  );
  return res.data.data.requests;
}

export async function approveJoinRequest(
  boardId: string,
  requestId: string
): Promise<BoardMember> {
  const res = await api.post<{ data: { member: BoardMember } }>(
    `/boards/${boardId}/join-requests/${requestId}/approve`
  );
  return res.data.data.member;
}

export async function rejectJoinRequest(
  boardId: string,
  requestId: string
): Promise<void> {
  await api.post(`/boards/${boardId}/join-requests/${requestId}/reject`);
}

// ----- Vao bang bang link -----
export async function previewInvite(token: string): Promise<InvitePreview> {
  const res = await api.get<{ data: InvitePreview }>(`/boards/join/${token}`);
  return res.data.data;
}

export async function requestToJoin(
  token: string
): Promise<{ boardName: string }> {
  const res = await api.post<{ data: { boardName: string } }>(
    `/boards/join/${token}`
  );
  return res.data.data;
}
