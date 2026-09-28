# Module Chatbot — Trợ lý công việc TaskFlow (bản đầu)

> Module AI thứ ba của khoá luận, sau module sinh bảng (`AI_MODULE.md`) và
> module gợi ý phân công (`ASSIGN_MODULE.md`). Ý tưởng gốc ở `CHATBOT_PLAN.md`
> (giữ nguyên, không sửa); tài liệu này là **hợp đồng** để hiện thực: mọi định
> nghĩa, con số và quy tắc ở đây là chuẩn mà code và test phải khớp. Đổi hợp
> đồng thì sửa tài liệu này trước, ghi lý do vào nhật ký cuối file.
>
> Trạng thái: **xong bước 0–1** (tài liệu hợp đồng + lõi thuần: ý định/tham số, khoảng thời
> gian, so khớp tên, bộ luật B0, câu nối tiếp). Chưa có API, CSDL hay LLM. Lộ trình ở §17,
> nhật ký cuối file.

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
| `MY_PRIORITIES` | quá hạn / hạn hôm nay / hạn trong 3 ngày / bị chặn | việc đang mở **không** bị chặn, kèm nhãn lý do (§6.6) | "Cần gỡ chặn" (thẻ `BLOCKED`) |
| `MEMBER_TASKS` + `NONE` | đang mở; quá hạn; hoàn thành trong kỳ | thẻ đang mở của người đó (không lọc ngày) | đã xong trong kỳ (mặc định tuần này; kỳ tương lai → tuần này) |
| `MEMBER_TASKS` + focus X | tổng khớp | thẻ của người đó khớp X | — |
| `TEAM_SUMMARY` + `NONE` | hoàn thành trong kỳ; đang mở; quá hạn; bị chặn; chưa giao chưa xong | — | đã hoàn thành; quá hạn; bị chặn |
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
  đúng workspace đó; người chưa có hồ sơ → "mặc định".

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
thành viên). Quyền của workspace A không bao giờ dùng để xem workspace B.

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
- `BOARD(id)`: chủ bảng + BoardMember hiện tại + (nếu bảng `WORKSPACE`) thành viên workspace.
- Danh sách này **chỉ ở server**, là tham số đầu vào của bộ luật và bộ nhận diện;
  **không** gửi cho LLM.

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
     câu); từ xưng hô đứng một mình ("anh ấy" không phải tên "Tuấn Anh").
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
- Chỉ lưu: ý định, tham số, phạm vi, `userId` người đã chọn, câu hỏi lại đang chờ
  (nếu có). **Không** lưu câu hỏi gốc, dữ liệu thẻ hay vai trò.
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
| `member` | **Luật** nếu luật khớp được người trong danh sách, ngược lại chuỗi của LLM | Chỉ bộ luật nhìn thấy danh sách người |

Sau gộp → `applyFollowUp` (§9.2) → nhận diện người (§8). Thứ tự này giống nhau ở cả ba nhánh.

### 10.4 Giới hạn gọi LLM

- **Ngân sách chung toàn tiến trình**: 10 lượt gọi / 60 giây trượt (khoá API dùng chung
  với module sinh bảng; gói free đo được bắt đầu 429 quanh 15 lượt/phút). Hết ngân
  sách → dùng bộ luật, **không** trả 429 cho người dùng. Nhận xét §11 cũng tính vào
  ngân sách và bị bỏ trước tiên khi thiếu.
- Nhớ **mức ép JSON** nhà cung cấp đã chấp nhận (`formatMode` trong `LlmResult`) để
  lượt sau bắt đầu từ mức đó, không tốn 3 request mỗi lượt. Cần thêm tuỳ chọn cho
  `callLlm` (bước 5): `format { name, schema, startMode? }`, mặc định giữ nguyên hành
  vi cũ (lược đồ kế hoạch bảng, bắt đầu từ `json_schema`).
- Giới hạn theo người: `chatLimiter` **60 lượt POST / 10 phút** (gồm cả `/more`, `/choice`).

## 11. Nhận xét AI cho tổng kết nhóm

Chỉ khi `TEAM_SUMMARY` + focus `NONE`, LLM sẵn sàng và còn ngân sách.

- **Đầu vào** (JSON): nhãn kỳ ("tuần này"), loại phạm vi (workspace/bảng), và các con
  số của §6.4. **Không** tên người, tên bảng, tiêu đề thẻ.
- **Đầu ra**: lược đồ `{ "comment": string }`, tối đa 300 ký tự, 2–3 câu, giọng trung tính.
- **Kiểm tra trước khi hiện** (vi phạm bất kỳ → bỏ nhận xét, câu trả lời vẫn đủ số liệu):
  - chứa chữ số không có trong tập số đã gửi;
  - chứa số viết bằng chữ (một…mười, chục, trăm, nghìn) hoặc ký hiệu `%`;
  - chứa một từ trùng tên người trong danh sách người (so nguyên từ, không dấu — chấp
    nhận loại nhầm, ví dụ "an toàn" với người tên An);
  - chứa liên kết, markdown, hoặc dài quá 300 ký tự.
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
| 400 | Sai định dạng (Zod); `userId`/`workspaceId` ở `/choice` không thuộc lựa chọn đang chờ |
| 401 | Chưa đăng nhập |
| 403 | Không phải thành viên workspace; bảng chỉ xem được vì PUBLIC |
| 404 | Không tìm thấy workspace/bảng; `/more` hoặc `/choice` với hội thoại không còn / không phải của mình (cùng một thông điệp) |
| 429 | Vượt `chatLimiter` |

## 13. Giao diện (tóm tắt hợp đồng)

- Nút **Trợ lý** trên Header (giữa "Tạo mới" và chuông thông báo), mở panel bên phải
  qua portal; hội thoại giữ ở provider cấp `ProtectedRoute` nên **không mất** khi bấm
  liên kết thẻ chuyển từ trang chủ sang trang bảng.
- Bộ chọn phạm vi **Việc của tôi / Workspace / Bảng**; mặc định theo trang đang mở
  (trang bảng → Bảng; `/workspaces/:id` → Workspace; còn lại → Việc của tôi). Đổi phạm vi
  giữa hội thoại → lượt sau không kế thừa ngữ cảnh.
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
| 2 | Phạm vi (`chat.scope`): bảng đọc được, danh sách người lấy từ CSDL, trưởng nhóm + test CSDL phân quyền và nhận diện tên trên dữ liệu thật | chưa |
| 3 | Truy vấn, nhãn ưu tiên, dựng câu trả lời + test đối chiếu số liệu, > 200 thẻ | chưa |
| 4 | Phiên, dịch vụ, API, `chatLimiter` — chạy trọn vẹn **không cần LLM** | chưa |
| 5 | Lớp LLM (tham số `format` cho `callLlm`, luật gộp, ngân sách) + nhận xét tổng kết | chưa |
| 6 | Giao diện: nút Trợ lý, panel, bộ chọn phạm vi, hiển thị câu trả lời | chưa |
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

**Bước 2 cần**: `chat.scope.ts` (bảng đọc được, danh sách người lấy từ CSDL, trưởng nhóm) + test CSDL;
chạy lại bảng từ dễ nhầm tên với danh sách người lấy từ CSDL thật.
