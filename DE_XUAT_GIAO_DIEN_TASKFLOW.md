# Kế hoạch nâng cấp giao diện TaskFlow (bản 2)

**Ngày lập:** 30/09/2026 (thay bản 27/09/2026)  
**Trạng thái:** Đề xuất để xem xét; chưa triển khai giao diện sản phẩm. Trang giới thiệu (`/`) đã được dựng trong thư mục làm việc nhưng chưa commit (xem mục 5.8).  
**Lý do viết lại:** Giảng viên hướng dẫn nhận xét giao diện hiện tại "tĩnh" và đề nghị tham khảo AppFlowy. Bản 27/09 tập trung vào sự gọn gàng và nhất quán, gần như không nói về chuyển động hay cảm giác "sống". Bản này bổ sung phần đó, sửa các chỗ lệch so với mã nguồn và đổi thứ tự ưu tiên.

## 0. Tóm tắt

- **Vấn đề:** Cảm giác "tĩnh" có nguyên nhân đo được, không chỉ là ấn tượng. Trên trang board, không có phần tử nào đang chạy hiệu ứng; mọi chuyển động chỉ là hover 0,15 giây. Nhận diện màu không đồng nhất giữa trang giới thiệu (chàm–ngọc) và ứng dụng (xanh Trello, xuất hiện 161 lần trong mã). Trạng thái tải chỉ là dòng chữ "Đang tải…".
- **Hướng đi:** Giữ khung của bản 27/09 (màu, điều hướng, dashboard) và thêm một lớp **chuyển động, phản hồi realtime nhìn thấy được và tiến độ trực quan**. Lớp này tận dụng phần realtime đã có, gần như không cần đổi backend.
- **Ưu tiên:** Nền tảng (màu, chuyển động, skeleton) rồi màn hình board sống động, sau đó dashboard và thẻ bảng, cuối cùng là các trang còn lại. Trang giới thiệu chỉ còn rà soát.
- **Phạm vi tối thiểu để thấy khác biệt khi demo:** giai đoạn 1, 3 và 4 (mục 8). Có kịch bản demo hai tài khoản ở mục 9.3.

## 1. Cơ sở: khảo sát ngày 30/09/2026

### 1.1. Cách khảo sát và giới hạn

Chạy TaskFlow trên `localhost:5173` (backend trong Docker), đăng nhập bằng tài khoản demo lấy từ `backend/src/scripts/teamSeed.ts`, chụp màn hình 1440×900 các trang: giới thiệu, đăng nhập, dashboard, danh sách bảng, board Kanban, chi tiết thẻ. Mở trang [appflowy.com](https://appflowy.com/) song song và đo bằng `getComputedStyle` trên trang board.

Giới hạn cần biết:

- Trình duyệt trong khung xem trước bật "giảm chuyển động" (`prefers-reduced-motion: reduce`). Chuyển động của AppFlowy khi cuộn có thể đã bị tắt, nên các nhận xét về AppFlowy chỉ dựa trên ảnh tĩnh. Chuyển động thật cần xem lại trên Chrome thông thường.
- Chỉ xem được trang giới thiệu của AppFlowy (bản mô phỏng sản phẩm), không xem được ứng dụng của họ sau đăng nhập.
- Ảnh chụp nằm trong thư mục tạm của phiên làm việc, chưa đưa vào repo. Giai đoạn 0 (mục 8) cần chụp lại có hệ thống.
- Số đo chuyển động lấy trên một trang board; các trang khác được kiểm bằng đọc mã.

### 1.2. Những gì tạo nên cảm giác "tĩnh"

| Nhóm | Bằng chứng | Nguồn |
|---|---|---|
| Chuyển động | Trên trang board (1046 phần tử): 73 phần tử có transition, tất cả 0,15s và chỉ đổi màu/bóng khi hover; 0 phần tử đang chạy animation; chỉ có một `@keyframes` là `pulse`. Không có hiệu ứng mở modal, thêm/xoá thẻ | Đo trực tiếp |
| Trạng thái tải | 16 vị trí trong 11 file trang dùng dòng chữ "Đang tải…", không có skeleton. Vào `/boards` lúc đầu chỉ thấy nền xám trống | Ảnh chụp, tìm trong mã |
| Nhận diện | Trang giới thiệu và đăng nhập dùng chàm `#4F46E5`; trong ứng dụng, nút "Tạo mới", mục đang chọn ở sidebar, liên kết dùng xanh Trello `#0c66e4` (161 lần, nhiều nhất ở `CardModal.tsx`, `WorkspaceSettingsPage.tsx`, `BoardMembers.tsx`, `Header.tsx`) | Ảnh chụp, tìm trong mã |
| Thứ bậc thông tin | Dashboard là một cột hẹp (`max-w-4xl` trong khung `max-w-5xl`), thẻ trắng trên nền xám, chỉ số là chữ đen. Thẻ bảng chỉ có màu và tên. Modal thẻ có một hàng nút cùng trọng số (Nhãn, Ngày, Thành viên, Việc cần làm, Ảnh bìa, Đính kèm) | Ảnh chụp |
| Điều hướng | Sidebar chỉ có Bảng, Mẫu, Trang chủ, Tìm kiếm nâng cao; "Thẻ của tôi" và "Lịch" nằm trong menu tài khoản. Dưới 768px sidebar bị ẩn (`hidden md:block`) và header không có nút mở thay thế | Đọc mã |
| Realtime chưa "thấy" được | Có presence ở mức bảng (hàng avatar cạnh nút chia sẻ). Nhưng khi người khác sửa, thẻ chỉ tự đổi sau khi tải lại danh sách (gộp 400ms), không có dấu hiệu ai vừa thay đổi gì | Đọc mã |

### 1.3. Điều đáng học từ AppFlowy và điều không sao chép

| Quan sát (ảnh tĩnh) | Áp dụng cho TaskFlow |
|---|---|
| Bản mô phỏng bảng có **con trỏ đa người dùng kèm tên** (Camille, Alexandre) và viền ô đang được chọn | Cảm giác "nhiều người cùng làm việc" thể hiện qua presence và làm nổi bật thay đổi realtime (mục 3.2) |
| Ảnh sản phẩm nhiều lớp chồng nhau (bảng, hộp "Visible properties", ảnh bìa gradient) | Ảnh sản phẩm ở trang giới thiệu sau khi giao diện được nâng cấp (mục 5.8) |
| Tab tính năng bấm được (AI Search, Knowledge Base, Projects…), mỗi tab một minh họa | Đã có phần tương đương ở trang giới thiệu; xem lại khi cập nhật ảnh |
| Phần tối tương phản ("Built for teams who own their stack") xen giữa nền sáng | Chỉ dùng cho trang giới thiệu, không đưa vào ứng dụng |
| Ứng dụng có sidebar dạng cây (workspace, favorites, trang con) | Sidebar TaskFlow theo cấu trúc tương tự (mục 5.1) |

**Không sao chép:** trình soạn thảo tài liệu dạng khối, định vị "tự triển khai cho doanh nghiệp", tích hợp SSO/LDAP. Các phần này nằm ngoài phạm vi khóa luận. Màn hình làm việc của TaskFlow cần mật độ thông tin phù hợp dùng lâu dài; chữ lớn và khoảng trắng rộng chỉ dành cho trang giới thiệu.

### 1.4. Đã có sẵn, không làm lại

Kanban kéo thả (có `DragOverlay` trong `BoardPage` và `ListColumnOverlay`), chế độ bảng biểu, lịch, dashboard, mẫu, tìm kiếm nâng cao, dark mode (class `.dark`, khóa `taskflow_theme`), AI tạo bảng, chatbot trợ lý, thống kê, gợi ý phân công, chia sẻ, **presence ở mức bảng** (backend phát `board:presence`, `BoardMembers` hiển thị avatar người đang mở bảng), Socket.IO cho thẻ/danh sách/thành viên, và trang giới thiệu công khai (chưa commit).

## 2. Nguyên tắc và ranh giới

- Không thay thuật toán phân công, công thức thống kê, quyền truy cập, quy trình xác thực trong đợt làm lại giao diện.
- Ưu tiên dữ liệu và API hiện có. Mỗi đề xuất ghi rõ là **chỉ frontend** hay **cần backend nhỏ** (mục 7).
- Thêm chuyển động không được làm hỏng các cơ chế phức tạp đã có: kéo thả dnd-kit, popover/modal `position: fixed`, vùng cuộn ngang của board.
- Mọi hiệu ứng trang trí phải tắt được qua `prefers-reduced-motion`; thông tin quan trọng không được chỉ truyền tải bằng chuyển động.
- Chưa thêm thư viện chuyển động. Dùng CSS và Tailwind v4 (`motion-safe:` / `motion-reduce:`); chỉ cân nhắc thư viện nếu hiệu ứng thoát (exit) không làm được bằng CSS.
- Đưa số liệu vào giao diện chỉ khi dữ liệu thực sự có; không hiển thị dữ liệu giả.

## 3. Lớp "sống động" (ưu tiên cao nhất)

### 3.1. Hệ chuyển động

Định nghĩa một bộ thông số dùng chung (biến CSS trong `@theme`), không đặt thời lượng rải rác từng component.

| Tình huống | Hiệu ứng | Thời lượng |
|---|---|---|
| Hover, focus | Giữ đổi màu/bóng hiện có | 150ms (giữ nguyên) |
| Mở hộp thoại | Mờ dần + phóng 0,97 → 1; nền tối mờ dần | 180ms mở, 120ms đóng |
| Menu, popover | Mờ dần + trượt 4px | 140ms |
| Thẻ mới xuất hiện (tự thêm hoặc từ realtime) | Mờ dần + trượt 6px | 200ms |
| Thẻ bị xoá/lưu trữ | Mờ dần rồi thu gọn chiều cao (tùy chọn, xem mục 10) | 180ms |
| Kéo thẻ | Thẻ đang kéo nghiêng nhẹ (khoảng 2°), bóng đậm hơn; vị trí thả là ô chờ viền nét đứt; khi thả có hiệu ứng "đặt xuống" (`dropAnimation` của dnd-kit) | 150ms |
| Skeleton | Dải sáng chạy ngang, lặp | 1,4s/vòng |
| Số liệu dashboard | Đếm lên, chỉ ở lần hiển thị đầu | 400–600ms |
| Đổi trang | Chỉ đổi độ mờ (không dùng `transform`, xem mục 10) | 150ms |
| Thông báo nhỏ (toast) | Trượt vào từ cạnh | 180ms |

Khi người dùng chọn giảm chuyển động: tắt mọi hiệu ứng trang trí; hiệu ứng làm nổi bật thay đổi realtime (mục 3.2) chuyển sang viền tĩnh giữ khoảng 1,5 giây để vẫn báo được thay đổi.

**Nghiệm thu:** Mở modal, thêm thẻ, kéo thả và đổi trang đều có phản hồi mượt; kéo thả, sắp xếp và bố cục board không bị lệch so với trước; tắt chuyển động trong hệ điều hành thì không còn hiệu ứng trang trí nhưng mọi chức năng vẫn dùng được.

### 3.2. Hiển thị hoạt động realtime

Hiện socket chỉ báo "bảng này đã đổi" (sự kiện mang mỗi `boardId`), sau đó giao diện tải lại danh sách sau 400ms. Người dùng không biết cái gì đã đổi.

| Hạng mục | Nội dung | Phạm vi |
|---|---|---|
| Presence rõ hơn | Giữ hàng avatar hiện có; thêm chấm trạng thái, chú thích "đang xem bảng", hiệu ứng khi có người vào/ra | Chỉ frontend |
| Làm nổi bật thẻ đổi bởi người khác | Sau mỗi lần tải lại, so sánh danh sách cũ và mới ở phía frontend; thẻ mới hoặc đổi cột/nội dung được viền nổi khoảng 1,2 giây. Bỏ qua thay đổi do chính người dùng vừa thao tác (khoảng vài giây gần nhất) | Chỉ frontend |
| Biết ai vừa làm gì | Toast dạng "Nam vừa chuyển 'X' sang Hoàn thành", cần biết người thực hiện và thẻ liên quan | Cần backend nhỏ: thêm `actorId`/`cardId` vào payload sự kiện |
| Ai đang xem thẻ nào | Chỉ báo trong ô thẻ | Cần backend: sự kiện presence mức thẻ (mở rộng, không thuộc đợt đầu) |

**Nghiệm thu:** Với hai tài khoản trong hai cửa sổ, tài khoản A kéo một thẻ thì cửa sổ B thấy thẻ đó nổi bật rồi trở lại bình thường; tự thao tác của mình không tự nháy; đang kéo thẻ thì làm nổi bật không làm gián đoạn việc kéo (hiện tại tải lại đã bị hoãn khi đang kéo, cần giữ).

### 3.3. Tiến độ và số liệu trực quan

- Thẻ bảng có thanh tiến độ (thẻ hoàn thành / tổng thẻ) và, khi dữ liệu có, số thành viên. **Cần backend nhỏ** (mục 7): danh sách bảng chưa trả tổng số thẻ và số thẻ hoàn thành. Dùng đúng định nghĩa "hoàn thành" mà `BoardStatsPanel` đang dùng để hai nơi không cho số khác nhau.
- Tiêu đề cột đã hiển thị số thẻ, giữ nguyên; cột có trạng thái thêm ánh màu nhẹ theo trạng thái (không đổi màu nhãn tùy chỉnh).
- Bốn chỉ số ở dashboard có biểu tượng và hiệu ứng đếm; chỉ số "Quá hạn" giữ màu cảnh báo kèm chữ.

**Nghiệm thu:** Thanh tiến độ khớp số liệu trong panel Thống kê của cùng bảng; bảng chưa có thẻ hiển thị trạng thái hợp lý (không chia cho 0, không hiện 100% giả).

### 3.4. Thao tác trực tiếp (tùy chọn, chọn 1–2 mục)

- Thêm thẻ nhanh liên tiếp: sau khi Enter, giữ ô nhập để thêm thẻ kế tiếp (kiểm tra hành vi hiện tại của `AddCardForm` trước khi sửa).
- Thao tác nhanh hiện khi hover thẻ (giao cho tôi, đặt hạn) và luôn thấy được trên thiết bị cảm ứng.
- Bảng lệnh mở bằng `Ctrl+K`, mở rộng phím `/` đang dùng cho tìm kiếm: nhảy tới bảng, tạo bảng, mở trợ lý. Thuộc giai đoạn sau.

### 3.5. Trạng thái tải và trạng thái trống

Thay 16 dòng "Đang tải…" bằng skeleton đúng hình dạng nội dung (thẻ bảng, dòng thẻ dashboard, cột Kanban). Có thông báo ngắn cho trình đọc màn hình (`role="status"`). Trạng thái trống có minh họa đơn giản và một hành động rõ (ví dụ "Tạo bảng đầu tiên"), đường đi dẫn tới luồng tạo bảng thủ công, mẫu hoặc AI đang có.

## 4. Bộ quy tắc thiết kế

### 4.1. Màu sắc: một màu chủ đạo

Chọn **chàm `#4F46E5`** làm màu hành động chính trên toàn ứng dụng, thay xanh Trello `#0c66e4` (161 lần) và nền mục chọn `#e9f2ff`. Tập trung thành biến trong `@theme` của Tailwind v4, mở rộng từ `frontend/src/styles/brand.css` (đã có `--brand-primary`, `--brand-accent`…) thay vì tạo tệp mới. Giữ `--app-bg` để tương thích.

| Vai trò | Sáng | Tối |
|---|---|---|
| Nền ứng dụng | `#F8FAFC` | `#0F172A` |
| Bề mặt nội dung | `#FFFFFF` | `#1E293B` |
| Chữ chính | `#0F172A` | `#F1F5F9` |
| Chữ phụ | `#475569` | `#CBD5E1` |
| Viền | `#E2E8F0` | `#334155` |
| Nút chính | `#4F46E5`, chữ trắng | `#4F46E5`, chữ trắng |
| Liên kết, mục đang chọn | `#4338CA` trên nền chàm nhạt | `#A5B4FC` trên nền chàm mờ |
| Điểm nhấn thương hiệu | `#06B6D4` | `#22D3EE` |

- Gradient chàm–ngọc chỉ dùng ở logo, trang giới thiệu, hình minh họa và một số chi tiết liên quan AI.
- Màu trạng thái và trạng thái công việc giữ ngữ nghĩa hiện có. Trạng thái quan trọng luôn có chữ hoặc biểu tượng kèm theo.
- Kiểm tra độ tương phản của tổ hợp thực tế, đặc biệt nhãn nhỏ và giao diện tối. Đổi 161 chỗ theo từng nhóm file rồi kiểm tra sáng/tối từng nhóm, không đổi hàng loạt một lần.
- Giữ ba lựa chọn sáng/tối/hệ thống và khóa `taskflow_theme` trong `ThemeContext`.

### 4.2. Chữ, khoảng cách, hình khối

- Dùng font hệ thống hiện có (đã hiển thị tốt tiếng Việt); chưa tải font ngoài.
- Tiêu đề trang 24–28px; tiêu đề nhóm 16–18px; nội dung và thao tác chính 14–16px; thông tin phụ 12–13px, không thu nhỏ nội dung quan trọng để nhét vừa màn hình.
- Thang khoảng cách 4 / 8 / 12 / 16 / 24 / 32px. Bo góc: ô nhập, nút 8px; thẻ 12px; hộp thoại 16px. Bóng nhẹ ở thẻ, rõ hơn ở menu và hộp thoại.
- Chuẩn hóa nét, kích thước biểu tượng SVG hiện có trước khi cân nhắc thêm thư viện.
- Chỉ tách component dùng chung khi có nhu cầu tái sử dụng rõ: nút chính/phụ/nguy hiểm, ô nhập, badge, tiêu đề trang, skeleton, trạng thái trống.

## 5. Thiết kế theo màn hình

### 5.1. Khung điều hướng

- Sidebar thêm "Công việc của tôi" (`/my-cards`) và "Lịch" (`/calendar`); "Trang chủ" đổi nhãn thành "Tổng quan"; menu tài khoản tập trung vào hồ sơ, theme, cài đặt, đăng xuất.
- Phần workspace dạng cây: mỗi workspace có mũi tên đóng/mở với chuyển động mượt, bảng con lồng bên dưới; hiện chỉ workspace hiện tại được mở.
- Dưới 768px (ngưỡng đang dùng `md`) dùng ngăn điều hướng mở từ trái qua nút menu trong header; đóng khi chọn đích, bấm nền hoặc Escape, quản lý và trả focus. Chỉ đổi ngưỡng nếu kiểm tra thấy chật. Cho phép thu gọn sidebar desktop còn 72px và lưu cục bộ.
- Khung `MainLayout` giới hạn nội dung `max-w-5xl`; cần cho từng trang tự chọn chiều rộng để dashboard mở rộng được (mục 5.2). Board vẫn dùng layout riêng với vùng cuộn ngang.
- Giữ route hiện có, luồng quay lại sau đăng nhập, banner xác minh email và dữ liệu outlet/context của layout board.

**Nghiệm thu:** Mọi mục chính truy cập được trên desktop và điện thoại; mở board không làm mất lối vào công việc cá nhân và lịch; thao tác bàn phím không bị kẹt; phím tắt board không kích hoạt phía sau ngăn điều hướng đang mở.

### 5.2. Dashboard — `/home`

- Giữ lời chào theo giờ, tên và ngày; thêm nút "Tạo bảng" ở đầu trang dùng luồng tạo bảng hiện có.
- Giữ bốn chỉ số, thêm biểu tượng và hiệu ứng đếm (mục 3.3). Không thêm biểu đồ khi chưa có dữ liệu phù hợp.
- Từ 1280px chia hai cột khoảng 2:1: cột chính gồm "Cần xử lý" (quá hạn → hôm nay → trong tuần, giữ giới hạn hiện có) và "Truy cập nhanh"; cột phụ là "Hoạt động gần đây". Nhỏ hơn thì xếp một cột, hoạt động ở cuối.
- "Gần đây" tiếp tục dựa trên lịch sử lưu trong trình duyệt, không mô tả như đồng bộ giữa các thiết bị. Phần truy cập nhanh chỉ hiện khi có bảng gần đây hoặc yêu thích.
- Không đổi công thức thời gian hoặc ý nghĩa chỉ số trong một thay đổi bố cục.

**Nghiệm thu:** Vùng công việc cần chú ý nổi bật hơn hoạt động; bốn chỉ số vẫn đúng; trạng thái đang tải (skeleton), không có việc, không có bảng và tải lỗi đều dùng được.

### 5.3. Danh sách bảng — `/boards`

- Giữ cách nhóm theo workspace, bảng yêu thích, khu vực lưu trữ. Thẻ tách phần ảnh bìa (80–96px) và phần thông tin: tên tối đa hai dòng, workspace, số thành viên, thanh tiến độ (mục 3.3), ngày "Cập nhật bảng". Thiếu trường tùy chọn thì ẩn, không thay bằng số 0.
- Có ảnh nền thì dùng ảnh; không có thì dùng màu đã chọn. Không ghi đè tùy chỉnh của người dùng.
- Lưới 1 cột ở điện thoại hẹp, 2 cột từ 640px, 3 cột từ 1280px, 4 cột từ 1536px, khoảng cách 16px. Nút yêu thích và menu hiện khi hover hoặc focus; thiết bị cảm ứng luôn thấy và bấm được.
- Ô "Tạo bảng mới" cùng kích thước nhịp lưới, dẫn đến luồng hiện có và lựa chọn tạo bằng AI. Có skeleton khi tải.

**Nghiệm thu:** Tên dài không đẩy nút ra ngoài; mở menu không mở nhầm bảng; có/không ảnh và có/không metadata đều ổn; quyền lưu trữ/xoá giữ nguyên.

### 5.4. Board và thẻ Kanban — `/boards/:boardId`

- Toolbar hai hàng: hàng trên gồm workspace, tên bảng, yêu thích/theo dõi, chia sẻ, thành viên và presence; hàng dưới gồm chế độ "Kanban" / "Bảng biểu", "Lọc", "Thống kê", "Chia sẻ" và menu "Công cụ" (hoạt động, trường tùy chỉnh, tự động hóa, lưu trữ, ảnh nền, phím tắt…). Giữ nguyên điều kiện phân quyền từng mục; tách quyền chỉnh sửa nội dung và quyền quản lý bảng.
- Bộ lọc đang bật có dấu hiệu nhận biết và cách xoá lọc rõ. Màn hình hẹp cho toolbar xuống dòng; chỉ vùng Kanban/bảng biểu được cuộn ngang.
- Áp dụng mục 3.1–3.3: kéo thả có phản hồi, thẻ mới xuất hiện có chuyển động, thay đổi realtime nổi bật.
- Thẻ: tên nhiệm vụ là nội dung chính; nhãn có tên khi đủ chỗ; hạn có biểu tượng/chữ kèm màu cảnh báo; avatar, checklist, số bình luận/đính kèm nằm ở vùng phụ nhất quán. Nền cột đủ tách khỏi thẻ, vùng chữ đọc rõ trên ảnh nền người dùng chọn.

**Nghiệm thu:** Chuyển hai chế độ, kéo thả, lọc, mở chi tiết, menu và phím tắt tiếp tục hoạt động; người chỉ xem không thấy thao tác chỉnh sửa trái quyền; popup không bị cắt bởi vùng cuộn.

### 5.5. Chi tiết công việc và gợi ý phân công

**Chi tiết thẻ:** Giữ hộp thoại hiện tại nhưng phân cấp lại. Cột chính: tiêu đề, mô tả, checklist, bình luận. Cột phụ (desktop): thuộc tính và người phụ trách, gom các nút "Nhãn, Ngày, Thành viên, Việc cần làm, Ảnh bìa, Đính kèm" thành nhóm "Thêm vào thẻ" thay vì một hàng nút ngang hàng nhau. Điện thoại dùng một cột, nội dung cuộn được, nút đóng luôn tiếp cận được. Có hiệu ứng mở/đóng (mục 3.1).

**Phân công một công việc:**

- Mỗi ứng viên hiện avatar, tên, trạng thái đã được giao, điểm xếp hạng và mức tải/khả năng nhận việc. Đưa kết quả chính lên trước, giải thích để sau; giữ nút "Vì sao?".
- Nhãn điểm là "Điểm phù hợp", kèm giải thích đây là điểm tương đối trong nhóm ứng viên của công việc này; không dùng phần trăm khiến người dùng hiểu là xác suất hoàn thành. Phân biệt "Độ tin cậy" (thành phần chấm điểm) với "Mức đủ dữ liệu" (bằng chứng lịch sử).
- Lý do hiển thị lấy từ dữ liệu có sẵn; không thêm mô hình AI sinh lời giải thích. Mức tải dùng đúng `load` và `capacity` theo cách tính hiện hành.
- Giữ các tình huống thiếu lịch sử, không có việc tương tự, quá tải, tạm nghỉ, đang tải và lỗi; khi gợi ý lỗi vẫn giao thủ công được. Tiếp tục ẩn tên bằng chứng từ bảng riêng tư theo phản hồi API.

**Phân công cả nhóm/danh sách:** Giữ bước xem trước và áp dụng. Làm rõ việc nào giao cho ai, cảnh báo tải và kết quả áp dụng. Khi đổi người được giao, chỉ hiển thị thông tin thực có cho người mới; giữ áp dụng từng thẻ, thử lại phần lỗi, không tự giao khi mở màn hình, không ghi phản hồi học lặp do đổi component.

**Nghiệm thu:** Bố cục mới thể hiện đúng dữ liệu và thứ tự đề xuất; không thay đổi điểm, trọng số, phản hồi học hay hành vi xác nhận cảnh báo.

### 5.6. Mẫu, công việc cá nhân, lịch, tìm kiếm, hồ sơ

- **Mẫu:** hình xem trước board đơn giản dựng từ cột/nội dung mẫu hiện có thay cho dải màu nhỏ; giữ "Mẫu của bạn", "Mẫu có sẵn", workspace đích, nút dùng mẫu.
- **Công việc của tôi:** làm nổi nhóm hạn, tên bảng, trạng thái; giữ cách ẩn công việc hoàn thành; dùng chung kiểu hạn, avatar, trạng thái với dashboard và Kanban.
- **Lịch:** giữ tháng/tuần và kéo thả ngày; màn hình hẹp ưu tiên đọc ngày và sự kiện, cuộn ngang chỉ trong vùng lịch.
- **Tìm kiếm:** nhóm bộ lọc rõ hơn, hiển thị điều kiện đang áp dụng và nút xoá lọc; giữ bộ lọc đã lưu, phân trang và cách nhận `q` từ URL.
- **Hồ sơ/cài đặt:** áp dụng lại màu, form, tiêu đề; giữ vùng hành động nguy hiểm tách biệt về thị giác. (Trang Hồ sơ và `DeclaredProfileSection` đang có thay đổi lớn chưa commit trong thư mục làm việc; rà lại sau khi có màu chung.)

### 5.7. Đăng nhập và đăng ký

Từ 1024px dùng hai cột: form bên trái, hình TaskFlow và một câu lợi ích bên phải (dữ liệu demo, không có thông tin người dùng thật); nhỏ hơn thì giữ form và phần thương hiệu gọn. Đồng bộ màu, ô nhập, lỗi, nút. Giữ đăng nhập Google khi được cấu hình, trạng thái gửi, xác thực và đích quay lại sau đăng nhập/đăng ký.

### 5.8. Trang giới thiệu công khai — đã dựng, cần rà soát

Khác với bản 27/09 (đề xuất `/welcome`, giữ nguyên `/`), thư mục làm việc hiện đã dùng: `/` là trang giới thiệu (`LandingPage.tsx`), `/boards` là danh sách bảng, đường dẫn không xác định chuyển về `/boards` nếu đã đăng nhập hoặc `/` nếu chưa. Trang có header, tính năng, phần AI, cách hoạt động, hỏi đáp, lời mời cuối, nút chính đổi theo trạng thái tài khoản (chưa đăng nhập → `/register`; đã đăng nhập → `/boards`, nhãn "Mở TaskFlow" hoặc "Vào không gian làm việc"), liên kết bỏ qua, menu điện thoại, và một bài kiểm tra định tuyến (`LandingRouting.test.tsx`). Phần này chưa commit.

Việc còn lại:

- Chạy lại lint, build và test frontend rồi commit trang giới thiệu cùng các thay đổi kèm theo (nhiều file đăng nhập/hồ sơ đang sửa dở) thành các commit riêng, dễ theo dõi.
- Sau giai đoạn 3–4, chụp lại ảnh sản phẩm thật để thay bản mô phỏng (`BoardPreview`) nếu cần cho khớp giao diện mới.
- Không thêm số lượng khách hàng, đánh giá, chứng nhận khi chưa có căn cứ.

**Nghiệm thu:** Truy cập không cần đăng nhập, không tải dữ liệu workspace riêng tư; nút chính đúng trạng thái tài khoản; các luồng board công khai và lời mời giữ nguyên.

## 6. Trạng thái và chất lượng tương tác

| Tình huống | Cách thể hiện |
|---|---|
| Đang tải lần đầu | Skeleton theo hình dạng nội dung, có thông báo ngắn cho trình đọc màn hình |
| Chưa có bảng | Lời giải thích và hành động "Tạo bảng đầu tiên" |
| Không có việc đến hạn | Thông báo tích cực, gọn; vẫn hiện truy cập nhanh |
| Không có kết quả lọc | Hiện điều kiện đang lọc và cách xoá lọc |
| Tải lỗi | Thông báo trong vùng lỗi và nút thử lại; không biến lỗi thành số liệu 0 |
| Đang lưu/gửi | Phản hồi ngay, chặn gửi lặp |
| Không có quyền | Giữ cách xử lý quyền hiện hành; không chỉ đổi màu để giả trạng thái bị khóa |

- Kiểm tra ở 375, 768, 1024, 1280, 1440px; chữ dài và tên tiếng Việt phải đọc được.
- Nút biểu tượng có tên truy cập; hover có trạng thái focus tương đương; vùng chạm quan trọng trên điện thoại khoảng 44px.
- Menu/hộp thoại quản lý focus, Escape và trả focus; tránh để phím tắt board kích hoạt phía sau lớp phủ.

## 7. Dữ liệu, API và ranh giới mở rộng

| Đề xuất | Cơ chế hiện có | Cần thay đổi |
|---|---|---|
| Hệ chuyển động, skeleton, màu chung | CSS, Tailwind v4 | Chỉ frontend |
| Presence rõ hơn | Sự kiện `board:presence` (`backend/src/realtime/socket.ts`), hiển thị trong `BoardMembers` | Chỉ frontend |
| Làm nổi bật thẻ đổi bởi người khác | Sự kiện `board:lists-changed` chỉ mang `boardId`; frontend tải lại danh sách | Chỉ frontend (so sánh danh sách cũ và mới) |
| Toast "ai vừa làm gì" | Chưa có người thực hiện và thẻ liên quan trong sự kiện | Backend nhỏ: thêm `actorId`, `cardId` vào payload (tùy chọn) |
| Presence mức thẻ | Chưa có | Backend: sự kiện mới (mở rộng, ngoài đợt đầu) |
| Thanh tiến độ trên thẻ bảng | `GET /api/boards` chưa trả tổng thẻ và số thẻ hoàn thành | Backend nhỏ, chỉ đọc: thêm số liệu tổng hợp vào danh sách bảng |
| Avatar nhóm trên thẻ bảng | Danh sách chỉ có `memberCount` | Backend nhỏ (tùy chọn); đợt đầu chỉ hiện số thành viên |
| Bố cục dashboard, sidebar | Dữ liệu thẻ của tôi, hoạt động, bảng, lịch sử cục bộ | Chỉ frontend |
| Gợi ý phân công, thống kê, AI tạo bảng | Đã có | Chỉ đổi cách trình bày |

Không có migration cơ sở dữ liệu trong phạm vi chính. Các thay đổi backend ở trên đều nhỏ, chỉ thêm trường hoặc dữ liệu tổng hợp, và cần được thêm kèm test backend.

Điểm bắt đầu khi triển khai: [định tuyến](frontend/src/App.tsx), [khung ứng dụng](frontend/src/layouts/MainLayout.tsx), [sidebar](frontend/src/components/Sidebar.tsx), [CSS dùng chung](frontend/src/index.css), [màu thương hiệu](frontend/src/styles/brand.css), [dashboard](frontend/src/pages/HomeDashboard.tsx), [thẻ bảng](frontend/src/components/BoardCard.tsx), [kiểu dữ liệu bảng](frontend/src/types/board.ts), [realtime của board](frontend/src/pages/boardPage/useBoardRealtime.ts), [socket phía backend](backend/src/realtime/socket.ts).

Tài liệu nền: [Giao diện và chức năng hiện tại](GIAO_DIEN_CHUC_NANG.md), [Tổng quan dự án](PROJECT.md), [Module AI](AI_MODULE.md), [Module phân công](ASSIGN_MODULE.md), [Chatbot](CHATBOT_MODULE.md). Khi tài liệu và mã khác nhau, đối chiếu mã nguồn trước khi làm.

## 8. Các giai đoạn triển khai

Không gắn thời gian cố định khi chưa thống nhất bản phác. Mỗi giai đoạn có đầu ra kiểm tra độc lập. Thứ tự khác bản 27/09: phần chuyển động và board sống đứng trước dashboard vì tác động trực tiếp tới nhận xét "tĩnh".

| Giai đoạn | Việc thực hiện | Đầu ra |
|---|---|---|
| 0. Ghi nhận hiện trạng | Chụp lại có hệ thống dashboard, danh sách bảng, board, chi tiết thẻ, đăng nhập ở sáng/tối và điện thoại; chuẩn bị dữ liệu demo; xem AppFlowy trên Chrome thông thường để ghi nhận chuyển động thật | Bộ ảnh đối chiếu và ghi chú, lưu trong repo |
| 1. Nền tảng | Biến màu chung và thay dần xanh Trello bằng chàm; bộ thông số chuyển động và quy tắc giảm chuyển động; thành phần skeleton và trạng thái trống; cho từng trang chọn chiều rộng trong `MainLayout` | Ứng dụng nhìn thống nhất một màu chủ đạo, skeleton thay chữ "Đang tải…" |
| 2. Điều hướng | Sidebar (thêm Công việc của tôi, Lịch; cây workspace; thu gọn), ngăn điều hướng điện thoại | Điều hướng dùng được mọi kích thước |
| 3. Board sống động | Chuyển động modal/menu/thẻ, phản hồi kéo thả, presence rõ hơn, làm nổi bật thay đổi realtime, phân cấp lại modal thẻ | Kịch bản demo hai tài khoản (mục 9.3) chạy được |
| 4. Dashboard và danh sách bảng | Bố cục hai cột, hiệu ứng đếm, thẻ bảng có thông tin và tiến độ | Hai trang có thứ bậc rõ và dùng đúng dữ liệu |
| 5. Hoàn thiện | Trình bày gợi ý phân công, mẫu, việc cá nhân, lịch, tìm kiếm, cài đặt, đăng nhập/đăng ký | Không còn nhóm trang lệch nhận diện |
| 6. Trang giới thiệu | Rà soát, commit, cập nhật ảnh sản phẩm | Nội dung khớp giao diện thực |
| 7. Kiểm tra tổng thể | Responsive, theme, quyền, phím tắt, hồi quy | Ảnh trước/sau, kết quả kiểm tra, danh sách giới hạn còn lại |

**Lát cắt nhỏ nhất đáng làm:** giai đoạn 0, 1, 3 và 4. Giai đoạn 2 nên làm trước 3 nếu cần trình diễn trên điện thoại.

## 9. Kế hoạch kiểm tra

### 9.1. Các luồng cần kiểm tra

| Nhóm | Kịch bản chính |
|---|---|
| Điều hướng | Mở/thu gọn sidebar, ngăn điều hướng điện thoại, đổi workspace, chuyển dashboard ↔ board, quay lại bằng trình duyệt |
| Dashboard | Có việc quá hạn/hôm nay, không có việc, chưa có bảng, đang tải, tải lỗi |
| Thẻ bảng | Tên dài, ảnh thiếu/lỗi, thiếu metadata, bảng chưa có thẻ, yêu thích, menu, lưu trữ và khôi phục |
| Board | Kanban/bảng biểu, kéo thả thẻ/cột khi có hiệu ứng, lọc/xoá lọc, mở chi tiết, menu trong vùng cuộn |
| Realtime | Hai tài khoản cùng mở một bảng: vào/ra, kéo thẻ, thêm thẻ, sửa thẻ đang mở; mất kết nối rồi nối lại |
| Phân công | Có bằng chứng, thiếu lịch sử, chưa có điểm, quá tải, tạm nghỉ, lỗi API, giao thủ công |
| Phân quyền | Chủ sở hữu, người chỉnh sửa, người chỉ xem, truy cập công khai |
| Xác thực | Đăng nhập/đăng ký, link trực tiếp có query, lời mời, xác minh email, Google nếu được cấu hình |
| Theme, tiếp cận | Sáng/tối/hệ thống, bàn phím, focus, giảm chuyển động, menu lồng nhau |
| Điện thoại | Header không che thao tác chính, không tràn ngang ngoài vùng cho phép, form và hộp thoại dùng được |
| Trang giới thiệu | Truy cập ẩn danh, tài khoản đã đăng nhập, liên kết trong trang, không gọi dữ liệu riêng tư |

### 9.2. Kiểm tra tự động và thủ công

- Trong thư mục `frontend`: `npm run lint`, `npm run build`, `npm test`. Chạy toàn bộ bộ test sau mỗi giai đoạn sửa layout chung. Chỉ chạy test backend khi có thay đổi backend (tiến độ thẻ bảng, payload sự kiện).
- Ưu tiên test hành vi: phần tử thoát chỉ bị gỡ sau khi hiệu ứng kết thúc, giảm chuyển động tắt hiệu ứng, điều hướng và focus, trạng thái tải/lỗi, quyền. Không viết test chỉ để khẳng định mã màu hay tên class CSS.
- Tận dụng test hiện có cho Header, cột Kanban/kéo thả, bảng biểu, dark mode, thành viên bảng và gợi ý phân công; kiểm tra danh sách test thực tế trước khi chọn lệnh.
- Khi kiểm tra chuyển động, đảm bảo trình duyệt **không** bật giảm chuyển động (khung xem trước dùng trong phiên khảo sát ngày 30/09 đang bật), nếu không sẽ không thấy hiệu ứng nào.
- Chụp ảnh trước/sau cùng kích thước, dữ liệu và theme; ghi rõ lỗi có sẵn so với lỗi mới.

### 9.3. Kịch bản demo hai tài khoản (khoảng 2 phút)

Dùng hai tài khoản demo từ `teamSeed.ts` trong hai cửa sổ trình duyệt riêng, cùng mở bảng "Sprint 4":

1. Cửa sổ A mở bảng; cửa sổ B mở cùng bảng: avatar của B xuất hiện ở A với hiệu ứng vào.
2. B kéo một thẻ từ "Cần làm" sang "Đang làm": A thấy thẻ chuyển cột và được làm nổi bật rồi trở lại bình thường.
3. A mở chi tiết thẻ: hộp thoại mở mượt; thêm bình luận, B thấy cập nhật.
4. Về dashboard: số liệu đếm lên, thẻ bảng có thanh tiến độ, skeleton hiện khi tải chậm.
5. Bật "giảm chuyển động" của hệ điều hành: hiệu ứng trang trí biến mất, chức năng không đổi.

## 10. Rủi ro và cách xử lý

| Rủi ro | Cách xử lý |
|---|---|
| CSS transition xung đột với `transform` mà dnd-kit tự đặt cho phần tử sắp xếp | Chỉ thêm hiệu ứng vào/ra và overlay; không thêm transition cho `transform` của phần tử đang sắp xếp; thử kéo thả sau mỗi thay đổi |
| `transform`, `filter`, `backdrop-filter` ở phần tử cha làm popover/modal `position: fixed` bị lệch (đã gặp ở thanh tên bảng có `backdrop-blur`) | Hiệu ứng đổi trang chỉ dùng độ mờ; menu/modal trong vùng có hiệu ứng thì đưa ra `body` bằng portal |
| Làm nổi bật realtime nháy sai (thay đổi của chính mình, hoặc mỗi lần tải lại đều nháy) | So sánh nội dung thật giữa hai lần tải; bỏ qua thay đổi do thao tác của mình trong vài giây gần nhất; cần `actorId` mới chính xác hoàn toàn (mục 3.2) |
| Hiệu ứng thoát (gỡ khỏi DOM sau khi mờ) làm phức tạp component | Ưu tiên hiệu ứng vào; hiệu ứng thoát chỉ làm khi đơn giản, nếu không thì bỏ |
| Đổi 161 chỗ màu gây lỗi tương phản hoặc sai ở giao diện tối | Đổi theo nhóm file, kiểm tra sáng/tối từng nhóm |
| Phạm vi phình to | Bám lát cắt nhỏ nhất ở mục 8; phần tùy chọn (mục 3.4, toast, presence mức thẻ) chỉ làm khi còn thời gian |

## 11. Checklist bàn giao giao diện

- [x] Một màu chủ đạo thống nhất giữa trang giới thiệu, đăng nhập và ứng dụng, sáng/tối đều đọc rõ.
- [x] Hệ chuyển động dùng chung, có tắt qua giảm chuyển động; kéo thả và bố cục board không hỏng.
- [x] Skeleton thay các dòng "Đang tải…"; trạng thái trống có hành động rõ.
- [x] Presence và thay đổi realtime nhìn thấy được, không nháy sai.
- [x] Thanh tiến độ trên thẻ bảng khớp số liệu trong panel Thống kê (cùng định nghĩa `isDone`, bỏ thẻ/danh sách đã lưu trữ; có test).
- [x] Công việc cá nhân và lịch truy cập được trên desktop và điện thoại.
- [x] Dashboard ưu tiên việc cần xử lý và không hiển thị dữ liệu giả.
- [x] Gợi ý phân công giữ đúng điểm, mức đủ dữ liệu, cảnh báo và quyền xem bằng chứng (không đổi logic, chỉ đổi màu nhấn; các test của bảng gợi ý vẫn qua).
- [x] Đăng nhập, lời mời, board công khai và link trực tiếp hoạt động đúng luồng hiện hành (có test định tuyến `LandingRouting.test.tsx`; chưa thử tay từng luồng sau đợt nâng cấp).
- [x] Trang giới thiệu đã commit, nội dung và hình minh họa phản ánh chức năng thực tế (hình là bản mô phỏng có ghi "Bản minh họa").
- [x] Có kết quả kiểm tra, ảnh đối chiếu trước/sau và ghi chú giới hạn cho phạm vi đã triển khai.

## Phụ lục: thay đổi so với bản 27/09/2026

- Thêm mục 1 (khảo sát), mục 3 (lớp sống động), mục 9.3 (kịch bản demo), mục 10 (rủi ro).
- Đổi màu chủ đạo trong ứng dụng từ xanh Trello sang chàm; ghi rõ số lượng cần đổi.
- Sửa các chỗ không khớp mã nguồn: trang giới thiệu đã ở `/` (không phải `/welcome`); danh sách bảng ở `/boards`; presence mức bảng đã có; sự kiện realtime chỉ mang `boardId`.
- Đổi thứ tự giai đoạn: board sống động và dashboard lên trước; trang giới thiệu chỉ còn rà soát.
- Bỏ các câu về việc "chỉ tạo tài liệu" và rút gọn phần lặp lại.
- Đưa phần thanh tiến độ trên thẻ bảng vào phạm vi (cần thêm số liệu tổng hợp ở backend).

## Nhật ký triển khai (nhánh `giao-dien-nang-cap`, tách từ `skeleton` ngày 30/09/2026)

Mỗi bước là một commit riêng; sau mỗi bước chạy `npm run lint` (không lỗi), `npm run build` và `npm test` trong `frontend`. Nền trước khi làm: 291 test qua, hiện 354 test qua. Ảnh đối chiếu trước/sau ở [docs/anh-doi-chieu](docs/anh-doi-chieu/README.md).

| Bước | Nội dung | Commit |
|---|---|---|
| Nền | Commit phần đang sửa dở: trang giới thiệu ở `/`, đồng bộ màu trang xác thực, trang Hồ sơ, tài liệu này | `4002987`, `5388ed9`, `c7c31ec`, `91be437` |
| 1a | Màu chủ đạo chàm thay xanh Trello: biến `primary`, `primary-hover`, `primary-soft`, `primary-ink` (hai biến sau tự đổi ở giao diện tối); thay khoảng 180 chỗ ở 43 file; nền ứng dụng `#f8fafc` | `2580d83` |
| 1b | Hệ chuyển động `motion.css`: hộp thoại, menu/popover, đổi trang; chỉ hiệu ứng vào; tắt hết khi giảm chuyển động (`motion.test.ts` bảo đảm mọi lớp có animation đều bị tắt). Đã đo: khung hình chạy thật, kết thúc để lại `transform: none` | `adcf831` |
| 1c, 1d | Skeleton (`Skeleton.tsx`) thay "Đang tải…" ở các trang chính, menu, panel, trang phụ; sửa lỗi ô chỉ số dashboard hiện "0" khi đang tải | `44b5df3`, `84262fe` |
| 1e | Trạng thái trống có biểu tượng và hành động (`EmptyState`): Thẻ của tôi, Hoạt động của tôi, Tổng quan, Tìm kiếm | `0ab1ee0` |
| 3a | Thẻ mới / vừa chuyển cột mờ dần vào; thay đổi do người khác nổi viền ~1,2s (so sánh danh sách cũ và mới ở frontend, không đổi backend). Không nháy khi chính mình thao tác, khi đang kéo, khi lần tải đầu/đổi bảng, hoặc khi hơn 12 thẻ đổi cùng lúc. Đã thử thật với tài khoản thứ hai | `157ed30` |
| 3b | Presence: chấm xanh, chú thích "<tên> (bạn) — đang xem bảng", `role=group` + nhãn liệt kê tên, avatar bật lên khi có người vào. Đã thử thật qua socket | `bde713d` |
| 3c | Hộp thoại thẻ: nhóm "Thêm vào thẻ" và biểu tượng cho 6 nút; vị trí popover giữ nguyên | `afd9950` |
| 3d | Thanh công cụ board: xuống dòng ở màn hình hẹp, tên bảng không bị ngắt 4 dòng, 7 nút công cụ gom vào một nhóm `role=toolbar` | `2749c9f` |
| 4a | Backend: danh sách bảng trả `cardCount`, `doneCount` (hai truy vấn gom nhóm, đếm giống màn hình bảng); 6 test mới | `d411841` |
| 4b | Thẻ bảng có ảnh bìa + tên, không gian, số thành viên, ngày cập nhật, thanh tiến độ; Tổng quan hai cột từ 1280px, nút "Tạo bảng", số liệu đếm lên (`useCountUp`); layout rộng hơn cho `/home` và `/boards` | `6e5b728` |
| 2 | Điều hướng: 6 mục chính (thêm "Công việc của tôi", "Lịch"), cây không gian đóng/mở mượt (nhớ trạng thái), ngăn điều hướng cho điện thoại (`NavDrawer`: Escape, nền, chọn liên kết, giữ và trả focus, phím không lọt ra phím tắt của bảng), nút menu ở header. Sửa lỗi tràn ngang của Tổng quan ở 375px | `f1340f8` |
| 5a | Mẫu có hình xem trước bảng; đăng nhập/đăng ký hai cột từ 1024px (bảng Kanban minh hoạ với dữ liệu demo); thống nhất màu nhấn ở giao diện tối | `bd5a549` |
| 5b | Lịch trên màn hình hẹp: tiêu đề một dòng, lưới lịch cuộn ngang trong vùng riêng. Đã rà 375px các trang chính: không còn tràn ngang | `386c8c6` |
| 0/7 | Ảnh đối chiếu trước/sau lưu trong repo | `583cd7a` |

### Chưa làm hoặc làm một phần (ghi rõ để không hiểu nhầm)

- **Không làm (cần backend hoặc nằm ngoài đợt này):** toast "ai vừa làm gì" và chỉ báo "ai đang xem thẻ nào" (sự kiện realtime chỉ mang `boardId`).
- **Chưa làm:** thu gọn sidebar desktop còn 72px; hiệu ứng thoát (thẻ bị xoá/lưu trữ thu gọn dần); bảng lệnh `Ctrl+K`, thêm thẻ nhanh liên tiếp, thao tác nhanh khi hover thẻ (mục 3.4 là tùy chọn).
- **Làm một phần:** toolbar board mới chỉ gom nhóm và cho xuống dòng, chưa gộp vào menu "Công cụ"; trang giới thiệu chỉ rà soát (giữ bản mô phỏng sản phẩm, chưa thay bằng ảnh chụp thật); trang Hồ sơ/Cài đặt mới rà tràn ngang, chưa rà thị giác từng khối; phần kéo thả vốn đã có phản hồi tốt nên không làm lại.
- **Chưa xem được:** chuyển động ở tốc độ thật trong trình duyệt của công cụ (bật sẵn "giảm chuyển động"); hiệu ứng được xác minh bằng cách ép bật tạm và đo. Nên xem trên Chrome thường trước khi báo cáo.
- **Nợ kỹ thuật ghi nhận:** một cảnh báo lint mới `set-state-in-effect` ở `useCardHighlights` (có chủ đích, dùng `useLayoutEffect` để không nhấp nháy).

