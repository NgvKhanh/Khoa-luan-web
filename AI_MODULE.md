# Module AI — Sinh bảng công việc từ mô tả ngôn ngữ tự nhiên

> Tài liệu thiết kế (bước 0). Chưa có code. Mục đích: chốt kiến trúc, IR, thuật
> toán và phạm vi trước khi hiện thực, để phần này đứng được thành một chương
> riêng trong khoá luận.

---

## 1. Bài toán

**Đầu vào**: một đoạn mô tả công việc bằng tiếng Việt tự do, ví dụ

> *"Tổ chức hội thảo khoa học cấp khoa vào 15/11. Cần chuẩn bị nội dung báo cáo,
> mời 3 diễn giả, lo hậu cần phòng ốc và làm truyền thông trước 2 tuần. Nhóm có
> 4 người."*

**Đầu ra**: một bảng TaskFlow hoàn chỉnh — danh sách (cột) hợp lý, các thẻ công
việc trong từng cột, nhãn, checklist, và **ngày bắt đầu / hạn chót đã được tính
toán** cho từng thẻ sao cho toàn bộ kế hoạch kết thúc trước 15/11.

**Không phải là**: một chatbot. Người dùng nhập một lần, xem trước, sửa, rồi tạo.

---

## 2. Hướng tiếp cận: LAI (hybrid)

Đã cân nhắc 3 hướng:

| Hướng | Ưu | Nhược | Kết luận |
|---|---|---|---|
| NER/rule thuần (PhoBERT, XLM-R) | Đúng chất nghiên cứu, có P/R/F1 | Phải tự gán nhãn dataset; không *suy luận* được việc cần làm | Dùng làm **baseline để so sánh**, không làm hệ chính |
| LLM thuần (structured output) | Chất lượng cao, nhanh | Đóng góp nghiên cứu mỏng; LLM tính ngày sai nhiều | Không đủ cho khoá luận |
| **LAI** ⭐ | Chất lượng cao + có phần thuật toán tự viết để báo cáo & kiểm thử | Phức tạp hơn | **Chọn** |

### Nguyên tắc phân vai

> **LLM lo phần "nghĩ ra việc gì cần làm".**
> **Code tự viết lo phần "việc đó rơi vào ngày nào, hợp lệ không, ghi vào đâu".**

Cụ thể, LLM **không** được phép:

- tự tính ngày tuyệt đối (nó chỉ trả số ngày tương đối — xem §4),
- tự quyết id, position, hay màu hex tuỳ ý ngoài bảng màu cho phép,
- ghi bất cứ thứ gì thẳng vào cơ sở dữ liệu.

Bốn lớp do ta tự viết — đây là **phần đóng góp** của khoá luận:

1. **IR có ràng buộc (`BoardPlan`)** — ngôn ngữ trung gian giữa LLM và CSDL.
2. **Bộ trích xuất thời gian tiếng Việt (rule-based)** — "trong 3 tuần", "trước
   20/10", "cuối tháng sau", "mỗi thứ 2".
3. **Thuật toán phân bổ hạn (scheduling)** — từ 1 deadline tổng chia ngày cho
   từng thẻ, tôn trọng phụ thuộc.
4. **Lớp Validate & Repair** — kiểm tra, vá, chấp nhận hoặc từ chối đầu ra LLM.

---

## 3. Kiến trúc pipeline

```
[1] NHẬP LIỆU
    - text tự do (bắt buộc)
    - tuỳ chọn: ngày bắt đầu, hạn chót, số thành viên, workspace đích
    - tuỳ chọn (v1.5): file .docx / .pdf mô tả kế hoạch
                    |
[2] TIỀN XỬ LÝ
    - chuẩn hoá khoảng trắng, tách câu
    - gắn ngữ cảnh "hôm nay = <ngày hệ thống>"   <- để LLM không tự bịa ngày
                    |
[3] TRÍCH XUẤT — 2 nhánh song song
    |- Nhánh LLM (Claude, structured output theo Zod schema)
    |     -> sinh cấu trúc: tên bảng, cột, thẻ, nhãn, checklist, độ nặng
    |- Nhánh RULE (regex + từ điển tiếng Việt)
          -> mọi mốc thời gian, số lượng, tên người xuất hiện trong text
          -> dùng làm "sự thật nền" (ground truth), ghi đè LLM khi mâu thuẫn
                    |
[4] BoardPlan (IR) — JSON, validate bằng Zod
                    |
[5] HẬU XỬ LÝ (deterministic, không gọi AI)
    - Resolver ngày: offset tương đối -> ngày thật
    - Scheduler:     topological sort + forward pass + nén nếu tràn hạn
    - Chuẩn hoá:     khử trùng lặp, ép <= MAX_LISTS / MAX_CARDS, ép màu hợp lệ
                    |
[6] MÀN HÌNH XEM TRƯỚC   <- BẮT BUỘC, không tự động tạo bảng
    người dùng thấy bảng sắp tạo + danh sách "giả định của AI",
    sửa / xoá / thêm, rồi mới bấm "Tạo bảng"
                    |
[7] ÁP DỤNG — 1 transaction Prisma
    tạo Board + List + Card + Label + Checklist
    + logActivity + emit socket board:lists-changed
```

### Vì sao bắt buộc có bước [6]

- **Kỹ thuật**: LLM có thể ảo giác; người dùng là lớp kiểm duyệt cuối.
- **Trải nghiệm**: người dùng thấy mình *kiểm soát* chứ không bị AI áp đặt.
- **Nghiên cứu**: lượng chỉnh sửa ở bước này chính là **số liệu đo chất lượng**
  (xem §9) — không có bước xem trước thì không có gì để đo.

---

## 4. IR — `BoardPlan`

Đây là phần lõi, đáng đầu tư nhất. LLM chỉ được trả về đúng cấu trúc này.

```jsonc
{
  "board": {
    "name": "Hội thảo khoa học cấp khoa 2026",
    "colorKey": "green",                  // chọn từ bảng màu cố định, không tự bịa hex
    "backgroundQuery": "conference hall"  // từ khoá lấy ảnh Unsplash (module đã có)
  },

  "labels": [
    { "key": "high",      "name": "Ưu tiên cao", "colorKey": "red" },
    { "key": "logistics", "name": "Hậu cần",     "colorKey": "yellow" }
  ],

  "lists": [
    {
      "name": "Chuẩn bị nội dung",
      "cards": [
        {
          "ref": "c1",                          // id cục bộ, dùng cho dependsOn
          "title": "Chốt chủ đề và chương trình hội thảo",
          "description": "...",
          "labelKeys": ["high"],
          "checklist": ["Họp ban tổ chức", "Gửi bản nháp chương trình"],
          "startOffsetDays": 0,                 // <- TƯƠNG ĐỐI, không phải ngày thật
          "durationDays": 5,
          "weight": 3,                          // độ nặng, dùng khi phải nén lịch
          "dependsOn": []
        },
        {
          "ref": "c2",
          "title": "Mời diễn giả",
          "startOffsetDays": 3,
          "durationDays": 10,
          "dependsOn": ["c1"]
        }
      ]
    }
  ],

  "anchors": {                        // do nhánh RULE trích, KHÔNG do LLM
    "startDate": "2026-09-13",
    "deadline":  "2026-11-15"
  },

  "assumptions": [
    "Giả định dự án bắt đầu từ hôm nay 13/09/2026",
    "Không tìm thấy thông tin ngân sách nên không tạo cột chi phí"
  ],

  "confidence": 0.84
}
```

### Ba quyết định thiết kế quan trọng

**(a) Offset tương đối thay vì ngày tuyệt đối.**
LLM trả `startOffsetDays` / `durationDays`; backend tính ngày thật. Lý do: mô
hình ngôn ngữ làm số học ngày tháng rất kém (nhầm tháng, nhầm năm, nhầm số ngày
trong tháng). Tách việc này ra code thuần loại bỏ gần như toàn bộ lớp lỗi đó, và
**kiểm thử được bằng unit test**.

**(b) `ref` + `dependsOn` thay vì tham chiếu theo tiêu đề.**
Tham chiếu theo tiêu đề rất dễ lệch (LLM viết lại tiêu đề khác một chữ). Dùng id
cục bộ `c1`, `c2`… Backend resolve, phát hiện chu trình, cắt cạnh gây chu trình
và ghi lý do vào `assumptions`.

**(c) `assumptions` là công dân hạng nhất, hiển thị cho người dùng.**
Người dùng thấy AI đã giả định gì thì tin tưởng hơn và sửa đúng chỗ. Đây cũng là
cách xử lý "thông tin thiếu" một cách trung thực thay vì im lặng bịa ra.

### Ràng buộc cứng (do Zod + code kiểm, không nhờ LLM tự giác)

| Ràng buộc | Giá trị |
|---|---|
| Số cột | 2 – 8 |
| Số thẻ / cột | 0 – 15 |
| Tổng số thẻ | ≤ 60 |
| Độ dài tiêu đề thẻ | 3 – 120 ký tự |
| Số nhãn | 0 – 8 |
| Số mục checklist / thẻ | 0 – 10 |
| `colorKey` | chỉ trong bảng màu định sẵn |
| `durationDays` | 1 – 180 |
| `dependsOn` | chỉ trỏ tới `ref` đã tồn tại, không tạo chu trình |

---

## 5. Thuật toán phân bổ hạn (Scheduler)

Phần thuần thuật toán, không gọi AI, **test được 100%** bằng vitest.

**Đầu vào**: `startDate`, `deadline?`, danh sách thẻ có `startOffsetDays`,
`durationDays`, `weight`, `dependsOn`.

```
B1. Xây đồ thị phụ thuộc; topological sort (Kahn).
    Nếu phát hiện chu trình -> cắt cạnh quay lui, ghi vào assumptions.

B2. Forward pass:
    earliestStart(c) = max( startOffsetDays(c),
                            max{ finish(p) | p thuộc dependsOn(c) } )
    finish(c)        = earliestStart(c) + durationDays(c)

B3. span = max{ finish(c) }        // tổng số ngày kế hoạch cần

B4. Nếu có deadline:
        available = số ngày làm việc từ startDate đến deadline
        nếu span > available:
            scale = available / span
            nén mọi durationDays theo scale, tối thiểu 1 ngày
            (ưu tiên giữ nguyên thẻ có weight cao)
            đánh dấu cảnh báo "Lịch quá chặt so với hạn chót"
    Nếu không có deadline:
        giữ nguyên span; deadline suy ra = startDate + span

B5. Ánh xạ số ngày -> ngày thật:
        bỏ qua T7/CN (tuỳ chọn workingDaysOnly)
        hạn rơi vào cuối tuần -> đẩy về thứ 6 liền trước

B6. Gán Card.startDate / Card.dueDate.
```

**Các ca biên bắt buộc có test**: chu trình phụ thuộc; deadline trong quá khứ;
deadline quá gần (nén cực đại); không có deadline; `durationDays` bằng 0; toàn bộ
thẻ độc lập; chuỗi phụ thuộc tuyến tính dài.

---

## 6. Bộ trích xuất thời gian tiếng Việt (Rule-based)

Chạy song song với LLM, kết quả **ghi đè** LLM khi mâu thuẫn (LLM hay đọc sai ngày).

| Mẫu | Ví dụ | Kết quả |
|---|---|---|
| Ngày tuyệt đối | `15/11`, `15-11-2026`, `ngày 15 tháng 11` | Date (thiếu năm → suy ra năm gần nhất trong tương lai) |
| Trước mốc | `trước 20/10`, `hạn chót 30/11`, `deadline 1/12` | deadline |
| Khoảng tương đối | `trong 3 tuần`, `sau 10 ngày`, `trong vòng 2 tháng` | deadline = hôm nay + N |
| Mốc mờ | `cuối tháng sau`, `đầu tuần tới`, `cuối năm` | Date xấp xỉ + ghi vào `assumptions` |
| Định kỳ | `mỗi thứ 2`, `hằng tuần`, `hàng tháng` | gợi ý `RecurringCardSchedule` (v2) |
| Số lượng | `3 diễn giả`, `nhóm 4 người` | gợi ý số thẻ / số thành viên |

Mỗi mẫu có unit test riêng → đây là bảng số liệu P/R đưa thẳng vào báo cáo.

---

## 7. Lớp gọi LLM

### Lựa chọn mô hình

- **Provider**: Claude API (`@anthropic-ai/sdk`), mô hình `claude-opus-5`.
- **Cơ chế ép định dạng**: `client.messages.parse()` + `zodOutputFormat(schema)`
  — dùng **chính Zod schema của `BoardPlan`** làm ràng buộc đầu ra. Không parse
  JSON bằng tay, không bóc khối code bằng regex.
- Dự án đã dùng Zod 4 nên schema được **tái sử dụng cho cả hai vai trò**: ép LLM
  và validate ở backend. Đây là một điểm thiết kế gọn, đáng nêu trong báo cáo.
- Cần xác nhận khi hiện thực: `zodOutputFormat` tương thích Zod 4 ở phiên bản SDK
  cài đặt (nếu không thì dùng JSON Schema thuần, giữ nguyên toàn bộ kiến trúc).

### Cấu hình (theo đúng khuôn Unsplash / Google đã có trong `env.ts`)

```
AI_PROVIDER=anthropic          # để ngỏ cho việc thêm provider khác
ANTHROPIC_API_KEY=             # để trống -> toàn bộ /api/ai trả 503, app vẫn chạy
AI_MODEL=claude-opus-5
AI_MAX_CARDS=60
AI_TIMEOUT_MS=60000
```

Để trống key → endpoint trả 503 kèm thông báo tiếng Việt, frontend ẩn nút "Tạo
bằng AI". Hội đồng chạy thử không có key vẫn không bị vỡ ứng dụng.

### Chống lạm dụng

- `express-rate-limit` (đã có sẵn trong dependencies): giới hạn N lần sinh /
  người dùng / giờ.
- Giới hạn độ dài input (ví dụ 4000 ký tự) trước khi gửi đi.
- Text người dùng luôn được bọc trong một khối dữ liệu rõ ràng trong prompt, và
  mọi đầu ra đều phải qua Zod → **prompt injection không thể leo thang** thành
  hành động trên CSDL, vì LLM không hề có quyền ghi.

---

## 8. Thay đổi cần thêm vào schema

```prisma
enum AiGenerationKind {
  BOARD_PLAN
  NL_QUERY
}

model AiGeneration {
  id           String           @id @default(cuid())
  userId       String
  workspaceId  String
  boardId      String?          // null = người dùng xem trước rồi huỷ
  kind         AiGenerationKind
  inputText    String
  plan         Json             // BoardPlan IR: audit + hoàn tác + đo đạc
  provider     String
  model        String
  inputTokens  Int?
  outputTokens Int?
  latencyMs    Int?
  accepted     Boolean          @default(false)
  editCount    Int?             // số thay đổi người dùng thực hiện ở màn xem trước
  createdAt    DateTime         @default(now())

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  board     Board?    @relation(fields: [boardId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([createdAt])
}
```

`accepted` + `editCount` chính là dữ liệu thực nghiệm ở §9 — thu tự động từ
người dùng thật, không phải khảo sát thủ công.

---

## 9. Đánh giá (chương thực nghiệm)

| Nhóm | Chỉ số | Cách đo |
|---|---|---|
| Tính hợp lệ | % đầu ra hợp schema ngay lần đầu | đếm số lần phải Repair |
| Trích xuất | P / R / F1 cho thực thể thời hạn, số lượng, người | so với ~100 mô tả gán nhãn tay |
| Chất lượng cấu trúc | Likert 1–5 về độ hợp lý của cột & thẻ | 5–10 người chấm mù |
| Độ chính xác ngày | % thẻ có hạn nằm trong khoảng kỳ vọng | đối chiếu đáp án tay |
| Tỉ lệ chấp nhận | % bảng được tạo mà không sửa gì | cột `accepted` + `editCount` |
| Hiệu quả | thời gian tạo bảng thủ công vs bằng AI | đo trên ~10 người |
| So sánh | LAI vs baseline rule/NER thuần | chạy cùng bộ 100 mô tả |

Bộ dữ liệu thử: ~100 mô tả công việc tiếng Việt thuộc 5 miền (học tập, sự kiện,
phát triển phần mềm, marketing, cá nhân), tự soạn + thu từ bạn học.

---

## 10. Phạm vi theo phiên bản

### v1 — lõi (làm trước)
- Nhập mô tả text → sinh Board + List + Card
- Nhãn (Label) + Checklist
- Ngày bắt đầu / hạn chót tính bằng Scheduler
- Ảnh nền bảng qua module Unsplash đã có
- Màn hình xem trước cho phép sửa trước khi tạo
- Ghi `AiGeneration` + Activity + emit socket

### v1.5 — đầu vào từ file
- Upload `.docx` / `.pdf`, trích text làm đầu vào (thêm `mammoth` + `pdf-parse`)

### v2 — mở rộng
- Gán file người dùng upload kèm prompt vào đúng thẻ AI sinh ra
- Tìm kiếm bằng ngôn ngữ tự nhiên: text → `SearchCardsQuery` (tái dùng
  `search.service.ts`, **không sinh SQL**)

### v3 — nếu còn thời gian
- Gợi ý `AutomationRule` từ mô tả
- Sinh `CustomField` (suy luận kiểu trường)
- Gợi ý `RecurringCardSchedule` từ cụm "mỗi thứ 2", "hằng tuần"

**Cố ý loại khỏi mọi phiên bản**: AI tự sinh nội dung file đính kèm (tài liệu
mẫu, .md). Phạm vi lớn, giá trị demo thấp.

---

## 11. Lộ trình hiện thực

| Bước | Nội dung | Cần API key? |
|---|---|---|
| 0 | Tài liệu này | ✗ |
| 1 | Zod schema `BoardPlan` + bộ dữ liệu mẫu | ✗ |
| 2 | Bộ trích xuất thời gian tiếng Việt + unit test | ✗ |
| 3 | Scheduler + unit test | ✗ |
| 4 | Lớp provider LLM + prompt + structured output | ✓ |
| 5 | Validate/Repair + `POST /api/ai/board-plan` (chỉ sinh IR) | ✓ |
| 6 | `POST /api/ai/board-plan/apply` (transaction + activity + socket) | ✗ |
| 7 | Frontend: modal nhập mô tả + màn hình xem trước | ✓ |
| 8 | Đầu vào từ file .docx / .pdf | ✓ |
| 9 | Tìm kiếm bằng ngôn ngữ tự nhiên | ✓ |
| 10 | Thu thập số liệu + viết chương đánh giá | ✓ |

Bước 1–3 và 6 **không cần API key**, làm được ngay và đã đủ nội dung cho một
chương báo cáo độc lập.

---

## 12. Cấu trúc file dự kiến

```
backend/src/modules/ai/
  ai.routes.ts              # POST /api/ai/board-plan, /apply
  ai.controller.ts
  boardPlan.schema.ts       # Zod: BoardPlan IR  <- lõi, dùng cho cả LLM lẫn validate
  boardPlan.service.ts      # điều phối pipeline
  boardPlan.apply.ts        # bước [7]: transaction ghi vào CSDL
  llm.provider.ts           # bọc @anthropic-ai/sdk, timeout, retry, đếm token
  llm.prompt.ts             # system prompt + few-shot
  extract.datetime.ts       # bộ trích xuất thời gian tiếng Việt (rule)
  extract.quantity.ts       # số lượng, số người
  scheduler.ts              # thuật toán phân bổ hạn
  repair.ts                 # vá đầu ra không hợp lệ

backend/test/
  ai.extractDatetime.test.ts
  ai.scheduler.test.ts
  ai.boardPlan.test.ts      # dùng IR mẫu cố định, không gọi API thật

frontend/src/components/ai/
  AiGenerateBoardDialog.tsx # nhập mô tả
  AiBoardPreview.tsx        # màn hình xem trước, sửa được
  AiAssumptionsList.tsx     # hiển thị giả định của AI
```
