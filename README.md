# TaskFlow – Website quản lý công việc

Đồ án khoá luận tốt nghiệp: website quản lý công việc và dự án theo nhóm, giao diện bảng kiểu Kanban.

## Chức năng chính

- Đăng ký, đăng nhập bằng JWT; đăng nhập bằng Google
- Quản lý nhóm và thành viên, phân quyền trưởng nhóm
- Quản lý dự án (bảng) và thành viên dự án; đánh dấu sao bảng hay dùng
- Bảng Kanban: cột tự do, kéo thả thẻ và cột
- Chi tiết thẻ: công việc con, quan hệ phụ thuộc, bình luận có @nhắc tên
- Danh sách công việc: tìm kiếm, lọc, sắp xếp theo hạn, phân trang

## Công nghệ

| Phần | Công nghệ |
|------|-----------|
| Backend | Node.js, Express, TypeScript, Prisma, Zod |
| Cơ sở dữ liệu | PostgreSQL 16 (Docker Compose) |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, dnd-kit |

## Cách chạy

Cần cài sẵn Node.js 20+ và Docker.

```bash
# 1. Bật PostgreSQL
docker compose up -d

# 2. Backend (http://localhost:4000)
cd backend
cp .env.example .env      # rồi sửa JWT_SECRET
npm install
npm run prisma:migrate
npm run dev

# 3. Frontend (http://localhost:5173), mở terminal khác
cd frontend
cp .env.example .env
npm install
npm run dev
```

Muốn dùng đăng nhập Google thì điền `GOOGLE_CLIENT_ID` (backend) và `VITE_GOOGLE_CLIENT_ID` (frontend) trong file `.env`.

## Cấu trúc thư mục

```
backend/    API Express + Prisma (schema, migration, các module)
frontend/   Ứng dụng React + Vite
docker-compose.yml   PostgreSQL cho môi trường phát triển
```
