import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdvancedSearchCard, SearchCardsResult } from '../lib/api/search';
import SearchPage from './SearchPage';

// Trang Tìm kiếm nâng cao: hàng nút lọc theo trạng thái công việc (chọn nhiều) + huy hiệu trạng thái ở kết quả.

const mocks = vi.hoisted(() => ({ search: vi.fn() }));

vi.mock('../lib/api/search', () => ({
  searchCardsAdvanced: mocks.search,
  fetchSavedFilters: vi.fn().mockResolvedValue([]),
  saveFilter: vi.fn(),
  deleteSavedFilter: vi.fn(),
}));

function item(id: string, status: AdvancedSearchCard['status']): AdvancedSearchCard {
  return {
    id,
    title: `Thẻ ${id}`,
    status,
    isDone: status === 'DONE',
    dueDate: null,
    coverColor: null,
    list: { id: 'l1', name: 'Cột', boardId: 'b1', board: { id: 'b1', name: 'Bảng', color: '#000' } },
    labels: [],
    members: [],
  };
}

function result(items: AdvancedSearchCard[]): SearchCardsResult {
  return { items, page: 1, pageSize: 20, total: items.length, hasMore: false };
}

beforeEach(() => {
  mocks.search.mockReset();
  mocks.search.mockResolvedValue(result([item('a', 'BLOCKED'), item('b', 'DONE')]));
});

function renderPage() {
  render(
    <MemoryRouter>
      <SearchPage />
    </MemoryRouter>
  );
}

const lastParams = () => mocks.search.mock.calls.at(-1)?.[0];

describe('SearchPage - lọc theo trạng thái', () => {
  it('bấm nút trạng thái -> gọi tìm kiếm kèm statuses; bấm thêm -> chọn nhiều; bấm lại -> bỏ chọn', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(mocks.search).toHaveBeenCalled());
    expect(lastParams().statuses).toBeUndefined();

    const group = screen.getByRole('group', { name: 'Lọc theo trạng thái' });
    await user.click(within(group).getByRole('button', { name: 'Bị chặn' }));
    await waitFor(() => expect(lastParams().statuses).toEqual(['BLOCKED']));
    expect(within(group).getByRole('button', { name: 'Bị chặn' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(group).getByRole('button', { name: 'Đang làm' }));
    await waitFor(() => expect(lastParams().statuses).toEqual(['BLOCKED', 'IN_PROGRESS']));

    await user.click(within(group).getByRole('button', { name: 'Bị chặn' }));
    await user.click(within(group).getByRole('button', { name: 'Đang làm' }));
    await waitFor(() => expect(lastParams().statuses).toBeUndefined());
  });

  it('kết quả: thẻ chưa xong có huy hiệu trạng thái, thẻ đã xong thì không (đã có dấu tích)', async () => {
    renderPage();
    const blocked = await screen.findByText('Thẻ a');
    expect(within(blocked.closest('a')!).getByText('Bị chặn')).toBeInTheDocument();
    const done = screen.getByText('Thẻ b');
    expect(within(done.closest('a')!).queryByText('Hoàn thành')).toBeNull();
  });
});
