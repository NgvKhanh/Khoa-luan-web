// Cac mau bang co san. Nguoi dung chon 1 mau -> tao ngay 1 bang day du list + the.
// Moi cot ghi TUONG MINH trang thai cua no (null = cot tu do, vd "Y tuong",
// "Hom nay") thay vi doan theo ten - de doc/sua truc tiep o day.

import type { CardStatus } from '../../generated/prisma/enums';

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  color: string;
  lists: { name: string; status: CardStatus | null; cards: string[] }[];
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
        status: 'TODO',
        cards: ['Ví dụ: Lên kế hoạch tuần', 'Ví dụ: Trả lời email'],
      },
      { name: 'Đang làm', status: 'IN_PROGRESS', cards: ['Ví dụ: Viết báo cáo'] },
      { name: 'Hoàn thành', status: 'DONE', cards: [] },
    ],
  },
  {
    id: 'project',
    name: 'Quản lý dự án',
    description: 'Quy trình đầy đủ từ ý tưởng đến bàn giao, kèm cột tạm hoãn.',
    color: '#519839',
    lists: [
      { name: 'Ý tưởng', status: null, cards: ['Thu thập yêu cầu', 'Nghiên cứu đối thủ'] },
      { name: 'Việc cần làm', status: 'TODO', cards: ['Thiết kế giao diện', 'Lập lịch dự án'] },
      { name: 'Đang thực hiện', status: 'IN_PROGRESS', cards: [] },
      { name: 'Đang review', status: 'IN_REVIEW', cards: [] },
      { name: 'Hoàn thành', status: 'DONE', cards: [] },
      { name: 'Tạm hoãn', status: 'BLOCKED', cards: [] },
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
        status: 'TODO',
        cards: ['Là người dùng, tôi muốn đăng nhập', 'Là người dùng, tôi muốn đổi mật khẩu'],
      },
      { name: 'Sprint Backlog', status: 'TODO', cards: ['Thiết lập CI/CD'] },
      { name: 'Đang làm', status: 'IN_PROGRESS', cards: [] },
      { name: 'Kiểm thử', status: 'IN_REVIEW', cards: [] },
      { name: 'Hoàn thành', status: 'DONE', cards: [] },
    ],
  },
  {
    id: 'content',
    name: 'Lịch nội dung',
    description: 'Theo dõi bài viết / video từ lúc lên ý tưởng đến khi xuất bản.',
    color: '#B04632',
    lists: [
      { name: 'Ý tưởng', status: null, cards: ['Chủ đề: Mẹo năng suất', 'Chủ đề: Review công cụ'] },
      { name: 'Đang viết', status: 'IN_PROGRESS', cards: [] },
      { name: 'Chờ duyệt', status: 'IN_REVIEW', cards: [] },
      { name: 'Đã lên lịch', status: null, cards: [] },
      { name: 'Đã đăng', status: 'DONE', cards: [] },
    ],
  },
  {
    id: 'personal',
    name: 'Việc cá nhân',
    description: 'Sắp xếp việc riêng theo mức độ ưu tiên về thời gian.',
    color: '#00AECC',
    lists: [
      { name: 'Hôm nay', status: null, cards: ['Tập thể dục 30 phút'] },
      { name: 'Tuần này', status: null, cards: ['Đọc xong 1 cuốn sách'] },
      { name: 'Sau này', status: null, cards: [] },
      { name: 'Đang chờ', status: 'BLOCKED', cards: [] },
      { name: 'Xong', status: 'DONE', cards: [] },
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
        status: 'TODO',
        cards: ['Tìm 5 bài báo liên quan', 'Đọc chương cơ sở lý thuyết'],
      },
      { name: 'Đang nghiên cứu', status: 'IN_PROGRESS', cards: [] },
      { name: 'Đang viết', status: 'IN_PROGRESS', cards: ['Viết chương 1: Giới thiệu'] },
      { name: 'Chờ GVHD phản hồi', status: 'IN_REVIEW', cards: [] },
      { name: 'Đã chỉnh sửa xong', status: 'DONE', cards: [] },
    ],
  },
];

export function getTemplate(id: string): BoardTemplate | undefined {
  return BOARD_TEMPLATES.find((t) => t.id === id);
}
