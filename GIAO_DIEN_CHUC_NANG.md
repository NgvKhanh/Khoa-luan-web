# TaskFlow — Chi tiết giao diện & chức năng

Tài liệu này mô tả chi tiết từng trang, layout và component giao diện của TaskFlow (frontend `React 19 + Vite + TypeScript + Tailwind CSS 4`, thư mục `frontend/src`), phục vụ báo cáo khoá luận. Xem tổng quan kiến trúc/stack ở [PROJECT.md](PROJECT.md).

## Mục lục

1. [Sơ đồ định tuyến (routes)](#1-sơ-đồ-định-tuyến-routes)
2. [Layout & thành phần dùng chung](#2-layout--thành-phần-dùng-chung)
3. [Nhóm trang xác thực](#3-nhóm-trang-xác-thực)
4. [Các trang chức năng chính](#4-các-trang-chức-năng-chính)
5. [Trang Bảng (Board) — trung tâm ứng dụng](#5-trang-bảng-board--trung-tâm-ứng-dụng)
6. [Modal chi tiết thẻ (CardModal)](#6-modal-chi-tiết-thẻ-cardmodal)
7. [Chia sẻ & truy cập công khai](#7-chia-sẻ--truy-cập-công-khai)
8. [Cơ chế realtime (Socket.IO)](#8-cơ-chế-realtime-socketio)
9. [Hệ thống màu sắc, theme & thương hiệu](#9-hệ-thống-màu-sắc-theme--thương-hiệu)

---

## 1. Sơ đồ định tuyến (routes)

Định nghĩa tại `src/App.tsx`.

**Công khai (không cần đăng nhập):**
`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/public/boards/:boardId`.

**Cần đăng nhập** (bọc trong `ProtectedRoute`):
- Trong `MainLayout`: `/` (Trang danh sách bảng), `/home` (Dashboard), `/templates`, `/workspaces/:workspaceId`, `/my-cards`, `/search`, `/calendar`, `/settings/profile`, `/settings/password`, `/settings/notifications`, `/activity`.
- `/join/:token` (không dùng MainLayout — trang xem trước lời mời, full-screen riêng).
- Trong `BoardViewLayout`: `/boards/:boardId` (trang Bảng Kanban).

`ProtectedRoute` lưu lại `location` hiện tại vào `state.from` để sau khi đăng nhập điều hướng người dùng quay lại đúng chỗ.

---

## 2. Layout & thành phần dùng chung

### 2.1. MainLayout
Khung cho mọi trang "không phải xem 1 bảng cụ thể". Cấu trúc dọc toàn màn hình: `Header` → `EmailVerifyBanner` (nếu cần) → hàng ngang gồm `Sidebar` cố định trái + `<main>` cuộn dọc, nội dung căn giữa `max-w-5xl`.

### 2.2. BoardViewLayout
Khung riêng khi mở 1 bảng: giữ `Header`, nhưng thay `Sidebar` bằng `BoardSidebar` (điều hướng phẳng giữa các bảng, không phân theo workspace); `<main className="overflow-hidden">` để `BoardPage` tự quản lý cuộn ngang các cột. Lấy `boards`/`upsertBoard` từ context `useBoards()` truyền xuống qua `useOutletContext`.

### 2.3. Header
Thanh trên cùng cao 14 (`h-14`), toàn ứng dụng dùng chung. Từ trái sang phải:
- **Logo** (link `/`).
- **WorkspaceSwitcher**: dropdown tên không gian làm việc hiện tại, liệt kê toàn bộ workspace để đổi, nút "Quản lý không gian này" (→ `/workspaces/:id`), form tạo workspace mới inline.
- **BoardSearch** (chiếm phần giữa, `flex-1`): ô tìm kiếm debounce 300ms, tìm thẻ xuyên toàn bộ board (`searchCards`) + lọc tức thời tên board phía client; phím tắt `/` để focus; dropdown kết quả 2 nhóm "Bảng"/"Thẻ"; nút "Tìm nâng cao..." → `/search?q=...`.
- **CreateBoardMenu**: nút "Tạo mới" mở `CreateBoardDialog`.
- **NotificationBell**.
- **AccountMenu**: avatar → dropdown thông tin user, liên kết (Hồ sơ, Thẻ của tôi, Lịch, Cài đặt thông báo, Đổi mật khẩu, Hoạt động của tôi), chọn theme (Sáng/Tối/Hệ thống), Đăng xuất.

### 2.4. Sidebar (dùng trong MainLayout)
Cột trái rộng 256px, ẩn trên mobile. Nav chính (Bảng, Mẫu, Trang chủ, Tìm kiếm nâng cao — active màu xanh `#0c66e4` nền `#e9f2ff`), mục "Yêu thích" (board đã star), mục "Các Không gian làm việc" (mỗi workspace 1 nút mở rộng hiện các board con thụt lề + link "Quản lý không gian").

### 2.5. BoardSidebar (dùng trong BoardViewLayout)
Cột trái đơn giản hơn: link "Tất cả các bảng" → nhóm "Yêu thích" → nhóm "Các bảng của bạn" (danh sách phẳng mọi board, không chia theo workspace).

### 2.6. NotificationBell
Icon chuông có badge đỏ đếm chưa đọc (>99 hiện "99+"). Panel mở bằng `createPortal` ra `document.body` (`fixed right-3 top-14 w-[380px]`) để tránh vỡ layout do `backdrop-blur` của thanh chứa nó (xem mục 9). Có checkbox "Chỉ hiển thị chưa đọc", nút đánh dấu tất cả đã đọc, danh sách thông báo cuộn với hơn 15 loại sự kiện (thành viên, vai trò, chuyển quyền sở hữu, yêu cầu tham gia, mention, bình luận, đính kèm, di chuyển/đổi tên thẻ, hạn, nhắc hạn...). Click 1 thông báo → đánh dấu đã đọc + điều hướng đúng ngữ cảnh (`?share=requests`, `?card=id`, hoặc `/workspaces/:id`). Poll dự phòng 45s, **realtime qua sự kiện socket `notification:new`**.

### 2.7. EmailVerifyBanner
Banner vàng dưới Header khi tài khoản chưa xác minh email — không chặn thao tác. Nút "Gửi lại email xác minh", nút đóng (ẩn theo phiên qua `sessionStorage`).

### 2.8. Component nhỏ dùng chung
- **Avatar**: vẽ chữ cái đầu trên nền màu hash theo id, ảnh fade-in khi tải xong, tự retry có backoff nếu lỗi, không hiện icon "ảnh vỡ".
- **StarButton**: icon ngôi sao đổi màu vàng khi active, chặn `stopPropagation` để không kích hoạt click của phần tử cha.
- **BoardCard**: thẻ đại diện 1 board trong lưới ở trang chủ — ảnh/màu nền phủ gradient tối, `StarButton` góc trái, menu "..." góc phải (đổi màu nhanh, tải ảnh nền, bỏ ảnh nền, lưu trữ, xoá vĩnh viễn nếu là chủ sở hữu).
- **ConfirmDialog**: hộp thoại xác nhận dùng chung thay `window.confirm`, overlay mờ + backdrop-blur, Esc/click nền để huỷ, nút xác nhận màu đỏ nếu `danger`.

---

## 3. Nhóm trang xác thực

Dùng chung `AuthShell` (`src/components/auth/AuthShell.tsx`): nền gradient xanh thương hiệu `#1558bc → #0b3f8f`, 2 khối blur trang trí góc, logo trắng, card trắng bo góc giữa màn hình, dòng chân trang + copyright.

| Trang | Route | Nội dung |
|---|---|---|
| LoginPage | `/login` | Email + `PasswordField`, link "Quên mật khẩu?", nút Đăng nhập, `GoogleAuthButton`. Giữ `state.from` để redirect đúng chỗ sau đăng nhập. |
| RegisterPage | `/register` | Họ tên, Email, `PasswordField` (≥6 ký tự), nút Đăng ký, `GoogleAuthButton`. |
| ForgotPasswordPage | `/forgot-password` | Form nhập Email → sau khi gửi chuyển sang thông báo xác nhận (không tiết lộ email có tồn tại hay không); dev mode hiện link preview mail (Ethereal). |
| ResetPasswordPage | `/reset-password?token=` | 2 `PasswordField` (mật khẩu mới + xác nhận), validate ≥6 ký tự & khớp nhau. |
| VerifyEmailPage | `/verify-email?token=` | 3 trạng thái: đang xác minh → thành công → lỗi; tự gọi API 1 lần khi mount. |

Component dùng chung: `GoogleAuthButton` (nút `GoogleLogin` của `@react-oauth/google`, tự ẩn nếu thiếu `VITE_GOOGLE_CLIENT_ID`), `PasswordField` (input có nút hiện/ẩn ký tự).

---

## 4. Các trang chức năng chính

### 4.1. HomePage (`/`)
Danh sách toàn bộ bảng, nhóm theo: "Được đánh dấu sao" → từng không gian làm việc → "Bảng khác" (board mồ côi). Mỗi nhóm là lưới `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` gồm `BoardCard` + ô "Tạo bảng mới" (dashed, mở `CreateBoardDialog`). Mục "Bảng đã lưu trữ" gập/mở, mỗi dòng có nút Khôi phục / Xoá vĩnh viễn (chủ sở hữu).

### 4.2. HomeDashboard (`/home`)
Dashboard cá nhân: lời chào theo giờ trong ngày, 4 ô số liệu nhanh (Bảng, Thẻ được giao, Quá hạn, Đến hạn trong tuần — mỗi ô bấm điều hướng), section "Cần chú ý" (nhóm Quá hạn/Hôm nay/Trong tuần, tối đa 5 mục/nhóm), "Truy cập nhanh" (board xem gần đây từ `localStorage` + board yêu thích), "Hoạt động gần đây".

### 4.3. TemplatesPage (`/templates`)
Chọn mẫu tạo nhanh bảng: "Mẫu của bạn" (tự lưu từ 1 board có sẵn, có thể xoá) và "Mẫu có sẵn" (hệ thống). Mỗi thẻ mẫu hiện dải màu, tên, tag tên cột, số cột/thẻ, nút "Dùng mẫu này". Có dropdown chọn workspace đích nếu có nhiều hơn 1.

### 4.4. WorkspaceSettingsPage (`/workspaces/:id`)
Trang quản trị 1 không gian làm việc, 5 khối:
1. Tiêu đề — đổi tên inline, badge "cá nhân" nếu là workspace cá nhân.
2. Tổng quan — 4 ô thống kê thẻ (Tổng/Quá hạn/Chưa giao/Đã hoàn thành) + bộ lọc theo người phụ trách/trạng thái + danh sách thẻ khớp lọc.
3. Thành viên — mời qua email + chọn vai trò, danh sách thành viên với dropdown đổi vai trò, xoá, chuyển quyền sở hữu (chỉ owner).
4. Bảng trong không gian — grid liên kết tới từng board.
5. Vùng nguy hiểm — Rời khỏi không gian (non-owner) hoặc Xoá không gian (owner, không phải workspace cá nhân).

**Realtime**: lắng nghe socket `workspace:changed` để tự tải lại dữ liệu.

### 4.5. MyCardsPage (`/my-cards`)
Toàn bộ thẻ được gán cho user hiện tại, nhóm theo hạn (Quá hạn/Hôm nay/Trong tuần/Sau này/Không có hạn), checkbox "Ẩn thẻ đã hoàn thành".

### 4.6. SearchPage (`/search`)
Tìm kiếm nâng cao xuyên board: từ khoá, người phụ trách (Mọi người/Của tôi/Chưa giao), trạng thái, tên nhãn, checkbox Quá hạn, khoảng ngày hết hạn (từ–đến). Tự tìm lại khi đổi filter (debounce 400ms). Dải chip **bộ lọc đã lưu** (`SavedFilter`) có thể áp dụng lại hoặc lưu bộ lọc hiện tại. Kết quả có phân trang.

### 4.7. CalendarPage (`/calendar`)
Lịch xem thẻ theo `dueDate`, 2 chế độ Tháng/Tuần, lưới `grid-cols-7`. Dùng `@dnd-kit` để **kéo-thả thẻ sang ngày khác** (tính lại `dueDate`/giữ nguyên khoảng cách `startDate`). Hiện cả card lẫn checklist item có hạn riêng; chip có chấm màu theo board.

### 4.8. ProfilePage (`/settings/profile`)
Banner gradient + avatar lớn nổi lên, 3 ô thống kê (Bảng/Yêu thích/Ngày tham gia). Upload/xoá avatar. Form đổi tên hiển thị + URL avatar tuỳ chọn (email chỉ đọc). Chọn theme (segmented control Sáng/Tối/Hệ thống). Liên kết nhanh: Đổi mật khẩu, Thẻ của tôi, Hoạt động của tôi.

### 4.9. ChangePasswordPage (`/settings/password`)
Form 3 field (mật khẩu hiện tại/mới/xác nhận), validate client-side trước khi gọi API. **Sau khi đổi thành công, tự ngắt & kết nối lại socket** (để tokenVersion mới có hiệu lực ngay mà vẫn giữ realtime, xem mục 8).

### 4.10. NotificationSettingsPage (`/settings/notifications`)
Toggle bật/tắt theo nhóm: Trong ứng dụng (hoạt động thẻ, bảng & workspace, nhắc hạn), Email nhắc hạn, Email tổng hợp hằng ngày (kèm 2 toggle con). Lưu ngay khi đổi (optimistic update).

### 4.11. MyActivityPage (`/activity`)
Nhật ký hoạt động cá nhân (tạo/di chuyển/đổi tên thẻ, hoàn thành, đặt hạn, bình luận, thêm thành viên...), mỗi dòng có link tới board liên quan.

---

## 5. Trang Bảng (Board) — trung tâm ứng dụng

`BoardPage.tsx` (`/boards/:boardId`) là trang phức tạp nhất, đã được tách thành 3 hook riêng trong `pages/boardPage/`: `useBoardRealtime`, `useBoardShortcuts`, `useBoardDnd`.

### 5.1. Bố cục tổng thể
1. **Thanh tên bảng** (nền `bg-gradient-to-b from-black/35 to-black/5 backdrop-blur-sm`): icon bảng, tên (sửa inline), badge tên workspace, `StarButton`, nút Theo dõi bảng, `BoardVisibilityMenu`, nút copy link công khai (nếu PUBLIC). Bên phải: toggle **Bảng/Bảng biểu**, và loạt nút mở popover — Thống kê, Lọc (có badge số lượng đang lọc), Hoạt động, Trường tùy chỉnh, Tự động hoá, Mục lưu trữ, Hình nền, avatar thành viên + Chia sẻ, menu "..." thao tác bảng.
2. Banner "chỉ đọc" nếu người dùng không có quyền sửa; banner lỗi; banner "đang lọc thẻ" kèm nút xoá lọc.
3. Nội dung chính: nếu chế độ Bảng biểu → `BoardTableView`; ngược lại → các cột `ListColumn` cuộn ngang trong `DndContext`, cuối hàng là `AddListForm`.
4. `CardModal` (khi có thẻ đang mở, đồng bộ qua query `?card=id`), `ShortcutsHelp` (phím `?`).

### 5.2. Kéo-thả (useBoardDnd)
Dùng `@dnd-kit/core` + `sortable`: `PointerSensor` (ngưỡng 5px) + `KeyboardSensor`. Kéo **cột** dùng chiến lược va chạm riêng (chỉ va với cột khác, bỏ qua thẻ bên trong). Kéo **thẻ**: optimistic update ngay khi kéo qua cột khác, chốt bằng API `moveCard` khi thả, rollback theo snapshot nếu lỗi hoặc huỷ kéo (`handleDragCancel`). `DragOverlay` hiện bản clone xoay nhẹ của thẻ/cột đang kéo (`ListColumnOverlay` cho cột, biến thể overlay của `CardItem` cho thẻ).

### 5.3. Phím tắt (useBoardShortcuts)
`?` bảng trợ giúp phím tắt, `n` thêm thẻ (bấm nút `[data-add-card]` đầu tiên), `f` bật/tắt bộ lọc, `b` mở hình nền, `x` xoá bộ lọc, `q` lọc nhanh "giao cho tôi". Tự bỏ qua khi đang gõ input/textarea hoặc đang mở CardModal.

### 5.4. ListColumn (1 cột danh sách)
Nền `#f1f2f4`, rộng cố định 272px, kéo được (drag handle ở header). Menu "..." nhiều tầng: Thêm thẻ / Thêm thẻ từ mẫu / **Thẻ định kỳ...** (mở `RecurringScheduleModal`) / Theo dõi danh sách / Sao chép danh sách / Di chuyển danh sách (Đầu/Cuối) / Di chuyển tất cả thẻ sang list khác / Sắp xếp theo (ngày tạo tăng/giảm, tên, đã xong) / Xoá tất cả thẻ / Lưu trữ danh sách. Cuối cột là `AddCardForm`.

### 5.5. CardItem (1 thẻ trong cột)
Ảnh/dải màu cover trên cùng, nút tròn đánh dấu hoàn thành, nhãn màu dạng thanh nhỏ, tiêu đề, hàng badge (mô tả, hạn, checklist x/y — xanh nếu xong hết, số bình luận, số đính kèm, avatar tối đa 3 thành viên). Nút lưu trữ hiện khi hover.

### 5.6. Các popover/menu công cụ trên thanh bảng

| Component | Chức năng chính |
|---|---|
| **BoardMembers** | Dải avatar người đang online (realtime qua `board:presence`) + panel "Chia sẻ bảng": mời qua email + chọn vai trò, tạo/copy/xoá link mời, 2 tab "Thành viên" / "Yêu cầu tham gia" (badge đỏ, realtime qua `board:join-requests-changed`), `RoleMenu` đổi vai trò/chuyển quyền sở hữu/rời-xoá thành viên. |
| **BoardActionsMenu** | Lưu thành mẫu, Xuất bảng ra file JSON (tải trực tiếp, không cần xác nhận), Lưu trữ bảng, Xoá bảng (owner, có màn xác nhận riêng). |
| **BoardActivityMenu** | Nhật ký hoạt động toàn bảng (avatar + mô tả + thời gian tương đối). |
| **BoardArchiveMenu** | 2 tab Thẻ/Danh sách đã lưu trữ — khôi phục hoặc xoá vĩnh viễn từng mục. |
| **BoardBackgroundMenu** | Lưới màu có sẵn + tìm & chọn ảnh Unsplash (kèm credit + gọi `trackUnsplashDownload` theo yêu cầu attribution của Unsplash), nút bỏ hình nền. |
| **BoardFilterPanel** | Lọc theo từ khoá, thành viên (gồm "không có thành viên"/"giao cho tôi"), trạng thái hoàn thành, hạn (không có/quá hạn/ngày mai/trong tuần), nhãn — áp dụng client-side. |
| **BoardStatsPanel** | Thống kê: tổng thẻ / hoàn thành / quá hạn, thanh tiến độ theo từng danh sách, top 8 thành viên nhiều thẻ nhất — tính hoàn toàn client-side từ dữ liệu đã tải. |
| **BoardTableView** | Chế độ xem dạng bảng (spreadsheet-like): cột trạng thái, tên, danh sách, nhãn, thành viên, hạn, trạng thái; click header để sắp xếp. |
| **BoardVisibilityMenu** | Chọn Riêng tư / Không gian làm việc / Công khai. |
| **CustomFieldsPanel** | Tạo/xoá trường tuỳ chỉnh cấp bảng (TEXT/NUMBER/DATE/CHECKBOX/DROPDOWN), quản lý lựa chọn cho DROPDOWN. |
| **LabelPanel** | Gán/tạo/sửa nhãn màu cho 1 thẻ (mở từ CardModal), bảng màu 10 màu dùng chung. |
| **AutomationPanel** | Tạo luật tự động: trigger (Thẻ được tạo / Thẻ được chuyển vào danh sách X) → tối đa 5 hành động (Đánh dấu hoàn thành / Gắn nhãn / Gán thành viên); bật/tắt, xoá luật. |
| **RecurringScheduleModal** | Lịch tạo thẻ định kỳ cho 1 danh sách: tần suất Ngày/Tuần/Tháng, giờ tạo (UTC), mẫu thẻ tuỳ chọn, ngày dừng tuỳ chọn; tạm dừng/tiếp tục/xoá lịch. |
| **CreateBoardDialog** | Form tạo bảng: xem trước mini 3 cột theo nền đã chọn, chọn nhanh ảnh Unsplash hoặc màu, đặt tên, chọn workspace đích. |
| **ShortcutsHelp** | Modal liệt kê 7 phím tắt của trang bảng. |

Tất cả popover trên đều dùng `createPortal` ra `document.body` + định vị `fixed right-3 top-14` để không bị vỡ layout bởi `backdrop-blur` của thanh tên bảng (xem mục 9).

---

## 6. Modal chi tiết thẻ (CardModal)

Modal lớn nhất hệ thống (`components/board/CardModal.tsx`, portal full-screen `bg-black/60`, hộp rộng 760px), tương đương "card detail" của Trello. Chia 2 cột:

**Header**: ảnh bìa (nếu có), dropdown chọn list hiện tại (kèm "Chuyển sang bảng khác..." — chọn board + list đích), menu "..." (Sao chép thẻ / Lưu thành mẫu thẻ / Lưu trữ), nút đóng.

**Cột trái**:
- Tiêu đề (click-to-edit) + nút hoàn thành, nút "Theo dõi" thẻ.
- Hàng huy hiệu: Nhãn, Ngày bắt đầu → hết hạn (kèm `ReminderCheckboxes` đặt nhắc hẹn), Thành viên (avatar).
- Hàng nút hành động mở popover riêng: **Nhãn** (`LabelPanel`), **Ngày**, **Thành viên**, **Việc cần làm** (checklist), **Ảnh bìa**, **Đính kèm**.
- **Trường tùy chỉnh**: input tương ứng loại field (text/number/date/checkbox/dropdown) do bảng định nghĩa.
- **Mô tả**: Markdown, click-to-edit, hiển thị qua `MiniMarkdown`.
- **Tệp đính kèm**: danh sách file, preview ảnh, nút "Làm ảnh bìa"/"Xoá".
- **Checklist**: nhiều checklist trong 1 thẻ, thanh % tiến độ mỗi cái, ẩn/hiện mục đã xong, kéo-thả sắp xếp mục (`@dnd-kit` riêng, `SortableItem`), mỗi mục có checkbox, tên, avatar người được gán, hạn riêng, menu (Chỉ định / Ngày hết hạn / **Chuyển thành thẻ mới** / Xoá), `AddItemInput` để thêm mục nhanh.

**Cột phải — "Nhận xét và hoạt động"**: nút ẩn/hiện chi tiết hoạt động, form bình luận có gợi ý `@mention`, feed hợp nhất bình luận + hoạt động sắp theo thời gian giảm dần, nút xoá bình luận (chỉ tác giả).

**Realtime** (`useCardRealtime`): lắng nghe `board:lists-changed`, debounce 400ms, lọc theo đúng `boardId` của thẻ, và **bỏ qua khi đang gõ tiêu đề/mô tả** (`editingRef`) để không mất bản nháp.

---

## 7. Chia sẻ & truy cập công khai

### 7.1. JoinBoardPage (`/join/:token`)
Trang xem trước bảng được mời qua link — hiện ảnh nền/tên board, tuỳ trạng thái hiện nút "Xin tham gia" / thông báo "đã gửi yêu cầu chờ duyệt" / nút "Mở bảng" (đã là thành viên).

### 7.2. PublicBoardPage (`/public/boards/:boardId`)
Xem bảng ở chế độ **công khai, chỉ đọc**, không cần đăng nhập. Header riêng tối giản (badge "Xem công khai · chỉ đọc"). Layout Kanban giống trang Board nhưng không có toolbar quản trị, không kéo-thả. Click 1 thẻ mở overlay chi tiết (`PublicCardOverlay`) hiện đầy đủ nội dung (nhãn, ngày, thành viên, mô tả, checklist — checkbox disabled, đính kèm — chỉ tải, bình luận — chỉ đọc, không có form gửi mới). Đúng tinh thần read-only tuyệt đối.

---

## 8. Cơ chế realtime (Socket.IO)

Một kết nối singleton phía client (`src/lib/socket.ts`), nối/ngắt theo trạng thái đăng nhập ở `AuthContext`. Server phát sự kiện qua `emitToBoard(boardId, event)` / `emitToUser(userId, event)`.

**`board:lists-changed`** là sự kiện "bao tất" cho mọi thay đổi nội dung bảng (thẻ, danh sách, checklist, bình luận, mô tả...). Cả `BoardPage` (qua `useBoardRealtime`) lẫn `CardModal` (qua `useCardRealtime`) tự lắng nghe **độc lập** với nhau, mỗi bên tự debounce 400ms rồi refetch dữ liệu tương ứng — thay vì server gửi diff chi tiết theo từng field.

| Sự kiện | Phòng | Nơi lắng nghe | Ý nghĩa |
|---|---|---|---|
| `board:lists-changed` | board | BoardPage, CardModal | Bất kỳ thay đổi nội dung nào trong bảng |
| `board:members-changed` | board | BoardPage (BoardMembers) | Thành viên bảng thay đổi (thêm/xoá/đổi vai trò) → kéo theo tải lại `canManage` |
| `board:meta-changed` | board | BoardPage | Board đổi visibility/thông tin chung |
| `board:access-changed` | user | BoardsContext | Danh sách bảng người dùng xem được có thể đổi (được thêm/xoá quyền) |
| `board:join-requests-changed` | board | BoardMembers | Có người xin tham gia / được duyệt / bị từ chối |
| `board:presence` | board | BoardPage | Danh sách userId đang mở bảng (hiện chấm online) |
| `board:removed` | board | BoardPage | Bảng bị xoá → điều hướng về `/` |
| `workspace:changed` | user | WorkspaceSettingsPage, BoardPage, BoardsContext | Thông tin/thành viên không gian làm việc thay đổi |
| `notification:new` | user | NotificationBell | Có thông báo mới, kèm poll dự phòng 45s |

Khi socket mất kết nối rồi nối lại (`connect`), `useBoardRealtime` tự join lại phòng bảng và tải bù dữ liệu members + lists để tránh bỏ sót thay đổi trong lúc mất kết nối.

Bảo mật realtime: đổi/reset mật khẩu tăng `User.tokenVersion` và ngắt ngay các socket đang mở của người dùng đó (`disconnectUserSockets`); xoá khỏi bảng/workspace hoặc đổi visibility sẽ ép các socket không còn đủ quyền rời khỏi phòng bảng tương ứng (`evictUserFromBoardRoom` / `reconcileBoardRoomAccess`) — không phụ thuộc phía client tự giác rời.

---

## 9. Hệ thống màu sắc, theme & thương hiệu

- **Màu chủ đạo**: `#0c66e4` (nút chính/trạng thái active toàn ứng dụng); gradient `#1558bc → #0b3f8f` cho các trang xác thực (`AuthShell`).
- **Logo TaskFlow**: hình mũi tên gấp giấy (origami arrow) 3 mảnh lệch sắc độ, dải màu riêng **xanh ngọc `#06b6d4` → chàm `#4f46e5`** — cố tình khác tông xanh dương `#0c66e4` dùng cho UI để tách biệt nhận diện thương hiệu khỏi Trello.
- **Dark mode**: quản lý qua `ThemeContext`, 3 chế độ Sáng/Tối/Hệ thống, chọn ở `AccountMenu` (Header) hoặc `ProfilePage`; hầu hết component đều có class `dark:` tương ứng.
- **Vấn đề kỹ thuật `backdrop-blur` đã xử lý**: thanh tên bảng (`BoardPage`) và header cột (`ListColumn`) dùng `backdrop-blur-sm`, tạo containing block + stacking context riêng khiến `position: fixed`/`z-index` của popover con bị bó hẹp hoặc bị đè bởi phần tử anh em đứng sau trong DOM. **Quy tắc bắt buộc**: mọi popup mở từ trong vùng có `backdrop-blur` phải `createPortal(node, document.body)` + tự định vị `fixed` + tự xử lý click-ngoài/Esc — đã áp dụng cho toàn bộ popover liệt kê ở mục 5.6 và `NotificationBell`.
