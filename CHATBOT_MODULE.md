# Module Chatbot — Trợ lý công việc TaskFlow (bản đầu)

> Module AI thứ ba của khoá luận, sau module sinh bảng (`AI_MODULE.md`) và
> module gợi ý phân công (`ASSIGN_MODULE.md`). Ý tưởng gốc ở `CHATBOT_PLAN.md`
> (giữ nguyên, không sửa); tài liệu này là **hợp đồng** để hiện thực: mọi định
> nghĩa, con số và quy tắc ở đây là chuẩn mà code và test phải khớp. Đổi hợp
> đồng thì sửa tài liệu này trước, ghi lý do vào nhật ký cuối file.
>
> Trạng thái: **xong bước 0–6** — chatbot chạy trọn vẹn qua API `/api/chat` và **giao diện** (nút
> Trợ lý trên Header, panel bên phải): hiểu câu bằng **bộ luật + LLM** (gộp B2; thiếu khoá / LLM lỗi /
> hết ngân sách → bộ luật), câu nối tiếp, phạm vi + quyền đọc lại mỗi lượt, nhận diện người + hỏi lại,
> truy vấn số liệu, câu trả lời theo mẫu, nhận xét AI cho tổng kết nhóm (có kiểm tra), phiên hội thoại
> tạm, "Xem thêm". Còn: bộ đánh giá (bước 7–8), nghiệm thu (bước 9). Lộ trình ở §17, nhật ký cuối file.

---

## 1. Bài toán

**Đầu vào**: một câu hỏi tiếng Việt tự do (có dấu hoặc không dấu) + phạm vi
đang chọn trên giao diện (Việc của tôi / Workspace / Bảng).

**Đầu ra**: câu trả lời tiếng Việt gồm các con số đã tính ở backend, danh sách
thẻ có liên kết mở thẻ, phạm vi dữ liệu đã dùng, thời điểm truy vấn; hoặc một
câu hỏi lại khi chưa đủ thông tin.

**Không phải là**: một chatbot trò chuyện tự do, và **không thao tác dữ liệu**
— bản đầu không tạo, sửa, xoá hay phân công việc qua chat.

## 2. Quyết định đã chốt

| Vấn đề | Chốt |
|---|---|
| Lý do giới hạn dữ liệu | **Tối thiểu hoá dữ liệu gửi cho LLM bên thứ ba** (Gemini gói free). Không phải "phân quyền mới": API và giao diện hiện có giữ nguyên chính sách cũ |
| Vai trò của LLM | **Chỉ hiểu câu hỏi** → ý định + tham số (1 lượt gọi/câu). Số liệu và danh sách do backend tính và dựng bằng mẫu. Riêng tổng kết nhóm có thêm 1 lượt gọi viết **nhận xét ngắn** từ số đếm tổng hợp |
| Khi không có LLM | Chạy bằng **bộ luật** (B0) — chatbot vẫn trả lời được, không bao giờ trả 503 vì thiếu khoá |
| Đánh giá | **Ba nhánh B0 luật / B1 chỉ LLM / B2 lai**, bộ câu hỏi tự soạn có nhãn, 3 lần chạy (§12) |
| Phạm vi bản đầu | **4 nhóm câu hỏi** (5 ý định, §4); **không** có câu hỏi email |
| Lưu trữ | **Không thêm bảng CSDL.** Hội thoại giữ tạm trong bộ nhớ tiến trình (§9) |
| Nhật ký | **Không ghi** nội dung câu hỏi hay câu trả lời vào log/CSDL |
| Cờ bật/tắt | Không có — bộ luật luôn chạy được, `GET /api/chat/status` báo có LLM hay không |
| Chọn người bằng `@` | **Hoãn.** Trùng tên được giải bằng nút "Ý bạn là ai?" (§8) |

### Ngoài phạm vi bản đầu (cố ý)

- Ngày cụ thể trong câu hỏi ("ngày 20/10", "từ 1/10 đến 5/10") — chỉ hỗ trợ các khoảng ở §5.
- Mục checklist được giao riêng cho một người (`ChecklistItem.assigneeId`) — câu trả lời ghi rõ là chưa tính.
- Hồ sơ tự khai / CV của module phân công, email, vai trò workspace của người khác.
- Liên kết "Mở trong Tìm kiếm nâng cao" (trang tìm kiếm chỉ đọc `?q=` và có tính bảng PUBLIC nên số liệu sẽ khác).
- Các hướng mở rộng ở §5 của `CHATBOT_PLAN.md`.

## 3. Luồng xử lý và dữ liệu đi ra ngoài

```
câu hỏi + phạm vi
  → bộ luật (B0)  ─┐
  → LLM hiểu câu ─┴→ gộp (B2, §10) → áp ngữ cảnh lượt trước (§9)
  → kiểm phạm vi & quyền (§7) → nhận diện người (§8)
  → truy vấn Prisma, đếm trên toàn bộ tập hợp lệ (§6)
  → dựng câu trả lời theo mẫu
  → (chỉ TEAM_SUMMARY, focus NONE) nhận xét LLM từ số đếm (§11)
```

Quyền được kiểm **ở mỗi lượt** từ phiên đăng nhập; client không bao giờ gửi vai
trò hay danh tính. Kết quả cũ không được dùng làm nguồn cho lượt sau.

### Dữ liệu gửi cho LLM — bảng đầy đủ

| Dữ liệu | Gửi LLM? | Ghi chú |
|---|---|---|
| Câu hỏi của người dùng (≤ 500 ký tự) | **Có** | Giao diện ghi rõ điều này |
| Ý định + tham số của lượt trước (mã enum) | **Có** | Không kèm tên người |
| Số đếm tổng hợp của TEAM_SUMMARY | **Có** (chỉ lượt nhận xét) | Chỉ con số + nhãn kỳ, xem §11 |
| Danh sách thành viên, tên người | **Không** | Nhận diện tên làm ở backend |
| Tiêu đề, mô tả thẻ, tên bảng/danh sách | **Không** | → chèn lệnh qua nội dung thẻ không thể lái LLM (test chứng minh) |
| Email, hồ sơ làm việc, token | **Không** | |

## 4. Ý định và tham số

### 4.1 Năm ý định (+ hai giá trị đặc biệt)

| intent | Nhóm câu hỏi | Ví dụ |
|---|---|---|
| `MY_TASKS` | Việc cá nhân | "Việc nào của tôi sắp đến hạn?", "Tôi còn việc gì quá hạn?", "Tuần này tôi xong những gì?" |
| `MY_PRIORITIES` | Ưu tiên công việc | "Hôm nay tôi nên xử lý gì trước?", "Nên ưu tiên việc nào?" |
| `MEMBER_TASKS` | Phối hợp trong nhóm | "Lan đang làm gì?", "Tuần này anh Minh đã xong những việc nào?" |
| `TEAM_SUMMARY` | Tiến độ nhóm | "Tuần này nhóm hoàn thành gì, còn vướng gì?", "Nhóm có việc nào quá hạn?" |
| `TEAM_WORKLOAD` | Tiến độ nhóm / trưởng nhóm | "Ai đang có nhiều việc?", "Mỗi người đang giữ bao nhiêu việc?" |
| `UNSUPPORTED` | — | Ngoài phạm vi, hoặc yêu cầu **thao tác** ("tạo thẻ", "xoá", "giao việc cho Lan") |
| `NONE` | — | Câu chỉ bổ sung tham số cho câu trước ("còn tuần sau thì sao?", "còn Minh?") — xem §9.2 |

Quy tắc gán nhãn (dùng cho cả bộ luật, prompt và bộ đánh giá):

- "nên làm gì trước / ưu tiên / bắt đầu từ việc nào" → `MY_PRIORITIES`; "có việc gì / sắp hạn / quá hạn / đã xong" của tôi → `MY_TASKS`.
- Câu hỏi về **một người cụ thể** (khác người hỏi) → `MEMBER_TASKS`; người hỏi tự nhắc mình ("tôi", "mình", "em") → `MY_*`.
- Câu hỏi về **cả nhóm** theo trạng thái/tiến độ → `TEAM_SUMMARY`; so sánh **số việc giữa các người** → `TEAM_WORKLOAD`.
- Có động từ thao tác (tạo, thêm, xoá, sửa, đổi, giao, chuyển, đánh dấu…) → `UNSUPPORTED` dù có nhắc tới việc.

### 4.2 Tham số

| Tham số | Giá trị | Ý nghĩa |
|---|---|---|
| `period` | `TODAY` `TOMORROW` `THIS_WEEK` `NEXT_WEEK` `LAST_WEEK` `NEXT_7_DAYS` `NONE` | Khoảng thời gian, định nghĩa chính xác ở §5 |
| `focus` | `OPEN` `OVERDUE` `DONE` `BLOCKED` `NONE` | Lọc theo tình trạng. "Sắp đến hạn" = `OPEN` + `NEXT_7_DAYS` |
| `member` | chuỗi (`""` = không nhắc ai) | Tên **như người dùng gõ**; backend nhận diện ở §8 |

Trong code, `NONE` và `""` được Zod đổi thành `null`.

### 4.3 Lược đồ JSON gửi LLM (chế độ `json_schema`, strict)

Phẳng, **không dùng `null` trong enum** (dùng `"NONE"`/`""`) — cùng kiểu với
`LLM_DRAFT_JSON_SCHEMA` mà Gemini đã chấp nhận 75/75 lần ở chương 5.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["intent", "period", "focus", "member"],
  "properties": {
    "intent": { "type": "string", "enum": ["MY_TASKS", "MY_PRIORITIES", "MEMBER_TASKS", "TEAM_SUMMARY", "TEAM_WORKLOAD", "UNSUPPORTED", "NONE"] },
    "period": { "type": "string", "enum": ["TODAY", "TOMORROW", "THIS_WEEK", "NEXT_WEEK", "LAST_WEEK", "NEXT_7_DAYS", "NONE"] },
    "focus":  { "type": "string", "enum": ["OPEN", "OVERDUE", "DONE", "BLOCKED", "NONE"] },
    "member": { "type": "string" }
  }
}
```

(Mỗi trường còn có `description` ngắn; xem `INTENT_JSON_SCHEMA` trong `chat.intent.ts`.)
Không dùng `maxLength` vì không chắc nhà cung cấp nào cũng nhận — **Zod** mới là cửa kiểm
soát thật: `.strict()`, `member` tối đa 80 ký tự; có test đối chiếu hai bên.
Phản hồi không khớp lược đồ (sau Zod) → lỗi `INVALID_SHAPE`, xử lý như LLM thất bại (§10).

### 4.4 Tham số nào áp dụng cho ý định nào

| intent | `period` | `focus` | `member` | Mặc định khi thiếu |
|---|---|---|---|---|
| `MY_TASKS` | dùng (xem §5.2) | dùng | bỏ qua | focus → `OPEN`; `DONE` không kèm kỳ → `THIS_WEEK` |
| `MY_PRIORITIES` | **bỏ qua** | **bỏ qua** | bỏ qua | luôn xét mọi việc đang mở của tôi |
| `MEMBER_TASKS` | dùng | dùng | **bắt buộc** | focus `NONE` → tổng quan người đó (§6.4) |
| `TEAM_SUMMARY` | dùng | dùng | bỏ qua | period → `THIS_WEEK`; focus `NONE` → bản tóm tắt (§6.5) |
| `TEAM_WORKLOAD` | **bỏ qua** | **bỏ qua** | bỏ qua | — |

Tham số người dùng có nói mà bị bỏ qua → đưa vào `ignoredSlots` và câu trả lời
ghi một dòng "Trợ lý chưa lọc theo … cho loại câu hỏi này."

## 5. Thời gian

Mọi mốc tính theo **giờ Việt Nam** (`Asia/Ho_Chi_Minh`, +07:00, không có giờ mùa
hè). "Hôm nay" = `todayInVietnam(now)`; mốc 00:00 của một ngày = `startInstant(ngày)`
(`ai.apply.ts`). Kết quả **không phụ thuộc** biến `TZ` của máy chủ (có test).

### 5.1 Khoảng `[từ, đến)` của từng `period`

Ví dụ lấy `now` = **Thứ Tư 30/09/2026 10:00 giờ VN** (= `2026-09-30T03:00:00Z`).

| period | Định nghĩa | Ví dụ |
|---|---|---|
| `TODAY` | 00:00 hôm nay → 00:00 ngày mai | 30/09 00:00 → 01/10 00:00 |
| `TOMORROW` | 00:00 ngày mai → 00:00 ngày kia | 01/10 → 02/10 |
| `THIS_WEEK` | 00:00 Thứ Hai tuần này → 00:00 Thứ Hai tuần sau | 28/09 → 05/10 |
| `NEXT_WEEK` | Thứ Hai tuần sau → Thứ Hai tuần sau nữa | 05/10 → 12/10 |
| `LAST_WEEK` | Thứ Hai tuần trước → Thứ Hai tuần này | 21/09 → 28/09 |
| `NEXT_7_DAYS` | **thời điểm hỏi** → 00:00 của (hôm nay + 8 ngày), tức hết 7 ngày tới | 30/09 10:00 → 08/10 00:00 |

Tuần bắt đầu **Thứ Hai**. Hỏi vào Chủ nhật thì "tuần này" là tuần đang kết
thúc hôm đó (test biên Chủ nhật 23:59:59 / Thứ Hai 00:00, tức `16:59:59Z` / `17:00:00Z`).

### 5.2 `period` lọc cột nào

| focus | Lọc theo | Ghi chú |
|---|---|---|
| `OPEN` | `dueDate ∈ [từ, đến)` | `NONE` → không lọc ngày (mọi việc đang mở) |
| `DONE` | `completedAt ∈ [từ, đến)` | `NONE` → `THIS_WEEK`. Kỳ **ở tương lai** (`TOMORROW`, `NEXT_WEEK`, `NEXT_7_DAYS`) → bỏ qua, dùng `THIS_WEEK`, ghi `ignoredSlots` |
| `OVERDUE` | không lọc kỳ | Luôn "tính tới thời điểm hỏi"; kỳ người dùng nói → `ignoredSlots` |
| `BLOCKED` | không lọc kỳ | như trên |

`OPEN` + `TODAY`/`THIS_WEEK` gồm cả thẻ hạn đã qua trong kỳ (chúng mang cờ
"quá hạn" trong danh sách); `NEXT_7_DAYS` bắt đầu từ thời điểm hỏi nên **không**
gồm thẻ đã quá hạn.

## 6. Dữ liệu và cách đếm

### 6.1 Thẻ "còn sống" trong phạm vi

Một thẻ được tính khi **cả ba** điều kiện đúng:

1. Thẻ: `deletedAt = null` và `archivedAt = null`.
2. Danh sách chứa thẻ: `deletedAt = null` và `archivedAt = null`.
3. Bảng chứa danh sách: `deletedAt = null`, `archivedAt = null`, **đọc được** (§7.1) và thuộc phạm vi đang chọn.

Điều kiện bảng ghép bằng `AND: [đọc được, phạm vi]` — **không** trải hai object
vào nhau vì cả hai có thể mang `OR` và cái sau sẽ đè cái trước.

### 6.2 Định nghĩa các con số

"Mở" = `isDone = false` (tương đương `status ≠ DONE` theo bất biến ở `cardStatus.ts`).

| Con số | Điều kiện (trên tập thẻ §6.1) |
|---|---|
| Đang mở | `isDone = false` |
| Quá hạn | `isDone = false` và `dueDate < now` |
| Bị chặn | `status = BLOCKED` |
| Hoàn thành trong kỳ | `completedAt ∈ [từ, đến)` (thẻ mở lại rồi chưa xong lại **không** tính — `completedAt` đã về `null`) |
| Đến hạn trong kỳ | `isDone = false` và `dueDate ∈ [từ, đến)` |
| **Chưa giao, chưa xong** | `isDone = false` và không có `CardMember` nào. **Khác** ô "Chưa giao" ở trang Tổng quan workspace (`workspaceOverview.service.ts:70`) vốn tính cả thẻ đã xong — nên dùng nhãn khác |
| Số thẻ đang mở của một người | thẻ `isDone = false` mà người đó là `CardMember`. Thẻ nhiều người nhận → tính cho **từng** người |

Mọi con số đếm bằng `count`/`groupBy` trên **toàn bộ** tập hợp lệ, không đếm từ
danh sách đã phân trang. Thẻ không có hạn không bao giờ "quá hạn".

**Cố ý không gọi là "tải công việc"**: module phân công đo tải bằng số thẻ **chồng
lấn khoảng ngày** so với `maxParallelCards`; chatbot chỉ đếm thẻ đang mở. Hai
cách khác nhau thì phải khác tên để không có hai con số "tải" mâu thuẫn trên
giao diện.

### 6.3 Trường của một thẻ trong câu trả lời (danh sách cho phép)

Lấy bằng `select` tường minh, không bao giờ `include` cả bản ghi:

`id`, `title`, `boardId`, tên bảng, tên danh sách, `status`, `dueDate`,
`completedAt`, cờ quá hạn (tính ở backend), số mục checklist đã xong / tổng,
**tên** người nhận (không email, không avatar của người ngoài phạm vi).

**Không bao giờ** trả: `description`, email, token mời, trường bảo mật tài khoản,
khoá API. Liên kết nguồn: `/boards/:boardId?card=:cardId` (đã có sẵn ở `BoardPage`).

Danh sách chính phân trang **10 thẻ/trang**, sắp `dueDate` tăng dần (không có hạn
xếp cuối), rồi `id` — thứ tự ổn định để trang không trùng nhau. Mỗi trang tính
lại `total` và `generatedAt`; nếu dữ liệu đổi giữa hai trang thì con số mới là
con số đúng (giao diện hiện thời điểm truy vấn của từng trang).

Danh sách phụ (trong tổng quan) tối đa **5 thẻ**, không phân trang, kèm tổng số
và nút câu hỏi gợi ý để xem đầy đủ.

### 6.4 Nội dung câu trả lời theo ý định

| intent + focus | Con số (facts) | Danh sách chính (phân trang) | Danh sách phụ (≤ 5) |
|---|---|---|---|
| `MY_TASKS` + focus bất kỳ | tổng khớp; trong đó quá hạn | thẻ khớp | — |
| `MY_PRIORITIES` | tổng việc mở không bị chặn; trong đó quá hạn / hạn hôm nay / hạn trong 3 ngày; số việc bị chặn | việc đang mở **không** bị chặn, kèm nhãn lý do (§6.6) | "Cần gỡ chặn" (thẻ `BLOCKED`) |
| `MEMBER_TASKS` + `NONE` | đang mở; quá hạn; hoàn thành trong kỳ | thẻ đang mở của người đó (không lọc ngày) | đã xong trong kỳ (mặc định tuần này; kỳ tương lai → tuần này) |
| `MEMBER_TASKS` + focus X | tổng khớp | thẻ của người đó khớp X | — |
| `TEAM_SUMMARY` + `NONE` | hoàn thành trong kỳ (không có khi kỳ ở tương lai); đến hạn trong kỳ; đang mở; quá hạn; bị chặn; chưa giao chưa xong | — | đã hoàn thành (không có khi kỳ ở tương lai); quá hạn; bị chặn |
| `TEAM_SUMMARY` + focus X | tổng khớp | thẻ của nhóm khớp X | — |
| `TEAM_WORKLOAD` | chưa giao chưa xong; số lượt giao cho người ngoài danh sách | bảng theo người (§6.7) | — |

Mọi câu trả lời có dòng **phạm vi**: "Tính trên N bảng bạn xem được trong
‹workspace/bảng›" và, khi nói về người khác, "Có thể còn việc ở bảng bạn không
xem được — đây không phải toàn bộ việc của ‹tên›."

### 6.5 Tiến độ

Tiến độ thể hiện bằng **trạng thái** + **checklist x/y**. Không quy đổi thành phần
trăm chất lượng. `ChecklistItem` không có thời điểm hoàn thành → không bao giờ
nói "mục này xong lúc…".

### 6.6 Thứ tự ưu tiên (`MY_PRIORITIES`)

Không có trường "độ ưu tiên" trên thẻ → chỉ dựa vào hạn và trạng thái; câu trả
lời ghi rõ giới hạn này. Thứ tự = thứ tự danh sách chính (§6.3). Nhãn lý do:

| Nhãn | Điều kiện |
|---|---|
| Quá hạn | `dueDate < now` |
| Hạn hôm nay | `now ≤ dueDate <` 00:00 ngày mai |
| Hạn trong 3 ngày | 00:00 ngày mai `≤ dueDate <` 00:00 (hôm nay + 4) |
| Còn lại | hạn muộn hơn, hoặc không có hạn |

Thẻ `BLOCKED` tách khỏi danh sách chính vào "Cần gỡ chặn" — không khuyên "làm
trước" một việc đang bị chặn.

### 6.7 Bảng theo người (`TEAM_WORKLOAD`)

- Mỗi dòng là một người trong **danh sách người** của phạm vi (§8.1): tên, số thẻ
  đang mở, trong đó quá hạn. Sắp theo số thẻ đang mở giảm dần, rồi tên.
- Lượt giao cho người **không** nằm trong danh sách (khách của bảng, người đã rời
  workspace — việc xoá thành viên workspace không xoá `CardMember`) gộp thành
  **một dòng** "N lượt giao cho người ngoài danh sách thành viên".
- Chỉ **trưởng nhóm** (§7.3) thấy thêm hai cột: `maxParallelCards` và "tạm nghỉ đến"
  (`pausedUntil`, chỉ hiện khi còn trong tương lai), lấy từ `MemberWorkProfile` của
  đúng workspace đó; người chưa có hồ sơ → "mặc định" (`capacity = null`). Với người không phải
  trưởng nhóm, hai trường này **không có mặt** trong kết quả (không chỉ để trống).
- Danh sách phụ "Đã hoàn thành" sắp **mới xong trước** (`completedAt` giảm dần); các danh sách
  khác sắp theo hạn như danh sách chính.

## 7. Phạm vi và quyền

### 7.1 Bảng "đọc được"

Người dùng đọc được bảng khi là **chủ bảng**, **BoardMember** (kể cả `VIEWER`),
hoặc bảng có `visibility = WORKSPACE` thuộc workspace mình đang là thành viên.
**Bảng PUBLIC không được tính** chỉ vì nó công khai. Điều kiện này sao y phép
`OR` của `listMyCards` (`card.service.ts:172-176`).

- **Không** dùng `assertBoardView` (có nhánh PUBLIC) hay `isBoardParticipant`
  (loại VIEWER) cho việc này.
- OWNER/ADMIN workspace **không** mặc nhiên đọc được bảng PRIVATE mình không tham
  gia (dù họ có quyền quản lý bảng đó qua `canManageBoard` — chatbot chỉ xét quyền đọc).

### 7.2 Ba phạm vi

| Phạm vi | Điều kiện hợp lệ | Bảng được xét |
|---|---|---|
| `MY` | luôn hợp lệ | mọi bảng đọc được, ở mọi workspace |
| `WORKSPACE(id)` | `assertWorkspaceAccess` (là thành viên) | bảng đọc được **thuộc** workspace đó |
| `BOARD(id)` | bảng đọc được theo §7.1; chỉ xem được vì PUBLIC → **403** "Trợ lý chỉ hỗ trợ bảng bạn tham gia" | đúng bảng đó |

Phạm vi `MY` mà hỏi `MEMBER_TASKS`, `TEAM_SUMMARY`, `TEAM_WORKLOAD` → **hỏi lại**:
"Bạn muốn xem trong workspace nào?" (nút chọn các workspace người dùng đang là
thành viên; chỉ có **một** workspace thì dùng luôn, không hỏi). Quyền của workspace A không
bao giờ dùng để xem workspace B.

Ở phạm vi `MY`, bộ luật nhận diện tên bằng danh sách người của **mọi** workspace người hỏi đang
tham gia (`loadMyRoster`) — chỉ để biết "Lan" là tên người rồi hỏi lại chọn workspace; truy vấn
thật luôn dùng danh sách của workspace được chọn.

### 7.3 Trưởng nhóm

Trưởng nhóm = người có vai trò **OWNER hoặc ADMIN của workspace** chứa phạm vi
(với `BOARD` là workspace của bảng), lấy qua `workspaceRoleOf`. **Tính lại mỗi
lượt**, không lưu trong phiên. Quản trị viên của **một bảng** không phải trưởng
nhóm. Phạm vi `MY` không có trưởng nhóm.

### 7.4 Ai thấy gì

| Dữ liệu | Người hỏi (việc của mình) | Thành viên hỏi về người khác | Trưởng nhóm |
|---|---|---|---|
| Thẻ, trạng thái, hạn, checklist x/y, tên người nhận | ✔ | ✔ (chỉ trong bảng mình đọc được) | ✔ (chỉ trong bảng mình đọc được) |
| Số thẻ đang mở theo người | ✔ | ✔ | ✔ |
| `maxParallelCards`, "tạm nghỉ đến" của người khác | — | ✘ | ✔ (workspace mình quản lý) |
| Email, vai trò workspace, hồ sơ tự khai/CV | ✘ | ✘ | ✘ (ngoài bản đầu) |

Mọi vai trò đều bị giới hạn bởi quyền đọc bảng (§7.1).

## 8. Nhận diện người

### 8.1 Danh sách người của phạm vi

- `WORKSPACE(id)`: thành viên hiện tại của workspace + chủ workspace, chỉ người dùng
  chưa bị xoá (cách của `assign.repo.ts:54-78`).
- `BOARD(id)`: chủ bảng + BoardMember hiện tại (kể cả `VIEWER`, kể cả khách không ở workspace)
  + (nếu bảng `WORKSPACE`) chủ + thành viên workspace.
- `MY`: rỗng — hỏi về người khác ở phạm vi cá nhân thì hỏi lại chọn workspace (§7.2).
- Danh sách này **chỉ ở server**, là tham số đầu vào của bộ luật và bộ nhận diện;
  **không** gửi cho LLM. Đọc lại mỗi lượt: người đã rời không còn nhận diện được, kể cả khi
  phiên đang giữ id của họ (`resolveMemberRef` luôn đối chiếu id với danh sách hiện tại).
- Chủ workspace / chủ bảng luôn có mặt, kể cả dữ liệu cũ thiếu dòng thành viên của chủ.

### 8.2 So khớp tên

1. Chuẩn hoá: `normalizeText` (NFC — chuỗi NFD cho cùng kết quả) rồi tách thành các **từ**;
   mỗi từ giữ bản chữ thường có dấu và bản không dấu (`foldText`).
2. Bỏ từ xưng hô **đứng trước một tên**: anh, chị, em, bạn, cô, chú, thầy, bác, bé, ông ("chị Lan" → "Lan").
3. Người hỏi tự nhắc mình: "tôi", "mình", "tớ", "em", "bản thân", "chính tôi" → chuyển sang ý định
   `MY_*` tương ứng (`applyFollowUp`). Riêng "minh" **không dấu** do LLM trả về được coi là **tên** "Minh".
4. So **nguyên từ** (không so tiền tố ký tự — "An" không khớp "Anh"), **theo từng cặp từ**:
   hai từ đều có dấu → so bản có dấu ("tuần" ≠ "Tuấn"); một bên không dấu → so bản không dấu
   (gõ "tuan" vẫn tìm được "Tuấn"; tên lưu không dấu "Tuan" khớp cả "Tuấn" lẫn "tuần" → hỏi lại).
5. Chuỗi phải là **đuôi tên** (các từ cuối liên tiếp: "Lan", "Thị Lan", "Nguyễn Thị Lan").
   Nhiều người khớp → hỏi lại, **trừ khi** chuỗi có ≥ 2 từ và trùng **đúng cả tên** của đúng
   một người (gõ họ tên đầy đủ là có chủ đích: "Trần Lan" chọn "Trần Lan", không hỏi về "Nguyễn Trần Lan").
6. Bộ luật (B0) chỉ coi một cụm trong câu là tên người khi có **dấu hiệu ngữ cảnh**:
   - từ đứng trước là "của, cho, với, còn" hoặc từ xưng hô; hoặc từ đứng sau là "đang, làm, xong,
     có, đã, còn, nhận, giữ, thì, bị, sắp, hiện, vẫn, được, cần, phải, nên";
   - hoặc cả câu chỉ là một tên ("Lan?"); hoặc tên **viết hoa giữa câu** ("Tuần này Lan thế nào?").
   - Loại trừ trước: cụm thời gian ("tuần sau", "năm nay", "tháng này", "3 tuần", "ngày/sáng/tối/đêm
     mai"); "mình/tôi/tớ" gõ có dấu; "minh/toi" khi **cả câu** gõ không dấu (trừ "Minh" viết hoa giữa
     câu); từ xưng hô đứng một mình ("anh ấy" không phải tên "Tuấn Anh"); **từ khoá của chính bộ
     luật** đứng một mình (nhóm, team, việc, hạn, thẻ, bảng, mọi, người, ai, task, deadline, card…) —
     người tên "Trưởng Nhóm" không biến "Nhóm có việc nào quá hạn?" thành câu hỏi về người (nhắc cả
     tên "Trưởng Nhóm có việc gì?" vẫn nhận).
   - Nhiều cụm hợp lệ → lấy cụm **dài nhất**, rồi **sớm nhất**.

   Có test riêng cho từng cặp dễ nhầm: tuần/Tuấn, mai/Mai, năm/Nam, an toàn/An, tháng/Thắng, mình/Minh.

### 8.3 Kết quả

| Số người khớp | Hành vi |
|---|---|
| 1 | Nhận diện xong |
| ≥ 2 | **Hỏi lại** "Ý bạn là ai?" với nút tên (tối đa 8, sắp theo tên); client gửi `userId` qua `/messages/choice`, backend kiểm lại id đó thuộc danh sách người |
| 0 | "Không tìm thấy ‹X› trong ‹phạm vi›" — **không** nói người đó có tồn tại ở nơi khác hay không |

Id gửi qua `/choice` không thuộc danh sách → lỗi chung chung (400), không phân
biệt "không tồn tại" với "không có quyền" để không dò được id.

## 9. Hội thoại

### 9.1 Phiên tạm trong bộ nhớ

- `conversationId` = `crypto.randomUUID()`, **gắn với `userId`**. Id của người khác
  hoặc id không tồn tại → coi như phiên mới (không báo lỗi làm lộ sự tồn tại).
- Hết hạn sau **30 phút không hoạt động**; giới hạn **5 phiên/người**, **2000 phiên**
  toàn tiến trình (vượt thì bỏ phiên cũ nhất). Đồng hồ được tiêm vào để test.
- Chỉ lưu: ý định, tham số **người dùng đã nói** (trước khi điền mặc định), phạm vi, `userId`
  người đã chọn, câu hỏi lại đang chờ (khi chờ chọn workspace thì giữ cả tên đã gõ để nhận
  diện sau khi chọn), và truy vấn hiệu lực cuối (cho "Xem thêm"). **Không** lưu câu hỏi gốc,
  dữ liệu thẻ hay vai trò.
- Không đọc đồng hồ: mọi hàm nhận `nowMs` từ `chat.controller.ts` (tệp duy nhất của module đọc
  đồng hồ) → test hết hạn bằng đồng hồ giả.
- Máy chủ khởi động lại (hoặc `tsx watch` nạp lại) thì mất hết phiên → lượt sau
  trả `conversationReset: true`, giao diện báo "Trợ lý đã bắt đầu hội thoại mới".

### 9.2 Câu nối tiếp (`applyFollowUp`, hàm thuần)

| Kết quả hiểu câu mới | Phiên trước | Kết quả |
|---|---|---|
| intent cụ thể (5 ý định) | bất kỳ | Câu hỏi **mới hoàn toàn**, không kế thừa |
| `UNSUPPORTED` | bất kỳ | Trả lời "chưa hỗ trợ" |
| `NONE` + có ít nhất một tham số | có intent trước | Kế thừa intent + tham số cũ, **ghi đè** tham số mới |
| `NONE` + có tham số | không có intent trước | `UNSUPPORTED` kèm nút câu hỏi gợi ý |
| `NONE` + không tham số | bất kỳ | `UNSUPPORTED` kèm nút câu hỏi gợi ý |

Đổi phạm vi giữa hai lượt → **không** kế thừa ngữ cảnh. Kế thừa `member` thì
người đó vẫn phải nhận diện lại trong phạm vi hiện tại (người đã rời thì báo
không tìm thấy).

### 9.3 Câu hỏi lại đang chờ

Sau một câu hỏi lại (chọn người / chọn workspace), phiên giữ `pending`.
`POST /messages/choice` giải `pending` **không gọi LLM**; gửi câu hỏi mới qua
`/messages` thì bỏ `pending`.

## 10. Hai bộ hiểu câu hỏi và luật gộp

### 10.1 Bộ luật (B0) — `chat.rules.ts`

Hàm thuần `parseByRules(câu hỏi, danh sách người) → {intent, period, focus, member}` (không cần
"hôm nay" vì `period` là mã enum; khoảng ngày tính sau ở `chat.period.ts`). Câu cắt ở 500 ký tự.

- Tách từ rồi so **cụm từ theo từng từ** trên bản không dấu — không regex ghép chuỗi, không `.*`.
  Từ dễ nhầm khi bỏ dấu chỉ khớp khi gõ **đúng dấu** (đổi/đợi/đội, gán/gần, mời/mới, bận/bạn,
  lương/lượng, huỷ/Huy, thẻ/thế, đội…); gõ không dấu thì dùng cụm hai từ ("doi han") hoặc bỏ qua.
- Thứ tự: (1) cụm thời gian — chiếm từ, nhiều cụm thì lấy cụm **nhắc trước**; "sắp đến hạn" đồng
  thời là focus `OPEN`; (2) tình trạng — phủ định trước ("chưa xong" = `OPEN`), nhiều tình trạng →
  `NONE`, trừ `OPEN` + (`OVERDUE`|`BLOCKED`) → cái cụ thể hơn; (3) tên người (§8.2 bước 6);
  (4) người hỏi tự nhắc mình; (5) "mai" đứng một mình (không phải tên ai) = `TOMORROW`.
- Quyết định ý định theo **thứ tự ưu tiên**:

| # | Điều kiện | Kết quả |
|---|---|---|
| 1 | Hỏi thông tin ngoài phạm vi (email, số điện thoại, mật khẩu, địa chỉ, lương, hồ sơ, CV, kỹ năng) hoặc có động từ thao tác (tạo, thêm, xoá, sửa, đổi, chuyển, gán, mời, huỷ, giao — trừ "được/chưa/đã/bị/đang giao" —, đánh dấu, cập nhật, đặt hạn…) | `UNSUPPORTED` (mọi tham số `null`) |
| 2 | Hỏi lượng việc giữa các người ("ai" + nhiều/ít/bận/rảnh/quá tải/ôm; "mọi người" + bao nhiêu/số việc/đang giữ; "khối lượng", "phân bổ", "nhiều việc nhất") | `TEAM_WORKLOAD` |
| 3 | Hỏi ưu tiên ("ưu tiên", "nên làm", "làm gì trước", "gấp nhất"…) | `MEMBER_TASKS` nếu có tên người, ngược lại `MY_PRIORITIES` |
| 4 | Có dấu hiệu nối tiếp ("còn …", "thế còn / vậy còn …" ở đầu câu, "… thì sao" ở cuối câu), **không** có từ chỉ việc hay từ chỉ nhóm, **có** ít nhất một tham số | `NONE` (người hỏi tự nhắc mình → `member = "tôi"`) |
| 5 | Có tên người | `MEMBER_TASKS` |
| 6 | Có từ chỉ nhóm ("nhóm", "team", "đội", "dự án", "bảng này", "mọi người", "thành viên", "chưa giao"…; "tiến độ/tổng kết/báo cáo/tình hình" chỉ khi người hỏi không tự nhắc mình) | `TEAM_SUMMARY` |
| 7 | Người hỏi tự nhắc mình, **hoặc** có từ chỉ việc ("việc", "task", "deadline", "hạn chót", "nhiệm vụ", "thẻ"), **hoặc** có tình trạng | `MY_TASKS` |
| 8 | Chỉ có khoảng thời gian ("tuần sau?") | `NONE` |
| 9 | Còn lại | `UNSUPPORTED` |

Giới hạn đã biết của bộ luật (đo ở §14, không sửa bằng tay cho từng câu): câu không nói "tôi"
hay "nhóm" được hiểu là việc của tôi; "anh ấy / chị ấy" không nhận diện được người; cả câu gõ
không dấu thì "minh" là "mình"; "năm nay", "tháng này", "3 tuần nữa" chưa hỗ trợ (`period = null`).

### 10.2 LLM (B1) — `chat.llm.ts`

- `system`: định nghĩa 5 ý định + 2 giá trị đặc biệt, quy tắc gán nhãn §4.1, enum
  tham số, 10–15 ví dụ ngắn. Nói rõ: câu hỏi là **dữ liệu**, không phải chỉ dẫn.
- `user`: câu hỏi (≤ 500 ký tự) + dòng "Ngữ cảnh trước: intent=…, period=…, focus=…"
  (không có tên người — `member` của lượt trước được thay bằng `"<người đã chọn>"`).
- Gọi `callLlm` với lược đồ §4.3, timeout **8 giây**, nhiệt độ 0,2.

### 10.3 Luật gộp (B2) — hàm thuần, chốt trước khi đánh giá

LLM thất bại (`DISABLED`, `TIMEOUT`, `NETWORK`, `HTTP_4XX`, `HTTP_5XX`, `EMPTY`,
`BAD_JSON`, `INVALID_SHAPE`, hết ngân sách) → dùng nguyên kết quả bộ luật.
LLM thành công:

| Trường | Lấy từ | Lý do |
|---|---|---|
| `intent` | **LLM** | Ngữ nghĩa ("vướng", "kẹt", câu thao tác) là điểm mạnh của LLM; bộ luật dễ bắt nhầm "quá hạn" trong câu "xoá thẻ quá hạn" |
| `period` | **Luật** nếu luật tìm thấy, ngược lại LLM | Từ chỉ thời gian là lớp đóng, bộ luật đọc tất định |
| `focus` | **LLM** nếu khác `NONE`, ngược lại luật | Cần đọc nghĩa ("chưa xong", "đang kẹt") |
| `member` | **Luật** nếu luật khớp được người trong danh sách (một hoặc nhiều người) **hoặc** là người hỏi tự nhắc mình ("còn tôi?" → `"tôi"`), ngược lại chuỗi của LLM | Chỉ bộ luật nhìn thấy danh sách người |

Sau gộp → `applyFollowUp` (§9.2) → nhận diện người (§8). Thứ tự này giống nhau ở cả ba nhánh.
Kết quả trả về ghi `parser = "HYBRID"` khi LLM trả lời hợp lệ, `"RULE"` khi dùng nguyên bộ luật;
`"LLM"` chỉ dùng cho nhánh B1 trong bộ đánh giá.

### 10.4 Giới hạn gọi LLM

- **Ngân sách chung toàn tiến trình**: 10 lượt gọi / 60 giây trượt (khoá API dùng chung
  với module sinh bảng; gói free đo được bắt đầu 429 quanh 15 lượt/phút). Hết ngân
  sách → dùng bộ luật, **không** trả 429 cho người dùng. Đếm theo **lượt gọi `callLlm`**
  (kể cả lượt lỗi — request vẫn tốn hạn mức của nhà cung cấp); thiếu khoá thì không tính.
- Nhận xét §11 cũng tính vào ngân sách và bị bỏ **trước tiên** khi thiếu: chỉ gọi khi sau
  lượt đó vẫn còn ≥ 3 lượt trống cho việc hiểu câu hỏi (`COMMENT_RESERVE = 3`).
- Nhớ **mức ép JSON** nhà cung cấp đã chấp nhận (`formatMode` trong `LlmResult`) **theo tên
  lược đồ** (`chat_intent`, `team_summary_comment`) để lượt sau bắt đầu từ mức đó, không tốn
  3 request mỗi lượt. "Đã chấp nhận" = HTTP 200 (kể cả khi nội dung sai hình dạng — đó là lỗi
  của câu trả lời, không phải của mức ép JSON); lỗi HTTP/mạng không ghi đè mức đã nhớ.
  `callLlm` có tham số tuỳ chọn `format { name, schema, startMode? }`; bỏ trống thì giữ nguyên
  hành vi cũ (lược đồ kế hoạch bảng, bắt đầu từ `json_schema`).
- Timeout **8 giây** cố định (`CHAT_LLM_TIMEOUT_MS`), không theo `AI_TIMEOUT_MS` (30 giây) của
  module sinh bảng. Cấu hình `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` đọc lại **mỗi lượt**.
- Giới hạn theo người: `chatLimiter` **60 lượt POST / 10 phút** (gồm cả `/more`, `/choice`).

## 11. Nhận xét AI cho tổng kết nhóm

Chỉ khi `TEAM_SUMMARY` + focus `NONE`, qua `POST /messages` (không qua `/choice`, `/more` —
§12.1), **lượt hiểu câu vừa rồi dùng được LLM** (`parser ≠ RULE`: LLM vừa lỗi / quá giờ thì gọi
lại cũng vô ích và người dùng phải đợi thêm tới 8 giây) và còn ngân sách (§10.4).

- **Đầu vào** (JSON, `chat.summary.ts`): nhãn kỳ ("tuần này"), loại phạm vi ("một không gian
  làm việc" / "một bảng"), và 6 con số của bản tổng kết §6.4 (hoàn thành trong kỳ — không có khi
  kỳ ở tương lai —, chưa xong đến hạn trong kỳ, chưa xong, quá hạn, bị chặn, chưa giao chưa
  xong). **Không** tên người, tên bảng, tiêu đề thẻ, câu hỏi.
- **Đầu ra**: lược đồ `{ "comment": string }`, tối đa 300 ký tự, 2–3 câu, giọng trung tính.
- **Kiểm tra trước khi hiện** (`validateComment`, hàm thuần; vi phạm bất kỳ → bỏ nhận xét, câu
  trả lời vẫn đủ số liệu). Theo thứ tự:
  1. sai hình dạng (Zod `strict`), rỗng, hoặc dài quá 300 **ký tự** (đếm theo ký tự, không theo đơn vị UTF-16);
  2. markdown / liên kết / xuống dòng (`* # \` [ ] < > | _ ~ @`, tab, `http:`, `https:`, `www.`);
  3. ký hiệu `%`;
  4. chữ số không có trong tập số đã gửi (so nguyên dãy chữ số: `03` ≠ `3`), số thập phân (`2,5`),
     hoặc ký tự số ngoài 0–9 (số La Mã, số Ả Rập…);
  5. số viết bằng chữ: một, hai, ba, bốn, tư, năm, lăm, sáu, bảy, bẩy, tám, chín, mười, mươi, chục,
     trăm, nghìn, ngàn, triệu, tỷ, tỉ, nửa (từ có dấu so bản có dấu — "hài" không phải "hai"; từ gõ
     không dấu so bản không dấu);
  6. **từ viết hoa giữa câu** (dấu hiệu tên riêng: LLM không được biết tên ai nên mọi tên đều là bịa;
     đầu câu = đầu văn bản hoặc sau `. ! ? : …`);
  7. từ **đầu câu** trùng một từ trong tên thành viên (so dấu theo §8.2) **và** có dấu hiệu tên: từ kế
     tiếp là "đang, có, đã, cần…" (dấu hiệu tên của bộ luật) hoặc câu chỉ có một từ. Từ khoá của bộ
     luật ("Nhóm", "Việc"…) đứng đầu câu không tính.
- **Đổi so với bản đầu của hợp đồng** (chốt khi code bước 5): luật cũ "chứa một từ trùng tên người,
  so nguyên từ không dấu" bị bỏ vì loại gần như **mọi** nhận xét của nhóm thật — tên Việt trùng từ
  thường: "hoàn **thành**" / Thành, "**công** việc" / Công, "**tiến** độ" / Tiến, "tập **trung**" /
  Trung, "ngày **mai**" / Mai, "**lại**" / Lại. Thay bằng luật 6 + 7 (có test cho từng cặp).
- Giao diện hiện trong ô riêng **"Nhận xét của trợ lý (AI)"**, tách khỏi phần số liệu.

## 12. Hợp đồng API

Tất cả dưới `/api/chat`, qua `requireAuth`; lỗi theo khuôn sẵn có
(`{success:false, message, errors?}`).

### 12.1 Điểm cuối

| Phương thức | Đường dẫn | Thân | Gọi LLM? |
|---|---|---|---|
| `GET` | `/status` | — | không — trả `{ llmAvailable }` |
| `POST` | `/messages` | `{ message: string 1..500, scope, conversationId? }` | có (nếu sẵn sàng) |
| `POST` | `/messages/choice` | `{ conversationId, userId }` hoặc `{ conversationId, workspaceId }` | **không** |
| `POST` | `/messages/more` | `{ conversationId, page: int ≥ 2 }` | **không**; gọi lại kiểm phạm vi, tính lại `total` |

`scope` = `{ kind: "MY" }` | `{ kind: "WORKSPACE", workspaceId }` | `{ kind: "BOARD", boardId }`.
Client **không** gửi vai trò, danh tính hay id người được nhắc.

### 12.2 Kết quả `200`

```ts
{
  conversationId: string;
  conversationReset?: true;           // phiên cũ không còn (hết hạn / khởi động lại)
  understood: {                       // hiện ở dòng "Trợ lý hiểu là: …"
    intent: Intent; period: Period | null; focus: Focus | null;
    memberName: string | null;        // tên ĐÃ nhận diện (từ CSDL), không phải chuỗi gõ
    parser: "RULE" | "LLM" | "HYBRID";
  };
  answer: {
    kind: "ANSWER" | "CLARIFY" | "UNSUPPORTED";
    text: string;                     // câu dẫn dựng bằng mẫu
    scopeLabel: string;               // "N bảng bạn xem được trong …"
    generatedAt: string;              // ISO, thời điểm truy vấn
    facts: { key: string; label: string; value: number }[];
    cards: ChatCard[];                // danh sách chính (trang hiện tại)
    total: number; page: number; pageSize: 10;
    sections: { key: string; label: string; total: number; cards: ChatCard[] }[]; // danh sách phụ ≤ 5
    rows?: { name: string; open: number; overdue: number; capacity?: number; pausedUntil?: string | null }[]; // TEAM_WORKLOAD
    ignoredSlots: ("period" | "focus" | "member")[];
    notes: string[];                  // giới hạn cần nói rõ (không có trường ưu tiên, chưa tính checklist giao riêng…)
    clarify?: { question: string; options: { id: string; label: string; kind: "USER" | "WORKSPACE" }[] };
    suggestions: string[];            // câu hỏi gợi ý tiếp theo
    comment?: { text: string; source: "AI" };
  };
}
```

`ChatCard` = các trường §6.3 (+ `reason` cho `MY_PRIORITIES`).

### 12.3 Mã lỗi

| Mã | Khi nào |
|---|---|
| 400 | Sai định dạng (Zod, mọi object `strict`); `/choice`: "Lua chon khong hop le" (id không thuộc lựa chọn đang chờ / sai loại), "Khong co cau hoi lai nao dang cho"; `/more`: "Chua co cau tra loi nao de xem them" |
| 401 | Chưa đăng nhập |
| 403 | Không phải thành viên workspace; bảng chỉ xem được vì PUBLIC |
| 404 | Không tìm thấy workspace/bảng; `/more` hoặc `/choice` với hội thoại không còn / không phải của mình (cùng một thông điệp "Hoi thoai da het han hoac khong ton tai, hay hoi lai"). Riêng `/messages` với mã như vậy thì **tạo phiên mới** + `conversationReset: true` |
| 429 | Vượt `chatLimiter` |

## 13. Giao diện (tóm tắt hợp đồng)

- Nút **Trợ lý** trên Header (giữa "Tạo mới" và chuông thông báo), mở panel bên phải
  qua portal; hội thoại giữ ở provider cấp `ProtectedRoute` nên **không mất** khi bấm
  liên kết thẻ chuyển từ trang chủ sang trang bảng.
- Bộ chọn phạm vi **Việc của tôi / Workspace / Bảng**; mặc định theo trang đang mở
  (trang bảng → Bảng; `/workspaces/:id` → Workspace; còn lại → Việc của tôi). Đổi phạm vi
  giữa hội thoại → lượt sau không kế thừa ngữ cảnh.
  - Phạm vi chỉ **đi theo trang** khi hội thoại còn rỗng và người dùng chưa tự chọn; đã hỏi rồi thì
    **giữ nguyên** (bấm liên kết thẻ sang trang bảng không được tự đổi phạm vi, nếu không câu nối tiếp
    "còn tuần sau?" sẽ mất ngữ cảnh). "Hội thoại mới" → phạm vi lại theo trang.
  - "Workspace" mặc định: workspace của trang, rồi workspace của bảng đang mở, rồi workspace đang
    chọn ở Header. "Bảng" chỉ chọn được khi đang ở trang một bảng.
- "Xem thêm" chỉ có ở **lượt mới nhất** (server chỉ nhớ truy vấn cuối); nút hỏi lại cũng chỉ bấm
  được ở lượt mới nhất (câu hỏi mới huỷ câu hỏi lại đang chờ, §9.3).
- Panel chưa mở lần nào thì không gọi API nào; `GET /status` gọi một lần khi mở lần đầu.
- Esc đóng panel chỉ khi con trỏ đang ở trong panel **và** không có hộp thoại `aria-modal="true"` nào
  khác đang mở; bấm ra ngoài không đóng. Bấm liên kết thẻ thì bỏ focus khỏi liên kết (thẻ mở ra nghe Esc
  ở `document` — con trỏ còn trong panel thì Esc sẽ đóng panel thay vì đóng thẻ). Enter gửi,
  Shift+Enter xuống dòng, Enter lúc bộ gõ tiếng Việt đang ghép chữ (IME) không gửi.
- Lớp hiển thị: panel `z-[35]` — trên nội dung trang và lớp phủ `z-30`, **dưới** mọi menu / popover
  `z-40` (menu tài khoản, "Tạo mới") và modal `z-50` (CardModal).
- Giờ hiển thị (hạn, thời điểm truy vấn) theo **giờ Việt Nam**, khớp định nghĩa "hôm nay / tuần
  này" của server (§5), không theo múi giờ máy người xem.
- Mỗi câu trả lời hiện: dòng "Trợ lý hiểu là: …", phạm vi, thời điểm truy vấn, con số,
  danh sách thẻ (trạng thái, hạn, checklist x/y, liên kết), "Xem thêm", nút hỏi lại,
  câu hỏi gợi ý; nhận xét AI nằm ô riêng.
- Trạng thái đang xử lý, kết quả rỗng, lỗi, hỏi lại — đều bằng tiếng Việt. Nhãn **"Chế độ
  cơ bản"** khi không có LLM. Dòng thông báo cố định: "Chỉ câu hỏi (và số liệu tổng hợp)
  được gửi tới dịch vụ AI."
- Nút câu hỏi nhanh cho 4 nhóm; hỗ trợ chế độ tối và khổ 375px.

## 14. Đánh giá (đăng ký trước khi chạy)

### 14.1 Câu hỏi đánh giá

- **Q1.** LLM hiểu câu hỏi tốt hơn bộ luật tới mức nào (B1 so với B0)?
- **Q2.** Gộp luật + LLM có hơn chỉ LLM không, nhất là ở **tên người** và **thời gian** (B2 so với B1)?
- **Q3.** Độ tin cậy và chi phí: tỉ lệ lỗi theo loại, độ trễ p50/p95, token.
- Rò dữ liệu **không** đo bằng bộ câu hỏi mà bằng test tự động (§15) — phải bằng 0.

### 14.2 Bộ dữ liệu

- Khoảng **90 câu tự soạn** (một người gán nhãn — ghi rõ là mối đe doạ độ tin cậy):
  ~12 câu cho mỗi ý định, ~10 câu nối tiếp, ~8 câu ngoài phạm vi / yêu cầu thao tác,
  ~6 câu có chèn lệnh; trải đều câu có dấu / không dấu, câu có từ dễ nhầm tên.
- **Danh sách người cố định** ~12 người, có trùng tên ("Nguyễn Thị Lan" và "Trần Lan") và
  các tên Tuấn, Mai, Nam, An, Bình.
- Câu nối tiếp mang **ngữ cảnh vàng** của lượt trước (không lấy từ kết quả nhánh), để
  lỗi một lượt không lan sang lượt sau.
- **Nhãn vàng** = **truy vấn hiệu lực** sau `applyFollowUp` → `resolveSlots` (§4.4) và nhận diện người:
  `{ intent, period, focus, memberUserId | null }`; câu có tên trùng thì nhãn vàng là "hỏi lại".
  So sau `resolveSlots` để tham số "không quan trọng" (ví dụ `period` của `TEAM_WORKLOAD`) không
  làm sai lệch điểm; `ignoredSlots` được chấm riêng.
- Chia cố định theo id **dev ~30 / test ~60** trước khi chạy; đóng băng bằng sha256.

### 14.3 Ba nhánh

| Nhánh | Cách làm |
|---|---|
| B0 | Chỉ bộ luật |
| B1 | Chỉ LLM → `applyFollowUp` → nhận diện người từ chuỗi LLM. LLM thất bại = sai mọi trường, ghi loại lỗi |
| B2 | Gộp §10.3 bộ luật + **cùng một** phản hồi LLM của B1 |

B1 và B2 dùng **chung phản hồi LLM** cho mỗi cặp (câu, lần chạy) → so sánh cặp, không tốn
quota gấp đôi, và phần chênh lệch chỉ do luật gộp. Không nhánh nào nhận id người chọn sẵn.

### 14.4 Chỉ số

- Độ chính xác ý định; macro-F1 trên 6 nhãn; ma trận nhầm.
- Khớp từng tham số (`period`, `focus`, người) và **khớp hoàn toàn** cả bốn trường.
- Tỉ lệ hỏi lại đúng (câu trùng tên, câu thiếu workspace).
- Tỉ lệ lỗi LLM theo loại; độ trễ p50/p95; token vào/ra.
- Khoảng tin cậy 95% bootstrap theo câu hỏi; chênh lệch **cặp** B1−B0 và B2−B1.

### 14.5 Quy trình

- 3 lần chạy, `--delay` ≥ 4000 ms; bộ đệm `backend/.chat-eval-cache/` (không commit), lưu
  cả `BAD_JSON`/`EMPTY` nhưng không lưu lỗi hạ tầng; dừng khi gặp 429.
- Chỉnh prompt và bộ luật **chỉ trên tập dev**; ghi mã phiên bản prompt + luật vào báo cáo;
  chạy tập test **đúng một lần**. Sửa gì sau khi chạy test → báo số liệu trước/sau trên
  cùng phản hồi đã đệm.
- Báo cáo: `backend/eval-chat-result.md`.

## 15. Kiểm thử và điều kiện nghiệm thu

Ánh xạ từ §4 của `CHATBOT_PLAN.md`; mỗi ca có ít nhất một test tự động.

**Phân quyền và dữ liệu**

- Cùng câu hỏi dưới thành viên và trưởng nhóm → đúng phạm vi và đúng bộ trường (§7.4).
- Thành viên không lấy được `maxParallelCards`/tạm nghỉ bằng cách tự xưng trưởng nhóm, đổi id hay hỏi vòng.
- Trưởng nhóm không đọc được bảng PRIVATE chưa tham gia, hay workspace mình không quản lý.
- Quản trị viên bảng không thành trưởng nhóm; VIEWER đọc được nhưng không thấy trường quản lý.
- Thu hồi quyền / đổi vai trò / chuyển bảng sang PRIVATE giữa hai lượt → lượt sau không dùng dữ liệu cũ.
- Mã hội thoại của người khác không đọc hay tiếp tục được; phiên hết hạn không giữ quyền.
- Tiêu đề thẻ chứa chỉ dẫn độc hại → thân request gửi LLM (bắt bằng `fetch` giả) **không chứa**
  tiêu đề, tên người, tên bảng hay email.
- Bảng PUBLIC ngoài phạm vi, thẻ/danh sách/bảng đã xoá hoặc lưu trữ không xuất hiện; không có
  `description`/email trong kết quả.
- Không có `console` nào trong module chatbot (test canh giữ).

**Độ chính xác**

- Biên nửa đêm, Chủ nhật/Thứ Hai; việc không có hạn; việc xong rồi mở lại; người trùng tên;
  từ dễ nhầm tên; câu NFD.
- Hơn 200 thẻ: tổng số đúng, các trang không trùng và phủ đủ; con số đối chiếu với phép đếm
  "ngây thơ" bằng JS và với tổng/đã xong/quá hạn của `getWorkspaceOverview`.
- LLM timeout / sai định dạng / 429 / hết ngân sách → vẫn trả lời bằng bộ luật.
- Hồi quy toàn bộ test module AI sinh bảng sau khi thêm tham số `format` cho `callLlm`.

## 16. Cấu trúc mã dự kiến

```
backend/src/modules/chat/
  chat.intent.ts     kiểu, Zod, lược đồ JSON (§4)
  chat.period.ts     period → [từ, đến) (§5)        — nơi DUY NHẤT import ai.service/ai.apply
  chat.rules.ts      bộ luật B0 (§10.1)             — thuần
  chat.followup.ts   applyFollowUp (§9.2)           — thuần
  chat.scope.ts      readableBoardWhere, liveCard, resolveScope, danh sách người, trưởng nhóm (§7, §8.1)
  chat.members.ts    so khớp tên (§8.2-8.3)         — thuần
  chat.queries.ts    đếm + danh sách (§6)
  chat.priority.ts   nhãn lý do (§6.6)              — thuần
  chat.answer.ts     dựng câu trả lời theo mẫu      — thuần
  chat.llm.ts        prompt, parse, luật gộp, ngân sách (§10.2-10.4)
  chat.summary.ts    nhận xét + kiểm tra (§11)
  chat.session.ts    phiên trong bộ nhớ (§9.1)
  chat.service.ts    điều phối một lượt
  chat.schema.ts / chat.controller.ts / chat.routes.ts
backend/src/scripts/chatEvalDataset.ts, evaluateChat.ts   (§14)
frontend/src/types/chat.ts, lib/api/chat.ts, context/AssistantContext.tsx, components/assistant/*
```

Sửa ngoài module: `ai/ai.llm.ts` (tham số `format`), `middleware/rateLimit.middleware.ts`
(`chatLimiter`), `app.ts` (gắn route), `scripts/evalCache.ts` (kiểu `Arm` → `string`),
`backend/.gitignore`, `frontend/src/components/Header.tsx`, `routes/ProtectedRoute.tsx`,
`components/board/darkMode.test.ts`. **Không** sửa `modules/assign/`.

## 17. Lộ trình

Mỗi bước một commit; bắt đầu khi được giao "làm bước N đi".

| Bước | Nội dung | Trạng thái |
|---|---|---|
| 0 | Tài liệu hợp đồng này | **xong** |
| 1 | Lõi thuần: `chat.intent`, `chat.period`, `chat.members` (so khớp tên — chuyển lên từ bước 2 vì bộ luật cần), `chat.rules`, `chat.followup` + test canh giữ | **xong** |
| 2 | Phạm vi (`chat.scope`): bảng đọc được, danh sách người lấy từ CSDL, trưởng nhóm + test CSDL phân quyền và nhận diện tên trên dữ liệu thật | **xong** |
| 3 | Truy vấn, nhãn ưu tiên, dựng câu trả lời + test đối chiếu số liệu, > 200 thẻ | **xong** |
| 4 | Phiên, dịch vụ, API, `chatLimiter` — chạy trọn vẹn **không cần LLM** | **xong** |
| 5 | Lớp LLM (tham số `format` cho `callLlm`, luật gộp, ngân sách) + nhận xét tổng kết | **xong** |
| 6 | Giao diện: nút Trợ lý, panel, bộ chọn phạm vi, hiển thị câu trả lời | **xong** |
| 7 | Bộ đánh giá: bộ câu hỏi, 3 nhánh, chỉ số, báo cáo (chạy thử B0 không cần khoá) | chưa |
| 8 | Chạy chính thức với Gemini thật (cần khoá API mới) | chưa |
| 9 | Nghiệm thu theo §15, thử trên trình duyệt, cập nhật tài liệu | chưa |

**Việc của tác giả**: trước bước 8 xoá khoá API cũ đã lộ và tạo khoá mới trong
`backend/.env`; báo GVHD về module AI thứ ba. Dòng `seed:team` đang sửa dở trong
`backend/package.json` (phiên khác) không được commit cùng module này — bộ đánh giá
chạy bằng `npx tsx` cho tới khi dòng đó được commit.

---

## Nhật ký tiến độ

### Đã xong — Bước 0 (28/09/2026)

Viết tài liệu hợp đồng từ `CHATBOT_PLAN.md`, góp ý ngày 27/09 và 4 quyết định tác giả
chốt ngày 28/09. Các điểm được chốt thêm khi viết (so với `CHATBOT_PLAN.md`):

- Thêm giá trị `NONE` cho `intent` để biểu diễn câu nối tiếp; cả bộ luật và LLM dùng chung `applyFollowUp`.
- `focus` áp dụng cho cả `MEMBER_TASKS` và `TEAM_SUMMARY` (xem danh sách thẻ nhóm quá hạn / bị chặn)
  thay vì thêm ý định mới.
- "Chưa giao, chưa xong" tách nhãn khỏi "Chưa giao" của trang Tổng quan; "số thẻ đang mở"
  tách tên khỏi "tải" của module phân công.
- Phạm vi `BOARD` dùng danh sách người của **bảng** (có cả khách của bảng), không phải của workspace.
- `DONE` với kỳ ở tương lai → bỏ qua kỳ, dùng tuần này.

### Đã xong — Bước 1: lõi thuần (28/09/2026)

**Tệp** (`backend/src/modules/chat/`, đều là hàm thuần — không DB, không mạng, không đọc đồng hồ):

| Tệp | Nội dung |
|---|---|
| `chat.intent.ts` | Hằng số ý định/tham số, `INTENT_JSON_SCHEMA` (§4.3), `parseLlmIntent` (Zod `.strict()`, đổi `NONE`/`""` → `null`, không ném lỗi), `resolveSlots` (§4.4, §5.2) |
| `chat.period.ts` | `periodRange(period, now)` → `[từ, đến)`, `vnToday`, `vnDayStart`; tệp **duy nhất** import `ai.service`/`ai.apply` |
| `chat.members.ts` | `tokenize`, `sameWord`, `matchMember` (ONE/MANY/NONE), `findNameSpans`, `isSelfReference` (§8.2–8.3) — chuyển lên từ bước 2 vì bộ luật cần |
| `chat.rules.ts` | `parseByRules(câu hỏi, danh sách người)` — nhánh B0 (§10.1) |
| `chat.followup.ts` | `applyFollowUp(parsed, ngữ cảnh trước)` (§9.2) + người hỏi tự nhắc mình |

**Test** (`backend/test/chat.*.test.ts`, 6 tệp): hợp đồng lược đồ ↔ Zod; bảng `resolveSlots`
đủ 5 ý định; khoảng ngày theo bảng §5.1, biên 16:59:59.999Z / 17:00Z, Chủ nhật/Thứ Hai, qua năm,
năm nhuận + 400 thời điểm ngẫu nhiên (tính chất: tuần bắt đầu 00:00 Thứ Hai giờ VN, dài đúng 7 ngày…);
so khớp tên (đuôi tên, xưng hô, trùng tên, tên lưu không dấu, giới hạn); ~70 câu mẫu cho bộ luật
+ bảng từ dễ nhầm tên + tương đương có dấu/không dấu/NFD + tính chất trên 3000 câu ngẫu nhiên;
bảng câu nối tiếp; test đọc mã nguồn (không `fetch`/`RegExp(`/`.*`/giờ địa phương/`console`/
`process.env`, tệp thuần không import CSDL/dịch vụ, không ký tự vô hình).

**Cài lỗi**: 78 phép trên 5 tệp nguồn → lần đầu lọt 9 (M5, M12, M13, R6, R7, R9, R31, R33, R34),
**đều là lỗ thật của test** (không có phép tương đương) → bổ sung ca → **78/78 bị bắt**, mã nguồn
khôi phục nguyên vẹn (so từng byte).

**Lỗi thật tìm ra khi thăm dò bộ luật (đã sửa trước khi viết `expect`)**:
1. "Minh đang làm gì?" bị hiểu là "mình" → "minh"/"toi" không dấu chỉ là người hỏi khi **cả câu** không dấu.
2. "mình có việc gì" (có dấu) vẫn khớp tên "Minh" lưu không dấu → "mình/tôi/tớ" có dấu không bao giờ là tên.
3. "hạn" là từ chỉ việc làm "Vậy còn quá hạn?" không còn là câu nối tiếp → chỉ tính "hạn chót".
4. Câu có dấu hiệu nối tiếp nhưng không có tham số ("còn gì nữa không?") trả `NONE` rỗng → đi tiếp các luật sau.

**Chốt thêm khi code** (đã sửa các mục tương ứng ở trên): bộ luật không cần "hôm nay" (§10.1); câu
"còn tôi?" → `NONE` + `member = "tôi"`, `applyFollowUp` đổi sang ý định `MY_*`; ngữ cảnh phiên lưu
`memberUserId` (không lưu tên gõ); so dấu **theo từng cặp từ** (§8.2 bước 4); luật "họ tên đầy đủ ≥ 2 từ"
(§8.2 bước 5); `MY_PRIORITIES` + "hôm nay" không báo bỏ qua; nhãn vàng đánh giá là truy vấn **sau**
`resolveSlots` (§14.2); lược đồ JSON bỏ `maxLength` (Zod kiểm).

**Bài học**:
- Luật loại trừ ("tuần sau" không phải Tuấn, "đêm mai" không phải Mai…) **chỉ có tác dụng khi có dấu
  hiệu tên đứng cạnh** ("của năm nay", "đêm mai **có**…"); câu không có dấu hiệu đã bị luật ngữ cảnh loại
  sẵn → test phải dựng đúng cặp "dấu hiệu + cụm thời gian" thì mới chứng minh được từng luật (R7, R9, R33).
- Hai tầng cùng canh một việc (cụm thời gian đã chiếm từ / luật "đầu tuần + từ bổ nghĩa") → mỗi tầng cần
  một ca chỉ nó canh ("tuần **vừa** qua": "vừa" không nằm trong danh sách từ bổ nghĩa).
- Kiểm tra "từ gõ có dấu khác dạng" chỉ lộ ra với từ có cùng bản bỏ dấu ("chán"/"chặn", "tới"/"tôi").

### Đã xong — Bước 2: phạm vi + quyền đọc + danh sách người (28/09/2026)

**Tệp**: `backend/src/modules/chat/chat.scope.ts` (mới) —

| Hàm | Việc |
|---|---|
| `readableBoardWhere(userId, wsIds)` | Bảng đọc được §7.1 (sao y OR của `listMyCards`, không PUBLIC, không bảng xoá/lưu trữ) |
| `liveCardWhere(boardWhere)` | Thẻ còn sống §6.1 (thẻ + danh sách + bảng) |
| `resolveScope(userId, scope)` | `MY` / `WORKSPACE` (qua `assertWorkspaceAccess`: 404 / 403) / `BOARD` (404 nếu không có hoặc đã xoá/lưu trữ, 403 "Tro ly chi ho tro bang ban tham gia" nếu không đọc được — kể cả PUBLIC); cờ trưởng nhóm theo vai trò **workspace**; `boardCount` |
| `loadRoster(scope)` | Danh sách người §8.1 |
| `listChoosableWorkspaces(userId)` | Lựa chọn khi hỏi lại "workspace nào?" (nhóm trước, cá nhân sau) |

`chat.members.ts` thêm `resolveMemberRef` (thuần): id đã chọn chỉ hợp lệ khi còn trong danh
sách hiện tại; id ưu tiên hơn tên gõ.

**Test** `backend/test/chat.scope.test.ts` (8 ca, dữ liệu thật: 2 workspace, 9 bảng, 11 người):
bảng đọc được đúng cho 9 vai trò và **trùng `listMyBoards`** (hàm sẵn có của trang chủ); bảng
PUBLIC xem được qua `assertBoardView` nhưng trợ lý không tính; ADMIN workspace quản lý được bảng
PRIVATE (`canManageBoard`) nhưng không đọc; quản trị viên **bảng** / chủ **bảng** không phải
trưởng nhóm; quyền workspace A không dùng cho B; thu hồi quyền / đổi vai trò / đổi hiển thị / rời
workspace giữa hai lượt; thẻ còn sống; danh sách người + nhận diện tên (trùng tên, người đã rời,
tài khoản đã xoá, khách chỉ có ở phạm vi bảng, id cũ trong phiên); dữ liệu cũ thiếu dòng thành
viên của chủ. `chat.guard.test.ts` thêm: không import `modules/assign`; `chat.scope` không dùng
`assertBoardView` / `isBoardParticipant` / `assertBoardAccess`.

**Cài lỗi**: 30 phép (27 trên `chat.scope.ts`, 3 trên `resolveMemberRef`) → lần đầu lọt 1 (chủ
bảng bị coi là trưởng nhóm) → thêm ca → **30/30**. Trước khi chạy đã tự soát ra 4 nhánh "chủ luôn
có dòng thành viên" mà dữ liệu mẫu không phân biệt được → thêm ca dữ liệu cũ; và gỡ một điều kiện
thừa trong `loadRoster` (`MY` luôn có `workspace = null`) thay vì viết test cho mã chết.

**Ghi nhận**: `listMyBoards` không có nhánh `ownerId` còn `listMyCards` (và chatbot) có — chỉ
khác nhau với dữ liệu cũ thiếu dòng thành viên của chủ; có test ghi nhận chủ ý này.

### Đã xong — Bước 3: truy vấn số liệu + dựng câu trả lời (28/09/2026)

**Tệp** (`backend/src/modules/chat/`):

| Tệp | Nội dung |
|---|---|
| `chat.queries.ts` | `runQuery(ctx, truy vấn hiệu lực, {target, roster})` → `ListResult` (con số, danh sách chính 10 thẻ/trang sắp `dueDate asc nulls last, id`, danh sách phụ ≤ 5) hoặc `WorkloadResult` (dòng theo người bằng `cardMember.groupBy`, lượt giao cho người ngoài danh sách, chưa giao chưa xong, hồ sơ chỉ cho trưởng nhóm). Điều kiện luôn ghép `AND`; trường theo `select` tường minh (§6.3) |
| `chat.priority.ts` | `priorityReason(dueDate, {now, tomorrow, day4})` — thuần, mốc truyền vào |
| `chat.answer.ts` | `renderAnswer` + `renderClarifyMember` / `renderClarifyWorkspace` / `renderAskWho` / `renderMemberNotFound` / `renderUnsupported` — thuần, tiếng Việt có dấu; `ScopeInfo` tách khỏi điều kiện truy vấn |

`PAGE_SIZE` / `SECTION_SIZE` chuyển vào `chat.intent.ts` để `chat.answer` (thuần) không kéo CSDL.
`chat.guard.test.ts`: `chat.priority` và `chat.answer` thành tệp thuần; tệp thuần chỉ được import
**giá trị** từ tệp thuần (import **kiểu** thì được lấy từ `chat.queries`).

**Test**:
- `chat.queries.test.ts` (6 ca, CSDL): **đối chiếu với phép đếm "ngây thơ"** — đọc lại toàn bộ CSDL
  rồi lọc bằng vòng lặp JS theo đúng định nghĩa §6–§7 — trên 9 cặp (người hỏi × phạm vi) × (3 chủ thể
  × 11 tổ hợp tình trạng/kỳ + 4 kỳ tổng quan) = 333 truy vấn: tổng, từng con số, **mọi thẻ qua mọi
  trang**, cờ quá hạn, danh sách phụ; chốt chống "xanh giả" (mỗi tổ hợp đều có thẻ thật, > 5 danh sách
  nhiều trang); 150 thẻ sinh tất định có thẻ nằm **đúng mốc** đầu khoảng; danh sách trường cho phép
  (không mô tả / email / token, checklist x/y và người nhận đúng, tài khoản đã xoá không hiện tên);
  nhãn ưu tiên đúng mốc 16:59:59.999Z / 17:00Z; 205 thẻ: 21 trang không trùng, phủ đủ, trang 22 rỗng;
  số thẻ đang mở theo người khớp phép đếm, hồ sơ chỉ cho trưởng nhóm (không lẫn hồ sơ workspace khác,
  tạm nghỉ đã qua không hiện); **khớp trang Tổng quan**: chưa xong = tổng − đã xong, quá hạn bằng nhau,
  số bảng bằng nhau.
- `chat.answer.test.ts` (7 ca, thuần): câu dẫn từng ý định + số 0; ưu tiên; con số / nhãn danh sách
  phụ / ghi chú / gợi ý (gợi ý cho câu hỏi về một người **không chứa tên**); bảng theo người; **tính chất
  trên 600 bộ số liệu ngẫu nhiên: mọi con số trong câu dẫn đều có trong số liệu đã tính**; hỏi lại /
  không tìm thấy (không lộ sự tồn tại) / chưa hỗ trợ.

**Cài lỗi**: 63 phép (40 truy vấn, 4 ưu tiên, 19 câu chữ) → lần đầu lọt 2 → thêm ca → **63/63**:
Q39 (mục "Cần gỡ chặn" lấy cả thẻ bị chặn của người khác — dữ liệu mẫu chỉ có thẻ bị chặn của chính
người hỏi), A16 (chưa có ca đúng 1 lượt giao cho người ngoài danh sách). Trước khi chạy đã tự thêm 5 ca
mà đọc mã thấy test chưa phân biệt: thẻ đúng mốc đầu khoảng, thứ tự "mới xong trước", cờ quá hạn với
thẻ đã xong, hồ sơ ở workspace khác, mặc định khi gọi `runQuery` không qua `resolveSlots`.

**Bài học**: phép đếm "ngây thơ" viết bằng vòng lặp trên ảnh chụp CSDL là chốt chặn mạnh nhất cho
tầng truy vấn — nó là test đầu tiên báo lỗi ở 26/40 phép cài lỗi truy vấn; nhưng nó chỉ mạnh bằng
**dữ liệu sinh ra**: phép lọt đều do dữ liệu mẫu thiếu một kiểu thẻ (bị chặn của người khác), không do phép đếm sai.

### Đã xong — Bước 4: phiên + dịch vụ + API (29/09/2026)

**Tệp mới** (`backend/src/modules/chat/`):

| Tệp | Nội dung |
|---|---|
| `chat.session.ts` | `ChatSessionStore` (thuần, `nowMs` truyền vào): mã `randomUUID` gắn người dùng, hết hạn 30 phút không hoạt động (tính từ lần dùng cuối), ≤ 5 phiên/người, ≤ 2000 phiên — đầy thì bỏ phiên **dùng lâu nhất**; `scopeKeyOf`; kho dùng chung `chatSessions` |
| `chat.service.ts` | `handleMessage` / `handleChoice` / `handleMore` / `getChatStatus`. Bộ "hiểu câu hỏi" **tiêm vào** (`Understand`; bước 4 = `understandByRules`) — nhận câu hỏi + danh sách người + ngữ cảnh, **không** nhận dữ liệu thẻ. Kiểm phạm vi **trước** khi mở phiên (sai quyền thì không để lại gì) |
| `chat.schema.ts` | Zod `strict` cho 3 thân yêu cầu (câu hỏi 1..500 ký tự sau `trim`; `/choice` đúng một trong `userId` / `workspaceId`; `/more` trang ≥ 2) |
| `chat.controller.ts` | Tệp **duy nhất** đọc đồng hồ (`now: new Date()`) |
| `chat.routes.ts` | `GET /status`; `POST /messages`, `/messages/choice`, `/messages/more` — `requireAuth` → `chatLimiter` → `validateBody` |

**Sửa**: `chat.scope.ts` thêm `loadMyRoster`; `rateLimit.middleware.ts` thêm `chatLimiter` (60/10 phút/người);
`app.ts` gắn `/api/chat`; `chat.rules.ts` thêm luật "từ khoá của bộ luật đứng một mình không là tên".

**Test**: `chat.session.test.ts` (3 ca, thuần — hạn tính từ lần dùng cuối, biên đúng 30 phút, bỏ phiên dùng lâu
nhất theo người và toàn kho); `chat.api.test.ts` (10 ca, HTTP thật): 401 / 400 (kể cả gửi kèm `role`, `userId`);
việc cá nhân → câu nối tiếp → "Xem thêm" (13 thẻ, 2 trang, không trùng) → đổi phạm vi thì mất ngữ cảnh + mất
truy vấn cũ; trùng tên → "Ý bạn là ai?" → chọn sai / tự chọn mình / chọn lại → 400, chọn đúng → trả lời, câu nối
tiếp giữ người, câu mới (kể cả câu chưa hỗ trợ) bỏ câu hỏi lại, người rời workspace giữa hai lượt → "không tìm thấy"
(cả ở "Xem thêm"); phạm vi cá nhân hỏi nhóm / người → chọn workspace (một workspace thì dùng luôn); ngữ cảnh giữ
tham số **người dùng đã nói** ("đã xong" → "còn chưa xong?" ra **mọi** việc chưa xong, không bị mặc định tuần này
dính theo); trưởng nhóm thấy giới hạn song song, thành viên không; thu hồi quyền giữa hai lượt (cả ở "Xem thêm") →
403; bảng PUBLIC 403, bảng lưu trữ 404, workspace khác 403; mã hội thoại của người khác → phiên mới +
`conversationReset`, `/more` và `/choice` → 404, phiên của chủ vẫn nguyên; **không có `console` nào chứa câu hỏi**
(kể cả khi 403 / 400); hết hạn phiên + khởi động lại bằng đồng hồ giả; bộ hiểu câu tiêm vào không thấy dữ liệu thẻ;
thiếu tên → "Bạn muốn hỏi về ai?"; 61 lượt → 429, người khác không bị ảnh hưởng (ca cuối tệp).

**Lỗi thật tìm ra**: bộ luật B0 hiểu "Nhóm có việc nào quá hạn?" thành câu hỏi về **người** khi trong nhóm có người
tên "Trưởng Nhóm" (đuôi tên "Nhóm" + dấu hiệu "có" ngay sau) → luật mới ở §8.2 bước 6, có test riêng.

**Cài lỗi**: 42 phép (22 dịch vụ, 9 phiên, 7 schema, 1 danh sách người phạm vi cá nhân, 2 giới hạn lượt, 1 luật từ
khoá) → lần đầu lọt 1 (V9: bỏ "câu hỏi mới xoá câu hỏi lại đang chờ" — test chỉ gửi câu mới **được trả lời**, mà
`answerQuestion` tự xoá lại; chỉ lộ ra khi câu mới **chưa hỗ trợ**) → thêm ca → **42/42**.

**Kiểm trên máy chủ thật**: container backend (bind-mount + `tsx watch`) **không** tự nạp lại khi sửa tệp từ Windows
(sự kiện đổi tệp không qua được bind-mount) → phải `docker restart taskflow-backend`; sau đó `/api/chat/*` trả 401
khi chưa đăng nhập (route đã gắn).

**Bước 5 cần**: tham số `format` cho `callLlm` (giữ mặc định lược đồ kế hoạch bảng, chạy lại toàn bộ test module
AI), `chat.llm.ts` (prompt, parse, luật gộp B2, ngân sách chung 10 lượt/phút, timeout 8 giây, nhớ mức ép JSON),
`chat.summary.ts` (nhận xét tổng kết + kiểm tra), thay `understandByRules` bằng bản lai, `getChatStatus` báo thật.

### Đã xong — Bước 5: lớp LLM + nhận xét tổng kết (29/09/2026)

**Tệp**:

| Tệp | Nội dung |
|---|---|
| `ai/ai.llm.ts` (sửa) | `callLlm(messages, cfg, format?)` — `LlmFormat { name, schema, startMode? }`; bỏ trống = `BOARD_PLAN_FORMAT` (hành vi cũ). `startMode` bắt đầu thang ép JSON giữa chừng |
| `chat/chat.llm.ts` (mới) | Prompt §10.2 (định nghĩa, enum, **15 ví dụ** `PROMPT_EXAMPLES` phủ đủ 7 ý định, câu hỏi trong khung `<<<CAU_HOI … CAU_HOI>>>`, `< >` trong câu hỏi đổi thành `( )`); dòng ngữ cảnh chỉ có mã enum; `LlmBudget` (10 lượt / 60 giây trượt, `reserve`); `callChatLlm` (kiểm cấu hình → ngân sách → gọi từ mức ép JSON đã nhớ → nhớ mức); `requestLlmIntent` (nhánh B1); `mergeParsed` (B2, thuần); `understandHybrid`; `defaultChatLlm` (đọc `env.ai` mỗi lượt, timeout 8 giây); `chatLlmAvailable` |
| `chat/chat.summary.ts` (mới) | `summaryPayload` (toàn bộ dữ liệu gửi LLM ở lượt nhận xét), `buildCommentMessages`, `validateComment` (thuần, §11), `requestSummaryComment` (chừa 3 lượt ngân sách) |
| `chat/chat.service.ts` (sửa) | Bộ hiểu câu mặc định = `understandHybrid`; `ChatContext.llm` tiêm được; nhận xét cho `TEAM_SUMMARY` + focus `NONE` khi `parser ≠ RULE`, chỉ ở `/messages`; `getChatStatus` báo thật |
| `chat/chat.answer.ts`, `chat/chat.rules.ts` (sửa) | `ChatAnswer.comment`, `periodText`; xuất `KEYWORD_TOKENS` / `POST_CUES` để bộ kiểm nhận xét dùng chung dấu hiệu tên với bộ luật |

**Chốt thêm khi code** (đã sửa các mục tương ứng ở trên): luật gộp `member` tính cả "người hỏi tự nhắc mình" (§10.3);
ngân sách đếm theo lượt gọi `callLlm`, nhận xét chừa 3 lượt, nhớ mức ép JSON theo tên lược đồ và khi HTTP 200 (§10.4);
**đổi luật kiểm nhận xét** — luật "trùng tên, so không dấu" loại gần như mọi nhận xét vì tên Việt trùng từ thường
("hoàn thành"/Thành, "công việc"/Công, "tiến độ"/Tiến…) → thay bằng "viết hoa giữa câu" + "đầu câu trùng tên kèm dấu
hiệu" (§11); nhận xét chỉ khi lượt hiểu câu dùng được LLM, không qua `/choice` (§11).

**Test** (fetch giả dùng chung `test/llmFake.ts`, chặn mọi URL ngoài `https://llm.test/`):
- `ai.llm.test.ts` (+1 ca): tên + lược đồ riêng, `startMode` ở từng mức, bỏ trống = lược đồ kế hoạch bảng; **toàn bộ
  15 ca cũ của lớp LLM module sinh bảng vẫn xanh**.
- `chat.llm.test.ts` (9 ca, thuần + fetch giả): prompt đủ enum, ví dụ qua Zod và nằm nguyên văn trong prompt, phần hệ
  thống không phụ thuộc câu hỏi; ngữ cảnh không lộ id người đã chọn; câu hỏi không thoát được khung; bảng luật gộp 12
  dòng; ngân sách (biên đúng 60 giây, lượt bị từ chối không trừ, `reserve`); thành công → 1 request `chat_intent`,
  thân request **không** có tên / id trong danh sách người; **15 kiểu thất bại × 2 nhánh** (thiếu khoá, hết ngân sách —
  không gọi mạng —, 429, 401, 500, quá giờ, mất mạng, không phải JSON, rỗng, 5 kiểu sai hình dạng) → nguyên kết quả bộ
  luật; nhớ mức ép JSON; `chatLlmAvailable` trùng `isLlmAvailable` trên 8 tổ hợp.
- `chat.summary.test.ts` (7 ca): dữ liệu gửi đi đúng 6 con số + nhãn; 10 nhận xét hợp lệ được giữ dù nhóm có Thành,
  Công, Tiến, Trung, Mai, An, "Trưởng Nhóm"; **41 ca loại**, mỗi ca vi phạm đúng một luật; tính chất trên 400 bộ số
  ngẫu nhiên (đúng số thì qua, đổi một số / chèn tên thì bị loại); chừa ngân sách.
- `chat.llm.api.test.ts` (5 ca, CSDL thật): thẻ có tiêu đề **chèn lệnh** + mô tả, tên bảng / danh sách / không gian, tên /
  email / id thành viên **không** xuất hiện trong bất kỳ request nào gửi LLM (trong khi câu trả lời vẫn có thẻ đó); số
  liệu gửi LLM = đúng con số của câu trả lời; nhận xét bị loại → câu trả lời **y hệt** chế độ cơ bản; LLM lỗi (500 /
  429 / sai JSON) → y hệt chế độ cơ bản và không gọi nhận xét; `/choice`, `/more` không gọi LLM; không log nội dung;
  HTTP `/status` báo đúng theo `env.ai` và không lộ khoá.
- `chat.guard.test.ts`: chỉ `chat.llm` gọi `callLlm`; `chat.llm` / `chat.summary` không kéo CSDL / phạm vi / truy vấn
  (bộ đánh giá bước 7 chạy không cần DB).

**Cài lỗi**: 72 phép (5 `callLlm`, 30 `chat.llm`, 26 `chat.summary`, 10 nối vào dịch vụ, 1 nhãn kỳ) → lần đầu lọt 1 (V10:
tắt nhận xét ở nhánh "phạm vi cá nhân, chỉ có **một** workspace thì dùng luôn" — mọi người dùng thử đều có ≥ 2 workspace
vì tài khoản nào cũng có workspace cá nhân) → thêm ca người chỉ thuộc một workspace → **72/72**. Trước khi chạy đã tự soát
ra 2 chỗ test yếu (đếm 300 ký tự bằng chữ `ệ` — 1 đơn vị UTF-16 nên không phân biệt `length` với số ký tự → đổi sang emoji;
chưa có ca nhãn kỳ khác "tuần này") và gỡ một nhánh chết trong luật tên đầu câu (từ kế tiếp viết hoa đã bị luật "viết hoa
giữa câu" chặn trước).

**Toàn bộ test backend**: 106 tệp / 1178 test xanh (thêm 23); `tsc`, `eslint` sạch. Container `taskflow-backend` **chưa**
khởi động lại — lần khởi động tới, chatbot sẽ gọi LLM bằng khoá đang có trong `backend/.env`.

**Bài học**:
- Luật an toàn viết trên giấy cần thử với **dữ liệu thật của người Việt** trước khi code: luật "trùng tên" đọc thì hợp lý
  nhưng với danh sách tên thật thì gần như luôn kích hoạt — một bộ lọc luôn từ chối thì tương đương tắt tính năng.
- "Nhớ mức ép JSON khi thất bại?" phải tách hai loại thất bại: nhà cung cấp **từ chối định dạng** (HTTP 400) khác với
  **mô hình trả sai hình dạng** (HTTP 200) — test đầu tiên của tôi kỳ vọng sai ở điểm này.

### Đã xong — Bước 6: giao diện (29/09/2026)

**Tệp mới** (`frontend/src/`):

| Tệp | Nội dung |
|---|---|
| `types/chat.ts` | Kiểu của hợp đồng API §12 |
| `lib/api/chat.ts` | `fetchChatStatus`, `sendChatMessage`, `sendChatChoice`, `fetchMoreAnswer` — chỉ gửi câu hỏi, phạm vi, mã hội thoại (`conversationId` rỗng thì không gửi khoá) |
| `lib/chatText.ts` | Hàm thuần: dòng "Trợ lý hiểu là", phạm vi mặc định theo đường dẫn, liên kết thẻ, giờ **Việt Nam**, gộp trang "Xem thêm" (bỏ thẻ trùng), thông điệp lỗi có dấu theo mã HTTP (404 ở `/choice`, `/more` = hội thoại hết hạn) |
| `context/AssistantContext.tsx` | Hội thoại (các lượt, mã hội thoại, phạm vi, trạng thái AI); đặt ở `ProtectedRoute` trên mọi layout; chưa mở panel thì không gọi API |
| `components/assistant/AssistantButton.tsx` | Nút "Trợ lý" (`aria-expanded`) |
| `components/assistant/AssistantPanel.tsx` | Panel portal ra body; "Chế độ cơ bản"; câu hỏi nhanh; ô nhập 500 ký tự; dòng thông báo dữ liệu gửi AI |
| `components/assistant/ScopePicker.tsx` | Việc của tôi / Không gian (+ chọn không gian) / Bảng |
| `components/assistant/AnswerView.tsx` | Một lượt hỏi – đáp: số liệu, thẻ (trạng thái, hạn / quá hạn, checklist x/y, người nhận, nhãn lý do), danh sách phụ, bảng theo người (cột quản lý chỉ khi server gửi), nhận xét AI ô riêng, nút hỏi lại, gợi ý |

**Sửa**: `routes/ProtectedRoute.tsx` (gắn provider + panel), `components/Header.tsx` (nút giữa "Tạo mới" và chuông —
**chỉ commit dòng của bước này**, 2 dòng phiên khác đang sửa dở trong tệp này không vào commit),
`components/board/darkMode.test.ts` (quét cả `components/assistant/` + luật "mỗi đoạn class có `bg-white` tự mang
`dark:bg-`" cho panel); backend `chat.answer.ts` (câu gợi ý, xem dưới).

**Test** (frontend, 4 tệp mới + 1 mở rộng): `lib/api/chat.test.ts` (4), `lib/chatText.test.ts` (7),
`components/assistant/AssistantPanel.test.tsx` (16 — mở/đóng, Esc trong/ngoài panel và khi có modal khác, phạm vi
mặc định theo 3 loại trang + giữ phạm vi ở câu sau, tự chọn / đổi không gian, đang tải / kết quả đầy đủ / rỗng / lỗi
429 · 403 · mất mạng, Enter / Shift+Enter / IME, câu hỏi nhanh + gợi ý, hỏi lại chọn người / chọn không gian, hỏi lại khi
hội thoại hết hạn, "Xem thêm" (nối trang, chỉ lượt mới nhất, 404, người đã rời), bảng theo người trưởng nhóm / thành
viên, nhận xét AI, bấm liên kết thẻ **đổi layout** mà hội thoại + phạm vi còn nguyên), `wiring.test.tsx` (4 —
`ProtectedRoute` thật gắn trợ lý, chưa đăng nhập thì không có, thứ tự lớp z, vị trí nút trên Header). Backend
`chat.answer.test.ts` +1: **mọi câu gợi ý và câu hỏi nhanh** đi qua bộ luật + câu nối tiếp ra đúng truy vấn nó hứa.
Toàn bộ frontend: 38 tệp / 287 test xanh (trước bước: 34 / 254); `tsc -b` sạch. Toàn bộ backend: 106 tệp / 1179 test xanh.

**Cài lỗi** (frontend): 73 phép → lần đầu lọt 6: T15 (bỏ `hourCycle: 'h23'` — Node vốn in 24 giờ với `en-GB`,
**tương đương** ở môi trường test; giữ vì có trình duyệt in "24:00"), X16 (lấy `page` từ server thay vì `1` —
**tương đương**, câu trả lời mới luôn là trang 1), và 4 lỗ thật của test → thêm ca → bắt được: N9 (Enter với ô toàn
khoảng trắng), N11 (đang chờ trả lời mà gõ tiếp thì nút Gửi phải khoá), S6 (đã sang "Không gian" ở trang bảng vẫn
quay lại "Bảng" được), D1 (test chế độ tối chỉ xét **cả tệp** nên lọt đoạn class thiếu nền tối). **71/73**, 2 tương đương.
Hai chỗ sửa sau khi thử trình duyệt (bỏ focus liên kết, luật `aria-modal`) được kiểm bằng cài lỗi tay: gỡ ra thì test đỏ.

**Thử trên trình duyệt thật** (Vite dev + backend Docker đang chạy mã bước 4 — `llmAvailable: false`, **không** gọi
Gemini; tài khoản / nhóm / bảng / 20 thẻ thử `chat-demo-*@test.local` tạo bằng script tạm, **đã xoá hết** sau khi thử):
đủ 4 nhóm câu hỏi (việc cá nhân + "Xem thêm" 13 thẻ không trùng; ưu tiên + "Cần gỡ chặn"; tổng kết nhóm qua hỏi lại chọn
không gian; bảng theo người có cột trưởng nhóm), hỏi lại trùng tên "Lan", bấm liên kết thẻ từ trang chủ sang trang bảng
(đổi layout — hội thoại 7 lượt còn nguyên, thẻ mở đè lên panel), khổ 375px chế độ tối (panel rộng hết, không cuộn ngang),
đăng xuất thì panel + hội thoại mất theo. Mọi yêu cầu `/api/chat/*` đều 200.

**Lỗi thật tìm ra khi thử trình duyệt (đã sửa, có test)**:
1. **Esc đóng nhầm panel thay vì thẻ**: bấm liên kết thẻ trong panel → thẻ mở đè lên nhưng con trỏ còn ở liên kết trong
   panel → Esc đóng panel, thẻ vẫn mở (CardModal nghe Esc ở `document`, panel đã chặn sự kiện). Sửa: bấm liên kết thì bỏ
   focus; panel bỏ qua Esc khi có hộp thoại `aria-modal="true"` khác đang mở.
2. **Panel che menu tài khoản / "Tạo mới"**: cùng `z-40`, panel vẽ sau nên nằm trên → không bấm được "Đăng xuất" khi panel
   mở. Sửa: panel `z-[35]` (§13), test canh thứ tự lớp.
3. **Câu gợi ý tự phá câu nối tiếp** (backend): nút "Còn việc quá hạn thì sao?" sau câu hỏi về Trần Lan bị bộ luật hiểu là
   "việc **của bạn** quá hạn" — "việc" là từ chỉ việc nên luật 4 (§10.1) không coi là câu nối tiếp → mất người đang hỏi.
   Sửa câu gợi ý thành "Còn quá hạn thì sao?"; bỏ "Việc nào chưa giao?" (chưa có danh sách thẻ chưa giao, chỉ ra bản tổng
   kết) thay bằng "Nhóm có việc nào bị chặn?"; test mọi câu gợi ý + câu hỏi nhanh. (Máy chủ Docker vẫn chạy mã cũ nên
   bản sửa này chưa thấy trên trình duyệt cho tới khi khởi động lại container.)

**Bài học**:
- Ba lỗi trên đều **không** lộ ra ở test đơn vị vì chúng nằm ở chỗ ghép hai phần: lớp z của hai thành phần khác nhau,
  focus giữa panel và modal của trang bảng, câu chữ của tầng trả lời đi ngược vào tầng hiểu câu. Thử trên trình duyệt thật
  là bước không thay được — và mỗi lỗi tìm ra phải thành một test (đã làm) để không quay lại.
- Câu gợi ý là **đầu vào** của hệ thống, không chỉ là chữ hiển thị: mọi chuỗi hệ thống tự đưa cho người dùng bấm phải đi
  qua đúng đường người dùng gõ.
