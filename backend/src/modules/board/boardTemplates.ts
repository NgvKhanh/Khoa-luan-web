// Cac mau bang co san. Nguoi dung chon 1 mau -> tao ngay 1 bang day du list + the.

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  color: string;
  lists: { name: string; cards: string[] }[];
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'kanban',
    name: 'Kanban cơ bản',
    description: 'Ba cột đơn giản để theo dõi công việc hằng ngày.',
    color: '#0079BF',
    lists: [
      {
        name: 'Cần làm',
        cards: ['Ví dụ: Lên kế hoạch tuần', 'Ví dụ: Trả lời email'],
      },
      { name: 'Đang làm', cards: ['Ví dụ: Viết báo cáo'] },
      { name: 'Hoàn thành', cards: [] },
    ],
  },
  {
    id: 'project',
    name: 'Quản lý dự án',
    description: 'Quy trình đầy đủ từ ý tưởng đến bàn giao, kèm cột tạm hoãn.',
    color: '#519839',
    lists: [
      { name: 'Ý tưởng', cards: ['Thu thập yêu cầu', 'Nghiên cứu đối thủ'] },
      { name: 'Việc cần làm', cards: ['Thiết kế giao diện', 'Lập lịch dự án'] },
      { name: 'Đang thực hiện', cards: [] },
      { name: 'Đang review', cards: [] },
      { name: 'Hoàn thành', cards: [] },
      { name: 'Tạm hoãn', cards: [] },
    ],
  },
  {
    id: 'sprint',
    name: 'Sprint / Agile',
    description: 'Bảng cho một sprint theo Scrum: backlog → đang làm → kiểm thử → xong.',
    color: '#89609E',
    lists: [
      {
        name: 'Product Backlog',
        cards: ['Là người dùng, tôi muốn đăng nhập', 'Là người dùng, tôi muốn đổi mật khẩu'],
      },
      { name: 'Sprint Backlog', cards: ['Thiết lập CI/CD'] },
      { name: 'Đang làm', cards: [] },
      { name: 'Kiểm thử', cards: [] },
      { name: 'Hoàn thành', cards: [] },
    ],
  },
  {
    id: 'content',
    name: 'Lịch nội dung',
    description: 'Theo dõi bài viết / video từ lúc lên ý tưởng đến khi xuất bản.',
    color: '#B04632',
    lists: [
      { name: 'Ý tưởng', cards: ['Chủ đề: Mẹo năng suất', 'Chủ đề: Review công cụ'] },
      { name: 'Đang viết', cards: [] },
      { name: 'Chờ duyệt', cards: [] },
      { name: 'Đã lên lịch', cards: [] },
      { name: 'Đã đăng', cards: [] },
    ],
  },
  {
    id: 'personal',
    name: 'Việc cá nhân',
    description: 'Sắp xếp việc riêng theo mức độ ưu tiên về thời gian.',
    color: '#00AECC',
    lists: [
      { name: 'Hôm nay', cards: ['Tập thể dục 30 phút'] },
      { name: 'Tuần này', cards: ['Đọc xong 1 cuốn sách'] },
      { name: 'Sau này', cards: [] },
      { name: 'Đang chờ', cards: [] },
      { name: 'Xong', cards: [] },
    ],
  },
  {
    id: 'thesis',
    name: 'Khoá luận tốt nghiệp',
    description: 'Bám sát tiến độ làm khoá luận và trao đổi với giảng viên hướng dẫn.',
    color: '#D29034',
    lists: [
      {
        name: 'Tài liệu cần đọc',
        cards: ['Tìm 5 bài báo liên quan', 'Đọc chương cơ sở lý thuyết'],
      },
      { name: 'Đang nghiên cứu', cards: [] },
      { name: 'Đang viết', cards: ['Viết chương 1: Giới thiệu'] },
      { name: 'Chờ GVHD phản hồi', cards: [] },
      { name: 'Đã chỉnh sửa xong', cards: [] },
    ],
  },
];

export function getTemplate(id: string): BoardTemplate | undefined {
  return BOARD_TEMPLATES.find((t) => t.id === id);
}
