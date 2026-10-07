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
