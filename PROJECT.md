# TaskFlow — Website quản lý công việc & dự án

Khoá luận tốt nghiệp (bắt đầu 08/2026). Ứng dụng quản lý công việc kiểu Trello: không gian làm việc → bảng → danh sách (cột) → thẻ công việc, kèm cộng tác thời gian thực.

> Tài liệu này tóm tắt hiện trạng dự án để tra cứu nhanh. Mô tả đề tài gốc: `Mo_ta_de_tai_website_quan_ly_cong_viec.docx` (máy cá nhân, không nằm trong repo).

## Stack công nghệ

| Lớp | Công nghệ |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS 4 |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma ORM 7 |
| Xác thực | JWT (cookie httpOnly) + Google OAuth (`@react-oauth/google` + `google-auth-library`) |
| Realtime | Socket.IO |
| Khác | Multer (upload), Nodemailer (mail, Ethereal khi chưa có SMTP thật), Zod (validate), `@dnd-kit` (kéo-thả), Unsplash API (ảnh nền bảng) |
| Test | Vitest + Supertest (backend), Vitest + Testing Library (frontend) |

## Cấu trúc thư mục

```
backend/            API Express + Prisma
  src/modules/       auth, workspace, board, list, card, label, customField,
                      activity, notification, automation, search, unsplash, watch
  src/realtime/       socket.ts — hub emit sự kiện Socket.IO
  test/               vitest + supertest, DB test riêng (taskflow_test)
frontend/           SPA Vite + React
  src/pages/          các trang (Home, Board, Calendar, MyCards, Search, Workspace...)
  src/components/     UI theo domain (board/, task/, ...)
  src/context/        AuthContext, BoardsContext, WorkspacesContext
  src/lib/            api client (axios), socket client
docker-compose.yml  Postgres + backend (dev mode, hot reload qua bind mount)
```

## Chạy dự án

```bash
docker compose up -d
```
Lệnh trên dựng `taskflow-postgres` (5432) + `taskflow-backend` (4000, tự `prisma generate` + `migrate deploy` khi khởi động).

```bash
cd frontend && npm run dev
```
Frontend chạy ở host, cổng 5173.

Chi tiết & lưu ý (thêm dependency backend, sửa schema, biến môi trường...) xem thêm trong ghi chú vận hành nội bộ.

## Mô hình dữ liệu chính (Prisma)

`User`, `Workspace` + `WorkspaceMember`, `Board` + `BoardMember` + `BoardStar` + `BoardJoinRequest`, `List`, `Card` + `CardMember` + `CardReminder`, `Label` + `CardLabel`, `CustomField` + `CustomFieldOption` + `CardFieldValue`, `Checklist` + `ChecklistItem`, `Comment`, `Attachment`, `Activity`, `Watch`, `Notification` + `NotificationPreference`, `SavedFilter`, `AuthToken`, `BoardTemplate`/`BoardTemplateList`/`BoardTemplateCard`, `CardTemplate`/`CardTemplateChecklist`/`CardTemplateItem`, `RecurringCardSchedule`, `AutomationRule` + `AutomationAction`.

Điểm thiết kế đáng chú ý: `Card.status` (enum Cần làm/Đang thực hiện/Chờ duyệt/Hoàn thành/Bị chặn) **độc lập** với `List` (cột Kanban tự do do người dùng đặt) — kéo thẻ sang cột khác không tự đổi status; phục vụ đồng thời giao diện kiểu Trello lẫn các số liệu thống kê chuẩn hoá theo đề tài.

## Chức năng đã có

- **Xác thực**: đăng ký/đăng nhập JWT, quên/đặt lại mật khẩu (email), xác minh email (không chặn đăng nhập, chỉ nhắc banner), đăng nhập Google, thu hồi phiên khi đổi mật khẩu (`tokenVersion`, ngắt cả socket đang mở).
- **Không gian làm việc (Workspace)**: mỗi người có sẵn 1 không gian cá nhân; tạo không gian nhóm, mời thành viên, vai trò OWNER/ADMIN/MEMBER; mỗi bảng bắt buộc thuộc 1 không gian.
- **Bảng & danh sách kiểu Trello**: kéo-thả thẻ/danh sách (`@dnd-kit`), ảnh nền (màu hoặc Unsplash), mức hiển thị PRIVATE/WORKSPACE/PUBLIC, đánh dấu sao, mẫu bảng (template) dựng sẵn cột + thẻ mẫu.
- **Chia sẻ bảng**: mời qua email (kể cả người chưa có tài khoản), link tham gia, duyệt/từ chối yêu cầu tham gia, đổi vai trò, chuyển quyền sở hữu, chỉ báo online theo thời gian thực.
- **Thẻ công việc**: mô tả, gán nhiều thành viên, nhãn, custom field, checklist, đính kèm file (kiểm tra quyền xem khi phục vụ file), bình luận + mention, nhắc hạn (`CardReminder`), lịch tái diễn (`RecurringCardSchedule`), lịch sử hoạt động chi tiết.
- **Automation**: `AutomationRule` + `AutomationAction` — quy tắc tự động theo hành động trên thẻ/bảng.
- **Tìm kiếm & lọc**: tìm xuyên bảng, bộ lọc đã lưu (`SavedFilter`), trang "Công việc của tôi", trang lịch (Calendar).
- **Thông báo**: trong ứng dụng + tuỳ chọn nhận (`NotificationPreference`) + digest định kỳ.
- **Thời gian thực (Socket.IO)**: một kết nối singleton phía client; sự kiện bao trùm `board:lists-changed` cho mọi thay đổi nội dung bảng, cộng thêm các sự kiện hẹp hơn (`board:members-changed`, `board:join-requests-changed`, `board:meta-changed`, `board:access-changed`, `board:presence`, `board:removed`, `workspace:changed`, `notification:new`).
- **Bảo mật đã rà soát**: chặn truy cập file đính kèm riêng tư qua route tĩnh (kể cả path bị mã hoá), suy Content-Type từ đuôi file thay vì tin client, thu hồi JWT + socket khi đổi mật khẩu/mất quyền, token dùng một lần cho email, cô lập chắc chắn DB test khỏi DB thật.

## Thương hiệu

Tên **TaskFlow**, logo hình mũi tên gấp giấy (origami arrow) 3 mảnh lệch sắc độ, dải màu xanh ngọc `#06b6d4` → chàm `#4f46e5` — cố tình tách khỏi tông xanh dương của Trello.

## Định hướng mở rộng (nếu còn thời gian)

Timeline/milestone nâng cao, AI dự báo trễ tiến độ dựa trên lịch sử hoạt động đã lưu.
