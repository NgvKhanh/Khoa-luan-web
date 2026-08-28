// Luu "bang da xem gan day" tren trinh duyet (giong Trello - theo tung may).

const KEY = 'taskflow_recent_boards';
const MAX = 8;

export interface RecentBoard {
  id: string;
  name: string;
  viewedAt: number;
}

export function getRecentBoards(): RecentBoard[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentBoard[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((b) => b && typeof b.id === 'string' && typeof b.name === 'string')
      .sort((a, b) => b.viewedAt - a.viewedAt);
  } catch {
    return [];
  }
}

export function recordRecentBoard(id: string, name: string): void {
  try {
    const others = getRecentBoards().filter((b) => b.id !== id);
    const next = [{ id, name, viewedAt: Date.now() }, ...others].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Bo qua neu trinh duyet chan localStorage
  }
}
