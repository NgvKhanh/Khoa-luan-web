# Bàn giao chatbot v2 — bước 4–6

Ngày: 04/10/2026. Phạm vi: điều phối AI, API/phiên và panel; không bao gồm kho hướng dẫn RAG ở bước 7 hoặc đánh giá diện rộng ở bước 8.

## Kết quả kiểm tra

- Backend: 56 test liên quan trên 8 file, qua các lượt chạy chọn lọc: v2 API (12), adapter (4), tools (10), dataset (1), API v1 (10), catalog API (8), LLM/API v1 (8), chống lộ lịch sử thẻ (3). Các test v2 có HTTP thật, PostgreSQL fixture thật và AI mock để kết quả ổn định. Không phải toàn bộ test repository.
- Frontend: 37 test trên 3 file; có câu nhiều phần, lựa chọn đối tượng, client API v2 và xem thêm riêng từng phần.
- Backend typecheck và ESLint trên module mới: đạt. Frontend build: đạt. Lint frontend không có lỗi, còn các warning hiện có về React; build có cảnh báo kích thước bundle.
- Gemini thật trên fixture giả: trả đúng bảng tên 1234, phân công 6/chưa giao 25 (tính cả việc hoàn thành); tải việc đang mở 30, Lan/Tuấn đồng hạng 2 việc, chưa giao 25. Lịch sử tuần này: 11 sự kiện trên 5 thẻ, nội dung thẻ chuyển/xóa bị che. Câu lịch sử thiếu thời gian được server hỏi lại.
- Trình duyệt Chromium với frontend/API/Gemini thật trên DB test: trả hai danh sách, xem thêm chỉ danh sách chưa giao đến đủ 25 thẻ, mở đúng card, giữ hội thoại khi chuyển trang và trả bảng khối lượng có đồng hạng. [Ảnh kiểm tra](backend/chat-v2-browser.png).

## Các điểm được sửa từ thử nghiệm

- Model có lúc lấy tên bảng số làm ID thật. Backend phân giải tên trước; scope ID chưa được xác minh bị từ chối.
- Model có lúc chọn OPEN cho câu đối chiếu đã/chưa phân công, làm mất thẻ đã xong. Mặc định ALL được ổn định ở server; yêu cầu rõ “chỉ việc chưa xong” vẫn dùng OPEN.
- JSON planner phải giữ system instructions ở role system; không đặt chúng trong phần JSON dữ liệu của hội thoại.
- Thử nghiệm native tool đơn giản được endpoint chấp nhận; bộ schema đầy đủ bị từ chối. JSON planner đã chạy đầy đủ nhiều vòng. Adapter giữ cả hai đường và không tuyên bố schema đầy đủ đã được xác nhận native.

## Tái chạy

Từ `backend`: `npm test -- test/chat.v2.api.test.ts test/chat.v2.llm.test.ts test/chat.v2.tools.test.ts test/chat.v2.dataset.test.ts`. Chạy test DB trong một process vì mỗi test truncate DB test chung.

Probe không đọc DB: `npx tsx src/scripts/probeChatV2.ts --live`. Chỉ dùng dữ liệu công cụ giả, gọi provider thật. Đánh giá đọc fixture: `npx tsx test/liveChatV2.ts --live` sau khi seed fixture qua test v2; report ở `backend/eval-chat-v2-smoke.json` (gitignored như các report tự sinh hiện có).

Browser: `node -r tsx/cjs test/browserChatV2.cjs --live` với Playwright đã cài hoặc biến TASKFLOW_PLAYWRIGHT_MODULE trỏ tới module Playwright. Dùng DB test cục bộ và hai cổng riêng 4200/5175. Bỏ `--live` thì dùng fallback cơ bản, không dùng key thật. Script tái sử dụng fixture hoặc seed vào DB test khi chưa có; không đọc DB ứng dụng đang chạy.

Smoke report không phải tỷ lệ chính xác, không thay thế chạy bộ câu hỏi tách dev/test nhiều lần ở bước 8. Ngữ cảnh/lịch sử hiện được lưu trong database như phần bổ sung bên dưới; dữ liệu/quyền đọc lại mỗi công cụ, không có snapshot chung giữa mọi công cụ/trang.

Để dùng ở môi trường development hiện tại: tải lại website, mở trợ lý và bắt đầu hội thoại mới. Hợp đồng đầy đủ ở [CHATBOT_V2_MODULE.md](CHATBOT_V2_MODULE.md).

## Sửa lỗi câu hỏi “gán thành viên” — 04/10/2026

- Tiến trình backend Docker chưa nạp route v2: kiểm tra HTTP `/api/chat/v2/status` trả 404 dù mã nguồn đã có route. Sau khi khởi động lại `taskflow-backend`, endpoint trả 200, engine v2, AI đã cấu hình.
- Frontend mặc định dùng v2 khi khám phá trạng thái lỗi hoặc thiếu engine; chỉ chọn legacy khi server yêu cầu rõ. Tránh âm thầm gửi câu hỏi về chatbot cũ khi status tạm lỗi.
- Planner và fallback hiểu thêm “đã được gán thành viên / chưa được gán”. So sánh đã/chưa gán tính cả việc hoàn thành, trừ khi người hỏi yêu cầu chỉ việc chưa xong.
- Kiểm tra lại: 15 test API v2 + 29 test panel/client đạt; backend typecheck và frontend build đạt. Test bao gồm đúng câu trong ảnh, Gemini lỗi và status 404.
- Chromium/Gemini thật trên DB test trả hai phần đúng 6/25 cho câu trong ảnh; xem thêm, mở thẻ và câu khối lượng có đồng hạng đều đạt. Các con số này thuộc dữ liệu giả của bài kiểm tra.

## Sửa lỗi câu hỏi “bảng 1234 gồm những ai” — 04/10/2026

- Phần phân giải tên bảng trước khi gọi AI đã lấy `1234 gồm` làm tên, khiến câu hỏi dừng ở NOT_FOUND. Bổ sung ranh giới câu hỏi gồm / bao gồm / thành viên; tên dài đặt trong dấu ngoặc kép vẫn được giữ nguyên.
- Planner dùng `query_catalog` với kind MEMBERS để đọc danh sách thành viên trong phạm vi bảng; fallback hỗ trợ câu này khi AI chưa sẵn sàng. Kết quả có tiêu đề “Danh sách thành viên”, không suy ra thành viên từ người được giao thẻ.
- 20 test API/điều phối v2 và backend typecheck đạt. Chromium với Gemini thật trên DB test trả đúng danh sách 4 người của fixture, cùng các kiểm tra phân công, xem thêm và mở thẻ. Không đọc dữ liệu thực tế của người dùng trong bài kiểm tra này.

## Lưu lịch sử theo tài khoản — 04/10/2026

- Migration `20261004160000_chat_history` thêm ChatConversation/ChatTurn. Các API v2 lưu câu hỏi/trả lời và ngữ cảnh server, gồm các trang xem thêm; lỗi câu hỏi cũng được giữ. Handle v1 không khôi phục sau restart, nhưng câu trả lời đã lưu vẫn được đọc.
- Panel tự mở hội thoại gần nhất khi mở trợ lý sau reload/đăng nhập lại; có nút Lịch sử chọn hội thoại, phân trang danh sách và tin nhắn. Nút + không xóa lịch sử.
- Đọc lịch sử/tiếp tục chỉ cho chủ hội thoại. Snapshot câu trả lời có kiểm quyền hiện tại; thẻ chuyển sang bảng riêng hoặc quyền bị thu hồi sẽ che kết quả cũ. Database là nguồn ngữ cảnh để tiếp tục sau khi mất cache và khi nhiều tiến trình cùng dùng một hội thoại.
- Đã kiểm tra chọn lọc: 27 test backend (20 API/điều phối + 7 lịch sử), 37 test frontend (27 panel + 6 client + 4 dark mode); typecheck, ESLint module mới và frontend build đạt. Không phải toàn bộ test repository.
- Chromium/DB test ở chế độ cơ bản đạt: reload khôi phục transcript, xóa cache server vẫn xem thêm được, mở lại hội thoại cũ giữ đủ trang đã tải và tiếp tục đúng bảng. Browser smoke không tạo dữ liệu trong DB ứng dụng.
- Lịch sử bắt đầu từ phiên bản này; các lượt chỉ ở bộ nhớ và đã mất trước khi triển khai không thể khôi phục.
