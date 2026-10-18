import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyCard } from '../lib/api/card';
import HomeDashboard from './HomeDashboard';

const mocks = vi.hoisted(() => ({ fetchMyCards: vi.fn(), updateCard: vi.fn(), fetchHomeActivity: vi.fn() }));
vi.mock('../lib/api/card', () => ({ fetchMyCards: mocks.fetchMyCards, updateCard: mocks.updateCard }));
vi.mock('../lib/api/board', () => ({ fetchHomeActivity: mocks.fetchHomeActivity }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Khanh Quoc' } }) }));
vi.mock('../context/BoardsContext', () => ({ useBoards: () => ({ boards: [] }) }));
vi.mock('../components/Header', () => ({ CreateBoardMenu: () => null }));

// Giữa trưa thứ Tư 14/10/2026 theo giờ máy
const NOW = new Date(2026, 9, 14, 12, 0, 0);
const due = (day: number, hour = 9) => new Date(2026, 9, day, hour, 0, 0).toISOString();

function card(id: string, title: string, over: Partial<MyCard> = {}): MyCard {
  const board = { id: 'b1', name: 'Talk show', color: '#4f46e5' };
  return {
    id,
    title,
    isDone: false,
    status: 'IN_PROGRESS',
    startDate: null,
    dueDate: null,
    coverColor: null,
    list: { id: 'l1', name: 'Đang thực hiện', status: 'IN_PROGRESS', boardId: board.id, board },
    labels: [],
    ...over,
  };
}

const CARDS: MyCard[] = [
  card('c1', 'Lấy báo giá âm thanh', { dueDate: due(10) }),
  card('c2', 'Chốt khách mời', { dueDate: due(14, 18) }),
  card('c3', 'Duyệt kịch bản', { dueDate: due(17) }),
  card('c4', 'Viết biên bản', { dueDate: due(30) }),
  card('c5', 'Đã xong từ trước', { isDone: true, status: 'DONE', dueDate: due(9) }),
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <HomeDashboard />
    </MemoryRouter>
  );
}

const attention = () => screen.getByRole('heading', { name: 'Cần chú ý' }).closest('section') as HTMLElement;
const overdueStat = () => screen.getByText('Quá hạn', { selector: 'button p' }).closest('button') as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  mocks.fetchMyCards.mockResolvedValue(CARDS);
  mocks.fetchHomeActivity.mockResolvedValue([]);
  mocks.updateCard.mockResolvedValue({});
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Tổng quan: khối Cần chú ý', () => {
  it('chia nhóm quá hạn / hôm nay / 7 ngày tới, ghi rõ hạn, bấm tên thẻ mở đúng thẻ', async () => {
    renderPage();
    const box = attention();
    const overdue = await within(box).findByRole('region', { name: 'Quá hạn' });
    expect(within(box).getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Quá hạn',
      'Hôm nay',
      'Trong 7 ngày tới',
    ]);
    expect(within(overdue).getByRole('link', { name: 'Lấy báo giá âm thanh' })).toHaveAttribute(
      'href',
      '/boards/b1?card=c1'
    );
    expect(within(overdue).getAllByText('Quá hạn 4 ngày')).not.toHaveLength(0);
    expect(within(box).getAllByText('Còn 3 ngày')).not.toHaveLength(0);
    // Thẻ hạn xa hơn 7 ngày và thẻ đã xong từ trước không nằm trong khối
    expect(within(box).queryByText('Viết biên bản')).not.toBeInTheDocument();
    expect(within(box).queryByText('Đã xong từ trước')).not.toBeInTheDocument();
  });

  it('tick xong ngay trên trang: gọi API, thẻ ở lại gạch ngang để bỏ tick được, số quá hạn giảm', async () => {
    // Lần tải lại sau khi lưu: server trả thẻ đã xong (đã chuyển sang cột Hoàn thành)
    mocks.fetchMyCards
      .mockResolvedValueOnce(CARDS)
      .mockResolvedValue(CARDS.map((c) => (c.id === 'c1' ? { ...c, isDone: true, status: 'DONE' as const } : c)));
    const user = userEvent.setup();
    renderPage();
    const tick = await screen.findByRole('checkbox', { name: 'Đánh dấu hoàn thành thẻ Lấy báo giá âm thanh' });
    await waitFor(() => expect(within(overdueStat()).getByText('1')).toBeInTheDocument());

    await user.click(tick);

    expect(mocks.updateCard).toHaveBeenCalledWith('c1', { isDone: true });
    // Tải lại danh sách sau khi lưu để cột / trạng thái mới đúng; thẻ vẫn ở lại khối (gạch ngang)
    await waitFor(() => expect(mocks.fetchMyCards).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('checkbox', { name: 'Mở lại thẻ Lấy báo giá âm thanh' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(within(attention()).getAllByText('Đã xong')).not.toHaveLength(0);
    await waitFor(() => expect(within(overdueStat()).getByText('0')).toBeInTheDocument());
  });

  it('lưu lỗi thì trả ô tick về như cũ và báo lỗi', async () => {
    mocks.updateCard.mockRejectedValue(new Error('mất mạng'));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('checkbox', { name: 'Đánh dấu hoàn thành thẻ Chốt khách mời' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Không cập nhật được thẻ.');
    expect(screen.getByRole('checkbox', { name: 'Đánh dấu hoàn thành thẻ Chốt khách mời' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('mỗi nhóm hiện tối đa 5 thẻ, phần còn lại dẫn sang trang Công việc của tôi', async () => {
    mocks.fetchMyCards.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => card(`o${i}`, `Việc trễ ${i + 1}`, { dueDate: due(i + 1) }))
    );
    renderPage();
    const overdue = await within(attention()).findByRole('region', { name: 'Quá hạn' });
    expect(within(overdue).getAllByRole('checkbox')).toHaveLength(5);
    expect(within(overdue).getByRole('link', { name: '+2 thẻ nữa' })).toHaveAttribute('href', '/my-cards');
  });

  it('tải lỗi thì không báo nhầm là "không có thẻ nào sắp đến hạn"', async () => {
    mocks.fetchMyCards.mockRejectedValue(new Error('500'));
    renderPage();
    expect(await within(attention()).findByText('Không tải được danh sách thẻ.')).toBeInTheDocument();
    expect(screen.queryByText('Không có thẻ nào sắp đến hạn.')).not.toBeInTheDocument();
  });
});
