import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { AssistantTurn } from '../../context/AssistantContext';
import type { ChatActionPlan, ChatActionResult, ChatActionView, ChatReply, ChatScope } from '../../types/chat';
import ActionCard from './ActionCard';

// Khoi thao tac (Phase 1) o muc thanh phan: moi trang thai cua ban xem truoc va ket qua, khong qua AssistantContext.

const plan = (over: Partial<ChatActionPlan> = {}): ChatActionPlan => ({
  planId: 'p1', checksum: 'c'.repeat(64), status: 'PROPOSED', risk: 'MEDIUM', requiresConfirmation: true, canConfirm: true,
  reasons: [{ code: 'FUZZY_DATE', text: 'Ngày hạn bạn nói còn mơ hồ (ví dụ “cuối tuần”). Hãy kiểm tra ngày mình đã hiểu.' }],
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), boardId: 'b1', boardName: 'Dự án Alpha',
  items: [{ index: 0, verb: 'Đặt hạn', text: '“Thiết kế giao diện”', detail: 'Chủ nhật, 11/10/2026', cardId: 'c1' }], warnings: ['Ngày hạn được lấy theo đúng câu của bạn (khác với ngày AI đề xuất).'], ...over,
});
const result = (over: Partial<ChatActionResult> = {}): ChatActionResult => ({
  planId: 'p1', status: 'EXECUTED', autoExecuted: false, summary: 'Đã đặt hạn cho thẻ “Thiết kế giao diện”: Chủ nhật, 11/10/2026.', boardId: 'b1', cardId: 'c1', warnings: [], ...over,
});
function turnOf(action: ChatActionView | undefined, over: Partial<AssistantTurn> = {}): AssistantTurn {
  const reply = { conversationId: 'conv', understood: {}, answer: { kind: 'ANSWER', text: '', action } } as unknown as ChatReply;
  return { id: 1, question: 'q', status: 'done', reply, cards: [], page: 1, error: null, loadingMore: false, moreError: null, actionBusy: false, actionError: null, ...over };
}
function renderCard(turn: AssistantTurn, scope: ChatScope = { kind: 'MY' }, busy = false) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<MemoryRouter><ActionCard turn={turn} scope={scope} busy={busy} onConfirm={onConfirm} onCancel={onCancel} /></MemoryRouter>);
  return { onConfirm, onCancel };
}

describe('ActionCard: ban xem truoc', () => {
  it('hien ten bang, thao tac, ly do can xem lai, canh bao va gio het han; Ap dung / Huy goi dung ham voi dung luot', () => {
    const turn = turnOf({ kind: 'PLAN', plan: plan() });
    const { onConfirm, onCancel } = renderCard(turn);
    const block = screen.getByRole('region', { name: 'Kế hoạch thao tác' });
    expect(within(block).getByRole('link', { name: 'Dự án Alpha' })).toHaveAttribute('href', '/boards/b1');
    expect(within(block).getByText('Đặt hạn')).toBeInTheDocument();
    expect(within(block).getByText('Chủ nhật, 11/10/2026')).toBeInTheDocument();
    expect(within(block).getByRole('note')).toHaveTextContent('Cần bạn xem lại trước khi áp dụng');
    expect(within(block).getByRole('note')).toHaveTextContent('Ngày hạn bạn nói còn mơ hồ');
    expect(within(block).getByText('Ngày hạn được lấy theo đúng câu của bạn (khác với ngày AI đề xuất).')).toBeInTheDocument();
    fireEvent.click(within(block).getByRole('button', { name: 'Áp dụng' }));
    expect(onConfirm).toHaveBeenCalledWith(turn);
    fireEvent.click(within(block).getByRole('button', { name: 'Hủy' }));
    expect(onCancel).toHaveBeenCalledWith(turn);
  });

  it('khong co ly do thi khong ve khung "can xem lai"', () => {
    renderCard(turnOf({ kind: 'PLAN', plan: plan({ reasons: [], warnings: [] }) }));
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('dang chay (EXECUTING) hoac cho chon: khong co nut, noi ro dang thuc hien', () => {
    renderCard(turnOf({ kind: 'PLAN', plan: plan({ status: 'EXECUTING', canConfirm: false }) }));
    expect(screen.getByText('Kế hoạch đang được thực hiện…')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('dang gui Ap dung (busy): ca hai nut khoa; hien loi neu lan truoc that bai', () => {
    renderCard(turnOf({ kind: 'PLAN', plan: plan() }, { actionBusy: true, actionError: 'Kế hoạch đã thay đổi hoặc đang được xử lý.' }), { kind: 'MY' }, true);
    expect(screen.getByRole('button', { name: 'Đang áp dụng…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Kế hoạch đã thay đổi hoặc đang được xử lý.');
  });

  it('o trang bang trung khop thi dung duoc; khac bang thi khoa va giai thich; trang chu khong han che', () => {
    const view = turnOf({ kind: 'PLAN', plan: plan() });
    const same = renderCard(view, { kind: 'BOARD', boardId: 'b1' });
    expect(screen.getByRole('button', { name: 'Áp dụng' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    expect(same.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('khac bang: khoa nut va noi ro chua thay doi gi', () => {
    const { onConfirm } = renderCard(turnOf({ kind: 'PLAN', plan: plan() }), { kind: 'BOARD', boardId: 'b2' });
    expect(screen.getByRole('button', { name: 'Áp dụng' })).toBeDisabled();
    expect(screen.getByText(/thuộc bảng khác với bảng đang mở nên không áp dụng được ở đây\. Chưa thay đổi gì\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('het han: khoa Ap dung va Huy, noi ro chua thay doi gi', () => {
    renderCard(turnOf({ kind: 'PLAN', plan: plan({ canConfirm: false, expiresAt: new Date(Date.now() - 1000).toISOString() }) }));
    expect(screen.getByText('Kế hoạch đã hết hạn. Hãy gửi lại lệnh. Chưa thay đổi gì.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Áp dụng' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled();
  });
});

describe('ActionCard: ket qua', () => {
  it.each([
    ['EXECUTED', 'Đã thực hiện'],
    ['FAILED', 'Chưa thực hiện được'],
    ['STALE', 'Dữ liệu đã thay đổi'],
    ['CANCELLED', 'Đã hủy'],
    ['EXPIRED', 'Đã hết hạn'],
  ] as const)('trang thai %s co nhan "%s"', (status, label) => {
    renderCard(turnOf({ kind: 'RESULT', result: result({ status }) }));
    const block = screen.getByRole('region', { name: 'Kết quả thao tác' });
    expect(within(block).getByText(label)).toBeInTheDocument();
    expect(within(block).queryByRole('button')).not.toBeInTheDocument();
    // chi thao tac DA CHAY moi co lien ket mo the
    if (status === 'EXECUTED') expect(within(block).getByRole('link', { name: 'Mở thẻ' })).toHaveAttribute('href', '/boards/b1?card=c1');
    else expect(within(block).queryByRole('link', { name: 'Mở thẻ' })).not.toBeInTheDocument();
  });

  it('tu chay: ghi "theo lenh cua ban"; ap dung lai: ghi da ap dung truoc do; canh bao hien day du', () => {
    renderCard(turnOf({ kind: 'RESULT', result: result({ autoExecuted: true, alreadyApplied: true, warnings: ['Thông báo chưa gửi được.'] }) }));
    expect(screen.getByText('Đã thực hiện · theo lệnh của bạn')).toBeInTheDocument();
    expect(screen.getByText('Kế hoạch này đã được áp dụng trước đó, không ghi thêm lần nữa.')).toBeInTheDocument();
    expect(screen.getByText('Thông báo chưa gửi được.')).toBeInTheDocument();
  });

  it('vung bao ngoai la aria-live="polite" de doc ket qua khi the xem truoc doi thanh ket qua', () => {
    const { container } = render(
      <MemoryRouter>
        <ActionCard turn={turnOf({ kind: 'RESULT', result: result() })} scope={{ kind: 'MY' }} busy={false} onConfirm={vi.fn()} onCancel={vi.fn()} />
      </MemoryRouter>
    );
    expect(container.firstElementChild).toHaveAttribute('aria-live', 'polite');
  });

  it('khong co hanh dong thi khong ve gi', () => {
    const { container } = render(
      <MemoryRouter>
        <ActionCard turn={turnOf(undefined)} scope={{ kind: 'MY' }} busy={false} onConfirm={vi.fn()} onCancel={vi.fn()} />
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });
});

// ---------- Phase 2: ke hoach NHIEU thao tac ----------
const multiPlan = (over: Partial<ChatActionPlan> = {}): ChatActionPlan =>
  plan({
    risk: 'MEDIUM',
    opCount: 4,
    reasons: [
      { code: 'MULTI_OP', text: 'Lệnh gồm nhiều thay đổi cùng lúc nên mình luôn cho bạn xem lại trước khi áp dụng.' },
      { code: 'NEW_STRUCTURE', text: 'Tạo cột làm thay đổi cấu trúc của bảng nên cần bạn xác nhận.' },
    ],
    warnings: [],
    items: [
      { index: 0, verb: 'Tạo cột', text: '“Kiểm thử”', detail: 'Trạng thái cột: Chờ duyệt' },
      { index: 1, verb: 'Tạo thẻ', text: '“Unit Test”', detail: 'Trong cột mới “Kiểm thử”' },
      { index: 2, verb: 'Tạo thẻ', text: '“API Test”', detail: 'Trong cột mới “Kiểm thử”' },
      { index: 3, verb: 'Giao thẻ', text: '“API Test” (thẻ mới) cho Nguyễn Lan', cardId: 'c9' },
    ],
    ...over,
  });

describe('ActionCard: ban xem truoc NHIEU thao tac', () => {
  it('hien so thay doi, danh sach danh so theo thu tu chay, ly do va nut ghi ro so thay doi; Ap dung / Huy van goi dung', () => {
    const turn = turnOf({ kind: 'PLAN', plan: multiPlan() });
    const { onConfirm, onCancel } = renderCard(turn);
    const block = screen.getByRole('region', { name: 'Kế hoạch thao tác' });
    expect(within(block).getByRole('heading')).toHaveTextContent('4 thay đổi trên bảng Dự án Alpha');
    const steps = within(block.querySelector('ol') as HTMLElement).getAllByRole('listitem'); // danh sách bước (khác danh sách lý do trong khung ghi chú)
    expect(steps).toHaveLength(4);
    expect(steps.map((s) => s.textContent)).toEqual([
      'Tạo cột “Kiểm thử”Trạng thái cột: Chờ duyệt',
      'Tạo thẻ “Unit Test”Trong cột mới “Kiểm thử”',
      'Tạo thẻ “API Test”Trong cột mới “Kiểm thử”',
      'Giao thẻ “API Test” (thẻ mới) cho Nguyễn LanMở thẻ',
    ]);
    expect(within(block).getByText(/làm tất cả hoặc không làm gì/)).toBeInTheDocument();
    expect(within(block).getByRole('note')).toHaveTextContent('Lệnh gồm nhiều thay đổi cùng lúc');
    expect(within(block).getByRole('note')).toHaveTextContent('Tạo cột làm thay đổi cấu trúc');
    fireEvent.click(within(block).getByRole('button', { name: 'Áp dụng 4 thay đổi' }));
    expect(onConfirm).toHaveBeenCalledWith(turn);
    fireEvent.click(within(block).getByRole('button', { name: 'Hủy' }));
    expect(onCancel).toHaveBeenCalledWith(turn);
  });

  it('đúng hai thao tác đã là kế hoạch nhiều thao tác (danh sách đánh số, nút ghi "2 thay đổi")', () => {
    const two = multiPlan({ opCount: 2, items: multiPlan().items.slice(0, 2), reasons: [{ code: 'MULTI_OP', text: 'Lệnh gồm nhiều thay đổi cùng lúc nên mình luôn cho bạn xem lại trước khi áp dụng.' }] });
    renderCard(turnOf({ kind: 'PLAN', plan: two }));
    expect(screen.getByRole('heading')).toHaveTextContent('2 thay đổi trên bảng Dự án Alpha');
    expect(screen.getByRole('button', { name: 'Áp dụng 2 thay đổi' })).toBeInTheDocument();
  });

  it('máy chủ cũ không gửi opCount: dùng số dòng; một thao tác giữ giao diện cũ (ul, nút "Áp dụng")', () => {
    const { container } = render(
      <MemoryRouter>
        <ActionCard turn={turnOf({ kind: 'PLAN', plan: plan() })} scope={{ kind: 'MY' }} busy={false} onConfirm={vi.fn()} onCancel={vi.fn()} />
      </MemoryRouter>
    );
    expect(container.querySelector('ol')).toBeNull();
    expect(screen.getByRole('button', { name: 'Áp dụng' })).toBeInTheDocument();
    expect(screen.getByRole('heading')).toHaveTextContent('Thao tác trên bảng Dự án Alpha');
  });

  it('đang áp dụng: khóa cả hai nút; hết hạn: khóa và nói rõ chưa thay đổi gì; khác bảng: khóa', () => {
    renderCard(turnOf({ kind: 'PLAN', plan: multiPlan() }, { actionBusy: true }), { kind: 'MY' }, true);
    expect(screen.getByRole('button', { name: 'Đang áp dụng…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled();
  });

  it('hết hạn hoặc sai bảng thì không bấm được Áp dụng', () => {
    const { onConfirm } = renderCard(turnOf({ kind: 'PLAN', plan: multiPlan({ canConfirm: false, expiresAt: new Date(Date.now() - 1000).toISOString() }) }));
    expect(screen.getByText('Kế hoạch đã hết hạn. Hãy gửi lại lệnh. Chưa thay đổi gì.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Áp dụng 4 thay đổi' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng 4 thay đổi' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('ActionCard: ket qua NHIEU thao tac', () => {
  const lines = ['Đã tạo cột “Kiểm thử”.', 'Đã tạo thẻ “Unit Test” trong cột “Kiểm thử”.', 'Đã tạo thẻ “API Test” trong cột “Kiểm thử”.'];

  it('đã áp dụng: tóm tắt + từng bước đã làm theo thứ tự', () => {
    renderCard(turnOf({ kind: 'RESULT', result: result({ summary: 'Đã áp dụng 3 thay đổi trên bảng “Dự án Alpha”.', opCount: 3, details: lines, cardIds: ['c1', 'c2'] }) }));
    const block = screen.getByRole('region', { name: 'Kết quả thao tác' });
    expect(within(block).getByText('Đã áp dụng 3 thay đổi trên bảng “Dự án Alpha”.')).toBeInTheDocument();
    expect(within(block).getAllByRole('listitem').map((l) => l.textContent)).toEqual(lines);
  });

  it('kế hoạch cũ (STALE) và lỗi (FAILED): hiện đúng nhãn, câu giải thích của máy chủ, không liệt kê bước nào đã làm', () => {
    renderCard(turnOf({ kind: 'RESULT', result: result({ status: 'STALE', summary: 'Thẻ đã được chuyển sang cột khác kể từ lúc xem trước. Dữ liệu đã thay đổi nên chưa thay đổi gì.', cardId: undefined, opCount: 3 }) }));
    const block = screen.getByRole('region', { name: 'Kết quả thao tác' });
    expect(within(block).getByText('Dữ liệu đã thay đổi')).toBeInTheDocument();
    expect(within(block).getByText(/chuyển sang cột khác kể từ lúc xem trước/)).toBeInTheDocument();
    expect(within(block).queryByRole('listitem')).not.toBeInTheDocument();
    expect(within(block).queryByRole('link', { name: 'Mở thẻ' })).not.toBeInTheDocument();
  });

  it('đã áp dụng trước đó (bấm đúp): báo không ghi thêm', () => {
    renderCard(turnOf({ kind: 'RESULT', result: result({ alreadyApplied: true, summary: 'Đã áp dụng 3 thay đổi trên bảng “Dự án Alpha”.', details: lines, opCount: 3 }) }));
    expect(screen.getByText('Kế hoạch này đã được áp dụng trước đó, không ghi thêm lần nữa.')).toBeInTheDocument();
  });
});
