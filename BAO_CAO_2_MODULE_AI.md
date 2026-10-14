# Tổng hợp hai module AI của khoá luận TaskFlow

> Bản tổng hợp để **đi báo cáo** — gom từ `AI_MODULE.md`, `ASSIGN_MODULE.md`,
> `backend/eval-assign-result.md`, `backend/eval-assign-sweeps.md`,
> `backend/eval-plan-result.md` và mã nguồn thật.
> Mọi con số trong tài liệu này đều lấy từ các lần chạy đã ghi nhật ký, không ước lượng.
> Ngày tổng hợp: **23/09/2026**.

**Mục lục**

- [0. Nói trong 90 giây](#0-nói-trong-90-giây)
- [1. Tổng quan hai module](#1-tổng-quan-hai-module)
- [PHẦN A — Module 1: Sinh bảng công việc từ mô tả](#phần-a--module-1-sinh-bảng-công-việc-từ-mô-tả)
- [PHẦN B — Module 2: Gợi ý phân công công việc](#phần-b--module-2-gợi-ý-phân-công-công-việc)
- [PHẦN C — Triết lý chung của hai module](#phần-c--triết-lý-chung-của-hai-module)
- [PHẦN D — Số liệu kỹ thuật](#phần-d--số-liệu-kỹ-thuật)
- [PHẦN E — Kịch bản demo](#phần-e--kịch-bản-demo)
- [PHẦN F — Câu hỏi hội đồng và cách trả lời](#phần-f--câu-hỏi-hội-đồng-và-cách-trả-lời)
- [PHẦN G — Chưa làm, hướng phát triển, việc cần làm trước buổi báo cáo](#phần-g--chưa-làm-hướng-phát-triển-việc-cần-làm-trước-buổi-báo-cáo)

---

## 0. Nói trong 90 giây

> Em bổ sung vào TaskFlow **hai module thông minh, giải quyết hai đầu của một quy trình**:
> module thứ nhất **sinh ra bảng công việc** từ một đoạn mô tả hoặc một file báo cáo
> `.docx` / `.pdf`; module thứ hai **gợi ý ai nên làm** từng thẻ, học từ chính lịch sử
> làm việc của nhóm.
>
> Cả hai đều theo một nguyên tắc: **mỗi con số phải truy vết được về dữ liệu có thật**,
> và **máy chỉ đề xuất, người quyết định** — không có màn hình nào tự động ghi vào cơ sở dữ liệu.
>
> Module 1 dùng mô hình ngôn ngữ (Google Gemini) nhưng **ràng buộc bằng cấu trúc dữ liệu**
> chứ không bằng lời dặn trong prompt: kiến trúc kết hợp đạt **F1 0,99**, **100% JSON hợp lệ
> ngay lần đầu** và **0% ngày sai**, trong khi nhánh chỉ dùng AI hỏng định dạng ở 6,7% số lần gọi.
>
> Module 2 **không dùng LLM**, chỉ TF-IDF + k láng giềng gần nhất + học trọng số trực tuyến,
> viết tay bằng TypeScript nên giải thích được từng phép tính: nó nâng xác suất đúng hạn kỳ vọng
> từ **0,389 (ngẫu nhiên) lên 0,441**, thắng trong **5/5 phép so sánh đã đăng ký trước**,
> và đứng đầu ở **13/13 thế giới mô phỏng** khác nhau.

---

## 1. Tổng quan hai module

| | **Module 1 — Sinh bảng bằng AI** | **Module 2 — Gợi ý phân công** |
|---|---|---|
| Tài liệu gốc | `AI_MODULE.md` | `ASSIGN_MODULE.md` |
| Bài toán | Văn bản tiếng Việt tự do / file `.docx`, `.pdf` → bảng + danh sách + thẻ + nhãn + checklist + ngày | (Thẻ, nhóm) → xếp hạng ai phù hợp, kèm bằng chứng |
| Tên học thuật | Trích xuất thông tin có cấu trúc + sinh có ràng buộc lược đồ | *Task assignee recommendation* (họ hàng *bug triage*), *content-based recommendation* + *learning to rank* |
| Có gọi LLM? | **Có** — Google Gemini, nhưng **chạy được cả khi không có khoá** | **Không** — toàn bộ là số học tự viết, không thư viện học máy, không Python |
| Kỹ thuật lõi | Bộ luật tiếng Việt tất định + LLM ép lược đồ JSON + hợp nhất "luật thắng AI về ngày" + bộ rải lịch | TF-IDF (uni + bi-gram) → k láng giềng gần nhất có suy giảm thời gian → 3 thành phần → chuẩn hoá min-max → perceptron xếp hạng theo cặp |
| Dữ liệu đánh giá | **25 mô tả tiếng Việt tự soạn** có nhãn vàng (10 có cấu trúc / 10 văn xuôi / 5 nhiễu) | **Bộ sinh mô phỏng** có kỹ năng ẩn: 20 hạt giống × ~105 quyết định (lớp 1); 20 hạt giống × 3 đợt × 12 thẻ (lớp 2) |
| Kết quả chính | F1 **0,95 → 0,99**; JSON hợp lệ lần đầu **100%** (`json_schema`) so với **93,3%** (`json_object`); ngày đúng **100%** | P(đúng hạn) **0,389 → 0,441**; thắng 5/5 so sánh đăng ký trước; lớp 2 giảm dồn việc **49,7% → 35,3%** |
| Người dùng quyết định ở đâu | Màn xem trước bắt buộc: tick / bỏ tick từng thẻ, sửa tiêu đề và ngày | Danh sách xếp hạng trong ô Thành viên + màn xem trước chia việc cả danh sách |
| Trạng thái | **Xong lộ trình bước 0–10** | **Xong lộ trình bước 0–9** (kể cả 4b, 6a, 6b, 7a, 7b, 8a, 8b, 9a, 9b) |

**Quan hệ giữa hai module**: độc lập hoàn toàn về mã nguồn nhưng **khớp nhau về nghiệp vụ** —
module 1 cố tình **không** gán người (ghi rõ trong phạm vi), và đúng phần bỏ trống đó là module 2.
Module 2 dùng lại hai hàm chuẩn hoá tiếng Việt của module 1 (`normalizeText`, `foldText`).

---

## PHẦN A — Module 1: Sinh bảng công việc từ mô tả

### A1. Bài toán và phạm vi

- **Đầu vào**: mô tả công việc bằng tiếng Việt gõ tay, **hoặc** file `.docx` / `.pdf`
  (biên bản họp, kế hoạch, báo cáo).
- **Đầu ra**: một bảng TaskFlow hoàn chỉnh — danh sách (cột), thẻ, **nhãn phân loại**,
  **checklist**, **ngày bắt đầu / hạn chót** đã tính cho từng thẻ.
- **Không phải là**: chatbot; **không** tự gán người phụ trách (đó là module 2);
  **không** tự tạo bảng — luôn phải qua màn xem trước.
- **Luồng file**: trích chữ → **đổ vào ô nhập cho người dùng sửa** → mới bấm sinh kế hoạch.
  Endpoint trích file **không bao giờ gọi LLM**.

### A2. Kiến trúc ba tầng

```
       ┌── file .docx/.pdf ──► ai.document (kiểm magic bytes) ──┐
đầu vào┤                                                        ├─► văn bản
       └── gõ tay ──────────────────────────────────────────────┘
                                   │
          [TẤT ĐỊNH] ai.rules: chuẩn hoá NFC → tách dòng đánh số 1..N
          → regex ngày tiếng Việt → phân loại dòng → detectMode
                                   │
              ┌────────────────────┴────────────────────┐
              ▼ (chỉ khi đủ 3 biến AI_*)                ▼
      [LLM] ai.llm → LlmDraft                  (không có khoá: bỏ qua)
      Zod pha nghiêm ngặt → sửa nhẹ → pha lỏng
      Thiếu khoá / hết giờ / JSON hỏng → dùng bản nháp bộ luật, KHÔNG BAO GIỜ 503
              └────────────────────┬────────────────────┘
                                   ▼
          [TẤT ĐỊNH] ai.service: hợp nhất (LUẬT thắng về ngày),
          loại thẻ không truy vết được → ai.schedule: rải lịch
          ⇒ BoardPlan (Zod) ──► lưu AiRun ──► trả 200 về giao diện
                                   ▼
                  MÀN XEM TRƯỚC (bắt buộc — người dùng sửa / bỏ tick)
                                   ▼
          [TẤT ĐỊNH] ai.apply: validate LẠI toàn bộ (không tin trình duyệt)
          → $transaction ghi lồng nhau board + list + card + label + checklist
          → COMMIT → try/catch { ghi nhật ký, phát socket } → cập nhật AiRun
```

**Hai chế độ đọc văn bản** (thay cho công thức 5 hệ số của bản v1):

```
structuredRatio = (số dòng khớp bullet/heading) / (số dòng không rỗng)
mode = (contentLines >= 3 && structuredRatio >= 0.4) ? STRUCTURED : FREEFORM
```

| | STRUCTURED | FREEFORM |
|---|---|---|
| Vai trò của AI | Chỉ bù chỗ thiếu (gộp dòng, đặt tên danh sách, gợi nhãn / checklist) | Dẫn dắt: nghĩ ra thẻ |
| Tạo thẻ ngoài dòng gốc | **Cấm** → loại, đếm vào `droppedCards` | Cho phép, vẫn phải trỏ dòng gần nhất |
| Ghi đè ngày đã ghi rõ | Cấm tuyệt đối | Cấm tuyệt đối |
| Số thẻ tối đa | = số dòng nội dung (trần 200) | 25 |

Người dùng **ghi đè được chế độ** bằng một ô chọn; hệ thống lưu cả `modeAuto` (máy chọn) lẫn
`mode` (thực dùng) → **tỉ lệ ghi đè chính là độ chính xác của bộ phân loại trên dữ liệu thật**,
thu tự động, không cần gán nhãn tay.

### A3. Năm cơ chế then chốt (phần đóng góp kỹ thuật — nên nhấn khi báo cáo)

1. **IR `BoardPlan` là hợp đồng duy nhất giữa LLM và cơ sở dữ liệu.** Lược đồ gửi cho AI
   **không có ô** để điền ngày tuyệt đối, `id`, `userId` hay mã màu hex — chỉ có `title`,
   `listName`, `sourceLine`, `startOffsetDays`, `durationDays`, `colorKey` (0–9), `checklist`.
   Ràng buộc bằng **cấu trúc**, không bằng lời dặn. Đây cũng chính là lớp **chống prompt injection**:
   dù văn bản đầu vào có chiếm quyền điều khiển mô hình, nó **không có ô nào để gây hại**.
2. **`sourceLine` bắt buộc → biến ảo giác thành con số đo được.** Thẻ không truy vết được về một
   dòng có thật sẽ bị loại và **đếm lại** (`droppedCards`).
3. **LUẬT thắng AI về ngày tháng.** Dòng nào regex tiếng Việt tìm được ngày thì dùng ngày đó,
   AI không được ghi đè. `dueDateOrigin ∈ {EXPLICIT, SCHEDULED, NONE}` để luôn trả lời được
   "ngày này từ đâu ra".
4. **Thang suy giảm ép JSON ba mức**: `json_schema` → (nếu 400) `json_object` → (nếu 400) không ép,
   tự gỡ rào ```` ```json ````. Mức nào được chấp nhận thì ghi vào CSDL → thành **bảng "khả năng
   tương thích JSON schema giữa các nhà cung cấp"** trong luận văn. Lược đồ JSON **viết tay** ở mẫu
   số chung nhỏ nhất (không sinh từ Zod, vì `$ref` / `$defs` bị nhiều nhà cung cấp trả 400).
5. **Không bao giờ 503.** Thiếu khoá, hết giờ, JSON hỏng, mất mạng — mọi nhánh lỗi đều bị nuốt,
   hệ thống lùi về bản nháp của bộ luật và vẫn trả 200 kèm cảnh báo.
   **Tính năng chạy được ngay cả khi chưa có khoá API.**

### A4. Dữ liệu và API

**Một bảng CSDL duy nhất** — `AiRun` (bản v1 có 6 bảng). Mọi khoá ngoại đều `SetNull`, thêm
`actorKey` **không có khoá ngoại** → xoá tài khoản vẫn **không mất dữ liệu thực nghiệm** của
khoá luận. Bảng này lưu: đầu vào, chế độ máy chọn / thực dùng, `structuredRatio`, có dùng LLM không,
nhà cung cấp, model, token vào / ra, độ trễ, lý do thất bại, `strictParseOk`, kế hoạch AI đề xuất
(**không bao giờ bị ghi đè**), kế hoạch người dùng thực sự bấm Tạo, `cardCount` / `droppedCards` /
`verdictLines`, cảnh báo, `accepted`, `editCount`, `appliedAt`.

| Endpoint | Ghi chú |
|---|---|
| `GET /api/ai/status` | `{llmAvailable, provider, model}` → giao diện hiện badge "đang chạy chế độ không có AI" |
| `POST /api/ai/board-plans` | Sinh kế hoạch. **Luôn trả 200** kể cả khi LLM chết. 10 lượt / 10 phút / người |
| `POST /api/ai/documents/extract` | Trích chữ từ `.docx` / `.pdf`. **Không gọi LLM, không ghi CSDL**. 10 lượt / 10 phút / người |
| `POST /api/ai/board-plans/:runId/apply` | Tạo bảng thật. 404 nếu không phải chủ lượt chạy; **409 nếu đã áp dụng** (chống bấm hai lần); 30 lượt / 10 phút |

**Đổi nhà cung cấp = đổi 3 biến môi trường + khởi động lại, không sửa một dòng mã** —
vừa là tính linh hoạt, vừa là thí nghiệm B3 của chương đánh giá.

### A5. Thiết kế thí nghiệm

- **Bộ dữ liệu 25 mẫu tiếng Việt tự soạn**: 10 có cấu trúc (`S01–S10`), 10 văn xuôi (`F01–F10`),
  5 nhiễu (`N01–N05`: không có ngày, hạn quá khứ, 60 dòng, lẫn tiếng Anh, có tên người, có dòng chèn lệnh).
- **Mẹo giảm công gán nhãn xuống ~1/5**: nhãn vàng chỉ là **số dòng** + ngày, **không phải tiêu đề**
  → so khớp `sourceLine ∈ goldLines`, tính P/R/F1 tự động, khách quan, không cần so chuỗi mờ.
- **Bốn nhánh**: **B0** chỉ bộ luật (không cần khoá) · **B1** chỉ AI (prompt bảo AI tự tính ngày
  tuyệt đối) · **B1v2** chỉ AI, prompt làm rõ ngoại lệ cuối tuần (phân tích độ nhạy) ·
  **B2 kết hợp = đúng đường sản phẩm**.
- **3 lần chạy mỗi mẫu** (AI không tất định, `temperature 0,2`) → 25 × 3 × 3 = **225 ô dữ liệu**.
- **Cache phản hồi thô**: lưu cả phản hồi thành công **và lỗi nội dung** (`BAD_JSON`, `EMPTY`),
  **không** lưu lỗi hạ tầng (429, 5xx, hết giờ) → chạy lại cho đúng cùng kết quả, không che mất
  tỉ lệ lỗi thật.

### A6. Số liệu chính

**Bảng A1 — So sánh bốn nhánh** (`gemini-3.5-flash-lite`, 25 mẫu × 3 lần, chạy 19/09/2026):

| Nhánh | Precision | Recall | **F1** | Ngày ghi rõ: tìm đúng | Ngày EXPLICIT: đúng | Thẻ có ngày xấu |
|---|---|---|---|---|---|---|
| B0 chỉ bộ luật | 0,90 | **1,00** | 0,95 | 100,0% | 88,6% | 0,0% |
| B1 chỉ AI | 0,98 | 0,95 | 0,97 | 88,6% | 92,5% | 0,0% |
| B1v2 chỉ AI (prompt làm rõ) | 0,98 | 0,94 | 0,96 | 89,5% | 95,4% | 0,0% |
| **B2 kết hợp (sản phẩm)** | **1,00** | 0,99 | **0,99** | **100,0%** | 95,0% | 0,0% |

F1 giữa 3 lần chạy: B1 **0,928–0,991** (dao động lớn vì có lần thất bại), B2 **0,991–0,997** (ổn định).

**Bảng A2 — Tách lỗi định dạng khỏi lỗi nội dung** (đây là **kết luận trung tâm**):

| Nhánh | Lần gọi | Gọi thành công | F1 (tất cả) | F1 (chỉ lần thành công) | Ngày tìm đúng (tất cả) | Ngày tìm đúng (chỉ lần thành công) |
|---|---|---|---|---|---|---|
| B1 chỉ AI (`json_object`) | 75 | 93,3% (**5 lần `BAD_JSON`**) | 0,966 | 0,989 | 88,6% | 94,9% |
| B1v2 chỉ AI (`json_object`) | 75 | 93,3% (5 lần `BAD_JSON`) | 0,963 | 0,991 | 89,5% | **98,9%** |
| **B2 kết hợp (`json_schema`)** | 75 | **100%** | **0,994** | 0,994 | **100%** | **100%** |

**Bảng A3 — Chất lượng lớp AI của nhánh sản phẩm (B2)**: gọi thành công **100%**, JSON hợp lệ ngay
lần đầu **100%**, độ phủ `lineVerdicts` **100%**, thẻ bị loại vì không truy vết được **0%**,
`json_schema` được chấp nhận **75/75**, độ trễ p50 **2,19 s** / p95 **3,70 s**, token vào 1.189 / ra 567.
So với B1: B1 nhanh hơn (1,49 s / 2,16 s) và rẻ hơn (861 / 403 token) nhưng **hỏng định dạng 6,7% số lần**.

**Bảng A4 — Quét ngưỡng chế độ** (chứng minh hằng số 0,4 là hiệu chỉnh thực nghiệm, không tuỳ ý):

| Ngưỡng | 0,2 | 0,3 | **0,4** | 0,5 | 0,6 |
|---|---|---|---|---|---|
| Đúng | 24/25 | 24/25 | **25/25** | 25/25 | 24/25 |

→ vùng tốt là **[0,4 ; 0,5]**; giá trị đang dùng nằm sát mép dưới của vùng đó.

### A7. Ba kết luận của module 1

1. **Ép cấu trúc thắng ở độ tin cậy, không chỉ ở chất lượng.** Với `json_object`, Gemini trả nội dung
   không phải JSON ở **5/75 lần (6,7%)** — mỗi lần là một kế hoạch rỗng. Với `json_schema`: **0/75**.
   Nếu chỉ xét các lần thành công thì chất lượng B1 khá gần B2 (F1 0,989 so với 0,994) —
   **khác biệt thật nằm ở chỗ có bao giờ hỏng hay không.**
2. **Giả thuyết "AI tự tính ngày sẽ sai lung tung" KHÔNG được xác nhận** ở model này: tỉ lệ ngày xấu
   (ngày không có thật, bắt đầu sau hạn, ngoài khoảng dự án) là **0% ở mọi nhánh**. Sau khi sửa đúng
   một câu trong prompt (B1v2), độ chính xác ngày của các lần thành công tăng **94,9% → 98,9%** — tức
   phần lớn chênh lệch ngày là do **cách viết prompt**, không phải do kiến trúc. Lợi thế thật còn lại
   của B2 là **tính tái lập**: ngày do bộ luật quyết nên **giống hệt nhau 3/3 lần chạy**.
3. **Bộ luật và AI bù nhau rất rõ**: bộ luật cho recall 1,00 (coi mọi dòng là một thẻ, không bỏ sót
   việc nào) nhưng precision chỉ 0,90 (giữ lại cả tiêu đề, câu dẫn, câu cảm thán, dòng chèn lệnh);
   AI lấp đúng khoảng trống đó → precision **1,00**. Đây là lập luận cho kiến trúc lai.

> **Một phát hiện đáng kể ngoài lề**: chính bộ đánh giá đã tìm ra một **lỗi thật trong mã sản phẩm**
> (`MEMBER_HEADING_RE` áp luật "danh sách tên người" lên tên danh sách do AI tự đặt). Sau khi sửa,
> recall của B2 tăng 0,986 → 0,990. Đã báo cả số liệu trước và sau.

### A8. Hạn chế phải khai trung thực (nói trước khi bị hỏi)

1. Nhãn do **một người** gán, mẫu **tự soạn**, và người soạn biết bộ luật hoạt động thế nào →
   bộ dữ liệu có thể vô tình dễ với bộ luật hơn dữ liệu thật. Không có inter-annotator agreement.
2. Hai mẫu (`S10`, `F05`) được **làm lai hơn** sau khi đo tỉ lệ cấu trúc, nhưng **trước khi chạy bất
   kỳ nhánh nào**; bộ dữ liệu đã đóng băng bằng `sha256` từ lần chạy đầu tiên.
3. **B1v2 được viết sau khi thấy kết quả pilot** (đó là phân tích độ nhạy — báo cáo nêu cả hai kết quả).
4. Sửa lỗi `MEMBER_HEADING_RE` là **sửa mã sản phẩm dựa trên kết quả đánh giá** → đã báo cả số liệu
   trước (F1 0,992) và sau (F1 0,994).
5. 25 mẫu, một model, một ngôn ngữ: các chênh lệch vài điểm phần trăm **chưa đủ sức thống kê**.
6. Hạn chế thật còn lại của bộ luật: cách nói mơ hồ ("cuối tháng 10" → 31/10), thời lượng bị hiểu là
   hạn chót ("trong 1 tuần"), và **ngày đã qua ghi thiếu năm bị đẩy sang năm sau** — đã ghi vào hướng
   phát triển.

---

## PHẦN B — Module 2: Gợi ý phân công công việc

### B1. Bài toán

- **Đầu vào**: một thẻ công việc (tiêu đề, mô tả, ngày bắt đầu, hạn chót) và danh sách thành viên của bảng.
- **Đầu ra**: xếp hạng thành viên theo độ phù hợp, mỗi người kèm (a) điểm 0–100, (b) tách nhỏ ba thành phần,
  (c) **bằng chứng truy vết được** — đúng những thẻ cũ đã dùng để tính ra điểm đó, (d) cờ cảnh báo.
- **Tên học thuật**: *task assignee recommendation*, họ hàng gần với *bug triage*. Phương pháp thuộc nhóm
  *content-based recommendation* kết hợp *pairwise learning to rank*.
- **Không phải là**: tự động gán người; bảng xếp hạng năng lực nhân sự; chatbot. **Không gọi LLM** ở đường chạy chính.

**Vì sao không dùng thư viện / Python**: thư viện TF-IDF cho Node hướng tiếng Anh và làm mất khả năng
giải thích từng con số; thêm một tiến trình Python trong Docker là thêm một chỗ hỏng mà không thêm năng lực;
toàn bộ phần tính toán chỉ khoảng 200–250 dòng số học cơ bản.

### B2. Kiến trúc hai lớp

```
Lớp 2 — chia việc cho cả danh sách (bước 8)
   xếp việc theo hạn gấp trước, mỗi việc gọi lớp 1,
   người vừa nhận việc bị trừ điểm dần ở các việc sau
        |
        v
Lớp 1 — chấm cặp (việc, người)
   hàm thuần: ảnh chụp dữ liệu -> điểm + bằng chứng
        |
        v
Tầng hồ sơ — TF-IDF, hồ sơ người, k láng giềng gần nhất
```

**Vì sao phải tách**: nếu chỉ có lớp 1, gợi ý cho cả nhóm sẽ dồn **mọi việc cho người giỏi nhất**.
Lớp 2 tồn tại chỉ để cân tải; tách ra còn giữ được lớp 1 là **hàm thuần**, dễ kiểm thử và dễ đo offline.

### B3. Công thức — phải thuộc để trả lời hội đồng

**(1) Tách từ** (`assign.text.ts`): chuẩn hoá NFC → hạ chữ thường → **nhận diện hư từ trên dạng CÓ DẤU rồi mới bỏ dấu**
(vì bỏ dấu trước sẽ xoá nhầm `bảng`, `đăng`, `trọng` — ba từ nội dung của chính dự án này);
79 hư từ có dấu + 13 hư từ không dấu; sinh **uni-gram + bi-gram liền kề**, bi-gram không bắc qua hư từ hay dấu câu;
**tiêu đề đếm gấp đôi mô tả**.

**(2) TF-IDF**: `tf = 1 + log(số lần xuất hiện)`, `idf = log((N+1)/(df+1)) + 1`, véc-tơ chuẩn hoá về độ dài 1
→ **độ giống = tích vô hướng (cosine) ∈ [0,1]**.

**(3) Suy giảm theo thời gian**: `decay(d) = 0,5 ^ (d / 90)` — **nửa đời 90 ngày**.

**(4) Kinh nghiệm chủ đề** — lấy **K = 5** thẻ cũ giống nhất (bỏ thẻ có `sim < 0,05`), `w_i = decay(i)`:

```
fit      = Σ(w_i · sim_i) / Σ(w_i)        (chất lượng khớp, ∈ [0,1])
evidence = Σ(w_i)                          (lượng bằng chứng đã suy giảm)
experience = fit · evidence / (evidence + 2)
```

Tách `fit` và `evidence` để "khớp rất đúng nhưng chỉ có một thẻ cũ từ hai năm trước" không bị nhầm
với "khớp đúng và có nhiều bằng chứng".

**(5) Tin cậy — tính theo đúng việc đang xét** (đây là **điểm khác biệt chính** so với các hệ thống
chỉ có một chỉ số "tỉ lệ hoàn thành" chung). Trên đúng K thẻ đó, trọng số `v_i = w_i · sim_i`:

```
outcome_i = 1 (xong đúng hạn, chưa từng bị mở lại) | 0,5 (đúng hạn nhưng từng mở lại) | 0 (trễ hạn)
reliability = (Σ(v_i · outcome_i) + 3·μ) / (Σ(v_i) + 3)      với μ = tỉ lệ đúng hạn của cả không gian
```

Đây là **làm trơn kiểu Bayes**, xử lý gọn cái bẫy "người mới làm đúng hạn 1 thẻ thành 100%".

**(6) Khả dụng**: `load` = số thẻ đang mở **chồng lấn** khoảng thời gian của thẻ mới;
`availability = max(0, 1 − load / cap)` với `cap` mặc định 5 thẻ song song → `load ≥ cap` thì gắn cờ `OVERLOADED`.

**(7) Điểm tổng**: trọng số mặc định **kinh nghiệm 0,45 · tin cậy 0,30 · khả dụng 0,25**;
chỉ cộng những thành phần **thực sự có dữ liệu** rồi chia lại theo tổng trọng số của chúng
(kỹ thuật `completeness` — thiếu dữ liệu **không** kéo điểm xuống);
`confidence = evidence / (evidence + 3)` chia ba mức hiển thị "mỏng / vừa đủ / đủ".

**(8) Chuẩn hoá min-max trong nhóm ứng viên** (bước 4b — chi tiết đáng kể):
ba thành phần **không cùng thang** (khả dụng trải rộng gấp ~5 lần kinh nghiệm, ~9 lần tin cậy),
nên cộng thô thì trọng số 0,45 / 0,30 / 0,25 **thực ra** cho ảnh hưởng 23% / 9% / **67%**.
Sau khi chuẩn hoá min-max trong nhóm ứng viên của chính thẻ đó, ảnh hưởng thực tế là **45% / 29% / 25%**
— đúng như ý nghĩa của trọng số. Hệ quả cần nói rõ: `score` là **điểm tương đối trong nhóm cho đúng thẻ này**,
không so sánh được giữa hai thẻ; giá trị **thô** vẫn hiện ra giao diện.

**(9) Xuống thang khi thiếu dữ liệu**: 0 thẻ lịch sử → cờ `NO_HISTORY`, chỉ xét khả dụng;
có lịch sử nhưng không thẻ nào giống → `NO_SIMILAR`; không thành phần nào có dữ liệu → `score = null`,
hiện **"Chưa đủ dữ liệu để chấm"** chứ **không** hiện 0 điểm.

**(10) Chống rò rỉ tương lai**: thẻ hoàn thành **sau** thời điểm đang xét không bao giờ được dùng
(cả ở hồ sơ lẫn ở trung bình nhóm μ); chính thẻ đang chấm bị loại khỏi lịch sử — bắt buộc khi phát lại lịch sử.

### B4. Cá nhân hoá nằm ở đâu — bốn chỗ

1. **Hồ sơ riêng từng người**, dựng từ chính các thẻ họ đã hoàn thành.
2. **Độ tin cậy tính theo ngữ cảnh việc đang xét** — cùng một người có điểm tin cậy khác nhau ở hai loại việc.
3. **Trọng số riêng cho từng nhóm** — mỗi không gian làm việc có bộ ba trọng số riêng, trưởng nhóm chỉnh bằng thanh trượt.
4. **Trọng số đó tự học từ phản hồi của chính nhóm** — thuật toán **perceptron xếp hạng theo cặp** (cùng họ RankNet):

```
Khi hệ thống xếp a đứng đầu nhưng người dùng chọn b:
   trọng số ← trọng số + 0,05 · (x_b − x_a)        (x là giá trị ĐÃ chuẩn hoá)
   rồi CHIẾU VUÔNG GÓC về tập hợp lệ: mỗi trọng số ∈ [0,05; 0,70], tổng = 1
```

**Bốn chốt chặn**: chỉ học từ lượt thứ 10 trở đi; chỉ học khi người được chọn nằm trong danh sách đã chấm;
chỉ học khi cả hai người **đủ cả ba thành phần**; **lưu lịch sử mọi lần đổi trọng số** → vẽ được **đường hội tụ**
(bằng chứng nhìn thấy được rằng cá nhân hoá có xảy ra thật).

> Vì sao dùng **phép chiếu** thay cho "kẹp rồi chia cho tổng": kẹp rồi chuẩn hoá **có thể phá chính ràng buộc**
> — `(0,70; 0,05; 0,05)` chuẩn hoá thành `(0,875; 0,0625; 0,0625)`, vượt trần 0,70. Phép chiếu tìm điểm hợp lệ
> **gần nhất**, luôn có nghiệm.

### B5. Lớp 2 — chia việc cho cả danh sách

`POST /api/lists/:listId/assignment-plan` — **chỉ xem trước, không ghi gì** (không `AssignRun`,
không `CardMember`, không nhật ký, không học trọng số; có test đếm sáu bảng trước và sau).

Thuật toán (`assign.plan.ts`, ~50 dòng, hàm thuần dùng chung cho máy chủ và cho bộ đánh giá):

1. Lấy các thẻ **chưa có người nhận** của danh sách, xếp **hạn gấp trước** (tất định: hạn → `position` → `id`).
2. Với từng thẻ gọi `rankCandidates` của lớp 1 (đúng cấu hình sản phẩm), chọn người xếp đầu **có điểm và không tạm nghỉ**.
3. **Cộng thẻ vừa chia vào "thẻ đang mở" của người đó**, rồi sang thẻ sau.

"Người vừa nhận việc bị trừ điểm dần" xảy ra **qua thành phần khả dụng của lớp 1** (`1 − tải/sức chứa`) —
**không có tham số mới, không có sổ tải theo ngày**. Kết quả **đúng bằng** việc lần lượt bấm gợi ý số 1 cho
từng thẻ rồi giao thật.

Giới hạn: tối đa 30 thẻ mỗi lượt, 10 lượt / 10 phút; độ trễ đo được: 3 ms/thẻ (nhóm 120 thẻ) →
74 ms/thẻ (không gian 3.000 thẻ), tức 30 thẻ ≈ 2,2 giây ở không gian lớn nhất đã thử.

### B6. Thiết kế thí nghiệm — phần công phu nhất của module này

- **Bộ sinh mô phỏng** (hệ thống mới, chưa có dữ liệu thật): mỗi người có **kỹ năng ẩn** theo chủ đề,
  có người mới vào muộn, có người học nghề, 25% giao sai, 12% thẻ mơ hồ.
  Xác suất đúng hạn = `0,15 + 0,7 · kỹ năng − phạt tải`.
- **Ba chế độ chạy**: `HISTORY` (phát lại lịch sử cố định) · **`ARM` (vòng kín — nhánh tự giao người xếp đầu,
  kết quả rút từ mô hình của bộ sinh, lịch sử tích luỹ theo lựa chọn của chính nhánh)** · `LEADER` (trưởng nhóm giả giao,
  nhánh chỉ gợi ý và nhận phản hồi).
  **Vì sao cần vòng kín**: phát lại lịch sử cố định không đo được việc dồn về một người, tải tự điều chỉnh,
  và "bẫy người mới" (không được giao thì mãi không có lịch sử).
- **So sánh cặp, may rủi chung**: mỗi thẻ có ba luồng ngẫu nhiên riêng gieo bằng `streamSeed(hạt giống, vị trí, mục đích)`,
  có **trộn bit** (gieo bằng hai số nguyên kề nhau cho giá trị đầu tương quan 0,998 — sau khi trộn còn ~0,01);
  `sampleOutcome` cho **ghép đơn điệu** → hai nhánh chỉ khác nhau ở **người được chọn**, không phải ở may rủi.
- **Tám nhánh + bốn nhánh cắt bỏ + hai nhánh tham chiếu** (người kỹ năng cao nhất, tối ưu — cần biết kỹ năng ẩn).
  Nhánh **không được import bộ sinh**, có test đọc mã nguồn canh giữ.
- **Chỉ số chính đăng ký trước**: **xác suất đúng hạn kỳ vọng** của người được giao. Phụ: độ hối tiếc,
  Top-1/Top-3/MRR, **hệ số Gini** (mức dồn việc), chỉ số "người mới", đúng hạn thực.
- **Khoảng tin cậy bootstrap 95%** theo hạt giống, **năm/sáu phép so sánh chính chọn TRƯỚC khi chạy**.

### B7. Số liệu chính

**Bảng B1 — Vòng kín, 20 hạt giống (2001–2020), lớp 1** (`backend/eval-assign-result.md`):

| Nhánh | P(đúng hạn) [95% CI] | Hối tiếc | Top-1 | MRR | Gini | Người nhiều nhất | Người mới (1 = công bằng) |
|---|---|---|---|---|---|---|---|
| Ngẫu nhiên | 0,389 [0,379; 0,400] | 0,324 | 18,9% | 0,447 | 0,170 | 23,2% | 1,14 |
| Chia vòng tròn | 0,404 | 0,315 | 19,6% | 0,453 | 0,131 | 19,9% | 1,02 |
| Người rảnh nhất | 0,395 | 0,330 | 20,1% | 0,452 | 0,238 | 25,9% | 0,71 |
| Người hay làm nhất | 0,221 | 0,332 | 18,9% | 0,450 | 0,825 | 97,6% | 0,00 |
| Chỉ kinh nghiệm | 0,397 | 0,247 | 33,0% | 0,547 | 0,547 | 51,7% | 0,00 |
| Chỉ tải (khả dụng) | 0,400 | 0,325 | 18,4% | 0,441 | 0,202 | 24,5% | 0,78 |
| **Đầy đủ (sản phẩm)** | **0,441 [0,427; 0,455]** | **0,244** | 30,6% | 0,532 | 0,347 | 34,4% | 0,46 |
| *Tham chiếu: kỹ năng cao nhất* | *0,592* | *0,000* | *100%* | *1,000* | *0,365* | *35,2%* | *0,94* |
| *Tham chiếu: tối ưu* | *0,611* | *0,009* | *90,7%* | *0,946* | *0,292* | *29,9%* | *1,04* |

**Bảng B2 — Năm so sánh đã đăng ký trước: nhánh đầy đủ thắng 5/5**

| Phép so sánh | Δ P(đúng hạn) [95% CI] | Hạt giống +/−/= | Kết luận |
|---|---|---|---|
| − Ngẫu nhiên | **+0,052** [+0,039; +0,065] | 20 / 0 / 0 | tốt hơn |
| − Người rảnh nhất | **+0,046** [+0,030; +0,062] | 18 / 2 / 0 | tốt hơn |
| − Người hay làm nhất | **+0,220** [+0,205; +0,236] | 20 / 0 / 0 | tốt hơn |
| − Chỉ kinh nghiệm | **+0,044** [+0,026; +0,062] | 18 / 2 / 0 | tốt hơn |
| − Chỉ tải (khả dụng) | **+0,041** [+0,028; +0,054] | 18 / 2 / 0 | tốt hơn |

**Bảng B3 — Nghiên cứu cắt bỏ (ablation)**: bỏ khả dụng −0,028 [−0,043; −0,014] (**kém hơn có ý nghĩa**);
bỏ kinh nghiệm −0,013 [−0,026; −0,000] (kém hơn); bỏ tin cậy −0,011 [−0,027; +0,005] (**chưa phân biệt được**).
→ trung thực mà nói: **thành phần tin cậy chưa chứng minh được đóng góp riêng** trên thế giới mô phỏng này.

**Bảng B4 — Lớp 2, 20 hạt giống mới (3001–3020)** (`backend/eval-plan-result.md`):

| Cách chia | Người nhiều nhất | Gini | P(đúng hạn) [95% CI] |
|---|---|---|---|
| Chấm riêng từng thẻ, không cộng tải | 49,7% | 0,482 | 0,455 |
| **Cộng thẻ vừa giao vào tải (đã cài)** | **35,3%** | **0,313** | **0,493 [0,472; 0,512]** |
| + trần ⌈K/người⌉ thẻ mỗi người | 22,2% | 0,101 | 0,479 |
| + phạt 10 điểm mỗi thẻ đã nhận | 28,9% | 0,206 | 0,489 |
| Chia vòng tròn | 22,2% | 0,067 | 0,398 |
| *Tối ưu tham lam (biết kỹ năng ẩn)* | *36,3%* | *0,338* | *0,607* |

So sánh đăng ký trước: cách đã cài hơn "chấm riêng từng thẻ" **+0,038** [+0,024; +0,053] và
hơn "chia vòng tròn" **+0,095** [+0,075; +0,116] về P(đúng hạn), đồng thời **giảm dồn việc
49,7% → 35,3%**. Còn cách tối ưu tham lam **0,114** [0,099; 0,130].

**Bảng B5 — Độ bền và quét tham số** (`backend/eval-assign-sweeps.md`):

- **13 thế giới mô phỏng khác nhau**: nhánh đầy đủ **đứng đầu 13/13**, hơn ngẫu nhiên có ý nghĩa ở **13/13** (+0,026 đến +0,068).
- **Không tham số nào** (`H`, `K`, `m`, `m_e`, `simMin`, `cap`) đổi P(đúng hạn) **quá 0,012** (2,7% tương đối)
  → tham số mặc định nằm trên một **mặt bằng phẳng**, không phải chọn bừa cũng không phải chọn "đẹp nhất".
- **Lưới 33 bộ trọng số**: mặc định 0,45/0,30/0,25 đứng **hạng 6/34**; bộ tốt nhất hơn +0,006 [−0,002; +0,015]
  → **không cấu hình nào tốt hơn có ý nghĩa**.
- **Phạt tải càng nặng, khả dụng càng đáng giá**: Δ so với "bỏ khả dụng" = −0,002 (phạt 0) → +0,028 (0,06) → +0,060 (0,3).
  Và "chỉ kinh nghiệm" so với ngẫu nhiên: +0,054 (phạt 0) → **−0,027** (phạt 0,2) — **dồn việc cho người giỏi nhất là tự huỷ khi tải nặng**.
- **Việc càng dày, module càng đáng giá**: hơn ngẫu nhiên +0,052 (24 thẻ/bảng) → +0,105 (72 thẻ/bảng).
- **Học trọng số hội tụ**: khoảng cách L1 tới gu thật của trưởng nhóm giả **0,90 → 0,10** (13 lượt học),
  0,50 → 0,19, 0,80 → 0,37; đối chứng (gu trùng mặc định) **0,00 — không học gì**, đúng bản chất perceptron.
  Tỉ lệ chấp nhận trên các quyết định **đủ dữ liệu**: 47,5% → **100%**, 54,1% → 93,7%, 66,3% → 88,8%.
- **Chuỗi xử lý văn bản**: láng giềng gần nhất đúng chủ đề ẩn Top-1 **96,1%**, P@5 **82,9%**;
  bỏ bi-gram làm P@5 giảm **0,63 điểm** (có ý nghĩa) → bi-gram giúp thật.

### B8. Kết luận của module 2

1. **Bộ chấm ba thành phần thắng mọi nhánh nền trong 5/5 phép so sánh đăng ký trước**, và thắng ở
   **13/13 thế giới mô phỏng** — kết luận chính không phụ thuộc vào một giả định riêng nào của bộ sinh.
2. **Cân tải là thành phần đóng góp rõ nhất** (bỏ nó mất 0,028), và giá trị của nó **tăng theo mức độ
   bận của nhóm** — đây là lập luận mạnh cho việc cần lớp 2.
3. **Học trọng số hội tụ về gu của nhóm và làm tỉ lệ chấp nhận tăng rõ**, nhưng **không làm kết quả
   khách quan tốt hơn** (Δ P(đúng hạn) từ −0,005 đến −0,012). Phải nói thẳng: lợi ích của cá nhân hoá
   ở đây là **sự chấp nhận và tin tưởng của người dùng**, không phải là đúng hạn — và điều đó chỉ đo
   được với người dùng thật.
4. **Không cách thực tế nào chia đều việc thật sự** — ngay cả cách tối ưu (biết kỹ năng ẩn) cũng dồn
   36,3% việc cho một người. Các cách chia chỉ **giảm** mức dồn.

### B9. Hạn chế phải khai trung thực

1. **Mọi số liệu nằm trong thế giới giả định của tác giả.** Chúng chứng minh thuật toán hoạt động
   **đúng như thiết kế** trong thế giới đó, **không** chứng minh hiệu quả ngoài đời thật.
2. Mỗi bộ chỉ có **6 người, ~105 quyết định**; khoảng tin cậy tính trên 20 hạt giống, không phải trên từng thẻ.
3. Số liệu học trọng số là học từ **người chọn giả** (một mô hình gu tuỳ ý), chưa phải người dùng thật.
4. Khoảng tin cậy cho các so sánh mô tả **không hiệu chỉnh đa so sánh** — chỉ 5–6 phép chính là đăng ký trước.
5. **Hai quyết định còn treo** (nói ra sẽ được điểm trung thực): (a) `DROP` hay `NEUTRAL` cho người thiếu
   dữ liệu — hai phép đo độc lập (bước 7b theo từng thẻ, 9b theo cả đợt) **đều không phân biệt được**;
   (b) có nên thêm trần hoặc phạt điểm cho lớp 2 — số liệu bước 9b cho thấy chúng **giảm dồn việc rất nhiều**
   (35,3% → 22,2%) với cái giá về đúng hạn **rất nhỏ hoặc bằng không**.
6. **Rủi ro đã đo, không né**: với `DROP`, người chưa có lịch sử chỉ còn thành phần khả dụng nên rất dễ đứng
   đầu — **86,5% số quyết định ở giai đoạn cuối có người xếp đầu là người mới**. Giao diện bù lại bằng huy hiệu
   "Chưa có lịch sử", nhưng đây là một rủi ro trải nghiệm thật đã được ghi nhận.

---

## PHẦN C — Triết lý chung của hai module

Nếu hội đồng hỏi "hai module này có gì chung, hay chỉ là hai tính năng rời?", trả lời bằng năm nguyên tắc:

| Nguyên tắc | Module 1 thể hiện thế nào | Module 2 thể hiện thế nào |
|---|---|---|
| **1. Mọi con số truy vết được** | `sourceLine` — thẻ nào cũng chỉ về một dòng có thật; `dueDateOrigin` cho biết ngày từ đâu ra | Nút **"Vì sao?"** mở đúng những thẻ cũ đã dùng để tính điểm (tiêu đề, % giống, đúng hạn/trễ, ngày) |
| **2. Ràng buộc bằng cấu trúc, không bằng lời dặn** | Lược đồ JSON không có ô để điền ngày tuyệt đối hay id → chống prompt injection | Lõi tính toán là **hàm thuần** không biết Prisma → không thể vô tình ghi CSDL |
| **3. Thiếu dữ liệu thì nói thiếu, không bịa số** | Thiếu khoá API → chạy đường bộ luật + badge, không 503 | `NO_HISTORY` / `NO_SIMILAR` / `NO_DATA` → hiện "Chưa đủ dữ liệu để chấm", không hiện 0 điểm |
| **4. Máy đề xuất, người quyết** | Màn xem trước **bắt buộc**, tick/bỏ tick từng thẻ | Bấm vào dòng mới thêm người; giao cho người quá tải thì hỏi lại một lần |
| **5. Tự thu số liệu cho chương đánh giá** | `AiRun` lưu `accepted`, `editCount`, tỉ lệ ghi đè chế độ | `AssignRun` lưu người xếp đầu / người được chọn → **tỉ lệ chấp nhận**; `AssignWeightHistory` → **đường hội tụ** |

Thêm hai điểm về **phương pháp đánh giá** (đáng nhấn vì hiếm thấy ở khoá luận):

- **Đăng ký trước các phép so sánh chính** (5 phép ở lớp 1, 5 phép ở lớp 2) **trước khi chạy**,
  và chỉ kết luận dựa trên khoảng tin cậy bootstrap có chứa 0 hay không.
- **Kiểm thử bằng cài lỗi (mutation testing)**: cố tình chèn lỗi vào mã rồi xem bộ test có bắt được không —
  module 1: **117/117** bị bắt ở phần đánh giá, 29/29 ở phần sửa lỗi;
  module 2: **134/136** (2 tương đương), **105 phép ở giao diện lớp 2 (104 bị bắt)**,
  96 phép ở giao diện lớp 1 (91 bị bắt, 5 tương đương).

---

## PHẦN D — Số liệu kỹ thuật

**Khối lượng mã nguồn** (dòng, không tính test):

| Phần | Module 1 (AI) | Module 2 (phân công) |
|---|---|---|
| Backend — module chính | **3.715** dòng / 13 file (`backend/src/modules/ai/`) | **2.505** dòng / 13 file (`backend/src/modules/assign/`) |
| Backend — script đánh giá | **1.593** dòng / 6 file | **4.971** dòng / 18 file (gồm bộ sinh mô phỏng) |
| Frontend | **1.130** dòng / 5 file | **1.629** dòng / 9 file |
| Bảng CSDL mới | 1 (`AiRun`) | 4 (`MemberWorkProfile`, `WorkspaceAssignWeights`, `AssignWeightHistory`, `AssignRun`) |
| Endpoint | 4 | 8 |

**Kiểm thử** (theo nhật ký bước 9b, 22/09/2026): **backend 75 file / 864 test xanh**,
**frontend 23 file / 180 test xanh**, `tsc` và `eslint` sạch.
Riêng hai module này chiếm khoảng **193 test backend cho module AI** và **530 test backend cho module phân công**
(đếm theo số ca `it(...)` trong các file `test/ai*.test.ts` và `test/assign*.test.ts`), cộng với 81 + 37 test frontend.

**Lệnh chạy đánh giá**:

```bash
npm run eval:ai -- --arm=rule,llm-only,llm-only-v2,hybrid --runs=3
```

```bash
npm run eval:assign -- --exp=all
```

```bash
npm run eval:plan
```

**Cấu hình cần khai báo khi chạy thật** (`backend/.env`):

```
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_API_KEY=<khoá Google AI Studio>
AI_MODEL=gemini-3.5-flash-lite
AI_PROVIDER_LABEL=google-gemini
AI_TIMEOUT_MS=30000
AI_MAX_INPUT_CHARS=20000
```

Thiếu bất kỳ biến nào trong ba biến đầu → hệ thống tự chạy đường bộ luật, **không lỗi**.
Module 2 **không cần biến môi trường nào**.

---

## PHẦN E — Kịch bản demo

**Chuẩn bị trước** (làm tối nay, đừng để sáng mai):

1. `docker compose up -d`, chạy frontend, đăng nhập sẵn **hai tab**: tài khoản của mình và `sim1@sim.local`
   (tài khoản có dữ liệu mô phỏng — module 2 cần lịch sử mới có gợi ý đẹp).
2. Kiểm tra `GET /api/ai/status` trả `llmAvailable: true` (nếu khoá cũ đã bị thu hồi thì demo vẫn chạy
   được bằng đường bộ luật — **nói trước điều này, coi như một tính năng**).
3. Chuẩn bị sẵn một đoạn mô tả tiếng Việt **có ngày ghi rõ** và một file `.docx` ngắn.

**Demo module 1 (khoảng 3 phút)**:

1. Header → **Tạo bảng** → dòng **"Tạo bằng AI"**.
2. Dán mô tả → chỉ vào ô chọn chế độ (`STRUCTURED` / `FREEFORM`) và nói "máy tự chọn nhưng người dùng ghi đè được,
   và **tỉ lệ ghi đè chính là số liệu đánh giá**".
3. Bấm sinh → **màn xem trước**: chỉ vào ngày của thẻ có ngày ghi rõ và nói **"ngày này do bộ luật quyết, AI không được ghi đè"**;
   bỏ tick một thẻ để cho thấy người dùng kiểm soát.
4. Bấm Tạo → bảng thật hiện ra với nhãn + checklist + ngày.
5. (Nếu còn thời gian) Tải file `.docx` → chữ đổ vào ô nhập → nói "endpoint trích file **không bao giờ gọi AI**".

**Demo module 2 (khoảng 3 phút)**:

1. Mở một thẻ ở tài khoản mô phỏng → ô **Thành viên** → danh sách xếp hạng hiện ra:
   điểm "Phù hợp 92", ba giá trị thô (KN 78% · TC 100% · KD 80%), huy hiệu cờ (`6/5 thẻ`, "Chưa có lịch sử").
2. Bấm **"Vì sao?"** → hiện đúng những thẻ cũ đã dùng để tính → **đây là điểm nhấn mạnh nhất của module**.
3. Thử giao cho người **quá tải** → hệ thống hỏi lại một lần.
4. Menu "⋯" của danh sách → **"Chia việc gợi ý… (N thẻ chưa giao)"** → màn xem trước cả đợt,
   bảng "Sau khi áp dụng" cập nhật ngay khi đổi người.
5. Trang **cài đặt không gian** → mục "Gợi ý phân công": ba thanh trượt, số lượt phản hồi,
   trạng thái tự học ("còn 7 lượt"), **lịch sử đổi trọng số** (Tự học / Chỉnh tay) → nói "đây là dữ liệu
   để vẽ **đường hội tụ** trong chương đánh giá".

**Câu chốt sau demo**: *"Cả hai màn hình vừa rồi đều không tự ghi gì vào cơ sở dữ liệu cho đến khi em bấm nút —
và mọi con số các thầy cô nhìn thấy đều mở ra được để xem nó tính từ dữ liệu nào."*

---

## PHẦN F — Câu hỏi hội đồng và cách trả lời

**1. "Em có thật sự dùng AI không, hay chỉ gọi API?"**
Có cả hai phần. Phần gọi API là một lớp trung lập nhà cung cấp — đổi Gemini sang Groq chỉ bằng ba biến môi trường.
Nhưng phần **đóng góp** là lớp **ràng buộc và kiểm chứng** quanh nó: lược đồ không có ô để AI gây hại,
`sourceLine` bắt buộc để đo ảo giác, và quy tắc "luật thắng AI về ngày". Module 2 thì **không dùng LLM một dòng nào** —
toàn bộ thuật toán do em viết.

**2. "Sao không dùng học sâu / mô hình lớn cho module 2?"**
Dữ liệu chỉ vài nghìn thẻ, mô hình lớn sẽ khớp nhiễu. Và bài toán **bắt buộc phải giải thích được**:
không trưởng nhóm nào giao việc theo một con số không rõ từ đâu. Em không nói suông — các mô hình khác
nằm sẵn trong danh sách nhánh đối chứng và có số liệu so.

**3. "Sao không dùng Python / scikit-learn?"**
Toàn bộ là số học cơ bản, chạy ngay trong tiến trình backend, độ trễ dưới một giây.
Thêm Python là thêm một dịch vụ trong Docker, thêm một chỗ hỏng, không thêm năng lực.

**4. "Vậy có huấn luyện mô hình không?"**
Có, nhưng là **học trực tuyến**: perceptron xếp hạng theo cặp, có hàm mất mát, có tốc độ học `eta = 0,05`,
có phép chiếu về miền hợp lệ, và **vẽ được đường hội tụ** — khoảng cách L1 tới gu thật giảm từ 0,90 xuống 0,10.

**5. "Dữ liệu mô phỏng thì đánh giá còn ý nghĩa gì?"** *(câu nguy hiểm nhất — nên nói trước khi bị hỏi)*
Lợi thế của mô phỏng là **biết đáp án tối ưu**, nên đo được **độ hối tiếc** chứ không chỉ đo độ trùng khớp.
Để chống "vòng tròn giữa bộ sinh và bộ chấm", em cho bộ sinh **lệch khỏi giả định của bộ chấm** ở sáu nguồn
và đo lại trên **13 thế giới khác nhau** — nhánh đầy đủ đứng đầu ở 13/13. Nhưng em khai rõ: điều đó chứng minh
thuật toán **hoạt động đúng như thiết kế**, không chứng minh hiệu quả ngoài đời.

**6. "Khác gì chia đều hay chọn người rảnh nhất?"**
Đó đúng là hai trong tám nhánh nền, và có số cụ thể: hơn **người rảnh nhất +0,046** [+0,030; +0,062]
về xác suất đúng hạn, thắng ở 18/20 hạt giống (đây là một trong năm phép so sánh đăng ký trước).
So với chia vòng tròn thì chênh lệch trung bình là 0,441 so với 0,404 — phép này chỉ mang tính mô tả,
không nằm trong năm phép chính.

**7. "Người mới chưa có lịch sử thì sao?"**
Xuống thang ba mức và nói thẳng "chưa đủ căn cứ" thay vì bịa số. Và em **có đo mặt tối**: với chính sách hiện tại,
người mới dễ đứng đầu vì chỉ còn thành phần khả dụng — đã ghi nhận là rủi ro và có hướng xử lý.

**8. "AI có bịa ra công việc không có trong văn bản không?"**
Có thể, và em **đo được**: thẻ không truy vết được về một dòng có thật bị loại và đếm vào `droppedCards`.
Trên bộ dữ liệu 25 mẫu × 3 lần, con số đó là **0%** ở nhánh sản phẩm.

**9. "Nếu AI trả về rác, hoặc mạng chết thì sao?"**
Hệ thống **không bao giờ trả 503**. Mọi nhánh lỗi đều lùi về bản nháp của bộ luật và vẫn trả 200 kèm cảnh báo.
Em đo được tỉ lệ đó: `json_object` hỏng 6,7% số lần gọi, `json_schema` 0%.

**10. "Có rủi ro bảo mật khi cho AI đọc văn bản người dùng dán vào không?"**
Có — đó là *prompt injection*. Em chặn bằng **cấu trúc**: lược đồ gửi cho AI chỉ có tiêu đề, số dòng nguồn,
số ngày lệch và mã màu 0–9 — **không có ô nào** để điền id, người dùng, hay lệnh. Bộ dữ liệu đánh giá có sẵn
một mẫu chứa dòng chèn lệnh (`N03`) và em báo cáo kết quả thật: lớp AI **giảm** chứ không loại bỏ hẳn ảnh hưởng
của dòng đó (biến nó thành thẻ ở 1/3 lần, so với 3/3 lần của bộ luật) — nhưng thẻ đó chỉ là chữ trong một danh sách,
không có quyền hạn nào, và người dùng thấy nó ở màn xem trước.

**11. "Đóng góp riêng của em là gì?"**
Bốn điểm: (a) **độ tin cậy tính theo ngữ cảnh việc đang xét** thay vì một chỉ số tổng;
(b) **mỗi gợi ý kèm bằng chứng truy vết** về đúng những thẻ cũ đã dùng; (c) **trọng số cá nhân hoá theo nhóm,
học được từ phản hồi, có đo bằng số**; (d) **khung đánh giá có đáp án tối ưu đã biết**, cho phép đo độ hối tiếc
chứ không chỉ đo độ trùng khớp. Với module AI: biến chống ảo giác từ lời hứa thành **con số đo được**.

**12. "Hai module này có chạy được không hay chỉ có trong báo cáo?"**
Chạy thật: 864 test backend và 180 test frontend đều xanh, và cả hai đều có giao diện em demo ngay bây giờ được.

---

## PHẦN G — Chưa làm, hướng phát triển, việc cần làm trước buổi báo cáo

### Việc cần làm TRƯỚC khi đi báo cáo

- [ ] **Xoá khoá API Gemini cũ** (đã lộ trong quá trình làm) và tạo khoá mới trên AI Studio, chép vào
      `backend/.env`, rồi `docker restart taskflow-backend`. **Đây là việc quan trọng nhất.**
- [ ] Chạy lại `npm test` ở backend và frontend một lượt để chắc chắn mọi thứ xanh sau các bản vá bảo mật ngày 20–23/09.
- [ ] Bấm thử **UI bước 6b và 8b** trong ứng dụng thật bằng tài khoản `sim1@sim.local` — phần này mới chỉ
      được kiểm bằng test và trang xem thử, **chưa bấm trong app thật**.
- [ ] Mở `CHUONG_5_DANH_GIA_NHAP.docx` bằng Word, kiểm ngắt trang và đánh số lại hình/bảng.
- [ ] Nếu định chiếu slide: lấy sẵn ba bảng A2, B2, B4 và hình đường hội tụ
      `backend/eval-assign-sweeps-hoitu.svg` (dán được thẳng vào Word).

### Hai quyết định còn treo (nên chủ động nói ra)

1. **`DROP` hay `NEUTRAL`** cho người thiếu dữ liệu — hai phép đo độc lập đều **không phân biệt được**,
   nên giữ `DROP` (đúng nguyên tắc "thiếu dữ liệu không kéo điểm xuống").
2. **Có nên thêm trần hoặc phạt điểm cho lớp 2** — số liệu bước 9b cho thấy đánh đổi rất có lợi
   (giảm dồn việc 35,3% → 22,2% với cái giá đúng hạn chỉ 0,014). **Chưa đổi** vì nguyên tắc "không tự ý đổi
   thiết kế đã lên sản phẩm", nhưng đây là ứng viên số một cho bước cải tiến tiếp theo.

### Hướng phát triển (đã ghi trong tài liệu, không viết code)

**Module 1**: xử lý riêng ba kiểu "ngày EXPLICIT thừa" (cách nói mơ hồ, thời lượng bị hiểu là hạn,
ngày đã qua ghi thiếu năm); chạy thêm một nhà cung cấp khác làm thí nghiệm B3 (chỉ đổi 3 biến `.env`);
duyệt lại nhãn của bộ dữ liệu với người gán nhãn thứ hai.

**Module 2**: nhánh **hồi quy logistic** huấn luyện theo lô (60 dòng gradient descent tự viết, vẫn không cần Python)
để có chữ "huấn luyện mô hình" đúng nghĩa; nhánh **embedding** thay TF-IDF dùng lại lớp LLM sẵn có;
phần thưởng nhỏ cho "cơ hội học nghề" của người mới và đo xem nó đánh đổi bao nhiêu.

**Câu cần hỏi lại giảng viên hướng dẫn**: khoa hoặc thầy có **yêu cầu bắt buộc** nào về việc phải dùng Python
hoặc phải có mô hình học máy huấn luyện theo lô không? Nếu có, thêm nhánh hồi quy logistic là đủ đáp ứng
mà không phải kéo Python vào kiến trúc.

---

*Tài liệu này chỉ tổng hợp, không thay thế `AI_MODULE.md` và `ASSIGN_MODULE.md` — hai file đó giữ nhật ký
đầy đủ từng bước, các sai sót đã mắc và cách sửa, nên đọc lại phần "Đọc kết quả" của bước 10 (module 1)
và bước 7b / 9b (module 2) nếu hội đồng hỏi sâu vào một con số cụ thể.*
