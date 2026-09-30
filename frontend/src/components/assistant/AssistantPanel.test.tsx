import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantProvider } from '../../context/AssistantContext';
import { QUICK_QUESTIONS } from '../../lib/chatText';
import type { ChatAnswer, ChatCard, ChatReply, ChatUnderstood } from '../../types/chat';
import AssistantButton from './AssistantButton';
import AssistantPanel from './AssistantPanel';

// Tich hop giao dien tro ly (CHATBOT_MODULE.md §13): API bi mock (lib/api/chat co test rieng).

const mocks = vi.hoisted(() => ({
  fetchChatStatus: vi.fn(),
  sendChatMessage: vi.fn(),
  sendChatChoice: vi.fn(),
  fetchMoreAnswer: vi.fn(),
}));
vi.mock('../../lib/api/chat', () => mocks);
vi.mock('../../context/BoardsContext', () => ({
  useBoards: () => ({ boards: [{ id: 'b1', name: 'Bảng Marketing', workspaceId: 'ws2' }] }),
}));
vi.mock('../../context/WorkspacesContext', () => ({
  useWorkspaces: () => ({
    workspaces: [
      { id: 'ws1', name: 'Cá nhân' },
      { id: 'ws2', name: 'Nhóm A' },
    ],
    currentWorkspaceId: 'ws1',
  }),
}));

const GENERATED = '2026-09-30T03:05:00.000Z'; // 10:05 gio VN

function card(id: string, over: Partial<ChatCard> = {}): ChatCard {
  return {
    id,
    title: `Việc ${id}`,
    boardId: 'b1',
    boardName: 'Bảng Marketing',
    listName: 'Đang làm',
    status: 'IN_PROGRESS',
    dueDate: '2026-09-30T10:00:00.000Z', // 17:00 gio VN
    completedAt: null,
    overdue: false,
    checklistDone: 1,
    checklistTotal: 3,
    assignees: ['Trần Lan'],
    ...over,
  };
}

function answer(over: Partial<ChatAnswer> = {}): ChatAnswer {
  return {
    kind: 'ANSWER',
    text: 'Bạn có 12 việc sắp đến hạn trong 7 ngày tới.',
    scopeLabel: 'Tính trên 3 bảng bạn xem được.',
    generatedAt: GENERATED,
    facts: [
      { key: 'total', label: 'Tổng số', value: 12 },
      { key: 'overdue', label: 'Quá hạn', value: 1 },
    ],
    cards: Array.from({ length: 10 }, (_, i) => card(`c${i + 1}`)),
    total: 12,
    page: 1,
    pageSize: 10,
    sections: [],
    ignoredSlots: [],
    notes: ['Chưa tính các mục checklist được giao riêng cho từng người.'],
    suggestions: ['Hôm nay tôi nên xử lý gì trước?'],
    ...over,
  };
}

function reply(over: Partial<ChatAnswer> = {}, understood: Partial<ChatUnderstood> = {}, cid = 'conv-1'): ChatReply {
  return {
    conversationId: cid,
    understood: { intent: 'MY_TASKS', period: 'NEXT_7_DAYS', focus: 'OPEN', memberName: null, parser: 'HYBRID', ...understood },
    answer: answer(over),
  };
}

const httpError = (status: number) =>
  new AxiosError('loi', 'ERR', undefined, undefined, { status, data: { success: false, message: 'Khong dau' } } as AxiosResponse);

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="location">{loc.pathname + loc.search}</output>;
}

/** Hai layout rieng, moi cai co nut Trợ lý rieng (Header bi dung lai khi doi layout nhu app that). */
function LayoutA() {
  return (
    <div data-testid="layout-main">
      <AssistantButton />
      <Outlet />
    </div>
  );
}
function LayoutB() {
  return (
    <div data-testid="layout-board">
      <AssistantButton />
      <Outlet />
    </div>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AssistantProvider>
        <Routes>
          <Route element={<LayoutA />}>
            <Route path="/home" element={<p>Trang chủ</p>} />
            <Route path="/workspaces/:workspaceId" element={<p>Trang không gian</p>} />
          </Route>
          <Route element={<LayoutB />}>
            <Route path="/boards/:boardId" element={<p>Trang bảng</p>} />
          </Route>
        </Routes>
        <AssistantPanel />
        <LocationProbe />
      </AssistantProvider>
    </MemoryRouter>
  );
}

const panel = () => screen.getByRole('dialog', { name: 'Trợ lý công việc' });
const input = () => screen.getByRole('textbox', { name: 'Câu hỏi cho trợ lý' });
async function openPanel() {
  // act async: cho ca luot tai trang thai AI (goi khi mo panel) xong trong act
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Trợ lý' }));
  });
  return panel();
}
/** Bam mot nut gui yeu cau: cho cau tra loi (mock) ve trong act. */
async function clickAsync(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el);
  });
}
async function askQuestion(text: string) {
  fireEvent.change(input(), { target: { value: text } });
  await clickAsync(screen.getByRole('button', { name: 'Gửi' }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.fetchChatStatus.mockResolvedValue({ llmAvailable: true });
});

describe('AssistantPanel: mo / dong', () => {
  it('chua mo thi khong render va KHONG goi API; mo -> hoi trang thai 1 lan; "Chế độ cơ bản" khi khong co AI', async () => {
    mocks.fetchChatStatus.mockResolvedValue({ llmAvailable: false });
    renderAt('/home');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.fetchChatStatus).not.toHaveBeenCalled();

    const btn = screen.getByRole('button', { name: 'Trợ lý' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await openPanel();
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(await within(panel()).findByText('Chế độ cơ bản')).toBeInTheDocument();
    expect(within(panel()).getByText('Chỉ câu hỏi (và số liệu tổng hợp) được gửi tới dịch vụ AI.')).toBeInTheDocument();
    expect(input()).toHaveFocus();

    fireEvent.click(btn); // dong
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(btn); // mo lai: khong hoi trang thai lan nua
    expect(mocks.fetchChatStatus).toHaveBeenCalledTimes(1);
  });

  it('co AI -> khong co nhan "Chế độ cơ bản"; loi tai trang thai -> khong nhan, lan mo sau hoi lai', async () => {
    mocks.fetchChatStatus.mockRejectedValueOnce(new Error('mang')).mockResolvedValue({ llmAvailable: true });
    renderAt('/home');
    await openPanel();
    await waitFor(() => expect(mocks.fetchChatStatus).toHaveBeenCalledTimes(1));
    expect(within(panel()).queryByText('Chế độ cơ bản')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng trợ lý' }));
    await openPanel();
    await waitFor(() => expect(mocks.fetchChatStatus).toHaveBeenCalledTimes(2));
    expect(within(panel()).queryByText('Chế độ cơ bản')).not.toBeInTheDocument();
  });

  it('Esc khi con tro trong panel thi dong; Esc / bam o ngoai panel KHONG dong', async () => {
    renderAt('/home');
    await openPanel();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.mouseDown(screen.getByText('Trang chủ'));
    fireEvent.click(screen.getByText('Trang chủ'));
    expect(panel()).toBeInTheDocument();
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('co hop thoai modal khac de len panel (aria-modal) -> Esc la cua lop do, panel khong dong', async () => {
    renderAt('/home');
    await openPanel();
    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
    try {
      fireEvent.keyDown(input(), { key: 'Escape' });
      expect(panel()).toBeInTheDocument();
    } finally {
      modal.remove();
    }
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('AssistantPanel: pham vi', () => {
  const checked = () => within(panel()).getByRole('radio', { checked: true }).textContent;

  it('mac dinh theo trang: trang chu -> Việc của tôi; /workspaces/:id -> Không gian; trang bang -> Bảng; cau hoi gui dung pham vi', async () => {
    mocks.sendChatMessage.mockResolvedValue(reply());
    const rows: Array<[string, string, unknown, string]> = [
      ['/home', 'Việc của tôi', { kind: 'MY' }, 'Việc của bạn trên mọi bảng bạn xem được.'],
      ['/workspaces/ws2', 'Không gian', { kind: 'WORKSPACE', workspaceId: 'ws2' }, 'Các bảng bạn xem được trong không gian “Nhóm A”.'],
      ['/boards/b1', 'Bảng', { kind: 'BOARD', boardId: 'b1' }, 'Bảng “Bảng Marketing”.'],
    ];
    for (const [path, label, scope, caption] of rows) {
      const view = renderAt(path);
      await openPanel();
      expect(checked(), path).toBe(label);
      expect(within(panel()).getByText(caption)).toBeInTheDocument();
      await askQuestion('Việc của tôi?');
      await waitFor(() => expect(mocks.sendChatMessage).toHaveBeenLastCalledWith({ message: 'Việc của tôi?', scope, conversationId: undefined }));
      // cau thu hai giu DUNG pham vi cua cau dau (da "ghim" khi hoi)
      await askQuestion('còn tuần sau?');
      await waitFor(() => expect(mocks.sendChatMessage).toHaveBeenLastCalledWith({ message: 'còn tuần sau?', scope, conversationId: 'conv-1' }));
      view.unmount();
    }
    // Ngoai trang bang: "Bảng" khong chon duoc
    renderAt('/home');
    await openPanel();
    expect(within(panel()).getByRole('radio', { name: 'Bảng' })).toBeDisabled();
  });

  it('tu chon pham vi: Không gian (mac dinh khong gian cua bang dang mo) + doi khong gian; cau sau gui pham vi moi; doi giua hoi thoai co canh bao', async () => {
    mocks.sendChatMessage.mockResolvedValue(reply());
    renderAt('/boards/b1');
    await openPanel();
    fireEvent.click(within(panel()).getByRole('radio', { name: 'Không gian' }));
    expect(checked()).toBe('Không gian');
    expect(within(panel()).getByRole('combobox', { name: 'Chọn không gian' })).toHaveValue('ws2'); // khong gian cua bang b1
    // van quay lai "Bảng" (bang cua trang) duoc
    expect(within(panel()).getByRole('radio', { name: 'Bảng' })).toBeEnabled();
    fireEvent.click(within(panel()).getByRole('radio', { name: 'Bảng' }));
    expect(checked()).toBe('Bảng');
    expect(within(panel()).getByText('Bảng “Bảng Marketing”.')).toBeInTheDocument();
    fireEvent.click(within(panel()).getByRole('radio', { name: 'Không gian' }));
    fireEvent.change(within(panel()).getByRole('combobox', { name: 'Chọn không gian' }), { target: { value: 'ws1' } });
    await askQuestion('Nhóm thế nào?');
    await waitFor(() => expect(mocks.sendChatMessage).toHaveBeenCalledTimes(1));
    expect(mocks.sendChatMessage.mock.calls[0]![0].scope).toEqual({ kind: 'WORKSPACE', workspaceId: 'ws1' });
    await within(panel()).findByText('Bạn có 12 việc sắp đến hạn trong 7 ngày tới.');

    expect(within(panel()).getByText(/Đổi phạm vi thì câu tiếp theo sẽ không nối tiếp câu trước/)).toBeInTheDocument();
    fireEvent.click(within(panel()).getByRole('radio', { name: 'Việc của tôi' }));
    await askQuestion('còn tuần sau?');
    await waitFor(() => expect(mocks.sendChatMessage).toHaveBeenCalledTimes(2));
    expect(mocks.sendChatMessage.mock.calls[1]![0]).toEqual({ message: 'còn tuần sau?', scope: { kind: 'MY' }, conversationId: 'conv-1' });

    // Hội thoại mới -> bo lua chon tay, pham vi lai theo trang (dang o trang bang)
    fireEvent.click(screen.getByRole('button', { name: 'Hội thoại mới' }));
    expect(checked()).toBe('Bảng');
  });
});

describe('AssistantPanel: hoi - dap', () => {
  it('dang tra loi -> cau tra loi day du: dong "hiểu là", con so, the co lien ket + trang thai / han / checklist / nguoi nhan, ghi chu, pham vi + gio', async () => {
    let resolve!: (r: ChatReply) => void;
    mocks.sendChatMessage.mockReturnValue(new Promise<ChatReply>((r) => (resolve = r)));
    renderAt('/home');
    await openPanel();
    await askQuestion('  Việc nào của tôi sắp đến hạn?  ');
    expect(mocks.sendChatMessage).toHaveBeenCalledWith({ message: 'Việc nào của tôi sắp đến hạn?', scope: { kind: 'MY' }, conversationId: undefined });
    expect(input()).toHaveValue('');
    expect(within(panel()).getByRole('status')).toHaveTextContent('Trợ lý đang trả lời…');
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled();
    // dang cho tra loi: khong doi pham vi, go tiep duoc nhung chua gui duoc
    expect(within(panel()).getByRole('radio', { name: 'Không gian' })).toBeDisabled();
    fireEvent.change(input(), { target: { value: 'Câu tiếp theo' } });
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled();

    const cards = Array.from({ length: 10 }, (_, i) => card(`c${i + 1}`));
    cards[1] = card('c2', { overdue: true, reason: 'OVERDUE', dueDate: '2026-09-28T02:00:00.000Z' });
    cards[2] = card('c3', { checklistTotal: 0, checklistDone: 0, assignees: [], dueDate: null, reason: 'DUE_TODAY' });
    await act(async () => resolve(reply({ cards })));
    const p = panel();
    expect(within(p).getByText('Việc nào của tôi sắp đến hạn?')).toBeInTheDocument();
    expect(p).toHaveTextContent('Trợ lý hiểu là: việc của bạn · chưa xong · 7 ngày tới · hiểu bằng AI + bộ luật');
    expect(within(p).getByText('Tổng số').nextSibling).toHaveTextContent('12');
    const list = within(p).getByRole('list', { name: 'Danh sách việc' });
    expect(within(list).getAllByRole('link')).toHaveLength(10);
    const first = within(list).getByRole('link', { name: /Việc c1\b/ });
    expect(first).toHaveAttribute('href', '/boards/b1?card=c1');
    expect(first).toHaveTextContent('Đang làm'); // trang thai (StatusBadge) + ten danh sach
    expect(first).toHaveTextContent('Hạn 30/09 17:00');
    expect(first).toHaveTextContent('Checklist 1/3');
    expect(first).toHaveTextContent('Trần Lan');
    expect(first).not.toHaveTextContent('Quá hạn');
    const late = within(list).getByRole('link', { name: /Việc c2\b/ });
    expect(late).toHaveTextContent('Quá hạn · 28/09 09:00');
    expect(late).not.toHaveTextContent('Hạn 28/09');
    const bare = within(list).getByRole('link', { name: /Việc c3\b/ });
    expect(bare).toHaveTextContent('Hạn hôm nay'); // nhan ly do (cau hoi uu tien)
    expect(bare).not.toHaveTextContent('Checklist');
    expect(bare).not.toHaveTextContent('Trần Lan');
    expect(bare.textContent).not.toMatch(/Hạn \d/);
    expect(within(p).getByText('Chưa tính các mục checklist được giao riêng cho từng người.')).toBeInTheDocument();
    expect(within(p).getByText('Tính trên 3 bảng bạn xem được. Lúc 10:05.')).toBeInTheDocument();
    expect(within(p).getByRole('button', { name: 'Xem thêm (còn 2 việc)' })).toBeEnabled();
  });

  it('Enter gui, Shift+Enter khong gui, cau rong khong gui; cau thu hai gui kem ma hoi thoai; goi y + cau hoi nhanh gui dung chu', async () => {
    const user = userEvent.setup();
    mocks.sendChatMessage.mockResolvedValue(reply());
    renderAt('/home');
    await openPanel();
    // cau hoi nhanh (hoi thoai rong)
    await user.click(within(panel()).getByRole('button', { name: 'Ai đang có nhiều việc?' }));
    await waitFor(() => expect(mocks.sendChatMessage).toHaveBeenCalledTimes(1));
    expect(mocks.sendChatMessage.mock.calls[0]![0]).toEqual({ message: 'Ai đang có nhiều việc?', scope: { kind: 'MY' }, conversationId: undefined });
    await within(panel()).findByText('Bạn có 12 việc sắp đến hạn trong 7 ngày tới.');

    await user.type(input(), '   ');
    await user.keyboard('{Enter}');
    expect(input()).toHaveValue('   '); // khong gui -> khong xoa o nhap
    await user.type(input(), 'còn{Shift>}{Enter}{/Shift}tuần sau');
    // Enter luc bo go tieng Viet dang ghep chu (IME) -> khong gui
    fireEvent.keyDown(input(), { key: 'Enter', isComposing: true });
    expect(mocks.sendChatMessage).toHaveBeenCalledTimes(1);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(mocks.sendChatMessage).toHaveBeenCalledTimes(2));
    expect(mocks.sendChatMessage.mock.calls[1]![0]).toEqual({ message: 'còn\ntuần sau', scope: { kind: 'MY' }, conversationId: 'conv-1' });

    // goi y chi o luot moi nhat
    await waitFor(() => expect(within(panel()).getAllByRole('button', { name: 'Hôm nay tôi nên xử lý gì trước?' })).toHaveLength(1));
    await user.click(within(panel()).getByRole('button', { name: 'Hôm nay tôi nên xử lý gì trước?' }));
    await waitFor(() => expect(mocks.sendChatMessage).toHaveBeenCalledTimes(3));
    expect(mocks.sendChatMessage.mock.calls[2]![0].message).toBe('Hôm nay tôi nên xử lý gì trước?');
    expect(input()).toHaveAttribute('maxLength', '500');
  });

  it('loi: 429 / 403 / mat mang -> thong diep tieng Viet co dau; hoi thoai khong mat, hoi tiep duoc', async () => {
    mocks.sendChatMessage
      .mockRejectedValueOnce(httpError(429))
      .mockRejectedValueOnce(httpError(403))
      .mockRejectedValueOnce(new AxiosError('Network Error'))
      .mockResolvedValue(reply());
    renderAt('/home');
    await openPanel();
    await askQuestion('Câu một');
    expect(await within(panel()).findByRole('alert')).toHaveTextContent('Bạn hỏi hơi nhiều trong thời gian ngắn. Hãy thử lại sau ít phút.');
    await askQuestion('Câu hai');
    await within(panel()).findByText('Bạn không có quyền xem phạm vi này. Hãy chọn phạm vi khác.');
    await askQuestion('Câu ba');
    await within(panel()).findByText('Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.');
    await askQuestion('Câu bốn');
    await within(panel()).findByText('Bạn có 12 việc sắp đến hạn trong 7 ngày tới.');
    expect(within(panel()).getAllByRole('alert')).toHaveLength(3);
  });

  it('ket qua rong + bang theo nguoi (truong nhom thay cot song song / tam nghi) + nhan xet AI o o rieng + hoi thoai moi phia server', async () => {
    mocks.sendChatMessage
      .mockResolvedValueOnce(reply({ text: 'Bạn không có việc nào quá hạn.', facts: [{ key: 'total', label: 'Tổng số', value: 0 }], cards: [], total: 0 }))
      .mockResolvedValueOnce({
        ...reply(
          {
            text: 'Số việc chưa xong của từng người (2 người).',
            cards: [],
            total: 0,
            rows: [
              { userId: 'u1', name: 'Trần Lan', open: 5, overdue: 2, capacity: 3, pausedUntil: '2026-10-05T00:00:00.000Z' },
              { userId: 'u2', name: 'Hoàng Minh', open: 1, overdue: 0, capacity: null, pausedUntil: null },
            ],
          },
          { intent: 'TEAM_WORKLOAD', period: null, focus: null }
        ),
        conversationReset: true,
      })
      .mockResolvedValueOnce(
        reply(
          {
            text: 'Tuần này, nhóm đã hoàn thành 3 việc.',
            cards: [],
            total: 0,
            sections: [{ key: 'OVERDUE', label: 'Quá hạn', total: 7, cards: [card('o1', { overdue: true }), card('o2', { overdue: true })] }],
            comment: { text: 'Nhóm có 2 việc quá hạn, nên xử lý sớm.', source: 'AI' },
          },
          { intent: 'TEAM_SUMMARY', period: 'THIS_WEEK', focus: null }
        )
      );
    renderAt('/home');
    await openPanel();
    await askQuestion('Việc nào quá hạn?');
    await within(panel()).findByText('Bạn không có việc nào quá hạn.');
    expect(within(panel()).queryByRole('list', { name: 'Danh sách việc' })).not.toBeInTheDocument();
    expect(within(panel()).queryByRole('button', { name: /Xem thêm/ })).not.toBeInTheDocument();

    await askQuestion('Ai nhiều việc?');
    const table = await within(panel()).findByRole('table');
    expect(within(table).getAllByRole('row').map((r) => r.textContent)).toEqual([
      'Thành viênChưa xongQuá hạnSong song tối đaTạm nghỉ đến',
      'Trần Lan52305/10',
      'Hoàng Minh10mặc định—',
    ]);
    expect(within(panel()).getByRole('status')).toHaveTextContent('Hội thoại trước đã hết hạn');

    await askQuestion('Nhóm thế nào?');
    const box = await within(panel()).findByRole('complementary', { name: 'Nhận xét của trợ lý (AI)' });
    expect(box).toHaveTextContent('Nhóm có 2 việc quá hạn, nên xử lý sớm.');
    // danh sach phu (<= 5 the) + so con lai
    const section = within(panel()).getByRole('region', { name: 'Quá hạn' });
    expect(within(section).getByRole('heading')).toHaveTextContent('Quá hạn (7)');
    expect(within(section).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/boards/b1?card=o1', '/boards/b1?card=o2']);
    expect(within(section).getByText('và 5 việc khác.')).toBeInTheDocument();
    expect(within(panel()).queryByRole('status')).not.toBeInTheDocument(); // thong bao cu mat khi hoi cau moi
  });

  it('thanh vien khong thay cot quan ly (server khong gui truong do)', async () => {
    mocks.sendChatMessage.mockResolvedValue(
      reply({ cards: [], total: 0, rows: [{ userId: 'u1', name: 'Trần Lan', open: 5, overdue: 2 }] }, { intent: 'TEAM_WORKLOAD', period: null, focus: null })
    );
    renderAt('/home');
    await openPanel();
    await askQuestion('Ai nhiều việc?');
    const table = await within(panel()).findByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Thành viên', 'Chưa xong', 'Quá hạn']);
  });
});

describe('AssistantPanel: hoi lai + xem them', () => {
  it('"Ý bạn là ai?" -> bam ten gui choice USER; lua chon cu khong bam duoc nua; hoi lai chon khong gian gui WORKSPACE', async () => {
    mocks.sendChatMessage
      .mockResolvedValueOnce(
        reply(
          { kind: 'CLARIFY', text: 'Có nhiều người khớp với “Lan”. Ý bạn là ai?', cards: [], total: 0, facts: [], suggestions: [], notes: [], clarify: { question: 'Ý bạn là ai?', options: [{ id: 'u1', label: 'Nguyễn Thị Lan', kind: 'USER' }, { id: 'u2', label: 'Trần Lan', kind: 'USER' }] } },
          { intent: 'MEMBER_TASKS', memberName: null }
        )
      )
      .mockResolvedValueOnce(
        reply(
          { kind: 'CLARIFY', text: 'Bạn muốn xem trong không gian nào?', cards: [], total: 0, facts: [], suggestions: [], notes: [], clarify: { question: 'Bạn muốn xem trong không gian nào?', options: [{ id: 'ws2', label: 'Nhóm A', kind: 'WORKSPACE' }] } },
          { intent: 'TEAM_SUMMARY' }
        )
      );
    mocks.sendChatChoice.mockResolvedValue(reply({ text: 'Trần Lan có 2 việc chưa xong.' }, { intent: 'MEMBER_TASKS', memberName: 'Trần Lan' }));
    renderAt('/home');
    await openPanel();
    await askQuestion('Lan đang làm gì?');
    const group = await within(panel()).findByRole('group', { name: 'Ý bạn là ai?' });
    await clickAsync(within(group).getByRole('button', { name: 'Trần Lan' }));
    expect(mocks.sendChatChoice).toHaveBeenCalledWith('conv-1', { id: 'u2', label: 'Trần Lan', kind: 'USER' });
    await within(panel()).findByText('Trần Lan có 2 việc chưa xong.');
    expect(within(panel()).getByText('Chọn: Trần Lan')).toBeInTheDocument();
    expect(panel()).toHaveTextContent('Trợ lý hiểu là: việc của Trần Lan · chưa xong');
    expect(within(group).getByRole('button', { name: 'Nguyễn Thị Lan' })).toBeDisabled(); // khong con la luot moi nhat

    await askQuestion('Nhóm thế nào?');
    const ws = await within(panel()).findByRole('group', { name: 'Bạn muốn xem trong không gian nào?' });
    await clickAsync(within(ws).getByRole('button', { name: 'Nhóm A' }));
    expect(mocks.sendChatChoice).toHaveBeenLastCalledWith('conv-1', { id: 'ws2', label: 'Nhóm A', kind: 'WORKSPACE' });
  });

  it('chon khi hoi thoai phia server da het han (404) -> "Hội thoại đã hết hạn", cau sau gui KHONG kem ma cu', async () => {
    mocks.sendChatMessage
      .mockResolvedValueOnce(
        reply(
          { kind: 'CLARIFY', text: 'Ý bạn là ai?', cards: [], total: 0, facts: [], suggestions: [], notes: [], clarify: { question: 'Ý bạn là ai?', options: [{ id: 'u2', label: 'Trần Lan', kind: 'USER' }] } },
          { intent: 'MEMBER_TASKS' }
        )
      )
      .mockResolvedValue(reply());
    mocks.sendChatChoice.mockRejectedValueOnce(httpError(404));
    renderAt('/home');
    await openPanel();
    await askQuestion('Lan đang làm gì?');
    await clickAsync(await within(panel()).findByRole('button', { name: 'Trần Lan' }));
    expect(await within(panel()).findByRole('alert')).toHaveTextContent('Hội thoại đã hết hạn. Hãy hỏi lại câu hỏi.');
    await askQuestion('Lan đang làm gì?');
    await waitFor(() => expect(mocks.sendChatMessage).toHaveBeenCalledTimes(2));
    expect(mocks.sendChatMessage.mock.calls[1]![0].conversationId).toBeUndefined();
  });

  it('"Xem thêm": goi trang 2, noi the (bo trung), het thi an nut; chi luot moi nhat co nut', async () => {
    mocks.sendChatMessage.mockResolvedValueOnce(reply()).mockResolvedValueOnce(reply({ text: 'Câu thứ hai.', cards: [card('x1')], total: 1 }));
    mocks.fetchMoreAnswer.mockResolvedValue(reply({ cards: [card('c10'), card('c11'), card('c12')], page: 2, total: 12, generatedAt: '2026-09-30T03:06:00.000Z' }));
    renderAt('/home');
    await openPanel();
    await askQuestion('Việc sắp đến hạn?');
    await clickAsync(await within(panel()).findByRole('button', { name: 'Xem thêm (còn 2 việc)' }));
    expect(mocks.fetchMoreAnswer).toHaveBeenCalledWith('conv-1', 2);
    await waitFor(() => expect(within(panel()).getAllByRole('link')).toHaveLength(12));
    expect(within(panel()).queryByRole('button', { name: /Xem thêm/ })).not.toBeInTheDocument();
    expect(within(panel()).getByText('Tính trên 3 bảng bạn xem được. Lúc 10:06.')).toBeInTheDocument();

    // luot cu con the chua hien -> khong co nut (server chi "xem them" duoc cau tra loi cuoi)
    mocks.sendChatMessage.mockReset().mockResolvedValueOnce(reply()).mockResolvedValueOnce(reply({ text: 'Câu thứ hai.', cards: [card('x1')], total: 1 }));
    fireEvent.click(screen.getByRole('button', { name: 'Hội thoại mới' }));
    await askQuestion('Một');
    await within(panel()).findByRole('button', { name: 'Xem thêm (còn 2 việc)' });
    await askQuestion('Hai');
    await within(panel()).findByText('Câu thứ hai.');
    expect(within(panel()).queryByRole('button', { name: /Xem thêm/ })).not.toBeInTheDocument();
    expect(within(panel()).getByText('Còn 2 việc chưa hiện — hỏi lại để xem đầy đủ.')).toBeInTheDocument();
  });

  it('"Xem thêm" 404 -> "Hội thoại đã hết hạn", cau sau gui KHONG kem ma cu; server bao nguoi da roi nhom -> hien ly do', async () => {
    mocks.sendChatMessage.mockResolvedValue(reply());
    mocks.fetchMoreAnswer.mockRejectedValueOnce(httpError(404));
    renderAt('/home');
    await openPanel();
    await askQuestion('Một');
    await clickAsync(await within(panel()).findByRole('button', { name: 'Xem thêm (còn 2 việc)' }));
    await within(panel()).findByText('Hội thoại đã hết hạn. Hãy hỏi lại câu hỏi.');
    await askQuestion('Hai');
    await waitFor(() => expect(mocks.sendChatMessage).toHaveBeenCalledTimes(2));
    expect(mocks.sendChatMessage.mock.calls[1]![0].conversationId).toBeUndefined();

    mocks.fetchMoreAnswer.mockResolvedValueOnce(reply({ text: 'Không tìm thấy “người bạn hỏi” trong không gian “Nhóm A”.', cards: [], total: 0, page: 1 }));
    await clickAsync(await within(panel()).findByRole('button', { name: 'Xem thêm (còn 2 việc)' }));
    await within(panel()).findByText('Không tìm thấy “người bạn hỏi” trong không gian “Nhóm A”.');
    expect(within(panel()).queryByRole('button', { name: /Xem thêm/ })).not.toBeInTheDocument();
  });
});

describe('AssistantPanel: giu hoi thoai khi doi trang', () => {
  it('bam lien ket the tu trang chu sang trang bang (DOI LAYOUT): hoi thoai con nguyen, pham vi giu "Việc của tôi"; Hội thoại mới -> pham vi theo trang', async () => {
    mocks.sendChatMessage.mockResolvedValue(reply());
    renderAt('/home');
    await openPanel();
    await askQuestion('Việc sắp đến hạn?');
    const link = await within(panel()).findByRole('link', { name: /Việc c3\b/ });
    link.focus();
    fireEvent.click(link);
    // Loi tim thay khi thu tren trinh duyet: con tro o lai lien ket trong panel -> Esc (dinh dong the
    // vua mo) lai dong panel. Bam lien ket phai dua con tro ra khoi panel.
    expect(document.activeElement).not.toBe(link);
    expect(panel().contains(document.activeElement)).toBe(false);
    expect(screen.getByTestId('location')).toHaveTextContent('/boards/b1?card=c3');
    expect(screen.getByTestId('layout-board')).toBeInTheDocument();
    expect(screen.queryByTestId('layout-main')).not.toBeInTheDocument();

    // panel + hoi thoai con nguyen; nut tren layout moi biet panel dang mo
    expect(within(panel()).getByText('Bạn có 12 việc sắp đến hạn trong 7 ngày tới.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trợ lý' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(panel()).getByRole('radio', { checked: true })).toHaveTextContent('Việc của tôi');

    await askQuestion('còn tuần sau?');
    await waitFor(() => expect(mocks.sendChatMessage).toHaveBeenCalledTimes(2));
    expect(mocks.sendChatMessage.mock.calls[1]![0]).toEqual({ message: 'còn tuần sau?', scope: { kind: 'MY' }, conversationId: 'conv-1' });

    fireEvent.click(screen.getByRole('button', { name: 'Hội thoại mới' }));
    expect(within(panel()).queryByRole('list', { name: 'Hội thoại' })).not.toBeInTheDocument();
    expect(within(panel()).getByRole('radio', { checked: true })).toHaveTextContent('Bảng');
    await askQuestion('Bảng này thế nào?');
    await waitFor(() => expect(mocks.sendChatMessage).toHaveBeenCalledTimes(3));
    expect(mocks.sendChatMessage.mock.calls[2]![0]).toEqual({ message: 'Bảng này thế nào?', scope: { kind: 'BOARD', boardId: 'b1' }, conversationId: undefined });
  });
});

describe('AssistantPanel: cau tra loi danh muc (§18)', () => {
  const table = (over: Partial<NonNullable<ChatAnswer['table']>> = {}): NonNullable<ChatAnswer['table']> => ({
    columns: ['Bảng', 'Không gian', 'Bạn là'],
    rows: [
      { cells: ['Kế hoạch Marketing', 'Nhóm A', 'Chủ bảng'], boardId: 'b1' },
      { cells: ['Việc cá nhân', 'Cá nhân', 'Xem nhờ không gian'], boardId: 'b/2' },
    ],
    total: 2,
    ...over,
  });
  const catalogAnswer = (over: Partial<ChatAnswer> = {}): Partial<ChatAnswer> => ({
    text: 'Bạn xem được 2 bảng, trong đó bạn tham gia trực tiếp 1 bảng.',
    facts: [{ key: 'total', label: 'Bảng xem được', value: 2 }],
    cards: [],
    total: 0,
    notes: ['Chỉ tính bảng bạn có quyền đọc.'],
    suggestions: ['Tôi thuộc những không gian nào?'],
    table: table(),
    ...over,
  });

  it('bang ket qua: tieu de cot, dong, o dau la lien ket mo bang (id duoc ma hoa), khong co danh sach viec / "Xem them"; bam lien ket doi trang va roi khoi panel', async () => {
    mocks.sendChatMessage.mockResolvedValue(reply(catalogAnswer(), { intent: 'MY_BOARDS', period: null, focus: null }));
    renderAt('/home');
    await openPanel();
    await askQuestion('Tôi đang ở bao nhiêu bảng?');
    const t = await within(panel()).findByRole('table');
    expect(within(t).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Bảng', 'Không gian', 'Bạn là']);
    expect(within(t).getAllByRole('row')).toHaveLength(3);
    expect(panel()).toHaveTextContent('Trợ lý hiểu là: các bảng của bạn');
    expect(panel()).toHaveTextContent('Bạn xem được 2 bảng, trong đó bạn tham gia trực tiếp 1 bảng.');
    expect(panel()).toHaveTextContent('Chỉ tính bảng bạn có quyền đọc.');
    expect(within(panel()).queryByRole('list', { name: 'Danh sách việc' })).not.toBeInTheDocument();
    expect(within(panel()).queryByRole('button', { name: /Xem thêm/ })).not.toBeInTheDocument();

    const first = within(t).getByRole('link', { name: 'Kế hoạch Marketing' });
    expect(first).toHaveAttribute('href', '/boards/b1');
    expect(within(t).getByRole('link', { name: 'Việc cá nhân' })).toHaveAttribute('href', '/boards/b%2F2'); // id co ky tu dac biet duoc ma hoa
    expect(within(t).getAllByRole('link')).toHaveLength(2); // chi o dau cua moi dong
    expect(within(t).getByText('Xem nhờ không gian')).toBeInTheDocument();

    first.focus();
    fireEvent.click(first);
    expect(panel().contains(document.activeElement)).toBe(false); // giong lien ket the: Esc khong dong panel
    expect(screen.getByTestId('location')).toHaveTextContent('/boards/b1');
    expect(within(panel()).getByText('Tôi đang ở bao nhiêu bảng?')).toBeInTheDocument(); // hoi thoai con nguyen
  });

  it('dem the theo cot: so canh phai, dong "hiểu là" co ten bang / cot da nhan dien; dong khong co boardId khong la lien ket', async () => {
    mocks.sendChatMessage.mockResolvedValue(
      reply(
        catalogAnswer({
          text: 'Bảng “Sprint 12” có 6 thẻ: 4 chưa xong, 2 đã hoàn thành.',
          table: { columns: ['Cột', 'Chưa xong', 'Đã xong', 'Tổng'], rows: [{ cells: ['Đang làm', 4, 0, 4] }, { cells: ['Xong', 0, 2, 2] }], total: 2 },
          facts: [{ key: 'open', label: 'Chưa xong', value: 4 }],
        }),
        { intent: 'CARD_COUNTS', period: null, focus: null, targetName: 'Sprint 12', columnName: null }
      )
    );
    renderAt('/home');
    await openPanel();
    await askQuestion('Bảng Sprint 12 có bao nhiêu thẻ?');
    const t = await within(panel()).findByRole('table');
    expect(panel()).toHaveTextContent('Trợ lý hiểu là: số thẻ · Sprint 12');
    expect(within(t).queryByRole('link')).not.toBeInTheDocument();
    const cells = within(t).getAllByRole('cell');
    expect(cells.map((c) => c.textContent)).toEqual(['Đang làm', '4', '0', '4', 'Xong', '0', '2', '2']);
    expect(cells[0]).not.toHaveClass('text-right');
    for (const numeric of [cells[1], cells[2], cells[3], cells[7]]) expect(numeric).toHaveClass('text-right', 'tabular-nums');
    expect(within(t).getAllByRole('columnheader')[1]).toHaveClass('text-right');
    expect(within(t).getAllByRole('columnheader')[0]).not.toHaveClass('text-right');
  });

  it('bang rong / khong co bang -> khong ve bang; cau tra loi van hien cau dan + so', async () => {
    mocks.sendChatMessage
      .mockResolvedValueOnce(reply(catalogAnswer({ text: 'Bạn chưa xem được bảng nào.', table: table({ rows: [], total: 0 }) }), { intent: 'MY_BOARDS' }))
      .mockResolvedValueOnce(reply(catalogAnswer({ text: 'Không tìm thấy bảng “abc”.', table: undefined, facts: [] }), { intent: 'CARD_COUNTS' }));
    renderAt('/home');
    await openPanel();
    await askQuestion('Tôi đang ở bao nhiêu bảng?');
    await within(panel()).findByText('Bạn chưa xem được bảng nào.');
    expect(within(panel()).queryByRole('table')).not.toBeInTheDocument();
    await askQuestion('Bảng abc có bao nhiêu thẻ?');
    await within(panel()).findByText('Không tìm thấy bảng “abc”.');
    expect(within(panel()).queryByRole('table')).not.toBeInTheDocument();
  });

  it('trung ten bang / khong gian: nut chon kieu TARGET gui targetId; lua chon cu khong bam duoc nua; ket qua co bang', async () => {
    mocks.sendChatMessage.mockResolvedValueOnce(
      reply(
        {
          kind: 'CLARIFY',
          text: 'Có nhiều bảng hoặc không gian khớp với “Website”. Ý bạn là cái nào?',
          cards: [],
          total: 0,
          facts: [],
          suggestions: [],
          notes: [],
          clarify: {
            question: 'Ý bạn là cái nào?',
            options: [
              { id: 'b4', label: 'Bảng Website (Kỹ thuật)', kind: 'TARGET' },
              { id: 'b10', label: 'Bảng Website (Marketing)', kind: 'TARGET' },
            ],
          },
        },
        { intent: 'CARD_COUNTS', period: null, focus: null }
      )
    );
    mocks.sendChatChoice.mockResolvedValue(
      reply(
        catalogAnswer({ text: 'Bảng “Website” có 3 thẻ: 3 chưa xong, 0 đã hoàn thành.', table: { columns: ['Cột', 'Tổng'], rows: [{ cells: ['Cần làm', 3] }], total: 1 } }),
        { intent: 'CARD_COUNTS', targetName: 'Website' }
      )
    );
    renderAt('/home');
    await openPanel();
    await askQuestion('Bảng Website có bao nhiêu thẻ?');
    const group = await within(panel()).findByRole('group', { name: 'Ý bạn là cái nào?' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Bảng Website (Kỹ thuật)', 'Bảng Website (Marketing)']);
    await clickAsync(within(group).getByRole('button', { name: 'Bảng Website (Marketing)' }));
    expect(mocks.sendChatChoice).toHaveBeenCalledWith('conv-1', { id: 'b10', label: 'Bảng Website (Marketing)', kind: 'TARGET' });
    await within(panel()).findByText('Bảng “Website” có 3 thẻ: 3 chưa xong, 0 đã hoàn thành.');
    expect(within(panel()).getByText('Chọn: Bảng Website (Marketing)')).toBeInTheDocument();
    expect(panel()).toHaveTextContent('Trợ lý hiểu là: số thẻ · Website');
    expect(within(panel()).getByRole('table')).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Bảng Website (Kỹ thuật)' })).toBeDisabled();
  });

  it('cau hoi nhanh thu nam ("Tôi đang ở bao nhiêu bảng?") gui dung chu voi pham vi hien tai', async () => {
    mocks.sendChatMessage.mockResolvedValue(reply(catalogAnswer(), { intent: 'MY_BOARDS' }));
    renderAt('/home');
    await openPanel();
    const quick = within(panel()).getAllByRole('button').filter((b) => QUICK_QUESTIONS.includes(b.textContent ?? ''));
    expect(quick.map((b) => b.textContent)).toEqual(QUICK_QUESTIONS);
    await clickAsync(within(panel()).getByRole('button', { name: 'Tôi đang ở bao nhiêu bảng?' }));
    expect(mocks.sendChatMessage).toHaveBeenCalledWith({ message: 'Tôi đang ở bao nhiêu bảng?', scope: { kind: 'MY' }, conversationId: undefined });
    await within(panel()).findByRole('table');
  });
});
