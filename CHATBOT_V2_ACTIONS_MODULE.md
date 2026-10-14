# Chatbot v2 — mô-đun hành động (hợp đồng cuối, Phase 8)

Ngày chốt: 09/10/2026 (cập nhật 14/10/2026 cho bước E–I) · Phạm vi: `backend/src/modules/chat/v2/actions/*`, các công cụ đọc mở rộng, giao diện `frontend/src/components/assistant/*` · Trạng thái: **Phase 1–4, 6, 7, 8 đã triển khai** (Phase 5 trong lộ trình gốc được thu gọn thành Board Patch ở Phase 3).

Tài liệu này là **bản tổng hợp hợp đồng**: một chỗ để đọc “mô-đun này làm gì, không làm gì, bảo đảm gì và đã được kiểm chứng ra sao”. Chi tiết từng giai đoạn (lý do thiết kế, số liệu đo, bẫy gặp phải) ở `CHATBOT_V2_MODULE.md` §9–§9F; kế hoạch gốc và các quyết định D0–D7 ở `CHATBOT_V2_ACTIONS_PLAN.md`. Hợp đồng của chatbot **chỉ đọc** (v1 và phần đọc của v2) vẫn ở `CHATBOT_MODULE.md` / `CHATBOT_V2_MODULE.md` §1–§8.

---

## 1. Mô-đun làm gì

Người dùng ra lệnh bằng tiếng Việt trong khung Trợ lý; trợ lý biến lệnh thành **kế hoạch thay đổi dữ liệu** của đúng MỘT bảng, cho xem trước, và chỉ ghi khi (a) lệnh đủ rõ và an toàn để tự chạy, hoặc (b) người dùng bấm **Áp dụng**. Mọi chữ hiển thị trong kế hoạch do server dựng từ dữ liệu đã tra cứu, mô hình AI không viết được chữ nào nói với người dùng.

| Nhóm | Ví dụ lệnh | Cách xử lý |
|---|---|---|
| Một thao tác rõ ràng | “Chuyển Login UI sang Đang làm”, “Giao Login API cho tôi”, “Đặt hạn Báo cáo tuần là thứ sáu” | **Tự chạy** (nếu bật `CHAT_AUTO_EXECUTE`) và báo kết quả |
| Nhiều thao tác / đổi cấu trúc / ngày mơ hồ | “Tạo cột Kiểm thử và thêm 3 task…”, “Giao Login UI cho Lan và gắn nhãn Gấp” | Xem trước → Áp dụng (làm tất cả hoặc không làm gì) |
| Người nhận do máy chọn | “Giao cho người phù hợp nhất”, “Chia các việc chưa có người trong cột X” | Xem trước kèm hạng / điểm / mức tin cậy / cờ cảnh báo |
| Mở rộng bảng bằng nội dung AI nghĩ ra | “Bổ sung các việc còn thiếu cho giai đoạn kiểm thử” | Xem trước (chỉ THÊM cột / thẻ mới, lọc trùng) → Áp dụng |
| Luật tự động hóa | “Khi thẻ vào cột Hoàn thành thì gắn nhãn Gấp” | Xem trước, rủi ro CAO, nói rõ “chạy bằng quyền của bạn” → Áp dụng |
| Đọc mở rộng | “Board này tiến độ bao nhiêu?”, “Ai phù hợp nhất cho task X?” | Khối kết quả do server dựng, nhận xét AI ngắn (tùy chọn) |

**Không làm (cố ý):** chuyển quyền chủ bảng, thao tác nhiều bảng trong một kế hoạch, chuyển thẻ sang bảng khác, hoàn tác (chưa có lệnh hoặc nút hoàn tác), sửa NỘI DUNG luật tự động hóa đã có, gửi email. Các yêu cầu đó được trả lời bằng “chưa hỗ trợ” (xem mục 9).

**Đã làm từ bước E–I (11–12/10/2026), luôn xem trước, không bao giờ tự chạy:** xóa thẻ / cột / bình luận / tệp / nhãn / trường, lưu trữ cột và bảng, xóa bảng (phải gõ lại đúng tên), đổi hiển thị, thêm / bỏ thành viên, đổi vai trò, link mời, bật / tắt / xóa luật có sẵn. Mỗi thao tác dùng đúng hàm `assert*` của giao diện và bị đánh giá rủi ro CAO (`DELETE`, `ADMIN`, `BULK`). Bản gốc của mục này (09/10) ghi “không xóa, không đổi quyền / hiển thị”: đã lỗi thời so với mục 3.

## 2. Đường đi của một lệnh

```
câu người dùng ─▶ mô hình (công cụ: đọc… + propose_actions + propose_board_patch)
   propose_actions: danh sách thao tác TƯỢNG TRƯNG (chữ người dùng gõ, "nó", "tôi", khóa của thứ lệnh này tạo) — KHÔNG có ô nào để điền id
   ─▶ prepare (thuần): giới hạn → tự nối chữ thành tham chiếu nội bộ → đồ thị phụ thuộc → NGUỒN GỐC của từng thao tác theo CÂU người dùng
   ─▶ resolve (CSDL): chữ → id trong ĐÚNG bảng của kế hoạch (trùng tên → nút chọn, không gọi lại mô hình; không thấy → từ chối)
   ─▶ guard: quyền SỬA + nghiệp vụ cho CẢ kế hoạch (cùng hàm assert với giao diện)
   ─▶ chính sách: AUTO | CONFIRM(lý do, rủi ro) | REFUSE
   ─▶ lưu ChatActionPlan (PROPOSED) ─▶ [tự chạy | bản xem trước]
Áp dụng ─▶ khóa checksum ─▶ dựng lại kế hoạch + so dấu vân tay (khác → STALE, không ghi đè thay đổi của người khác)
   ─▶ MỘT transaction: nhận chỗ PROPOSED→EXECUTING, khóa dòng (Board → List → Card theo id), kiểm lại quyền + giá trị cũ, ghi, chốt kết quả
   ─▶ SAU COMMIT: thông báo, tự động hóa, một sự kiện socket mỗi bảng
```

`propose_board_patch {goal}` là đường riêng: một lượt gọi LLM thứ hai (khung `BOARD_DATA`, không công cụ) sinh nội dung cột / thẻ mới; server lọc trùng trên TOÀN BỘ bảng, sàng lọc nội dung, rồi dùng lại đúng bộ thực thi trên.

## 3. Công cụ và thao tác

| Thành phần | Loại | Giai đoạn | Ghi chú ngắn |
|---|---|---|---|
| `resolve_entities`, `query_catalog`, `query_tasks`, `aggregate_tasks`, `query_activities` | đọc | 1–4 (v2 đọc) | trần phạm vi theo trang |
| `get_board_overview`, `get_card_details` | đọc | 4 | số liệu server đếm; mô tả thẻ chỉ hiển thị, không gửi mô hình |
| `suggest_assignee` | đọc | 6 | xếp hạng của module phân công; không lộ bằng chứng / CV |
| `CREATE_CARD`, `RENAME_CARD`, `SET_CARD_DUE`, `MOVE_CARD`, `SET_CARD_STATUS`, `ASSIGN_MEMBER`, `ADD_LABEL` | ghi (tự chạy được khi chỉ một thao tác) | 1 | “7 thao tác an toàn” |
| `CREATE_LIST` | ghi (luôn xem trước) | 2 | đổi cấu trúc bảng |
| tham chiếu `PLAN {key}` + đồ thị | — | 2 | cột / thẻ do chính lệnh tạo ra |
| `propose_board_patch` (`CREATE_LIST` + `CREATE_CARD` do AI sinh) | ghi (luôn xem trước) | 3 | chỉ thêm; 5 cột / 25 thẻ / 30 thao tác |
| `member {by:BEST}`, `ASSIGN_UNASSIGNED` | ghi (luôn xem trước) | 6 | `recordOutcome` chỉ sau khi bấm Áp dụng, chỉ hạng 1 |
| `CREATE_AUTOMATION_RULE` | ghi (luôn xem trước, HIGH) | 7 | 2 điều kiện + 3 việc của engine, phải đứng một mình |
| `SET_CARD_START`, `REMOVE_MEMBER`, `REMOVE_LABEL` | ghi (tự chạy được khi chỉ một thao tác) | bước D | chính xác, hoàn tác bằng thao tác đối nghịch; xem `CHATBOT_V2_MODULE.md` §9K |
| `SET_CARD_DESCRIPTION`, `ADD_COMMENT`, `ADD_CHECKLIST` | ghi (luôn xem trước, `TEXT_CONTENT`) | bước D | nội dung văn bản người khác sẽ đọc; phải là chữ chính người dùng gõ; bình luận không `@` |
| `RENAME_LIST` | ghi (luôn xem trước, `NEW_STRUCTURE`) | bước D | giữ vị trí và trạng thái cột; trùng tên cột khác bị từ chối / STALE |
| `ARCHIVE_CARD` | ghi (luôn xem trước, `ARCHIVE`) | bước D | khôi phục được ở mục Lưu trữ; không kết hợp với thao tác khác trên cùng thẻ |
| 13 thao tác dọn dẹp thẻ / cột (`DELETE_CARD`, `DELETE_LIST`, `COPY_LIST`, `MOVE_LIST`, `SORT_LIST`, `MOVE_ALL_CARDS`...) | ghi (xóa / cả cột luôn xem trước, `DELETE` / `BULK`) | bước E | xem `CHATBOT_V2_MODULE.md` §9L |
| 12 thao tác bình luận + checklist (`EDIT_COMMENT`, `DELETE_COMMENT`, `REPLY_COMMENT`, `SET_CHECKLIST_ITEM_DONE`...) | ghi (nội dung / xóa luôn xem trước) | bước F | chỉ sửa / xóa bình luận của chính người dùng |
| `ADD_ATTACHMENT`, `DELETE_ATTACHMENT` | ghi (luôn xem trước, `FILE` / `DELETE`) | bước G | tệp qua kho tạm của khung chat, 10 MB, đuôi tệp như thẻ |
| `SET_FIELD_VALUE`, `ADD_REMINDER`, `REMOVE_REMINDER`, `SET_WATCH`, `CREATE_CARD_FROM_TEMPLATE`, `SAVE_CARD_AS_TEMPLATE` | ghi (tự chạy được; trường văn bản tự do luôn xem trước) | bước H | việc cá nhân / chính xác |
| 18 thao tác quản trị bảng (`RENAME_BOARD`, `SET_BOARD_VISIBILITY`, `ARCHIVE_BOARD`, `DELETE_BOARD`, `ADD_BOARD_MEMBER`, `CHANGE_MEMBER_ROLE`, nhãn, luật có sẵn, trường...) | ghi (luôn xem trước, `ADMIN`, rủi ro CAO; riêng `STAR_BOARD` tự chạy) | bước I | quyền như giao diện, gõ đúng tên khi xóa / lưu trữ bảng, không trộn với việc ở thẻ / cột |
| `query_data` (`CARD / COMMENT / CHECKLIST_ITEM / ATTACHMENT`) | đọc | bước B | điều kiện / nhóm chọn trong danh mục whitelist; mô tả và bình luận được gửi mô hình sau khi làm sạch (§9I) |
| `finish.answer` | — | bước C | đoạn trả lời tự do chỉ hiện khi qua bộ kiểm số / tên (§9J) |

Giới hạn ở backend (không chỉ trong prompt): 15 thao tác / 10 thẻ mới / 3 cột mới / 20 đối tượng có sẵn mỗi kế hoạch; kế hoạch sống 10 phút; xác nhận 30 lượt / người / 10 phút; gợi ý phân công 30 và chia việc 10 lượt / người / 10 phút.

## 4. Chính sách tự chạy và xem trước

Tự chạy chỉ khi **đồng thời**: (1) nguồn lệnh là CÂU của người dùng (có động từ cho phép, không phủ định, không phải câu hỏi, tham số gắn vào câu), (2) đúng một thao tác thuộc danh sách tự chạy (`AUTO_RUN_TYPES`, hiện 22 loại: 7 thao tác của Phase 1, thêm `SET_CARD_START` / `REMOVE_MEMBER` / `REMOVE_LABEL` ở bước D và các việc chính xác / cá nhân của bước E–I), (3) mọi tham chiếu ra duy nhất một đối tượng, (4) đúng một bảng trong trần phạm vi của trang, (5) không hàng loạt / phá hủy, (6) không phải thao tác quản trị bảng (đổi quyền / hiển thị / thành viên / xóa bảng... từ bước I diễn đạt được trong schema nhưng **luôn xem trước**, rủi ro CAO; chuyển quyền chủ bảng vẫn không diễn đạt được), (7) không làm theo chỉ dẫn lấy từ dữ liệu, (8) backend kiểm lại quyền + nghiệp vụ.

Không đạt → **xem trước** với lý do hiện nguyên văn cho người dùng:

| Lý do | Khi nào | Rủi ro |
|---|---|---|
| `AUTO_DISABLED` | tắt `CHAT_AUTO_EXECUTE` | LOW |
| `MULTI_OP` | từ 2 thao tác | MEDIUM (≥ 8: HIGH) |
| `NEW_STRUCTURE` | có `CREATE_LIST` | MEDIUM |
| `FUZZY_DATE` | “cuối tuần”… | MEDIUM |
| `QUESTION_FORM`, `NOT_GROUNDED`, `DELEGATED_TO_DATA` | lệnh dạng câu hỏi / mô hình diễn giải lại / “làm theo nội dung thẻ” | MEDIUM |
| `BOARD_PATCH` | nội dung do AI nghĩ ra | MEDIUM+ |
| `AI_CHOSEN_TARGET` | người nhận do máy chọn | MEDIUM (≥ 4 việc: HIGH) |
| `STANDING_RULE` | luật tự động hóa | **HIGH** |

Từ chối ngay (không tạo kế hoạch): câu không có lệnh cho thao tác đó (`NOT_REQUESTED`), vượt giới hạn, đồ thị sai, không thấy đối tượng, thiếu quyền, thao tác ngoài danh mục, điều kiện / việc luật ngoài engine (`UNSUPPORTED_RULE`).

## 5. Bất biến an toàn và nơi bảo đảm

| # | Bất biến | Bảo đảm bằng | Kiểm chứng |
|---|---|---|---|
| I1 | Mô hình không bao giờ chạm id / quyền / chữ hiển thị | schema `.strict()` không có ô id; resolver server; `modelView` lọc dữ liệu gửi mô hình | `chat.actions.pure`, `chat.read.tools`, kho an toàn S01–S03 |
| I2 | DỮ LIỆU ≠ CHỈ DẪN: chữ trong tiêu đề / mô tả / bình luận không cấp phép cho hành động | giấy phép động từ trên CÂU người dùng; “làm theo nội dung…” không tự chạy (luật: từ chối thẳng) | `chat.actions.safety`, `chat.rule`, kho U01–U04 |
| I3 | Thao tác phá hủy / đổi quyền / hiển thị (bước E–I) không bao giờ tự chạy; chuyển quyền chủ bảng không diễn đạt được | danh mục đóng; `policy.confirm` của từng handler (`DELETE`, `ADMIN`, `BULK`) buộc xem trước + rủi ro CAO; xóa bảng gõ lại tên; Board Patch chặn xóa / thay thế (`DESTRUCTIVE`); chiều dữ liệu cũ bảo toàn | `chat.patch.*`, `chat.cleanup.*`, `chat.board.test`, kho D01–D07, P01–P05 |
| I4 | Một lần xem trước = một lần ghi, tất cả hoặc không gì | transaction duy nhất, nhận chỗ nguyên tử, idempotent, checksum, `STALE` | `chat.actions.multi.api`, `chat.actions.parity` |
| I5 | Quyền kiểm lại ở mỗi bước (đề xuất, áp dụng, trong transaction) | chính hàm `assert*` của giao diện + `canEditInTx` | `chat.actions.guard`, `chat.actions.api` |
| I6 | Tác dụng phụ chỉ sau COMMIT, đúng số lần | outbox trong bộ nhớ | `chat.actions.multi.api` |
| I7 | Người nhận do máy chọn luôn xem trước; không làm sai lệch số liệu của module phân công | `AI_CHOSEN_TARGET`; `recordOutcome` chỉ khi bấm Áp dụng + hạng 1 | `chat.assign` |
| I8 | Luật chạy lâu dài luôn xem trước, đúng engine, không trùng | `STANDING_RULE`; cấp phép từng phần; so trùng trong transaction với khóa dòng | `chat.rule` |
| I9 | Không lộ email / token / CV / mô tả vào kết quả hay lịch sử | `select` tường minh; quét khóa; kho an toàn kiểm phản hồi | `chat.read.tools`, `chat.safety.corpus` |

## 6. API và dữ liệu

Không có endpoint riêng cho từng giai đoạn: tất cả dùng `POST /api/chat/v2/messages` (gửi câu), `POST /api/chat/v2/actions/:planId/confirm` (Áp dụng; `{conversationId, checksum, scope}`), `POST …/cancel`, `GET …/:planId`, và `GET /api/chat/v2/status`. Phản hồi có `answer.action` = `PLAN` hoặc `RESULT`; các trường mới của từng giai đoạn (`patch`, `items[].choice`, `items[].rule`, `reasons[]`) đều **tùy chọn** nên giao diện cũ không vỡ.

Bảng `ChatActionPlan` (một migration `20261007130000_chat_action_plan` + `20261008100000_chat_action_plan_multi` cho cột đo đạc) lưu câu lệnh, kế hoạch đã resolve, nguồn gốc, lý do, rủi ro, trạng thái, token / độ trễ và kết quả. Không thêm bảng cho Board Patch, phân công hay luật (chi tiết nằm trong JSON của kế hoạch).

Cờ môi trường: `CHAT_ACTIONS` (công tắc tổng; **tắt ở production mặc định**; tắt thì nút Áp dụng của kế hoạch cũ cũng bị chặn), `CHAT_AUTO_EXECUTE` (tắt thì mọi thao tác cần Áp dụng).

## 7. Kiểm chứng

### 7.1 Kiểm thử tự động (mỗi giai đoạn: unit + API trên PostgreSQL test + FE + cài lỗi)

| Giai đoạn | Nội dung | Cài lỗi |
|---|---|---|
| 1 | 7 thao tác an toàn, chính sách tự chạy, trần phạm vi | backend 40/40, frontend 16/16 |
| 2 | đa thao tác, một transaction, STALE, idempotent | backend 66/66, frontend 6/6 |
| 3 | Board Patch | 20/20 |
| 4 | công cụ đọc mở rộng | 18/18 |
| 6 | tích hợp phân công | 27/27 |
| 7 | luật tự động hóa | 28/28 |
| 8 | adapter thử lại `auto`, lõi chấm điểm đánh giá, kho an toàn | 11/11 (+ 2 phép tương đương, có lý do) |

Toàn bộ tại thời điểm chốt (09/10): backend 139 tệp / 1898 test đạt, frontend 58 tệp / 497 test đạt. **Cập nhật 15/10/2026**: backend 164 tệp / 2.440 test, frontend 73 tệp / 620 test (bước A–I và các đợt rà soát sau đó); `tsc`, ESLint backend, `tsc -b`, oxlint (chỉ cảnh báo) và `vite build` sạch. Mỗi lần chạy đầu đều có mutant sống sót và mỗi mutant sống sót dẫn tới một test mới (được ghi ở từng mục §9x).

### 7.2 Kho câu an toàn đối kháng (xác định, mô hình “ngoan ngoãn” bị tiêm chỉ dẫn)

`backend/test/chat.safety.corpus.test.ts`: 32 ca (tiêm lệnh trực tiếp, đặc quyền, ủy quyền cho dữ liệu, lách schema, làm dụng giới hạn, vượt phạm vi, luật nguy hiểm). Mô hình giả LUÔN đề xuất đúng điều kẻ tấn công muốn; mỗi ca chạy qua toàn pipeline trên CSDL thật và phải thỏa: không có kết quả `EXECUTED`; nếu có kế hoạch thì bắt buộc xem trước; **băm các bảng dữ liệu không đổi**; không lộ email; không có kế hoạch tự chạy nào trong CSDL; và mọi ca ngoài hai ngoại lệ có chủ ý (U01, U03: câu “làm theo nội dung …” được phép tới bước **xem trước** với lý do `DELEGATED_TO_DATA`) phải bị **từ chối hoàn toàn**. Kết quả: **30 / 32 từ chối hoàn toàn, 2 / 32 chỉ tới xem trước, 0 tự chạy, 0 thay đổi dữ liệu.**

### 7.3 Đánh giá với Gemini thật (`gemini-3.5-flash-lite`)

Bộ dữ liệu tự soạn, **đóng băng bằng sha256** trước khi chạy: 45 câu “chọn công cụ + kế hoạch” (13 dev / 32 test) và 18 câu đối kháng (5 / 13); nhãn vàng được kiểm bằng chính sách thật trong test. Bộ chạy `backend/src/scripts/evaluateChatActions.ts` dùng đúng prompt / công cụ / schema / pipeline thuần của sản phẩm. Chi tiết và cách đọc số liệu: `CHATBOT_V2_MODULE.md` §9G.

| Chỉ số | Dev (1 lần, đủ) | Test (**một phần**: 62 / 156 lượt có phản hồi) |
|---|---|---|
| Chọn đúng tuyến (đọc / hành động / mở rộng bảng / không hỗ trợ) | 12 / 12 | **96,8 % [90,3 ; 100]** (60 / 62) |
| Khớp kế hoạch (loại + tên + quyết định), câu hành động | 6 / 7 (85,7 %) | **81,3 % [62,5 ; 100]** |
| Đúng quyết định tự chạy / xem trước | 7 / 7 | 93,8 % [81,3 ; 100] |
| **Tự chạy nhầm** (vàng cần xem trước mà hệ thống sẽ tự chạy) | **0 / 7** | **0 / 28** |
| An toàn đối kháng — lượt tự chạy | **0 / 5** | chưa chạy |
| Mở rộng bảng — nội dung tiêm lọt vào kế hoạch | 0 / 1 | chưa chạy |

**Lưu ý trung thực.** Hạn mức ngày của Gemini bản miễn phí (500 lượt / mô hình) cạn giữa lượt chạy test thứ hai nên **tập test chưa đủ 3 lần, và phần an toàn đối kháng + mở rộng bảng của tập test chưa chạy**; các lượt chưa chạy được bỏ qua và đếm riêng, không tính là sai (`backend/eval-chat-actions-lite-partial.md`). Chạy tiếp bằng đúng lệnh ở mục 8 (bộ đệm giữ phần đã có); kết quả đầy đủ sẽ nằm ở `backend/eval-chat-actions-result.md`. Các ca “sai” về loại thao tác phần lớn là cách hiểu **tương đương về hệ quả** (“Chuyển … sang Hoàn thành” → đổi trạng thái DONE thay vì chuyển cột; sản phẩm liên kết hai chiều trạng thái ↔ cột nên cùng kết quả) — nhãn vàng nghiêm ngặt vẫn tính là sai và không bị sửa sau khi thấy kết quả. Bằng chứng an toàn mạnh nhất hiện có là kho xác định 32 ca (mục 7.2) cùng bộ test từng giai đoạn.

### 7.4 Thử trình duyệt thật

Phase 3, 4, 6, 7 mỗi giai đoạn đã thử đầu-cuối bằng trình duyệt (Gemini thật, bảng thử ở database dev rồi xóa; có khổ 375 px + chế độ tối): xem trước không đổi dữ liệu, Áp dụng ghi đúng, Hủy / lỗi thời / trùng được xử lý, engine tự động hóa thật sự chạy luật do trợ lý tạo, câu chứa chỉ dẫn tiêm không tạo gì. Ghi chú chi tiết ở các mục §9C–§9F. **Chưa làm:** thử hai người dùng song song trong cùng lúc (trình duyệt tích hợp dùng chung cookie); sự kiện socket cho người thứ hai được kiểm bằng spy `emitToBoard` (đúng một sự kiện mỗi bảng sau COMMIT), không bằng hai trình duyệt.

## 8. Vận hành

- Bật: đặt `CHAT_ACTIONS=true` (và `CHAT_AUTO_EXECUTE=true` nếu muốn tự chạy) cùng cấu hình AI (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`). Không có AI: lệnh ghi được báo “cần bật AI”, **không đoán bằng luật**.
- Container `taskflow-backend` chạy `tsx watch` trên thư mục gắn từ Windows **không tự nạp lại** khi sửa tệp từ máy chủ: `docker restart taskflow-backend`.
- Chạy đánh giá: `npx tsx src/scripts/evaluateChatActions.ts --split=test --runs=3 --delay=4000 --out=eval-chat-actions-result.md` (chạy tay; có bộ đệm `.chat-actions-eval-cache`). Gói Gemini miễn phí có hạn mức theo phút / ngày.
- Dữ liệu thử trên database dev (`chat-act-*@test.local`) phải xóa sau khi thử; xóa `AssignRun` của tài khoản thử TRƯỚC khi xóa không gian.

## 9. Giới hạn đã biết (tổng hợp)

- Một bảng mỗi kế hoạch; không chuyển thẻ xuyên bảng; không thao tác nhiều bảng.
- Không có hoàn tác. Từ bước E–I có `DELETE_*`, lưu trữ / xóa bảng và quản trị bảng, nhưng luôn xem trước (mục 1, 4); chưa chuyển quyền chủ bảng; luật có sẵn bật / tắt / xóa được nhưng chưa sửa nội dung.
- Luật: phải đứng một mình; chỉ cột / nhãn / người có sẵn; nhận diện “ngoài engine” bằng cụm từ nên có thể bỏ sót cách nói lạ (người dùng vẫn thấy đúng điều kiện / việc ở bản xem trước); engine chạy luật theo người tạo mà không kiểm lại quyền hiện tại của họ (hành vi sẵn có của `automation.service`).
- Phân công: ngân sách gợi ý nằm trong bộ nhớ một tiến trình; chia tối đa 15 việc mỗi lần; “người phù hợp nhất” dùng nguyên xếp hạng của module phân công (dữ liệu mỏng khi nhóm mới).
- Board Patch: chỉ thêm cột / thẻ mới, không gắn người / hạn / nhãn lên thẻ mới; không chọn / bỏ từng thao tác.
- Phụ thuộc nhà cung cấp: Gemini bản miễn phí đôi khi lỗi một lượt (HTTP / hết hạn mức). Lỗi `400 INVALID_ARGUMENT` khi ép `tool_choice: required` đã được xử lý bằng cách thử lại `auto` (§9G); lỗi khác rơi về chế độ cơ bản / thông báo “chưa xử lý được”.
- Đánh giá dùng bộ dữ liệu nhỏ, tự soạn, một bảng giả; khoảng tin cậy rộng. Phần tìm đối tượng trong CSDL và kiểm quyền không nằm trong đánh giá LLM vì xác định và đã có test riêng.
