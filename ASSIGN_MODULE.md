# Module Gợi ý phân công công việc (cá nhân hoá từ lịch sử)

> **Trạng thái: xong bước 0–8 (kể cả 4b, 6a, 6b, 7a, 7b, 8a, 8b)** — 6a: **học trọng số mức 2** + hồ sơ làm việc cá nhân
> (backend); 6b: **giao diện** (ô Thành viên có gợi ý, mục trọng số ở trang cài đặt không gian); 7: **bộ đánh giá
> offline** (`npm run eval:assign`: 8 nhánh × 20 hạt giống, khoảng tin cậy bootstrap, quét tham số, học trọng số,
> độ bền vững; kết quả ở nhật ký 7a / 7b); 8: **lớp 2 — chia việc cho cả danh sách** (8a backend: `assign.plan.ts` +
> `POST /api/lists/:listId/assignment-plan`, §10.10; 8b giao diện: mục "Chia việc gợi ý…" ở menu danh sách + màn xem trước,
> sửa từng dòng rồi mới áp dụng).
> Thiết kế đã chốt; nền dữ
> liệu mô phỏng, bộ tách từ + TF-IDF + hồ sơ người, **bộ chấm cặp (việc, người)**
> đã có, chạy được trên dữ liệu mô phỏng và **đã chuẩn hoá thành phần trong nhóm
> ứng viên (phương án A)** để trọng số có nghĩa. **Bước 5: API** — xếp hạng ứng viên
> cho một thẻ từ dữ liệu thật trong Postgres, ghi nhật ký `AssignRun`, ghi người được
> chọn, xem/chỉnh/đặt lại trọng số của nhóm (§10). Chưa có đánh giá lớp 2 (bước 9). Còn treo: chính sách cho
> **người chưa có lịch sử** (DROP hay NEUTRAL — nhật ký bước 4b và 7b).
> Tài liệu này là hợp đồng thiết kế; mỗi bước xong sẽ thêm một mục
> "Đã xong — Bước N" ở cuối file, giống cách `AI_MODULE.md` ghi nhật ký.
>
> **Quan hệ với module AI sinh bảng**: độc lập hoàn toàn. Module AI *tạo ra*
> thẻ công việc; module này *gợi ý ai làm* thẻ đó. Module AI cố tình bỏ phần
> gán người (xem `AI_MODULE.md` §2, dòng "Ngoài phạm vi") — phần đó chính là
> module này, làm lại từ đầu với cách tiếp cận khác hẳn.
>
> **Quan hệ với bản v1 đã xoá**: nhánh `ai-module-v1-backup` (commit `bdb8f3a`)
> còn nguyên một module `assign/` cũ dùng **kỹ năng tự khai báo**. Bản này
> **không dùng lại cách tiếp cận đó** (xem §2), nhưng tham khảo được phần khung
> API, `AssignPreviewModal.tsx` và `assignmentLabels.ts` ở bước 8.

---

## 1. Bài toán

**Đầu vào**: một thẻ công việc (tiêu đề, mô tả, ngày bắt đầu, hạn chót) và danh
sách thành viên của bảng.

**Đầu ra**: xếp hạng các thành viên theo độ phù hợp, mỗi người kèm
(a) điểm 0–100, (b) tách nhỏ ba thành phần, (c) **bằng chứng truy vết được** —
những thẻ cũ cụ thể đã dùng để tính ra điểm đó, và (d) cờ cảnh báo.

**Tên học thuật của bài toán**: *task assignee recommendation*, họ hàng gần với
*bug triage* (gán báo lỗi cho lập trình viên). Phương pháp thuộc nhóm *gợi ý
dựa trên nội dung* (content-based recommendation) kết hợp *xếp hạng học từ
phản hồi* (pairwise learning to rank).

**Không phải là**:
- Không tự động gán người. Module chỉ bày bằng chứng, người dùng bấm quyết định.
- Không phải bảng xếp hạng năng lực nhân sự. Không có màn hình "ai giỏi nhất nhóm".
- Không phải chatbot, không gọi LLM ở đường chạy chính.

## 2. Quyết định đã chốt

| Vấn đề | Chốt | Ghi chú |
|---|---|---|
| Nguồn dữ liệu lịch sử | **Tự sinh mô phỏng** | Hệ thống mới, chưa có dự án thật. Xem §7 về cách chống "vòng tròn" |
| Nhận diện chủ đề công việc | **Từ khoá trong tiêu đề + mô tả** (TF-IDF) | Không bắt người dùng gắn nhãn kỹ năng thủ công |
| Công nghệ | **TypeScript thuần trong backend**, không thư viện học máy, không Python | Xem §3 nguyên tắc 1 |
| Học từ phản hồi | **Mức 2 — học trực tuyến trọng số theo nhóm** | Mức 1 (chỉ thống kê) là bước đệm bắt buộc |
| Kiến trúc | **Hai lớp tách rời**: lớp 1 chấm cặp (việc, người); lớp 2 xếp việc cho cả nhóm | Xem §4 |
| Thứ tự làm | Lớp 1 xong hẳn (có số liệu) rồi mới tới lớp 2 | Hết thời gian vẫn còn một khoá luận trọn vẹn |
| Cách tiếp cận bị loại | Kỹ năng **tự khai báo** kiểu v1 | Không phải cá nhân hoá từ dữ liệu — đúng chỗ GVHD góp ý |
| Phạm vi hồ sơ | Theo **không gian làm việc**, mượn toàn cục chỉ khi bật công tắc | Mặc định TẮT vì lý do riêng tư |
| Nhánh tuỳ chọn | Hồi quy logistic (huấn luyện theo lô) + nhánh embedding | Chỉ là nhánh đối chứng ở bước 7, không phải đường chạy chính |

### Vì sao không dùng thư viện / Python

| Lựa chọn | Vì sao loại |
|---|---|
| `natural` (TF-IDF cho Node) | Tách từ hướng tiếng Anh; và mất khả năng giải thích từng con số trước hội đồng |
| Python + scikit-learn qua tiến trình con | Thêm một tiến trình trong Docker cạnh Node = thêm một chỗ hỏng, không thêm năng lực |
| Embedding / LLM để so chủ đề | Tốn khoá, chậm, không tái lập được. Giữ lại làm **nhánh đối chứng** ở bước 7 |

Toàn bộ phần tính toán ước chừng 200–250 dòng. Dữ liệu vài nghìn thẻ nên không
cần tối ưu.

## 3. Nguyên tắc thiết kế

1. **Mọi con số phải giải thích được.** Nếu không vẽ được công thức lên giấy và
   chỉ ra dữ liệu nào tạo ra nó thì không đưa vào.
2. **Mọi điểm số phải có bằng chứng truy vết.** Mỗi gợi ý kèm đúng những thẻ cũ
   đã dùng để tính. Cùng triết lý với `sourceLine` của module AI.
3. **Thiếu dữ liệu thì nói thiếu, không bịa số.** Người không có lịch sử được
   gắn cờ `NO_HISTORY`, không phải bị chấm 0 điểm.
4. **Thành phần thiếu dữ liệu không được kéo điểm xuống.** Điểm tổng chia lại
   theo tổng trọng số của những thành phần *thực sự có dữ liệu* (kỹ thuật
   `completeness` — điểm duy nhất của engine v1 đáng giữ lại).
5. **Lõi tính toán là hàm thuần, không biết Prisma.** Nhận một "ảnh chụp" dữ
   liệu, trả kết quả. Nhờ vậy test được bằng vitest và đo được bằng script
   offline mà không cần dựng CSDL.
6. **Không tự động hoá quyết định về con người.** Module đề xuất, người quyết.

## 4. Kiến trúc hai lớp

```
Lớp 2 — xếp việc cho cả nhóm (bước 8)
   xếp việc theo hạn gấp trước, mỗi việc gọi lớp 1,
   người vừa nhận việc bị trừ điểm dần ở các việc sau
        |
        v
Lớp 1 — chấm cặp (việc, người)   <-- "module đánh giá độ phù hợp"
   hàm thuần: ảnh chụp dữ liệu -> điểm + bằng chứng
        |
        v
Tầng hồ sơ — TF-IDF, hồ sơ người, k láng giềng gần nhất
```

**Vì sao phải tách**: nếu chỉ có lớp 1, gợi ý cho cả nhóm sẽ dồn **mọi việc cho
người giỏi nhất**, vì việc nào người đó cũng hợp nhất. Lớp 2 tồn tại chỉ để cân
tải. Tách ra còn giữ được lớp 1 là hàm thuần, dễ kiểm thử và dễ đo.

**Vì sao lớp 2 phải tối giản**: engine v1 (`assign/engine.ts`, 144 dòng) dựng sổ
tải theo từng ngày, đặt chỗ ngược từ cuối, theo dõi "nợ giờ" — chính chỗ này làm
v1 phình to rồi bị xoá. Lớp 2 bản này chỉ là vòng lặp tham lam khoảng 50 dòng (đã cài ở bước 8: `assign.plan.ts`, §10.10).

## 5. Công thức và tham số mặc định

### 5.1 Tách từ (đã hiện thực ở bước 3: `assign.text.ts`)

- Chuẩn hoá NFC, hạ chữ thường, bỏ dấu — **dùng lại** `normalizeText`
  (`ai.rules.ts:86`) và `foldText` (`ai.rules.ts:111`, bỏ dấu từng ký tự, `đ → d`).
- **Hư từ được nhận diện trên dạng CÓ DẤU, sau đó mới bỏ dấu.** Bỏ dấu làm các từ
  khác nghĩa đụng nhau: `bằng`/`bảng` → `bang`, `đang`/`đăng` → `dang`,
  `trong`/`trọng` → `trong`, `cơ`/`có`, `nền`/`nên`, `đề`/`để`, `vẽ`/`về`, `vá`/`và`,
  `tải`/`tại`. Xét hư từ trên dạng đã bỏ dấu sẽ xoá mất `bảng`, `đăng`, `trọng` —
  ba từ nội dung của chính dự án này. Có **79 hư từ có dấu** (`STOP_ACCENTED`) và
  **13 hư từ khi gõ không dấu** (`STOP_PLAIN`, chỉ những dạng không mơ hồ). Cố ý
  **không** đưa vào: `chỉ` (chỉ mục), `từ` (từ khoá), `quá` (quá hạn), `the` (= `thẻ`,
  từ trung tâm của ứng dụng), `that` (= `thất bại`).
- Sinh **uni-gram + bi-gram liền kề**, mỗi token qua bộ lọc: dài 2–30 ký tự, không
  toàn chữ số, không phải hư từ. **Bi-gram không bắc qua** hư từ, token bị bỏ, hay dấu
  câu (`. , ; : ! ? ( ) [ ] { } " / | …` và xuống dòng) — dấu gạch nối, gạch dưới,
  khoảng trắng và ký hiệu khác chỉ tách token. Bi-gram là cách rẻ nhất để bắt cụm
  "đăng nhập", "kiểm thử", "cơ sở dữ liệu" mà không cần thư viện tách từ.
- Chỉ đọc tối đa **4000 ký tự** mỗi trường (mô tả thẻ có thể rất dài); bộ quét đi một
  lần theo từng ký tự, không dùng regex trên cả chuỗi → thời gian tuyến tính.
- **Tiêu đề đếm gấp đôi mô tả** (`TITLE_WEIGHT = 2`, xem §5.8 — đây là quyết định
  tiên nghiệm, chưa có bằng chứng).

### 5.2 TF-IDF và độ giống

- Kho ngữ liệu = mọi thẻ của không gian làm việc (cả đã xong lẫn đang mở).
- `tf(t,d) = 1 + log(số lần xuất hiện)` nếu có, ngược lại 0.
- `idf(t) = log((N+1)/(df+1)) + 1` — làm trơn để từ mới không chia cho 0.
- Véc-tơ chuẩn hoá về độ dài 1, nên **độ giống = tích vô hướng** (cosine),
  nằm trong `[0,1]`.

### 5.3 Suy giảm theo thời gian

`decay(d) = 0.5 ^ (d / H)` với `d` = số ngày từ lúc hoàn thành tới `now`,
**nửa đời `H = 90` ngày**. Nói "nửa đời 90 ngày" dễ hiểu hơn nói hằng số tau.

### 5.4 Điểm kinh nghiệm chủ đề

Với người `u` và thẻ mới `c`, xét các thẻ `u` đã hoàn thành:

1. `sim_i` = độ giống giữa `c` và thẻ cũ `i`; bỏ các thẻ có `sim_i < 0.05`.
2. Lấy **K = 5** thẻ có `sim_i` lớn nhất. `w_i = decay(i)`.
3. `fit = tổng(w_i * sim_i) / tổng(w_i)` — *chất lượng khớp*, trong `[0,1]`,
   không phụ thuộc số lượng.
4. `evidence = tổng(w_i)` — *lượng bằng chứng* đã suy giảm theo thời gian,
   hiểu là "số thẻ hiệu dụng".
5. **`experience = fit * evidence / (evidence + 2)`**

Tách `fit` và `evidence` để hai ý nghĩa không lẫn vào nhau: một người khớp rất
đúng nhưng chỉ có một thẻ cũ từ hai năm trước thì `fit` cao mà `evidence` thấp,
và điểm cuối phải phản ánh được điều đó.

> Đã cân nhắc và loại: gộp toàn bộ lịch sử thành **một** véc-tơ hồ sơ rồi lấy
> cosine. Cách đó pha loãng — người làm 50 thẻ đủ loại trông giống mọi thứ một
> cách nhạt nhoà. Dùng k láng giềng gần nhất giữ được độ sắc nét và cho luôn
> bằng chứng để hiển thị.

### 5.5 Điểm tin cậy (chất lượng, tính theo đúng việc đang xét)

Trên **đúng K thẻ** ở trên, trọng số `v_i = w_i * sim_i` (vừa mới vừa liên quan):

- `outcome_i` = 1 nếu xong đúng hạn và chưa từng bị mở lại; 0.5 nếu đúng hạn
  nhưng từng bị mở lại; 0 nếu trễ hạn. Thẻ không đặt hạn thì loại khỏi phép tính.
- Co về trung bình nhóm `muy` (tỉ lệ đúng hạn của cả không gian làm việc), với
  **`m = 3`**:

  **`reliability = (tổng(v_i * outcome_i) + m * muy) / (tổng(v_i) + m)`**

Đây là làm trơn kiểu Bayes, một dòng, và xử lý gọn cái bẫy "người mới làm đúng
hạn 1 thẻ thành 100%".

Nếu cả không gian làm việc chưa có thẻ nào hoàn thành thì `muy` không tồn tại →
thành phần này báo **không có dữ liệu** (xem nguyên tắc 4).

### 5.6 Điểm khả dụng

- `load` = số thẻ đang mở của `u` có khoảng thời gian **chồng lấn** khoảng của
  thẻ mới. Thẻ mới không có ngày thì lấy cửa sổ 14 ngày tới.
- `cap` = ngưỡng từ hồ sơ, **mặc định 5 thẻ song song**, chỉnh được.
- `availability = max(0, 1 - load / cap)`; nếu `load >= cap` thì bằng 0 và gắn
  cờ `OVERLOADED`.

### 5.7 Điểm tổng và độ tin cậy của điểm

- Trọng số mặc định: **kinh nghiệm 0.45 · tin cậy 0.30 · khả dụng 0.25**.
- `score = tổng(trọng số_k * điểm_k) / tổng(trọng số_k)` — **chỉ cộng những
  thành phần có dữ liệu**, rồi nhân 100.
- Không thành phần nào có dữ liệu → `score = null`, cờ `NO_DATA`.
- `confidence = evidence / (evidence + 3)`, chia ba mức hiển thị:
  dưới 0.25 = "dữ liệu mỏng", dưới 0.6 = "vừa đủ", còn lại = "đủ".

> **Xếp hạng có chuẩn hoá (đã xử lý ở bước 4b):** ba thành phần **không cùng thang** —
> trên cùng một thẻ, khả dụng trải rộng gấp ~5 lần kinh nghiệm và ~9 lần tin cậy, nên
> cộng thô thì trọng số 0,45 / 0,30 / 0,25 thực ra cho ảnh hưởng 23% / 9% / 67%. Vì vậy
> khi **xếp hạng** (`rankCandidates`), mỗi thành phần được **chuẩn hoá min-max trong nhóm
> ứng viên của thẻ đó** trước khi cộng (người thấp nhất nhóm = 0, cao nhất = 1; cả nhóm
> bằng nhau = 0,5). Nhờ đó trọng số là tầm quan trọng *tương đối* (ảnh hưởng thực tế
> 45% / 29% / 25%). Hệ quả: `score` của lúc xếp hạng là **điểm tương đối trong nhóm**;
> điểm thô §5.7 nguyên văn vẫn có ở `rawScore`. Chi tiết và số đo: nhật ký bước 4b.

### 5.8 Bảng tham số (đều sẽ được quét ở bước 7, không chọn bừa)

| Ký hiệu | Ý nghĩa | Mặc định |
|---|---|---|
| `H` | Nửa đời suy giảm thời gian | 90 ngày |
| `K` | Số thẻ cũ giống nhất đem xét | 5 |
| `simMin` | Ngưỡng bỏ thẻ quá khác | 0.05 |
| `m_e` | Hệ số bão hoà lượng bằng chứng | 2 |
| `m` | Hệ số co về trung bình nhóm | 3 |
| `cap` | Số thẻ song song tối đa | 5 |
| `eta` | Tốc độ học trọng số | 0.05 |
| trọng số | kinh nghiệm / tin cậy / khả dụng | 0.45 / 0.30 / 0.25 |
| `TITLE_WEIGHT` | Trọng số tiêu đề so với mô tả khi đếm thuật ngữ | 2 (**chưa có bằng chứng**: trên dữ liệu mô phỏng ×2 và ×1 cho kết quả ngang nhau — 3 hạt giống dương, 3 âm) |
| `MAX_TEXT_CHARS` / `MAX_TOKEN_CHARS` | Số ký tự đọc tối đa mỗi trường / độ dài token tối đa (tối thiểu 2) | 4000 / 30 |
| `confidenceScale` | Mẫu số của `confidence = e / (e + c)` | 3 |
| `defaultWindowDays` | Độ dài cửa sổ mặc định khi thẻ mới thiếu ngày | 14 ngày |
| `normalize` | Cách đưa ba thành phần về cùng thang khi xếp hạng: `MINMAX` / `NONE` (cộng thô) | `MINMAX` |
| `missing` | Thành phần thiếu dữ liệu: `DROP` (bỏ, nguyên tắc 4) / `NEUTRAL` (thay bằng trung bình nhóm) | `DROP` |

### 5.9 Các chỗ §5.4–5.7 để hở, đã chốt ở bước 4 (`assign.score.ts`)

1. **Cửa sổ của thẻ mới thiếu ngày**: không có cả hai → `[now, now + 14 ngày]`; chỉ có
   hạn → `[min(now, hạn), hạn]`; chỉ có bắt đầu → `[bắt đầu, bắt đầu + 14 ngày]`; ngày
   đảo ngược được coi là đoạn giữa hai ngày; ngày không hợp lệ coi như không có.
2. **Thẻ đang mở của ứng viên** chiếm khoảng `[bắt đầu, hạn]` nhưng **kéo dài ít nhất đến
   `now`** (việc quá hạn vẫn chiếm chỗ); thiếu bắt đầu = đã bắt đầu từ lâu, thiếu hạn =
   chưa có hạn (kéo dài vô hạn về sau); ngày đảo ngược = đoạn giữa hai ngày; thẻ đang được
   chấm không tự tính vào tải của chính nó.
3. **Người có `pausedUntil` ≥ lúc bắt đầu cửa sổ**: khả dụng = 0 và cờ `PAUSED` (số thẻ
   đang mở vẫn được đếm).
4. **Chống rò rỉ tương lai**: thẻ xong **sau `now`** không bao giờ được dùng (ở hồ sơ, ở
   trung bình nhóm `muy`); chính thẻ đang xét bị loại khỏi lịch sử. Vô nghĩa khi chạy thật
   (`now` = bây giờ) nhưng **bắt buộc khi phát lại lịch sử** ở bước 7.
5. **Thiếu dữ liệu**: không có thẻ nào đã xong → `NO_HISTORY` (không chấm kinh nghiệm *và*
   tin cậy, chỉ còn khả dụng); có lịch sử nhưng không thẻ nào giống → `NO_SIMILAR` (kinh
   nghiệm = 0 — "đã tìm và không thấy" — còn tin cậy lùi về `muy`); `muy` không tồn tại →
   thành phần tin cậy vắng cho mọi người.
6. **Chỉ thẻ có `sim > 0` mới là bằng chứng**, kể cả khi `simMin = 0` (thẻ sim = 0 sẽ làm
   phồng `evidence` mà không mang thông tin).
7. **Hoà điểm khi xếp hạng**: điểm cao hơn trước; không có điểm (`null`) xuống cuối; hoà
   thì độ tin cậy cao hơn trước; rồi `userId`. Kết quả không phụ thuộc thứ tự đầu vào.
8. **Chuẩn hoá (bước 4b)**: chỉ ở `rankCandidates` (cần "nhóm" để so). Tính riêng cho từng
   thành phần, trên những ứng viên **có** thành phần đó: `(v − min) / (max − min)`; nếu
   `max = min` (cả nhóm bằng nhau, hoặc chỉ một người có) → **0,5**. Giá trị thô `value`
   không đổi; giá trị dùng để cộng là `scaled`; `rawScore` là điểm thô §5.7 nguyên văn.
   `scoreCandidate` (chấm một người) không chuẩn hoá và bỏ qua hai tuỳ chọn.
9. **Thiếu dữ liệu khi xếp hạng**: `DROP` (mặc định, nguyên tắc 4) bỏ thành phần thiếu và
   chia lại theo trọng số còn lại; `NEUTRAL` thay bằng **trung bình** giá trị chuẩn hoá của
   những người có dữ liệu (không ai có → vẫn bỏ). `value` luôn giữ `null` để giao diện hiện
   "chưa có dữ liệu"; `share` phản ánh phần đóng góp thực sự.
10. **Ý nghĩa của `score`**: là điểm **tương đối trong nhóm cho đúng thẻ này**. Không so sánh
    được giữa hai thẻ hay hai nhóm; một nhóm chỉ có một người thì luôn 50. Giao diện phải hiện
    các giá trị **thô** (kinh nghiệm/tin cậy/khả dụng) để người dùng hiểu ý nghĩa tuyệt đối.
11. **Tất định tuyệt đối**: trung bình dùng cho `NEUTRAL` được cộng theo thứ tự tăng dần, vì
    phép cộng số thực không giao hoán — cộng theo thứ tự ứng viên đầu vào làm điểm lệch ở chữ
    số cuối khi đổi thứ tự, đủ để hai điểm sát nhau đổi hạng.

## 6. Cá nhân hoá nằm ở đâu — bốn chỗ

1. **Hồ sơ riêng từng người**, dựng từ chính thẻ họ đã hoàn thành (§5.4).
2. **Chất lượng tính theo ngữ cảnh việc đang xét** (§5.5) — cùng một người có
   điểm tin cậy khác nhau ở hai loại việc khác nhau. Đây là điểm khác biệt chính
   so với các hệ thống chỉ có một chỉ số "tỉ lệ hoàn thành" chung.
3. **Trọng số riêng cho từng nhóm** — mỗi không gian làm việc có bộ ba trọng số
   riêng, trưởng nhóm chỉnh được bằng thanh trượt.
4. **Trọng số đó tự học từ phản hồi của chính nhóm đó** (§8).

### Xuống thang khi thiếu dữ liệu

| Tình huống | Hành vi |
|---|---|
| 0 thẻ lịch sử | Không chấm kinh nghiệm, cờ `NO_HISTORY`, chỉ xét khả dụng |
| Ít thẻ | Co mạnh về trung bình nhóm, gắn nhãn "dữ liệu mỏng" |
| Đủ thẻ | Dùng hồ sơ riêng đầy đủ |

Ba mức này **phải hiện ra giao diện**, không được giấu.

### Mặt tối phải đo, không né

Học từ lịch sử có nguy cơ khiến người mới mãi không được giao việc mới. Bước 7
đo **hệ số Gini về phân bố việc** như một chỉ số phụ; nếu còn thời gian thì thêm
một phần thưởng nhỏ cho "cơ hội học nghề" và đo xem nó đánh đổi bao nhiêu.

## 7. Bộ sinh dữ liệu mô phỏng

**Rủi ro lớn nhất của cả khoá luận nằm ở đây**: bộ sinh và bộ chấm cùng do một
người viết, cùng một giả định thì thắng là đương nhiên, và hội đồng sẽ chỉ ra.

**Nhưng mô phỏng có một lợi thế dữ liệu thật không có**: biết **đáp án tối ưu**.
Mỗi người mô phỏng có một véc-tơ **kỹ năng ẩn** mà bộ chấm không bao giờ nhìn
thấy — nó chỉ thấy chữ trong thẻ và kết quả hoàn thành. Nhờ vậy đo được khoảng
cách tới lựa chọn tốt nhất, chứ không chỉ đo "có trùng người đã được giao ngoài
đời hay không" (mà người đó chưa chắc đúng).

### Cách chống vòng tròn — bộ sinh phải lệch khỏi giả định của bộ chấm

| Nguồn lệch | Cụ thể |
|---|---|
| Từ vựng | Mỗi chủ đề ẩn có bộ từ riêng, nhưng thẻ sinh ra có **từ đồng nghĩa, viết tắt, lỗi chính tả** — không khớp từ khoá y hệt |
| Phân công lịch sử sai | 20–30% thẻ giao cho người không hợp, như ngoài đời |
| Kỹ năng thay đổi | Một số người **học nghề**, kỹ năng ẩn tăng dần theo thời gian |
| Người mới / người nghỉ | Có người tham gia muộn, có người nghỉ giữa chừng |
| Thẻ mơ hồ | Một phần thẻ có tiêu đề không đoán được chủ đề |
| Kết quả ngẫu nhiên | Đúng hạn sinh theo **xác suất** phụ thuộc kỹ năng và tải, có nhiễu — không phải "hợp thì luôn đúng hạn" |

### Đóng băng

Hạt giống LCG cố định + sha256 toàn bộ tập dữ liệu, giống cách `evalDataset.ts`
đã làm ở bước 10 của module AI. Bộ sinh cho ra một đối tượng dữ liệu tất định;
từ đó có hai đường: một đường đổ vào Postgres qua Prisma để demo được trong sản
phẩm, một đường nạp thẳng vào script đánh giá (không cần CSDL).

### Câu phải viết trong luận văn

Kết quả trên dữ liệu mô phỏng chứng minh **thuật toán hoạt động đúng như thiết
kế**; nó **không** chứng minh hiệu quả trong môi trường thật. Chủ động nói trước
thì đó là sự cẩn trọng về phương pháp; để hội đồng chỉ ra thì đó là lỗ hổng.

## 8. Học trọng số (mức 2)

**Thuật toán**: cập nhật kiểu **perceptron xếp hạng theo cặp** — cùng họ với
RankNet. Học trực tuyến, không cần huấn luyện offline, không cần thư viện.

Khi module xếp `a` đứng đầu mà người dùng chọn `b` (khác `a`):

- Gọi `x_a`, `x_b` là véc-tơ ba thành phần của hai người.
- Nếu `score(a) > score(b)`: `trọng số <- trọng số + eta * (x_b - x_a)`, `eta = 0.05`.
- Đưa về tập hợp lệ: mỗi trọng số trong `[0.05, 0.70]`, tổng bằng 1. **Cài đặt dùng phép chiếu
  vuông góc** (điểm hợp lệ gần nhất) thay cho "kẹp rồi chia cho tổng" — xem "Cài đặt (bước 6a)" bên
  dưới vì sao.

**Bốn chốt chặn để không loạn**:

1. Chỉ bắt đầu học sau **ít nhất 10 lượt** có phản hồi trong nhóm đó; trước đó
   chỉ ghi nhận (mức 1).
2. Chỉ học khi người được chọn **nằm trong danh sách ứng viên đã chấm**.
3. Chỉ học khi cả hai người **đủ cả ba thành phần** — tránh học từ so sánh khập
   khiễng giữa người có dữ liệu và người không.
4. Lưu **lịch sử mọi lần đổi trọng số** → vẽ được **đường hội tụ** trong luận
   văn. Biểu đồ đó chính là bằng chứng nhìn thấy được rằng cá nhân hoá có xảy ra.

Có nút đặt lại về mặc định. Trọng số hiện tại luôn xem được, không giấu.

### Cài đặt (bước 6a — `assign.learn.ts`, `assign.repo.ts › decideAndLearn`)

- **Đặc trưng `x` là giá trị đã chuẩn hoá `scaled`** (thứ thực sự tạo ra điểm, bước 4b), không phải
  giá trị thô: bước cập nhật phải đi đúng hướng với cái đã xếp sai. Đọc lại từ `AssignRun.candidates`.
- **Phép chiếu thay cho "kẹp rồi chuẩn hoá"**: kẹp từng số rồi chia cho tổng **có thể phá chính bất
  biến §14** — `(0,70; 0,05; 0,05)` chuẩn hoá thành `(0,875; 0,0625; 0,0625)`, vượt trần 0,70. Phép chiếu
  tìm điểm hợp lệ **gần nhất**: `w_i = kẹp(v_i − τ)` với `τ` chọn (chia đôi, tất định) sao cho tổng = 1;
  luôn có nghiệm vì tổng chạy từ `3 × 0,70 = 2,1` xuống `3 × 0,05 = 0,15`. Cùng ý đồ, chính xác hơn.
- **Quyết định "có học không" là hàm thuần** (`learningDecision`), kiểm theo thứ tự cố định và trả **lý
  do**: `NO_TOP` → `ACCEPTED` (giao đúng người xếp đầu: không có lỗi để sửa) → `TOO_EARLY` (chưa đủ 10
  lượt) → `NOT_CANDIDATE` → `MISSING_COMPONENT` → `TIE` (điểm không lớn hơn hẳn: người xếp đầu chỉ
  hơn nhờ tie-break) → `NO_CHANGE` (chiếu xong vẫn không đổi) → `LEARNED`.
- **Mỗi lượt ghi được đều tính vào `feedbackCount`** (kể cả giao đúng người xếp đầu hay không học được);
  học chỉ xảy ra từ lượt thứ 10 trở đi (`feedbackCount` **sau khi cộng** ≥ 10) và chỉ khi giao người
  KHÁC người xếp đầu — đúng bản chất perceptron: không có lỗi thì không cập nhật.
- **Một giao dịch, khoá dòng**: ghi người được chọn (`updateMany where decidedAt = null`) → `SELECT … FOR
  UPDATE` dòng trọng số của nhóm → cộng số lượt, quyết định, (nếu học) ghi trọng số mới + một dòng
  `AssignWeightHistory` kèm `runId` + `AssignRun.learned = true`. Khoá dòng để hai lượt phản hồi (hoặc
  một lượt và một lần chỉnh tay) của cùng nhóm **nối đuôi nhau**, không ai ghi đè mất cập nhật của
  người kia. Cả bước chỉnh tay `saveWeights` cũng khoá cùng dòng.
- **Đo trước khi viết expect** (trưởng nhóm mô phỏng có thiên lệch cố định, 8 hạt giống, 300 vòng,
  4 ứng viên/vòng, đặc trưng ngẫu nhiên trong [0,1]; `assign.learn.test.ts`): khoảng cách L1 giữa trọng
  số học được và thiên lệch **0,50 → 0,03 · 0,90 → 0,02 · 0,80 → 0,03** (8/8 hạt giống), đồng ý top-1
  với trưởng nhóm 76–88% → 98–99%, chỉ ~25/300 vòng thực sự cập nhật. Trưởng nhóm **không nhất quán**
  (nhiễu ±0,15): L1 → 0,10–0,16, đồng ý 66–78% → 76–78%. **Đối chứng**: trưởng nhóm chọn đúng theo trọng
  số mặc định thì **không học gì** (trọng số nguyên vẹn). **Lưu ý trung thực**: với trưởng nhóm nhiễu mà
  thiên lệch trùng mặc định, trọng số **trôi** ~0,11 (L1) khỏi mặc định — perceptron với nhãn nhiễu và
  `eta` cố định không có cơ chế giữ chỗ; bước 7 cần quét `eta` (và cân nhắc biên độ/giảm dần) trước khi
  tuyên bố học "ổn định". Đây là số trên **người chọn giả**, chưa phải người thật.

**Cách đo mức 2 trên dữ liệu mô phỏng**: cho "trưởng nhóm mô phỏng" một thiên
lệch cố định (ví dụ luôn ưu ái tốc độ hơn kinh nghiệm), rồi đo sau bao nhiêu
lượt thì trọng số học được bám theo thiên lệch đó, và khoảng cách còn lại là bao
nhiêu.

## 9. Schema Prisma dự kiến (bước 1)

**Sửa bảng có sẵn** — bốn thay đổi rẻ nhưng bắt buộc:

| Thay đổi | Vì sao cần |
|---|---|
| `Card.completedAt DateTime?` | Hiện chỉ có `isDone` boolean → không tính được đúng hạn hay trễ |
| `CardMember.createdAt DateTime @default(now())` | Bảng hiện **không có mốc thời gian** → không biết được giao lúc nào, không tính được tốc độ |
| `CardMember.assignedById String?` | Phân biệt tự nhận việc với được giao việc |
| `Activity` kiểu `member.add` thêm `memberId` vào `data` | Hiện `cardExtras.service.ts:49` **chỉ lưu `memberName`** — trùng tên là sai người |

**Bảng mới** (theo bài học module AI: ít bảng, mọi khoá ngoại `SetNull`, không `Cascade`):

| Bảng | Nội dung |
|---|---|
| `MemberWorkProfile` | Theo cặp (người, không gian làm việc): số thẻ song song tối đa, tạm nghỉ tới ngày nào, công tắc cho phép mượn lịch sử chéo không gian (mặc định tắt) |
| `WorkspaceAssignWeights` | Ba trọng số hiện tại của nhóm + số lượt phản hồi đã nhận |
| `AssignWeightHistory` | Mỗi lần trọng số đổi ghi một dòng → vẽ đường hội tụ |
| `AssignRun` | Mỗi lượt gợi ý: danh sách ứng viên đã chấm (JSON), người xếp đầu, người thực sự được chọn, thời điểm chấp nhận, phiên bản thuật toán, độ trễ |

`AssignRun` vừa là nhật ký vừa là **nguồn dữ liệu đánh giá trực tuyến** (tỉ lệ
chấp nhận) vừa là đầu vào cho mức 2. Một bảng làm ba việc.

> **Cảnh báo migration** (bài học cũ, bắt buộc đọc lại): `prisma migrate dev`
> **không dùng được** trong repo này vì hai migration cũ bị sửa sau khi áp. Phải
> dùng `prisma migrate diff --from-schema ... --to-schema ... --script` rồi
> `migrate deploy`. Và `prisma generate` phải chạy cả trên host lẫn trong
> container vì `src/generated/prisma` là volume ẩn danh.

## 10. Thiết kế API

| Phương thức | Đường dẫn | Việc | Trạng thái |
|---|---|---|---|
| GET | `/api/cards/:cardId/assignment-suggestions` | Lớp 1: xếp hạng ứng viên cho một thẻ, trả kèm bằng chứng và `runId` | **bước 5** |
| POST | `/api/assignment/runs/:runId/outcome` | Ghi người thực sự được chọn (nuôi mức 1 và mức 2) | **bước 5** (ghi nhận) + **6a** (học) |
| GET / PUT / DELETE | `/api/workspaces/:workspaceId/assignment-weights` | Xem (kèm lịch sử, số phản hồi, trạng thái học), chỉnh ba thanh trượt, đặt lại mặc định | **bước 5** + **6a** (trường mới) |
| GET / PUT | `/api/workspaces/:workspaceId/assignment-profile` | Hồ sơ làm việc của **chính người gọi**: số thẻ chồng lấn tối đa, tạm nghỉ đến ngày | **bước 6a** |
| POST | `/api/lists/:listId/assignment-plan` | Lớp 2: chia các thẻ **chưa có người nhận** của danh sách, trả bản **xem trước** (không ghi gì) | **bước 8a** (giao diện: **8b**) |

Phân quyền: chỉ người **sửa được thẻ** mới gọi được gợi ý (đúng hàm `assertCardAccess` của thao
tác sửa thẻ → VIEWER và người ngoài bảng bị chặn); chỉ OWNER/ADMIN của không gian làm việc mới sửa
được trọng số (mọi thành viên không gian xem được). Lượt gợi ý chỉ chính người bấm mới ghi được kết
quả.

### 10.1 Cấu trúc mã (bước 5)

```
assign.repo.ts      chỉ đọc/ghi Prisma, không logic tính điểm
assign.snapshot.ts  hàm thuần: dòng CSDL -> { idf, mu, ứng viên }  (cùng hình dạng snapshotAsOf của bộ mô phỏng)
assign.score.ts     bộ chấm (bước 4/4b), KHÔNG sửa
assign.service.ts   nối các tầng + quyền + che riêng tư + nhật ký AssignRun
assign.weights.ts   hằng số + kiểm tra ba trọng số (hàm thuần)
assign.learn.ts     học trọng số mức 2 (hàm thuần: phép chiếu, bước cập nhật, quyết định "có học không")  [6a]
assign.schema.ts / assign.controller.ts / assign.routes.ts   zod, Express
```

Vì sao có `assign.snapshot.ts` riêng: mọi quy tắc "thẻ nào là lịch sử, thẻ nào đang mở" nằm ở **một
hàm thuần** thay vì rải trong truy vấn Prisma, nên test được không cần CSDL và **đối chiếu được tận
từng con số** với đường bộ nhớ của bước 4b (`assign.equivalence.test.ts`).

### 10.2 Luồng `GET .../assignment-suggestions`

1. `assertCardAccess` → 404 (thẻ/bảng không có hoặc đã lưu trữ) hoặc 403 (VIEWER, người ngoài bảng).
2. **Ứng viên** = chủ bảng + thành viên bảng không phải VIEWER + (bảng ở mức WORKSPACE) chủ và thành
   viên không gian; bỏ người đã bị gỡ và tài khoản đã xoá. Khớp **đúng** `isBoardParticipant` (có
   test đối chiếu) — nếu không, gợi ý ra người mà bấm "giao" lại bị `addCardMember` từ chối 400.
3. Đọc dữ liệu của **không gian làm việc chứa thẻ** (không đọc chéo không gian): mọi thẻ chưa xoá,
   các liên kết thẻ–người của ứng viên, các thẻ từng bị mở lại (`card.undone`), `MemberWorkProfile`,
   `WorkspaceAssignWeights`, tập bảng mà **người hỏi** xem được.
4. `buildSnapshot()` → `rankCandidates()` (chuẩn hoá `MINMAX`, thiếu dữ liệu `DROP` — hai lựa chọn
   được ghi cứng trong `assign.service.ts` và nằm trong `algorithmVersion`, không dựa vào mặc định
   của bộ chấm).
5. Che tiêu đề bằng chứng (§10.4), ghi **một** dòng `AssignRun`, trả JSON. Không có ứng viên nào →
   `runId = null`, không ghi nhật ký.

**Quy tắc "tại thời điểm `now`"** (`assign.snapshot.ts`; `now` là tham số, mặc định bây giờ):

| Đối tượng | Quy tắc |
|---|---|
| Kho ngữ liệu IDF | mọi thẻ **đã có** lúc `now` (`createdAt <= now`), kể cả thẻ đã xong, đã lưu trữ, không ai nhận |
| Lịch sử của người | thẻ họ được gán (đã có lúc `now`), `isDone`, `completedAt <= now`; **kể cả bảng/danh sách/thẻ đã lưu trữ** (chính là "dự án cũ") |
| Thẻ đang mở của người | chưa xong, **hoặc xong sau `now`**; thẻ/danh sách/bảng đã lưu trữ **không** chiếm tải |
| Thẻ đang chấm | không bao giờ nằm trong lịch sử hay thẻ đang mở của ai |
| Bị loại hẳn | thẻ, danh sách, bảng đã **xoá** (`deletedAt`); mọi thứ ở không gian khác |
| Dòng hỏng | ngày không hợp lệ, sức chứa không phải số nguyên ≥ 1, `isDone` mà không có `completedAt` → bị bỏ, không ném lỗi |

### 10.3 Dạng trả về

```jsonc
{ "success": true, "data": {
  "runId": "…", "card": { "id", "title", "boardId", "workspaceId" },
  "algorithmVersion": "knn-tfidf-v1/minmax/drop", "generatedAt": "…",
  "weights": { "experience": 0.45, "reliability": 0.3, "availability": 0.25, "custom": false },
  "groupOnTimeRate": 0.62,            // muy của nhóm, null nếu chưa thẻ nào có hạn
  "candidateCount": 6,
  "candidates": [{
    "rank": 1, "user": { "id", "name", "avatarUrl" },            // KHÔNG có email
    "score": 78.4,                    // TƯƠNG ĐỐI trong nhóm ứng viên của thẻ này, 0–100; null = không dữ liệu
    "rawScore": 61.2,                 // điểm thô §5.7 nguyên văn
    "confidence": 0.62, "confidenceLevel": "GOOD",
    "components": { "experience": { "value", "weight", "scaled", "share" }, "reliability": {…}, "availability": {…} },
    "fit": 0.71, "evidenceMass": 3.1, "load": 2, "capacity": 5, "flags": [],
    "assigned": false,                // đã ở trong thẻ này rồi
    "evidence": [{ "cardId", "title": "… hoặc null nếu bảng riêng tư", "sim", "weight", "outcome", "completedAt", "dueDate" }]
  }] } }
```

Giao diện **phải** hiện các giá trị thô (`components.*.value`, `load/capacity`) cạnh điểm tương đối,
vì `score` không so sánh được giữa hai thẻ (§5.9 mục 10).

### 10.4 Riêng tư

- **Che tiêu đề bằng chứng**: mỗi thẻ bằng chứng thuộc một bảng; nếu **người hỏi** không xem được bảng
  đó (`readViewableBoardIds` — khớp `assertBoardView`, nhưng không loại bảng lưu trữ vì thành viên của
  một dự án cũ vẫn có quyền xem nó) thì `title = null`. **Điểm và thứ hạng không đổi** — chỉ chữ bị che
  (test: hai người hỏi khác nhau cho điểm y hệt, chỉ tiêu đề khác). Che theo hướng an toàn: không biết
  thẻ thuộc bảng nào thì coi như không xem được.
- **Nhật ký `AssignRun` không chép tiêu đề thẻ** (chỉ `cardId`, `sim`, `weight`, `outcome`): tránh nhân
  bản nội dung có thể thuộc bảng riêng tư vào một bảng log.
- Không trả email, mật khẩu, phiên bản token ở bất kỳ chỗ nào.
- **Chưa đọc `MemberWorkProfile.allowCrossWorkspace`**: bật lên thì bằng chứng sẽ lộ tiêu đề thẻ của
  không gian khác. Cột vẫn nằm đó cho bước sau; hiện mọi thứ đọc trong đúng một không gian.

### 10.5 `POST .../runs/:runId/outcome`

Body `{ "chosenUserId": "…" }`. Ghi **người thực sự được giao** sau một lượt gợi ý:

- Luồng dự kiến của giao diện (bước 6): người dùng giao qua `POST /api/cards/:id/members` **rồi** gọi
  outcome. Server **không tin lời khai**: người được chọn phải **đang có trong thẻ** (400 nếu không);
  người gọi phải là người đã bấm gợi ý (lượt của người khác và lượt không tồn tại đều 404) và còn
  quyền sửa thẻ (403 nếu bị hạ xuống VIEWER); thẻ đã bị xoá hẳn → 409.
- **Ghi một lần**: gửi lại đúng người cũ → 200 với kết quả đã lưu; người khác → 409. Ghi bằng
  `updateMany where decidedAt = null`, nên hai request cùng lúc không đè nhau.
- `accepted = (chosenUserId === topUserId)`. Người được chọn **nằm ngoài danh sách ứng viên** (ví dụ
  VIEWER được gán tay trước đó) vẫn ghi được nhưng `accepted = false` và **không học** từ lượt đó
  (chốt chặn 2 của §8, lý do `NOT_CANDIDATE`).
- **Học (bước 6a)**: mỗi lượt ghi được cộng vào `feedbackCount` của nhóm; từ lượt thứ 10 trở đi, giao
  KHÁC người xếp đầu thì trọng số nhích (§8, "Cài đặt"). Lần ghi **đầu tiên** trả thêm
  `learning: { learned, reason }`, `feedbackCount`, `weights` (sau lượt này); **gửi lại** chỉ trả phần cũ
  (không có cột lưu lý do, và số lượt/trọng số lúc đó có thể đã đổi vì lượt khác) và **không** cộng thêm
  lượt phản hồi. `AssignRun.learned` = có làm đổi trọng số.

### 10.6 Trọng số của nhóm

- `GET` → `{ workspaceId, weights, defaults, custom, feedbackCount, updatedAt, learning, feedback,
  history }`; chưa từng chỉnh thì trả mặc định và **không tạo dòng** nào (đọc không ghi). `learning` =
  `{ minFeedback: 10, eta: 0.05, active }` (hằng số lấy từ máy chủ để giao diện không phải chép lại);
  `feedback` = `{ decided, accepted }` (số lượt đã có kết quả / trong đó giao đúng người xếp đầu — chỉ
  số đánh giá trực tuyến mức 1); `history` = **20 lần đổi gần nhất, mới nhất trước**, mỗi dòng
  `{ id, at, weights, feedbackCount, source: 'LEARNED' | 'MANUAL', runId }`. `PUT` và `DELETE` trả **cùng
  dạng đầy đủ** đó.
- `PUT` `{ experience, reliability, availability }`: mỗi số trong `[0,05; 0,70]`, tổng bằng 1 (sai số
  1e-6); sai → **400 kèm lỗi từng trường, không tự sửa ngầm** (`assign.weights.ts` là nơi duy nhất
  định nghĩa luật này; service kiểm lại một lần nữa làm rào chắn cuối). Đặt giống hệt giá trị hiện tại
  → không ghi gì. Đổi thật → ghi trọng số **và một dòng `AssignWeightHistory`** (`runId = null`) trong
  **cùng giao dịch**; `feedbackCount` giữ nguyên.
- `DELETE` → về 0,45 / 0,30 / 0,25 **và đưa `feedbackCount` về 0** (quy tắc "đủ 10 lượt mới học" áp
  dụng lại), ghi một dòng lịch sử. Không xoá dòng `WorkspaceAssignWeights` vì `AssignWeightHistory`
  xoá theo (Cascade) và đường hội tụ sẽ mất.
- Trọng số lưu hỏng trong CSDL (sửa tay) không làm hỏng gợi ý: lùi về mặc định, cảnh báo ở log; nhật
  ký ghi trọng số **đã dùng thật**.

### 10.7 Giới hạn tốc độ và nhật ký

`GET` gợi ý **có ghi CSDL** (một dòng `AssignRun` mỗi lượt) và mỗi lượt đọc cả không gian, nên có giới
hạn **60 lượt / người / 10 phút** (tính theo người dùng, sau `requireAuth`). `AssignRun` lưu: không
gian, bảng, thẻ, người bấm (`actorKey`), `algorithmVersion`, bộ trọng số tại thời điểm chấm, ứng viên
đã chấm (thành phần thô + chuẩn hoá + tỉ trọng, cờ, id bằng chứng), người xếp đầu (`null` nếu người
đó không có điểm), và `latencyMs` (chỉ tính phần đọc + chấm, không tính lúc ghi nhật ký).

### 10.8 Hồ sơ làm việc cá nhân (bước 6a)

`GET/PUT /api/workspaces/:workspaceId/assignment-profile` — **chỉ hồ sơ của chính người gọi**, mọi
thành viên không gian gọi được (không ai sửa hồ sơ người khác):

- `GET` → `{ workspaceId, maxParallelCards, defaultMaxParallelCards: 5, pausedUntil, isDefault,
  updatedAt }`; chưa có dòng thì trả mặc định, **không tạo dòng**.
- `PUT { maxParallelCards, pausedUntil }`: số nguyên **1–30**; `pausedUntil` là chuỗi ISO **có `Z`** hoặc
  `null` (bỏ tạm nghỉ). Sai → 400 kèm lỗi từng trường; service kiểm lại làm rào chắn cuối. Hai giá trị này
  đi thẳng vào thành phần khả dụng: đủ `maxParallelCards` thẻ chồng lấn → cờ `OVERLOADED`; `pausedUntil` ≥
  lúc bắt đầu cửa sổ của thẻ → cờ `PAUSED`, khả dụng = 0 (§5.6). Thời điểm tạm nghỉ đã qua thì không còn tác
  dụng nhưng vẫn lưu.
- Ghi bằng **upsert** trên khoá `(userId, workspaceId)` (Prisma sinh `INSERT … ON CONFLICT DO UPDATE`), nên
  bấm Lưu hai lần liền không tranh nhau. `allowCrossWorkspace` vẫn **không** đụng tới.

### 10.9 Chưa làm (cố ý)

Nút **tắt** học (cần thêm cột, tức migration), admin sửa hồ sơ người khác, đọc chéo không gian, bộ nhớ đệm
(đo độ trễ trước, xem nhật ký bước 5), **học từ chỉnh sửa trên bản xem trước chia việc** (đặc trưng có tải ảo nên cần thiết kế
riêng), API giao hàng loạt (chia việc giao từng thẻ bằng API có sẵn), dùng chung hồ sơ người giữa các thẻ của một lượt chia (tăng
tốc, chưa cần). (Biểu đồ hội tụ đã có ở bước 7b, dạng CSV + SVG ngoài ứng dụng.)

### 10.10 Chia việc cho cả danh sách (lớp 2, bước 8)

`POST /api/lists/:listId/assignment-plan` (không có thân yêu cầu). **Chỉ xem trước, không ghi gì**: không `AssignRun`, không
`CardMember`, không nhật ký hoạt động, không học trọng số (test đếm sáu bảng trước và sau). Người dùng áp dụng bằng API giao thẻ có
sẵn (`POST /api/cards/:cardId/members`), từng thẻ một, từ màn xem trước (bước 8b, xem cuối mục này).

**Thuật toán** (`assign.plan.ts`, hàm thuần — dùng chung cho máy chủ và cho bước 9 đánh giá lớp 2 trên bộ mô phỏng):

1. Lấy các thẻ **chưa có người nhận** của danh sách (chưa xong, chưa lưu trữ, chưa xoá, không có thành viên nào) và xếp **hạn gấp
   trước** (không có hạn xuống cuối; cùng hạn thì theo `position` trong danh sách, rồi `id` — tất định).
2. Với từng thẻ gọi `rankCandidates` của lớp 1 (đúng cấu hình sản phẩm: `MINMAX` / `DROP`, trọng số của nhóm), chọn người xếp đầu
   **có điểm và không đang tạm nghỉ** (cờ `PAUSED` tính theo cửa sổ của chính thẻ đó).
3. Cộng thẻ vừa chia vào "thẻ đang mở" của người đó, giữ nguyên khoảng [bắt đầu, hạn] của thẻ (thẻ không ngày thì "thẻ đang mở"
   không ngày, đúng như sau khi giao thật: chồng lấn mọi khoảng, §5.6), rồi sang thẻ sau.

"Người vừa nhận việc bị trừ điểm dần" (§4) xảy ra **qua thành phần khả dụng của lớp 1** (`1 − tải / sức chứa`): không có tham số
mới, không có sổ tải theo ngày. Vì vậy kết quả **đúng bằng lần lượt bấm gợi ý số 1 cho từng thẻ rồi giao thật** (khác duy nhất: bỏ
qua người tạm nghỉ). Test tích hợp làm đúng việc đó trên CSDL thật và đối chiếu từng người, điểm, tải, cờ, xếp hạng — với trọng số
mặc định và với trọng số của nhóm thiên về khả dụng.

**Phân quyền và giới hạn**: như lớp 1 (phải **sửa được bảng**: VIEWER và người ngoài 403; danh sách hoặc bảng đã xoá / lưu trữ 404);
**10 lượt / người / 10 phút** (ít hơn lớp 1 vì mỗi lượt chấm tới 30 thẻ); tối đa `PLAN_MAX_CARDS = 30` thẻ mỗi lượt, lấy các thẻ
gấp nhất — phần còn lại báo bằng `truncated` và `totalUnassigned`.

**Dạng trả về** (không có `runId`, không có bằng chứng, không email):

```jsonc
{ "success": true, "data": {
  "list": { "id", "name", "boardId", "workspaceId" },
  "algorithmVersion": "knn-tfidf-v1/minmax/drop", "planVersion": "greedy-v1", "generatedAt": "…",
  "weights": { "experience", "reliability", "availability", "custom" }, "groupOnTimeRate": 0.62,
  "people": [{ "user": { "id", "name", "avatarUrl" }, "capacity": 5, "openCards": 3, "paused": false }],
  "totalUnassigned": 41, "truncated": true,
  "rows": [{
    "order": 1, "card": { "id", "title", "startDate", "dueDate" },
    "assignee": { "user", "score", "rawScore", "confidence", "confidenceLevel", "components", "load", "capacity", "flags" } | null,
    "ranking": [{ "userId", "rank", "score", "load", "capacity", "flags" }]   // MỌI ứng viên, tại bước này (đã tính các thẻ chia trước)
  }] } }
```

`assignee = null` khi không ai đủ điều kiện (mọi ứng viên đang tạm nghỉ): dòng để trống, không bịa. `ranking` cho phép màn xem trước
đổi người nhận từng dòng mà không gọi lại máy chủ. **Riêng tư**: vì không trả bằng chứng nên không lộ tiêu đề thẻ cũ (kể cả ở bảng
riêng tư mà người hỏi không xem được, §10.4); test kiểm chuỗi tiêu đề lịch sử không xuất hiện ở bất kỳ chỗ nào của phản hồi.

**Giới hạn đã đo, không giấu** — đo thăm dò 36 đợt chia 12 thẻ cùng lúc (12 hạt giống dev 9301–9312 × 3 ngày; mô hình kết quả của
bộ sinh; **không phải số chính thức**, bước 9 đo lại trên hạt giống mới với so sánh đăng ký trước):

| Cách chia | Người nhiều nhất | Gini | P(đúng hạn) |
|---|---|---|---|
| Chấm riêng từng thẻ, không cộng tải | 49,1% | 0,469 | 0,459 |
| **Cộng thẻ vừa giao vào tải (cách đã cài)** | 35,4% | 0,298 | **0,485** |
| Cách trên + trần ⌈n/m⌉ thẻ mỗi người | 22,0% | 0,102 | 0,470 |
| Cách trên + phạt 10 điểm mỗi thẻ đã nhận | 29,6% | 0,210 | 0,485 |
| Cách trên + phạt 20 điểm mỗi thẻ đã nhận | 26,6% | 0,157 | 0,477 |
| Chia vòng tròn | 22,0% | 0,064 | 0,379 |
| Tối ưu (biết kỹ năng ẩn) | 34,5% | 0,328 | 0,613 |

Cách đơn giản nhất giảm dồn tải rõ và có P(đúng hạn) cao nhất trong các cách thực tế; ép cân bằng thêm (trần, phạt) làm đều hơn
nhưng không làm đúng hạn tốt hơn — nên **không thêm tham số**. Nhưng nó **chỉ giảm chứ không chia đều** (người nhiều nhất vẫn 35%
so với phần chia đều ~17–20%): chuẩn hoá min-max biến mọi chênh lệch thành 0..1 nên một thành phần (khả dụng, trọng số 0,25) không
thắng nổi hai thành phần còn lại (0,75). Người vượt trội cả về kinh nghiệm lẫn độ tin cậy **vẫn nhận mọi thẻ** — có test ghi lại
điều này — và bản xem trước bù lại bằng cách hiện `OVERLOADED` để người dùng đổi người. Cân bằng mạnh hơn là câu hỏi của bước 9.

**Độ trễ đo** (chỉ phần chấm, 40 thẻ, không kể đọc CSDL): 3 ms / thẻ (nhóm 120 thẻ, 5 ứng viên), 22 ms / thẻ (1000 thẻ, 9 ứng viên),
74 ms / thẻ (3000 thẻ) — tức 30 thẻ mất ≈ 2,2 s ở không gian 3000 thẻ. Chưa tối ưu (dùng chung hồ sơ người giữa các thẻ) vì chưa cần;
máy chủ Node chỉ có một luồng nên đây là lý do của hạn mức 10 lượt / 10 phút.

**Giao diện (bước 8b, `AssignPlanModal.tsx`)**: mục **"Chia việc gợi ý… (N thẻ chưa giao)"** ở menu "⋯" của danh sách (chỉ khi sửa được bảng; khoá khi
không có thẻ nào chưa xong và chưa có người nhận). Màn xem trước: mỗi thẻ một dòng theo thứ tự xử lý, người được gợi ý chọn sẵn, điểm tương đối + tải + ba giá trị **thô**
(chỉ của người được gợi ý — với người khác máy chủ chỉ gửi điểm, tải, cờ), huy hiệu cờ, cảnh báo khi người được chọn quá tải / tạm nghỉ; đổi người hoặc chọn "Không giao", bỏ tick từng thẻ; bảng
"Sau khi áp dụng" (thẻ mới, đang mở / sức chứa, cờ) cập nhật ngay. **Áp dụng** giao **tuần tự** bằng `addCardMember` (mỗi lần ghi nhật ký và gửi thông báo nên không chạy song song); thẻ lỗi không chặn thẻ sau
và được báo riêng kèm lý do; thẻ đã giao đánh dấu "Đã giao" và khoá; áp dụng lại chỉ giao phần còn lại. Kế hoạch không được lưu và không khoá thẻ: thẻ có thể bị người khác giao trong lúc bạn xem
(khi đó thẻ có thêm một người; giao trùng người thì không lỗi).

## 11. Module đánh giá (bước 7)

Chép nguyên khung của bước 10 module AI: `evalArms` / `evalMetrics` /
`evalReport` / `evalCache` + một CLI chạy bằng `tsx`, thêm script `eval:assign`
cạnh `eval:ai` trong `backend/package.json:15`. Các hàm `mdTable`, `fmt`,
`percentile` trong `evalMetrics.ts` dùng lại được ngay.

**Khác biệt lớn so với lần trước, theo hướng dễ hơn nhiều**: không gọi mạng,
không tốn khoá, không dính lỗi 429. Chạy hết trong vài giây → chạy được **20 bộ
dữ liệu khác hạt giống** thay vì 3 lần, nên báo được trung bình kèm độ lệch
chuẩn thay vì một con số trần trụi.

### Tám nhánh đem so

`ngẫu nhiên` · `chia vòng tròn` · `người rảnh nhất` · `người hay làm nhất` ·
`chỉ kinh nghiệm` · `chỉ tải` · `đầy đủ, trọng số cố định` ·
`đầy đủ, có học trọng số`

Bốn nhánh giữa vừa là nhánh nền vừa là **nghiên cứu cắt bỏ** (ablation).

### Chỉ số

| Chỉ số | Ý nghĩa |
|---|---|
| Top-1 / Top-3 | Tỉ lệ gợi ý trúng người có kỹ năng ẩn cao nhất |
| MRR | Thứ hạng trung bình nghịch đảo của người tốt nhất |
| **Độ hối tiếc** | Chênh lệch kỹ năng ẩn giữa người tốt nhất và người được gợi ý — nhạy hơn Top-1 vì "gần đúng" khác hẳn "sai bét" |
| Tỉ lệ đúng hạn mô phỏng | Nếu thực sự áp dụng gợi ý thì bao nhiêu phần trăm việc kịp hạn |
| Hệ số Gini | Mức độ dồn việc vào một người |
| (mức 2) Đường hội tụ | Khoảng cách từ trọng số học được tới thiên lệch thật của trưởng nhóm mô phỏng |

> **Ghi chú từ bước 4 / 4b:** Top-1 / MRR / độ hối tiếc chỉ tính **kỹ năng ẩn**, không tính tải,
> trong khi bộ chấm cố ý cân bằng tải, nên thành phần khả dụng **không thể thắng** trên các
> chỉ số này (tương quan với kỹ năng chỉ −0,05). Vì vậy đã có sẵn trong `replay()` (và
> `npm run assign:suggest`) chỉ số **xác suất đúng hạn kỳ vọng** `pOnTime*`, tính bằng chính
> mô hình kết quả của bộ sinh (`onTimeProbability`, có xét tải). Trên dữ liệu mô phỏng
> khả dụng đứng một mình cho 0,418 (hơn ngẫu nhiên 0,387, thấp xa kinh nghiệm 0,472); thêm nó
> (đã chuẩn hoá) vào kinh nghiệm + tin cậy thì giữ nguyên 0,484 — tức phạt tải trong mô phỏng quá
> nhẹ (0,06/thẻ vượt nửa sức chứa) để khả dụng tạo khác biệt. Bước 7 phải đo cả **đúng hạn**
> và **Gini** cạnh Top-1, quét mức phạt tải của bộ sinh, và báo cáo từng thành phần riêng
> thay vì chỉ điểm tổng.

### Hai thứ module AI chưa làm được, lần này làm

- **Quét tham số** `H`, `K`, `m`, `eta` — in bảng để chứng minh tham số được
  chọn có căn cứ, không phải chọn cái đẹp nhất.
- **Khoảng tin cậy bootstrap** giữa hai nhánh (khoảng 20 dòng tự viết), để không
  bị hỏi "chênh 2% có ý nghĩa thống kê không".

### Nhánh tuỳ chọn nếu còn thời gian

- **Hồi quy logistic** dự đoán xác suất hoàn thành đúng hạn từ bốn đặc trưng
  (độ giống, tải, tỉ lệ đúng hạn quá khứ, độ mới của kinh nghiệm). Khoảng 60
  dòng gradient descent tự viết, **vẫn không cần Python**, có tập huấn luyện và
  tập kiểm tra tách riêng, có đường mất mát. Đây là cách rẻ nhất để có chữ
  "huấn luyện mô hình" đúng nghĩa trong chương phương pháp — và nếu nó **thua**
  trọng số tay thì càng hay, vì chứng minh được mô hình đơn giản là đủ.
- **Nhánh embedding** thay TF-IDF, dùng lại adapter LLM sẵn có.

### Cài đặt (bước 7 — `backend/src/scripts/evalAssign*.ts`, chạy bằng `npm run eval:assign`)

Khung khác với dự kiến ban đầu ở ba điểm, đều có lý do đo được (nhật ký bước 7a): không có `evalCache` (không có mạng
để đệm; thay bằng bộ nhớ kết quả từng thí nghiệm để chạy từng phần / song song), có **vòng kín**, và so sánh **cặp**.

- **Ba chế độ chạy** (`evalAssignRun.ts`): `HISTORY` — thế giới là lịch sử của bộ sinh, cố định; tái hiện `replay()` cũ **đến
  từng chữ số** (test đối chiếu). `ARM` — **vòng kín**: nhánh tự giao người xếp đầu, kết quả rút từ chính mô hình kết quả của bộ
  sinh (`sampleOutcome`, kỹ năng ẩn + tải thật), lịch sử tích luỹ theo lựa chọn của nhánh. `LEADER` — trưởng nhóm giả giao việc,
  nhánh chỉ gợi ý và nhận phản hồi. **Vì sao cần vòng kín**: phát lại lịch sử cố định không đo được việc dồn về một người
  (Gini), tải tự điều chỉnh khi thật sự làm theo gợi ý, và "bẫy người mới" (không được giao thì mãi không có lịch sử).
- **Thế giới của nhánh**: 60 ngày đầu giữ lịch sử của bộ sinh (nhóm đã có việc trước khi dùng công cụ); từ ngày 60, thẻ nào do nhánh
  quyết định bị "xoá trắng" (chưa ai nhận, chưa xong) cho tới lúc quyết định, để việc do bộ sinh giao không rò vào thế giới của
  nhánh; cùng ngày thì theo thứ tự trong bộ. Phát lại cũ (`HISTORY`) **có** nhìn thấy các thẻ giao cùng ngày nhưng xử lý sau
  (như tải đang mở) — rò rỉ nhẹ đã có từ bước 4 và nay có test đo; vòng kín thì không.
- **So sánh cặp, may rủi chung**: mỗi thẻ có ba luồng ngẫu nhiên **riêng** (kết quả / nhánh ngẫu nhiên / trưởng nhóm) gieo bằng
  `streamSeed(hạt giống, vị trí thẻ, mục đích)`. **Bắt buộc trộn bit**: gieo LCG bằng hai số nguyên kề nhau cho giá trị đầu tương
  quan **0,998** (đo), sau khi trộn còn ~0,01. `sampleOutcome` cho **ghép đơn điệu** (cùng luồng: người có xác suất đúng hạn
  cao hơn luôn đúng hạn nếu người thấp hơn đúng hạn), nên hai nhánh chỉ khác nhau ở **người được chọn**, không phải may rủi.
- **Tải của thế giới** = số thẻ đang mở chồng lấn theo định nghĩa của bộ chấm (`load` của một xếp hạng tham chiếu tính riêng cho
  mỗi quyết định), dùng chung cho cả các nhánh không dùng bộ chấm; phạt tải vào xác suất đúng hạn qua
  `onTimeProbability(…, loadPenalty)` (mặc định 0,06; **không** nằm trong `SimConfig` vì cấu hình là một phần của mã băm đóng băng).
  Xác suất đúng hạn tối đa của mô hình là 0,85 (kỹ năng 1, không phạt): trần kẹp 0,95 không bao giờ đạt với kỹ năng hợp lệ.
- **Nhánh** (`evalAssignArms.ts`, **không import bộ sinh** — có test đọc mã nguồn canh giữ; nhánh chỉ thấy chữ và kết quả hoàn thành):
  ngẫu nhiên · chia vòng tròn · người rảnh nhất (ít thẻ đang mở chồng lấn nhất, đếm thô) · người hay làm nhất (nhiều thẻ đã xong
  nhất) · chỉ kinh nghiệm (1/0/0) · chỉ tải (0/0/1) · đầy đủ trọng số cố định (0,45/0,30/0,25, `MINMAX`/`DROP` — đúng cấu hình
  sản phẩm) · đầy đủ có học (`evalAssignLeader.ts`); thêm bốn nhánh cắt bỏ (chỉ tin cậy, bỏ khả dụng / tin cậy / kinh nghiệm) và
  hai nhánh **tham chiếu** cần kỹ năng ẩn (người kỹ năng cao nhất; **tối ưu** = xác suất đúng hạn cao nhất) đặt ở bộ chạy.
- **Chỉ số chính đăng ký trước**: **xác suất đúng hạn kỳ vọng** của người được giao (Top-1 theo kỹ năng không thể ghi công cho khả
  dụng, đã ghi ở bước 4). Phụ: độ hối tiếc, Top-1/Top-3/MRR, Gini + phần việc của người nhiều nhất, "người mới" (việc người vào
  muộn nhận / phần chia đều kỳ vọng), đúng hạn thực của các thẻ đã xong. **Sáu so sánh chính đăng ký trước**: nhánh đầy đủ với
  ngẫu nhiên / người rảnh nhất / người hay làm nhất / chỉ kinh nghiệm / chỉ tải, và nhánh có học với cố định (tỉ lệ chấp nhận).
- **Thống kê** (`evalAssignStats.ts`): khoảng tin cậy **bootstrap phân vị 95%** (10 000 lần lấy lại, tất định) trên chênh lệch
  **cặp theo hạt giống** — mỗi hạt giống là một đơn vị độc lập (không tính trên từng thẻ). Kết luận trong bảng do máy gắn nhãn
  chỉ dựa vào việc khoảng có chứa 0 hay không. 20 hạt giống **2001–2020**, chưa dùng để chọn gì ở các bước trước; tham số giữ
  đúng mặc định đã duyệt, các bảng quét chỉ **mô tả**. Mã băm tổng của 20 bộ dữ liệu được đóng băng bằng test.
- **Trưởng nhóm giả và nhánh có học** (`evalAssignLeader.ts`): tiện ích = Σ thiên_lệch_k · đặc_trưng_k + nhiễu · N(0,1) trên các giá
  trị đã chuẩn hoá (hoặc giá trị thô — kiểm độ bền khi gu nằm ngoài không gian đặc trưng của bộ học). Ba gu có "lỗi" để học (ưu tiên
  kinh nghiệm / đúng hạn / người rảnh, mỗi gu 0,70 ở một thành phần) và một đối chứng trùng mặc định. Nhánh có học gọi **đúng**
  `learningDecision` / `parseRunCandidates` của sản phẩm (không viết lại luật học), tăng `feedbackCount` **trước** khi quyết định
  như `decideAndLearn`. Trưởng nhóm nhìn xếp hạng **tham chiếu** (không phải xếp hạng của nhánh) nên ở chế độ `LEADER` mọi nhánh
  thấy cùng một thế giới. **Gu là tuỳ ý và không biết kỹ năng ẩn**: kết quả chứng minh trọng số bám theo gu của nhóm, **không**
  chứng minh học làm kết quả khách quan tốt hơn.
- **Thí nghiệm** (`evalAssignExperiments.ts` khai báo điểm đo, `evalAssignReportSweeps.ts` dựng bảng + đường hội tụ CSV/SVG):
  quét `H`, `K`, `m`, `m_e`, `simMin`, sức chứa bộ chấm tin; chuẩn hoá × xử lý thành phần thiếu (`DROP` / `NEUTRAL`; kèm chênh lệch
  cặp của "người mới" và Gini vì hai trung bình của chỉ số "người mới" nhiễu quá để so bằng mắt); lưới trọng số
  (33 điểm + mặc định); mức phạt tải và mật độ việc của thế giới; độ bền trước các nguồn lệch của bộ sinh; học trọng số (đường hội
  tụ, tốc độ học `eta` × nhiễu, gu nằm ngoài không gian đặc trưng, ảnh hưởng khách quan); bi-gram và trọng số tiêu đề trên 20 hạt giống.
- **Cố ý không làm** (đã thoả thuận trước khi làm): nhánh hồi quy logistic và nhánh embedding ("tuỳ chọn" ở trên), và mọi thứ của lớp 2 (bước 8–9).

## 12. Rủi ro lớn nhất

| Rủi ro | Biện pháp |
|---|---|
| **Vòng tròn giữa bộ sinh và bộ chấm** | §7 — sáu nguồn lệch cố ý, và khai rõ giới hạn trong luận văn |
| Hội đồng chê "không đủ AI" | Khoá luận đã có module LLM thật; thêm nhánh hồi quy logistic nếu cần; lập luận "dữ liệu nhỏ + bắt buộc giải thích được" là lập luận đúng, không phải bao biện |
| Lớp 2 phình to như v1 | Chốt cứng: vòng lặp tham lam, không sổ tải theo ngày, không CPM |
| Migration hỏng | §9 — bắt buộc dùng `migrate diff`, không dùng `migrate dev` |
| Thiên lệch với người mới | Đo hệ số Gini; cân nhắc phần thưởng cơ hội học nghề |
| Riêng tư: chấm điểm đồng nghiệp | Không có bảng xếp hạng công khai; mượn lịch sử chéo không gian mặc định tắt |

## 13. Lộ trình 0–9

| Bước | Nội dung | Xong thì thấy gì |
|---|---|---|
| **0** | Tài liệu này | Thiết kế chốt, chưa có mã |
| 1 | Schema: bốn sửa đổi + bốn bảng mới (§9) | CSDL mới, app chạy y như cũ |
| 2 | Bộ sinh dữ liệu mô phỏng + script đổ vào CSDL | Mở app thấy 5–10 bảng "dự án cũ" có lịch sử thật |
| 3 | Tách từ + TF-IDF + hồ sơ người (hàm thuần) | Chạy thử in ra top từ khoá của từng người |
| 4 | Bộ chấm cặp: ba thành phần, co điểm, suy giảm, bằng chứng (hàm thuần) | Test đầy đủ; in ra điểm và lý do |
| 5 | Tầng đọc CSDL + API gợi ý cho một thẻ + ghi `AssignRun` | Gọi API trả danh sách xếp hạng |
| 6 | Giao diện lớp 1: xếp hạng, lý do, cảnh báo khi gán tay, thanh trượt trọng số | Dùng được trong sản phẩm |
| 7 | Bộ đánh giá offline, 8 nhánh, quét tham số, bootstrap | Bảng số liệu cho luận văn |
| 8 | Lớp 2 tối giản: chia việc cả danh sách + màn xem trước | Nút "chia việc" chạy thật |
| 9 | Đánh giá lớp 2 (cân tải, việc trễ hạn) + viết chương | Số liệu phần hai |

Mức 2 (học trọng số) nằm rải: ghi phản hồi ở bước 5, học ở bước 6, đo ở bước 7.

**Tái dùng được nhiều nhất**: khung `evalMetrics`/`evalArms`/`evalReport` cho
bước 7; `AssignPreviewModal.tsx` và `assignmentLabels.ts` trong nhánh
`ai-module-v1-backup` cho bước 8.

## 14. Kiểm thử và nghiệm thu

Giữ nguyên công thức đã hiệu quả ở module AI:

- Lõi là **hàm thuần** → vitest bình thường, không cần CSDL.
- **Bộ cài lỗi tự động** (mutation) sau mỗi bước, để chứng minh test thật sự bắt
  được lỗi chứ không "xanh giả". Bắt buộc kiểm `mutated !== original`.
- **Test tính chất** trên dữ liệu sinh ngẫu nhiên có hạt giống cố định; đầu vào
  `Object.freeze` để bắt mã sửa đầu vào.
- Trước khi viết `expect`, chạy script thăm dò và **đọc kết quả thật** — bước 3
  của module AI lộ ra hai lỗi thật nhờ cách này.
- Mỗi bước một commit git riêng.

Ràng buộc bất biến cần có test canh giữ:

1. Điểm luôn trong `[0,100]` hoặc `null`, không bao giờ `NaN`.
2. Thành phần thiếu dữ liệu không làm giảm điểm (nguyên tắc 4).
3. Trọng số sau khi học luôn có tổng bằng 1 và mỗi cái nằm trong `[0.05, 0.70]`.
4. Người không có lịch sử không bao giờ bị chấm 0 — phải ra cờ `NO_HISTORY`.
5. Bằng chứng trả về phải là thẻ **có thật** của đúng người đó, và đúng những
   thẻ đã dùng để tính.

## 15. Chương đánh giá luận văn

Dàn ý dự kiến, thu số liệu tự động ngay từ bước 7:

1. Bài toán và định nghĩa "đúng" (kỹ năng ẩn, độ hối tiếc).
2. Bộ dữ liệu mô phỏng: tham số sinh, sáu nguồn lệch, cách đóng băng.
3. Tám nhánh và chỉ số.
4. Kết quả chính: bảng Top-1/Top-3/MRR/hối tiếc/Gini, trung bình trên 20 hạt
   giống kèm khoảng tin cậy.
5. Nghiên cứu cắt bỏ: từng thành phần đóng góp bao nhiêu.
6. Quét tham số.
7. Cá nhân hoá: đường hội tụ trọng số, so nhánh cố định với nhánh có học.
8. Giới hạn: dữ liệu mô phỏng, một người gán nhãn, chưa thử nghiệm người dùng thật.

## 16. Ôn trả lời giảng viên hướng dẫn

### Trả lời 30 giây

> Em xem đây là bài toán **gợi ý người thực hiện công việc**, cùng họ với bài
> toán gán lỗi cho lập trình viên trong nghiên cứu. Em giải bằng **gợi ý dựa
> trên nội dung**: biểu diễn mỗi công việc thành véc-tơ từ khoá bằng TF-IDF,
> dựng hồ sơ năng lực từng người từ các thẻ họ đã hoàn thành, rồi chấm độ phù
> hợp bằng k láng giềng gần nhất có trọng số. Phần cá nhân hoá thì trọng số của
> mỗi nhóm được **học trực tuyến từ phản hồi** chấp nhận hay đổi người. Em cài
> đặt thẳng bằng TypeScript trong backend, không dùng thư viện học máy, để mọi
> con số đều giải thích được.

### Trả lời đầy đủ — năm mạch

1. **Bài toán**: cho một việc và một nhóm, xếp hạng ai phù hợp nhất, và quan
   trọng hơn là **nói được vì sao**.
2. **Dữ liệu**: lịch sử trong hệ thống — thẻ đã hoàn thành, ai làm, bao lâu,
   đúng hạn hay trễ, có bị mở lại không. Hệ thống mới nên dựng bộ sinh mô phỏng
   có kỹ năng ẩn, nhiễu, người mới, người học nghề.
3. **Cách giải, bốn bước**: véc-tơ từ khoá (TF-IDF, uni-gram + bi-gram) → hồ sơ
   từng người có suy giảm theo thời gian → chấm ba thành phần với điểm tin cậy
   tính trên đúng K thẻ giống việc đang xét, có làm trơn Bayes → mỗi điểm kèm
   ba thẻ cũ làm bằng chứng.
4. **Cá nhân hoá, bốn chỗ**: §6.
5. **Chứng minh**: tám nhánh, 20 hạt giống, Top-k / MRR / độ hối tiếc / Gini,
   nghiên cứu cắt bỏ, khoảng tin cậy bootstrap.

### Các câu sẽ bị vặn

**"Sao không dùng học sâu?"** — Dữ liệu vài nghìn thẻ, mô hình lớn sẽ khớp nhiễu
chứ không học thêm được gì. Và bài toán bắt buộc phải giải thích được: không
trưởng nhóm nào giao việc theo một con số không rõ từ đâu. Em không nói suông —
mô hình phức tạp hơn nằm sẵn trong danh sách nhánh đối chứng, có số liệu so.

**"Sao không dùng Python?"** — Toàn bộ là số học cơ bản, chạy ngay trong tiến
trình backend, độ trễ dưới một giây. Thêm Python là thêm một dịch vụ, thêm một
chỗ hỏng, không thêm năng lực.

**"Vậy có huấn luyện mô hình không?"** — Có, nhưng là **học trực tuyến**: mô hình
cập nhật trọng số sau mỗi lượt người dùng chấp nhận hoặc đổi người, có hàm mất
mát xếp hạng theo cặp, có tốc độ học, vẽ được đường hội tụ. Nếu thầy muốn có
thêm huấn luyện theo lô đúng nghĩa thì em bổ sung nhánh hồi quy logistic dự đoán
xác suất hoàn thành đúng hạn, có tập huấn luyện và tập kiểm tra tách riêng.

**"Dữ liệu mô phỏng thì đánh giá còn ý nghĩa gì?"** — Câu nguy hiểm nhất, phải
nói trước khi bị hỏi. Trả lời theo §7: lợi thế là biết đáp án tối ưu; sáu nguồn
lệch để chống vòng tròn; và khai thẳng giới hạn.

**"Khác gì chia đều hay chọn người rảnh nhất?"** — Đó đúng là hai trong tám
nhánh nền, sẽ có số liệu chênh lệch cụ thể.

**"Người mới chưa có lịch sử thì sao?"** — Xuống thang ba mức, nói thẳng "chưa
đủ căn cứ" thay vì bịa số. Và có đo mức độ dồn việc.

**"Đóng góp riêng của em là gì?"** — Bốn điểm: (a) độ tin cậy tính **theo ngữ
cảnh việc đang xét** thay vì một chỉ số tổng; (b) mỗi gợi ý kèm bằng chứng truy
vết về đúng những thẻ cũ đã dùng để tính; (c) trọng số cá nhân hoá theo nhóm,
học được từ phản hồi, **có đo bằng số** chứ không chỉ mô tả; (d) khung đánh giá
có đáp án tối ưu đã biết, cho phép đo độ hối tiếc chứ không chỉ đo độ trùng khớp.

### Hai mẹo khi nói

Dùng đúng tên gọi học thuật để thầy định vị được ngay: *task assignee
recommendation*, *content-based recommendation*, *learning to rank*, *online
learning*, *ablation study*, *baseline*. Và luôn mở đầu bằng **bài toán**, không
mở đầu bằng công nghệ.

### Cần hỏi lại thầy

**Khoa hoặc thầy có yêu cầu bắt buộc nào về việc phải dùng Python, hay phải có
mô hình học máy được huấn luyện theo lô không?** Nếu có, thêm nhánh hồi quy
logistic ở §11 là đủ đáp ứng mà không phải kéo Python vào. Nếu bắt buộc phải là
Python thì phải tính lại kiến trúc từ đầu.

---

## Nhật ký tiến độ

### Đã xong — Bước 0: chốt thiết kế (20/09/2026)

Chỉ tạo một tệp: chính tài liệu này. **Không** đụng vào mã sản phẩm, **không**
đổi schema, **không** cài thêm thư viện.

Bốn quyết định được chốt trong bước này sau khi bàn với tác giả:

1. Dữ liệu lịch sử **tự sinh mô phỏng** (không nhập dữ liệu thật từ ngoài).
2. Chủ đề công việc nhận diện bằng **từ khoá trong tiêu đề và mô tả**.
3. Làm **cả hai lớp**, nhưng lớp 1 xong hẳn rồi mới tới lớp 2, và lớp 2 tối giản.
4. Học từ phản hồi ở **mức 2** (học trực tuyến trọng số theo nhóm).

Ba chỗ được đọc từ mã thật để chốt thiết kế, không đoán:

- `backend/prisma/schema.prisma` — xác nhận `Card` **không có** `completedAt` và
  `CardMember` **không có** mốc thời gian nào. Đây là lý do bước 1 bắt buộc phải
  sửa schema trước khi làm bất cứ thứ gì khác.
- `backend/src/modules/card/cardExtras.service.ts:43-52` — nhật ký `member.add`
  chỉ lưu `memberName` chứ không lưu id, nên **không** tái dựng được lịch sử
  phân công từ bảng `Activity` một cách đáng tin.
- `backend/src/modules/ai/ai.rules.ts:86,118` — đã có sẵn hàm chuẩn hoá chữ và
  bỏ dấu tiếng Việt, bước 3 dùng lại chứ không viết mới.

Bước tiếp theo: **bước 1 — schema**, gồm bốn sửa đổi trên bảng có sẵn và bốn
bảng mới ở §9, làm migration bằng `migrate diff` chứ không `migrate dev`.

### Đã xong — Bước 1: nền dữ liệu (20/09/2026)

**Schema** — đúng như §9: thêm `Card.completedAt`, `CardMember.createdAt` +
`assignedById` (kèm chỉ mục `[userId, createdAt]`), và bốn bảng mới
`MemberWorkProfile`, `WorkspaceAssignWeights`, `AssignWeightHistory`,
`AssignRun`. Bảng cấu hình dùng `Cascade`, bảng nhật ký dùng `SetNull`;
`topUserId`/`chosenUserId` cố ý **không** đặt khoá ngoại để log sống sót khi
xoá tài khoản.

**Migration** `20260920120000_assign_profiles`, sinh bằng
`prisma migrate diff --from-schema <schema ở HEAD> --to-schema prisma/schema.prisma --script`.
Lưu ý cho các bước sau: dự án đã lên **Prisma 7** với `backend/prisma.config.ts`,
nên lệnh phải chạy **từ thư mục `backend/`** (chạy ở gốc repo thì diff trả về
rỗng mà không báo lỗi — mất 15 phút mới phát hiện), và cờ cũ
`--from-schema-datamodel` đã bị bỏ, nay là `--from-schema`.

**Lấp dữ liệu cũ** (phần tự viết thêm vào cuối migration, `migrate diff` không
sinh ra): `completedAt` của thẻ đã xong lấy từ lần ghi nhật ký `card.done` gần
nhất của chính thẻ đó, không có thì lùi về `updatedAt`; thẻ chưa xong bị ép
`completedAt = NULL` để giữ bất biến; `CardMember.createdAt` cũ lấy theo ngày
tạo thẻ — **xấp xỉ có chủ ý**, vì nhật ký `member.add` cũ chỉ lưu tên nên không
đối chiếu được, mà để mặc định `CURRENT_TIMESTAMP` thì toàn bộ lịch sử hoá
thành "vừa mới gán".

**Bốn chỗ ghi trong mã** (đây là phần dễ quên nhất — thêm cột mà không nuôi cột
thì cột vô dụng):

| Tệp | Sửa gì |
|---|---|
| `card/card.service.ts` | `updateCard` ghi `completedAt` **chỉ khi trạng thái thay đổi**, để cập nhật khác (đổi tên) không làm trôi mốc |
| `automation/automation.service.ts` | `SET_DONE` ghi `completedAt` (đường ghi `isDone` thứ hai trong mã nguồn) |
| `card/cardExtras.service.ts` | Gán người: lưu `assignedById`, nhật ký lưu thêm `memberId` |
| `automation/automation.service.ts` | `ASSIGN_MEMBER`: như trên |

`copyCard` **cố ý** không đặt `assignedById` (bản sao có giá trị `null` =
"không rõ"): sao chép thẻ không phải hành vi chọn người có chủ đích, mà mức 2
chỉ nên học từ những lần người dùng thực sự chọn.

**Kiểm thử**: `test/assign.schema.test.ts`, 3 ca gộp (theo lệ cũ: `setup.ts`
TRUNCATE trước mỗi `it` và `registerLimiter` giới hạn 10 đăng ký mỗi tệp).
Canh giữ ba bất biến: `completedAt` khớp `isDone` và không trôi, `CardMember`
ghi đủ thời điểm + người gán, nhật ký có `memberId`.

**Cài lỗi: 8/8 bị bắt**, mã nguồn khôi phục nguyên vẹn (so từng byte). Tám phép
cài: bỏ hẳn ghi `completedAt`; bỏ chặn "chỉ ghi khi đổi trạng thái"; bỏ xong mà
không xoá mốc; đường tự động hoá không ghi mốc; và bốn phép tương ứng cho
`assignedById` / `memberId` trên cả hai đường gán người.

**Suite**: backend 49 tệp / 357 test xanh (trước bước này: 48 / 354).

Bước tiếp theo: **bước 2 — bộ sinh dữ liệu mô phỏng** (§7), gồm hàm sinh tất
định có hạt giống cố định và script đổ vào CSDL.

### Đã xong — Bước 2: bộ dữ liệu mô phỏng (20/09/2026)

**Tệp mới** (đều nằm ngoài đường chạy của sản phẩm, trong `backend/src/scripts/`):

| Tệp | Việc |
|---|---|
| `simVocab.ts` | Từ vựng 8 chủ đề ẩn + từ đồng nghĩa/viết tắt + tiêu đề và mô tả "mơ hồ" |
| `simGenerator.ts` | **Hàm thuần, tất định**: người có kỹ năng ẩn, bảng, thẻ, phân công, kết quả. Không đọc đồng hồ, không đọc CSDL |
| `simSeed.ts` | Đổ bộ dữ liệu vào Postgres trong **một** transaction; dọn bản cũ; đổi "ngày số" sang giờ Việt Nam |
| `seedSimulation.ts` | CLI: `npm run seed:sim` · `-- --seed=N` · `-- --remove` |

**Bộ dữ liệu mặc định** (`DEFAULT_SIM`, hạt giống 20260920): 6 người · 5 bảng ·
120 thẻ · lịch sử 300 ngày · sha256 đóng băng
`e7ddf9ac5a61e70048eab3c8cbcfaaf44b2b4c15d9d90be560086078b591e9d9`. Số đo: 12 thẻ
đang mở (tất cả ở "dự án đang chạy"), đúng hạn 46%, bị mở lại 10%, thẻ mơ hồ 11%,
**phân công lịch sử trùng người giỏi nhất chỉ 48%** (nếu ≈100% thì lịch sử chính là
đáp án và bài toán tầm thường). Trên 8 hạt giống khác: đúng hạn 39–58%, trùng
người giỏi nhất 42–55%, luôn đủ 8/8 chủ đề, đủ 5–6/6 người là "đáp án tốt nhất"
của ít nhất một thẻ. Đúng hạn theo kỹ năng: 67% (kỹ năng ≥ 0,6) so với 22% (< 0,3).

**Sáu nguồn lệch (§7) đều đo được bằng test**, không chỉ nằm trong comment: đồng
nghĩa/viết tắt · lỗi chính tả · thẻ mơ hồ · 25% giao sai · người học nghề (kỹ năng
tăng dần) · đúng hạn theo xác suất. Mỗi nguồn có một ca test bật/tắt nguồn đó và
chứng minh sự khác biệt.

**Quy ước quan trọng cho các bước sau**
- **Định nghĩa duy nhất của "đúng hạn"**: `completedAt <= dueDate`. Bộ sinh, phần
  đổ CSDL và bộ chấm điểm sau này đều phải dùng đúng định nghĩa này. Test đối chiếu
  cờ `onTime` của bộ sinh với phép so sánh trên mốc thời gian thật trong DB.
- **Đáp án tốt nhất** (`bestCandidate`) = người có kỹ năng ẩn cao nhất trong
  **họ bốc** (`assignablePool`): còn làm việc lúc giao **và** không rời nhóm trước khi
  việc có thể xong (`hạn + 9 ngày`). Bước 7 dùng hàm này làm mốc so sánh; bộ chấm
  điểm **không được** import `simGenerator` (chỉ bước 7 được nhìn kỹ năng ẩn).
- Giờ lưu: bắt đầu `00:00`, hạn `23:59` giờ VN (§5.3 của `AI_MODULE.md`); thời điểm
  xong `17:00`, tạo thẻ `09:00`, giao việc `10:00`.
- Tài khoản mô phỏng: `sim1@sim.local`…`sim6@sim.local`, mật khẩu `Password123`.
  `sim1` là chủ nhóm và là người giao việc; chủ nhóm nhận việc = **tự nhận**
  (`assignedById = null`). Người thứ 5 nghỉ giữa chừng (xoá mềm khỏi không gian
  và các bảng), người thứ 6 vào muộn (ngày 157) nên không có lịch sử trước đó.
- Dọn dẹp chỉ chạm tài khoản `@sim.local` và thứ họ sở hữu. Nếu ai đó đăng ký thật
  bằng một địa chỉ đuôi `@sim.local` thì tài khoản đó **sẽ bị xoá** khi chạy lại
  `seed:sim` — không dùng đuôi này cho tài khoản thật.

**Giới hạn phải khai trong luận văn** (đừng để hội đồng tự phát hiện)
1. Các công thức của bộ sinh là **giả định của tác giả**: xác suất đúng hạn
   `0,15 + 0,7·kỹ năng − phạt tải`, chọn người theo `kỹ năng³`, tỉ lệ giao sai 25%,
   tỉ lệ thẻ mơ hồ 12%… Kết quả đánh giá chỉ có nghĩa **trong thế giới giả định này**.
2. Bộ dữ liệu nhỏ (120 thẻ / 6 người). Bước 7 chạy 20 hạt giống để có độ lệch chuẩn,
   nhưng mỗi bộ vẫn nhỏ.
3. Từ vựng chỉ có 8 chủ đề, mỗi chủ đề 140–175 tổ hợp tiêu đề (tổng 1 190, chưa tính
   đồng nghĩa và lỗi chính tả); văn bản thật đa dạng hơn nhiều.
4. Tỉ lệ đúng hạn 46% thấp hơn nhiều nhóm thật — tham số, không phải quan sát.

**Kiểm thử**: `assign.sim.test.ts` (13 ca, thuần), `assign.seed.test.ts` (5 ca, DB
test). Ràng buộc chính: không mâu thuẫn nội tại trên 16 hạt giống × 3 cấu hình (48
bộ); đóng băng sha256; không sửa đầu vào (`Object.freeze`); từng thẻ trong DB khớp
bộ sinh; chạy lại không nhân đôi, không đụng dữ liệu thật; seed hỏng giữa chừng thì
bản cũ còn nguyên; dữ liệu đi qua **đăng nhập + phân quyền thật** (người nghỉ bị
chặn, người vào muộn chỉ vào được dự án đang chạy).

**Cài lỗi: 38/39 bị bắt bởi test độc lập** (bộ sinh 23/24, phần đổ CSDL 15/15), mã
nguồn khôi phục nguyên vẹn. Vì mọi thay đổi ở bộ sinh đều làm đổi mã băm đóng băng
nên phép đó "bắt hộ" mọi lỗi; để đo sức mạnh của các test còn lại, lô bộ sinh chạy
trên bản sao đã vô hiệu hoá riêng phép đóng băng. Phép còn lại (G24: đổi
`rng.int(3)` thành `rng.int(2)`) là **đối chứng có chủ ý**: dữ liệu vẫn nhất quán
nên chỉ phép đóng băng được phép bắt — đúng như kết quả.

**Suite**: backend 51 tệp / 375 test xanh (trước bước này: 49 / 357). `tsc` và
`eslint` sạch.

**Việc tham dò phát hiện — bài học cho các bước sau**
1. Đọc kết quả tham dò **trước** khi viết `expect` lại lộ lỗi thật: chỉ 3/120 thẻ còn
   mở (điểm khả dụng không có dữ liệu để tính); chủ đề 1 chỉ có 1/120 thẻ (người
   mạnh chủ đề đó không bao giờ là đáp án đúng); một số tiêu đề vô nghĩa do ghép động
   từ với đối tượng bừa. Sửa: bảng cuối là "dự án đang chạy" ép sát hôm nay; **chia
   bài** chủ đề từ một cỗ đã xáo thay vì bốc ngẫu nhiên; chỉnh động từ.
2. Ba mâu thuẫn dữ liệu tìm ra khi đọc mã: kẹp ngày hoàn thành vào "hôm nay" biến
   thẻ trễ hạn thành đúng hạn (nay: thẻ đó **còn mở**); người sắp nghỉ vẫn được giao
   việc kéo qua ngày nghỉ (nay: lọc bằng `assignablePool`); và `replace` chỉ thay cụm
   đồng nghĩa **lần đầu** nên `synonymRate = 1` không nghĩa "thay hết" (nay thay mọi
   lần xuất hiện).
3. **Đính chính một chẩn đoán sai**: lúc đầu tôi kết luận LCG thô "có tương quan" và
   thêm bước trộn bit. Đo lại (200 000 mẫu × 4 hạt giống): tương quan liền kề ≈ 0,001,
   tần suất đúng 0,55; cửa sổ 17 lần có ≤ 4 lần "đúng" xảy ra 0,6–1,2% ở **cả** LCG thô
   lẫn LCG đã trộn — tức 4/17 chỉ là sự kiện hiếm tình cờ. Mã trộn bit đã gỡ; LCG thuần
   (cùng hằng số với các test khác) là đủ. Điều thật sự sửa được vấn đề "quá ít thẻ mở"
   là thu hẹp cửa sổ của bảng cuối. Nếu trích dẫn lại trong luận văn: **không** viết
   "LCG có tương quan".
4. Test đầu tiên tôi viết cho bộ quy đổi ngày có kỳ vọng tính tay sai (28/02 00:00 giờ VN
   là `27/02T17:00Z`, không phải `28/02T17:00Z`). Mã đúng, test sai — kiểm chứng bằng
   dòng kiểm ngay bên cạnh trước khi sửa test.
5. Test đổ CSDL kiểm luôn **quan hệ giữa hai đầu**: cờ `onTime` của bộ sinh so với
   phép `completedAt <= dueDate` trên dữ liệu đã đọc lại từ DB — một phép quy đổi múi
   giờ sai lệch dù chỉ 1 ngày sẽ bị lộ ngay.

**Đã đổ vào CSDL dev** (20/09/2026): 6 người · 5 bảng · 120 thẻ · 370 dòng nhật ký.
Dữ liệu thật giữ nguyên (10 người dùng); bảng 40 → 45, thẻ 207 → 327. Chạy lại lần
hai không nhân đôi. Xoá: `npm run seed:sim -- --remove`.

Bước tiếp theo: **bước 3 — tách từ + TF-IDF + hồ sơ người** (§5.1–5.2), hàm thuần,
không import `simGenerator`.

### Đã xong — Bước 3: tách từ, TF-IDF, hồ sơ người (20/09/2026)

**Tệp mới** — ba tệp lõi là **hàm thuần** trong `backend/src/modules/assign/` (không
Prisma, không đồng hồ, không mạng, không import `simGenerator`):

| Tệp | Việc |
|---|---|
| `assign.text.ts` | Tách từ (§5.1): hư từ trên dạng có dấu, uni+bi-gram không bắc qua dấu câu, `countTerms` |
| `assign.tfidf.ts` | `buildIdf`, `idfOf`, `vectorize` (chuẩn hoá độ dài 1), `cosine` ∈ [0,1] |
| `assign.profile.ts` | `decay` (nửa đời 90 ngày), `buildProfile` (từng thẻ cũ giữ véc-tơ riêng), `topTerms` |
| `scripts/showKeywords.ts` | `npm run assign:keywords [-- --seed=N --top=N]`: in top thuật ngữ từng người + phép đo bên dưới |
| `scripts/simTextEval.ts` | Phép đo "láng giềng gần nhất có cùng chủ đề không" (dùng chung với test) |

Hồ sơ **không** gộp lịch sử thành một véc-tơ (§5.4 đã loại cách đó): mỗi thẻ đã xong
giữ véc-tơ và trọng số thời gian riêng, bước 4 sẽ lấy K láng giềng trên đó. `topTerms`
chỉ để hiển thị/gỡ lỗi. `buildIdf` nhận kho ngữ liệu từ bên ngoài — **bước 4/5 phải
quyết định** thẻ đang xét có nằm trong kho hay không (mặc định: có, vì nó thuộc không
gian làm việc).

**Đo được** (`npm run assign:keywords`, dữ liệu mô phỏng): láng giềng gần nhất của một
thẻ có cùng chủ đề ẩn không?

| Biến thể (trung bình 7 hạt giống: mặc định + 1…6) | top-1 | P@5 |
|---|---|---|
| uni + bi-gram, tiêu đề ×2 (**mặc định**) | **96,9%** (93,9 – 99,1) | **84,7%** (80,7 – 87,5) |
| chỉ uni-gram | 96,0% | 83,6% |
| tiêu đề ×1 (ngang mô tả) | 96,4% | 84,2% |
| chỉ tiêu đề | 95,7% | 79,5% |
| chỉ mô tả | 75,3% (65,7 – 83,6) | 59,4% (50,3 – 67,9) |
| ngẫu nhiên (theo phân bố chủ đề thật) | ≈ 13,2% | |

**Đọc số liệu cho đúng** (đừng nói quá trong luận văn):
- 93,9–99,1% là **cận trên trên một thị trường đồ chơi**: 8 chủ đề, mỗi chủ đề có bộ từ
  riêng, nhiều thẻ trùng tiêu đề. Nó chỉ chứng minh chuỗi xử lý **không hỏng** (so với
  13% ngẫu nhiên), không chứng minh độ tốt trên văn bản thật.
- **Bi-gram: chênh nhỏ, cùng chiều nhưng chưa vững.** So với chỉ uni-gram: top-1 +0,9
  điểm (độ lệch chuẩn giữa các hạt giống 1,3; **4 dương / 2 hoà / 1 âm** — hạt giống
  mặc định uni-gram còn hơn 1,0 điểm), P@5 +1,1 điểm (sd 1,1; 5 dương / 2 âm). Chưa đủ
  để viết "bi-gram tốt hơn"; bước 7 chạy 20 hạt giống mới kết luận được.
- **`TITLE_WEIGHT = 2` không có bằng chứng**: so với ×1, top-1 +0,5 (sd 1,6; 3 dương /
  1 hoà / 3 âm), P@5 +0,4 (sd 1,8; 4 dương / 3 âm) — coi như bằng nhau. Giữ ×2 vì mô
  tả thật dài và nhiều chữ đệm, nhưng ghi rõ là giả định tiên nghiệm.
- Tiêu đề mang gần hết tín hiệu (chỉ tiêu đề 95,7%, chỉ mô tả 75,3%) — hệ quả của cách
  bộ sinh viết mô tả (nhiều câu đệm chung), không phải quy luật của dữ liệu thật.

**Phát hiện khi tham dò và khi soạn test** (không phải lúc thiết kế):
1. `chỉ`, `từ`, `quá` từng nằm trong danh sách hư từ → "Tạo **chỉ** mục" mất `chi`,
   và gõ có dấu/không dấu ra hai tập thuật ngữ khác nhau. Cả ba đều hai nghĩa ngay cả
   khi có dấu (chỉ mục, từ khoá, quá hạn). Đã gỡ; phép kiểm dữ liệu-làm-căn-cứ (mọi
   cụm trong từ vựng lĩnh vực phải giữ đủ âm tiết) sẽ bắt lại nếu ai đưa chúng vào.
2. `STOP_PLAIN` từng chứa `the` và `that` — gõ không dấu thì **`thẻ` thành `the`** và
   `thất bại` thành `that bai`, bị nuốt. Phát hiện lúc soạn phép kiểm "STOP_PLAIN không
   nuốt từ nội dung", **trước khi chạy** nó. Chính ghi chú tôi viết ("không đưa từ trùng
   tiếng Việt") vẫn để lọt hai từ này.
3. **Bỏ dấu gộp `cầu` (yêu cầu) và `cấu` (cấu hình) thành `cau`** — thẻ "Cấu hình
   Docker" đóng góp cho thuật ngữ `cau` của người chuyên "Phân tích yêu cầu". Hạn chế
   thật của việc bỏ dấu; bi-gram (`yeu cau` ≠ `cau hinh`) giữ lại được sự phân biệt.
4. **Hồ sơ phản ánh việc đã được giao, không phải kỹ năng ẩn.** `sim1` mạnh CSDL (0,84)
   và Kiểm thử (0,82) nhưng top từ khoá là "biên tập, báo cáo, buổi bảo vệ" (11 thẻ Tài
   liệu, kỹ năng 0,50); `sim4` làm 6 thẻ API dù kỹ năng API chỉ 0,27. Đây đúng là hiện
   tượng "lịch sử ≠ năng lực" mà module phải xử lý — và là lý do tách `experience`
   (đã làm gì) khỏi `reliability` (làm có tốt không) ở §5.4–5.5.
5. Gõ không dấu, các hư từ vốn không dấu (`cho`, `trong`, `theo`, `sau`…) áp dụng cho cả
   hai cách viết vì chúng trùng nhau: **"trọng số" gõ không dấu mất `trong`** (gõ có dấu
   thì giữ). Hệ quả chấp nhận được, đã ghi trong mã.
6. Sai sót của chính tôi khi làm bước này: hai ngưỡng đếm test đoán sai thay vì đếm (25
   cụm, không phải > 25; từ vựng 279, không phải > 300); và chèn mã bằng heredoc Bash
   đã nuốt dấu gạch chéo ngược làm hỏng cú pháp test — đúng bài học cũ "dùng Write/Edit,
   không dùng heredoc khi có `\`".

**Kiểm thử**: `assign.text.test.ts` (12 ca), `assign.tfidf.test.ts` (4), `assign.profile.test.ts`
(6). Ràng buộc chính: câu mẫu với kết quả **đọc từ tham dò** (không đoán); có dấu ≡ không
dấu ≡ NFD ≡ HOA; 9 cặp từ đồng âm khác nghĩa (hư từ bỏ, từ nội dung giữ); mọi cụm lĩnh vực
giữ đủ âm tiết; mọi dấu ngắt câu kiểm **từng ký tự một**; cận độ dài và đầu vào 6 triệu ký
tự chạy < 1 giây; 400 chuỗi ngẫu nhiên (hạt giống cố định) cho tính chất cấu trúc; công thức
IDF/TF/cosine đối chiếu với **oracle độc lập** (cosine trên véc-tơ chưa chuẩn hoá); `topTerms`
đối chiếu với oracle tự tính trên hồ sơ 30 thẻ; và một ca chạy trên dữ liệu mô phỏng
(top-1 ≥ 85%, P@5 ≥ 70%, 4 hạt giống) kèm một ca chứng minh phép đo **tự nó rơi về mức
ngẫu nhiên** khi chuỗi xử lý bị hỏng.

**Cài lỗi: 58/58 bị bắt** (bộ tách từ 29, hồ sơ 18, TF-IDF 11), mã nguồn khôi phục nguyên
vẹn từng byte. Trước khi chạy tôi rà các phép sẽ **lọt** và bổ sung test cho chúng: nhánh
"chỉ xét `STOP_PLAIN` khi chữ không có dấu", từng dấu ngắt câu, hằng số theo **giá trị**
(kiểm qua chính hằng số thì tự khớp với mình), và véc-tơ hồ sơ của thẻ **hai** thuật ngữ
(chuẩn hoá triệt tiêu trọng số tiêu đề khi chỉ có một thuật ngữ).

**Suite**: backend 54 tệp / 397 test xanh (trước bước này: 51 / 375). `tsc` và `eslint` sạch.

**Chưa làm / để bước sau**: kho ngữ liệu và thẻ đang xét (bước 4/5), quét `H`, `TITLE_WEIGHT`
và bi-gram (bước 7), hư từ chưa đánh giá trên văn bản thật.

Bước tiếp theo: **bước 4 — bộ chấm cặp (việc, người)**: ba thành phần (kinh nghiệm chủ
đề / tin cậy / khả dụng), co điểm khi ít dữ liệu, bằng chứng truy vết (§5.4–5.7). Hàm
thuần, có test.

### Đã xong — Bước 4: bộ chấm cặp (việc, người) (20/09/2026)

**Tệp**: `modules/assign/assign.score.ts` (mới, hàm thuần) · `assign.profile.ts` (thêm
`title`, `dueDate`, `reopened` cho `HistoryCard`/`ProfileEntry`) · `scripts/simReplay.ts`
(phát lại lịch sử: `snapshotAsOf`, `replayTargets`, `replay`, `componentSpread`) ·
`scripts/showSuggestions.ts` (`npm run assign:suggest`) · `test/assign.score.test.ts` (21 ca).

**Giao diện cho bước 5** (chỉ hàm thuần, chưa API): `scoreCandidate(card, candidate, ctx)`,
`rankCandidates(card, candidates, ctx)`, `groupOnTimeRate(cards, now)` (tính `muy`),
`outcomeKindOf`/`outcomeValue`, `confidenceLevelOf`. `ScoreContext = { idf, now,
groupOnTimeRate, weights?, params? }`. Mỗi ứng viên trả `score` (0–100 hoặc `null`),
`confidence` + mức `THIN/FAIR/GOOD`, `components.{experience,reliability,availability}`
(`value`, `weight`, `share` = tỉ trọng thực trong điểm tổng), `evidence` (≤ K thẻ cũ kèm
`sim`, `weight`, kết quả, ngày), `evidenceMass`, `fit`, `load`, `capacity`, `flags`. Các chỗ
tài liệu để hở đã chốt ở §5.9.

**Kết quả thử trên dữ liệu mô phỏng — KHÔNG phải đánh giá** (`npm run assign:suggest`; phát
lại lịch sử: mỗi thẻ chỉ dùng thông tin biết được lúc nó được giao; ~103 thẻ/hạt giống, 7 hạt
giống; chưa có nhánh nền, chưa quét tham số, chưa có khoảng tin cậy). Đích đo = "người có kỹ
năng ẩn cao nhất trong họ bốc":

| Cấu hình | top-1 | độ hối tiếc |
|---|---|---|
| ngẫu nhiên (kỳ vọng) | 19,5% | 0,301 |
| **phân công thật trong lịch sử** | **45,4%** | 0,131 |
| chỉ kinh nghiệm (1 / 0 / 0) | 37,5% | 0,177 |
| chỉ tin cậy (0 / 1 / 0) | 34,4% | 0,191 |
| chỉ khả dụng (0 / 0 / 1) | 20,5% (≈ ngẫu nhiên) | 0,273 |
| **kinh nghiệm + tin cậy (0,6 / 0,4 / 0)** | **40,9%** | 0,161 |
| **mặc định 0,45 / 0,30 / 0,25** | **26,0%** | 0,237 |

Cấu hình kinh nghiệm + tin cậy hơn ngẫu nhiên ở **cả 7/7 hạt giống** (top-1 26,0–55,6%; hối
tiếc 0,138–0,197 so với 0,26–0,35). Cấu hình **mặc định** thì top-1 từng hạt giống là 27,2 /
33,3 / 29,4 / 23,3 / **17,6** / 25,3 / 26,0 — hạt giống số 4 còn *thấp hơn* ngẫu nhiên (19,4%),
dù độ hối tiếc vẫn tốt hơn ngẫu nhiên ở mọi hạt giống. Người xếp đầu là người chưa có lịch
sử ở 8,0% số thẻ; có độ tin cậy "mỏng" ở 31,7%.

**Phát hiện thiết kế: trọng số danh nghĩa ≠ ảnh hưởng thực tế.** Thêm khả dụng (trọng số 0,25)
làm top-1 tụt từ 40,9% xuống 26,0%. Tôi đã giải thích sai lần đầu ("người giỏi bị giao nhiều
việc hơn nên bận hơn") — đo lại thì tương quan (kỹ năng, khả dụng) trong họ bốc chỉ **−0,052**
(người giỏi nhất có khả dụng 0,706 so với trung bình 0,740). Cơ chế thật là **chênh lệch độ
phân tán** giữa các ứng viên của cùng một thẻ (723 thẻ):

| Thành phần | trung bình | độ lệch chuẩn | khoảng | tương quan với kỹ năng | trọng số | ảnh hưởng thực tế |
|---|---|---|---|---|---|---|
| kinh nghiệm | 0,056 | **0,039** | 0,106 | +0,388 | 0,45 | **23%** |
| tin cậy | 0,488 | **0,023** | 0,066 | +0,133 | 0,30 | **9%** |
| khả dụng | 0,740 | **0,201** | 0,533 | −0,052 | 0,25 | **67%** |

("Ảnh hưởng thực tế" ≈ trọng số × độ lệch chuẩn, chuẩn hoá — một xấp xỉ dễ hiểu, không phải
đại lượng chính xác.) Kinh nghiệm thấp và hẹp vì lịch sử mỏng (đo trên 3 731 cặp thẻ–ứng viên: trung
bình 2,5 thẻ giống mỗi ứng viên, "số thẻ hiệu dụng" sau suy giảm chỉ 1,5; 16% không có thẻ giống
nào, 52% có ≤ 2) và hệ số bão hoà `e/(e+2)`; tin cậy bị `m = 3` ép sát `muy`;
còn khả dụng đi từ 0 đến 1 theo số thẻ đang mở. Tổng có trọng số để thành phần **trải rộng
nhất** quyết định thứ tự, bất kể trọng số danh nghĩa. Chú ý tin cậy đứng một mình vẫn cho
34,4% — **tín hiệu tốt nhưng bị lấn át**, không phải tín hiệu yếu.

**Hệ quả kèm theo — người mới bị thổi phồng điểm.** Người chưa có lịch sử (`NO_HISTORY`) chỉ
chiếm **1,6%** số ứng viên nhưng đứng đầu ở **8,0%** số thẻ — gấp 5 lần phần chia đều. Nguyên
nhân là chính nguyên tắc 4 (§3: thành phần thiếu dữ liệu không được kéo điểm xuống): điểm của
họ chỉ còn thành phần khả dụng, nên không bị phạt vì thiếu dữ liệu và thắng cả người có dữ
liệu. Nguyên tắc 4 và mục tiêu "không thổi phồng người mới" **mâu thuẫn** ở điểm này; mọi
phương án bên dưới cần xử lý cả nó (ví dụ co điểm tổng về trung bình theo độ tin cậy, hoặc chỉ
xếp hạng người có độ tin cậy tối thiểu).

Phạm vi của phát hiện: con số cụ thể (23/9/67%) là của bộ dữ liệu mô phỏng này; **cơ chế**
(ba thành phần chưa chuẩn hoá về cùng thang) là thuộc tính của thiết kế §5.7. Mức 2 (§8) cập
nhật trên chính các thành phần này nên sẽ gặp cùng vấn đề thang.

**Phương án (chưa làm — cần bạn chọn trước bước 5–6, vì thanh trượt trọng số ở bước 6 phải có
nghĩa):**
- **A. Chuẩn hoá trong tập ứng viên của từng thẻ** (min-max hoặc z-score) trước khi cộng →
  trọng số thành *tầm quan trọng tương đối*. Ít thay đổi nhất; khuyến nghị.
- **B. Biến khả dụng thành ràng buộc**: chỉ phạt khi gần quá tải (ví dụ hinge quanh `cap`),
  bình thường bằng 1 → không lấn thứ tự theo kỹ năng, vẫn chặn được việc dồn cho người đã kín
  việc.
- **C. Hạ trọng số mặc định của khả dụng** (chỉ chữa triệu chứng, dễ vỡ khi dữ liệu đổi).
- **D. Giữ nguyên, để mức 2 học** — cần ≥ 10 lượt phản hồi và vẫn bị lệch thang.
Bước 7 nên đo cả bốn như các nhánh cắt bỏ, cùng chỉ số **kết quả** (đúng hạn, Gini), vì
top-1 theo kỹ năng không thể ghi công cho khả dụng.

Đổi K, nửa đời, hệ số co, hệ số bão hoà chỉ dịch top-1 của cấu hình mặc định trong khoảng
24,4–28,1% (thăm dò một lần bằng script tạm, không nằm trong kho mã) — trọng số quan trọng
hơn tham số nhiều.

**Kiểm thử** (`assign.score.test.ts`, 21 ca): công thức §5.4–5.7 đối chiếu bằng **số tính tay**
(thẻ giống hệt nên `sim = 1`: 1/3, 0,2, 5/7, 0,625, 0,375, 53,75…) và bằng **oracle** tính từ
`cosine`/`decay` (27 tổ hợp kết quả × tuổi × sim cho độ tin cậy); từng quy tắc ở §5.9; ranh
giới 0,25 / 0,6 của độ tin cậy; **mọi hoán vị** của 5 ứng viên (120) cho cùng thứ tự; 300 tình
huống ngẫu nhiên (hạt giống cố định) kiểm bất biến (điểm ∈ [0,100], thành phần ∈ [0,1], tỉ
trọng cộng bằng 1, bằng chứng hợp lệ và không thuộc tương lai, không NaN, tất định); tham số
/ trọng số / `now` / `muy` sai bị từ chối; **chốt chặn kiến trúc** (4 tệp lõi chỉ được import
lẫn nhau và `ai.rules` — không Prisma, không cấu hình, không `simGenerator`); và một chốt
chặn "bộ chấm không vô nghĩa" (kinh nghiệm + tin cậy hơn ngẫu nhiên ở mọi hạt giống).

**Cài lỗi: 69/69 bị bắt** (65 phép trên `assign.score.ts`, 3 trên phần mở rộng hồ sơ, 1 phép
đối xứng), mã nguyên vẹn từng byte. **Hai phép lúc đầu lọt, đã siết test rồi bắt lại:**
- *Ngày đảo ngược của thẻ đang mở* (xoá dòng đổi chỗ): ca cũ dùng đoạn `[bắt đầu 9, hạn 7]`
  mà cả hai cách hiểu đều chồng lấn cửa sổ → không phân biệt được. Thêm ca `[20, 8]`.
- *Đảo nhánh "điểm rỗng xuống cuối" của bộ so sánh*: bộ so sánh thành **không nhất quán**
  nên kết quả `sort` phụ thuộc thứ tự V8 gọi nó; test một thứ tự đầu vào tình cờ ra đúng. Chỉ
  bắt chắc được bằng cách thử **mọi hoán vị** (ca 120 hoán vị ở trên).
Trước khi chạy, việc rà "chỗ nào sẽ lọt" đã bổ sung 5 ca (điển hình: tin cậy chỉ được kiểm với
thẻ `sim = 1`, tuổi 0 nên phép bỏ `sim` hoặc bỏ `v` khỏi tử số sẽ lọt — nay đã bị bắt).

**Hiệu năng**: một lần phát lại 1 hạt giống giảm từ ~3,5 s xuống **394 ms** sau khi đưa
`vnToday()` ra khỏi vòng nóng (nó tạo `Intl.DateTimeFormat` mới mỗi lần gọi, bị gọi hàng
nghìn lần mỗi thẻ). `buildProfile` vẫn vector hoá lại lịch sử mỗi lần chấm — bước 7 (20 hạt
giống × nhiều nhánh × quét tham số) có thể cần đệm kết quả `countTerms`.

**Suite**: backend 55 tệp / 418 test xanh (trước bước này: 54 / 397). `tsc` và `eslint` sạch.

**Bài học**: (1) một lời giải thích "hợp lý" cho kết quả xấu vẫn phải được **đo** trước khi
ghi vào tài liệu — lần này nó đúng một phần ít và bỏ sót cơ chế chính. (2) Xem chỗ bộ chấm kém
ở mức từng thành phần (cắt bỏ) và mức phân tán, không chỉ điểm tổng. (3) Bộ so sánh của
`sort` cần được thử với mọi hoán vị. (4) Đo thời gian trước khi tối ưu: nút thắt là một hàm
tưởng rẻ (`Intl`), không phải thuật toán.

*(Cập nhật: bạn đã chọn phương án A; hiện thực và số đo ở nhật ký bước 4b ngay dưới. Các
con số 26,0% / 23-9-67% ở trên là của bản **cộng thô**, giữ nguyên làm hồ sơ chẩn đoán.)*

### Đã xong — Bước 4b: chuẩn hoá trong nhóm ứng viên — phương án A (20/09/2026)

**Quyết định**: bạn chọn phương án A (chuẩn hoá từng thành phần trong tập ứng viên của thẻ).
Trước khi sửa mã tôi thử **ở ngoài sản phẩm** trên giá trị thô mà `rankCandidates` đã trả về (tệp
tạm, không commit) để chọn biến thể bằng số đo: min-max 36,0% · z-score 35,8% · xếp hạng phần
trăm 34,7% (top-1, 723 tình huống) → chọn **min-max** (đơn giản nhất, có cận [0,1], dễ giải
thích). Ba cách ngang nhau nên không cần cách phức tạp hơn.

**Tệp**: `assign.score.ts` (thêm `normalize`, `missing`, `ComponentScore.scaled`,
`CandidateScore.rawScore`; tách hàm `combine`, `scaleColumn`, `applyScaling`) · `simGenerator.ts`
(xuất `onTimeProbability`, dùng chung với phép phát lại) · `simReplay.ts` (tuỳ chọn chuẩn hoá,
chỉ số `pOnTime*`, `scaledSd`) · `showSuggestions.ts` (bảng so sánh) · `test/assign.normalize.test.ts`
(10 ca mới) · 1 ca mới ở `assign.sim.test.ts`. Quyết định thiết kế ghi ở §5.9 mục 8–11.

**Kết quả (7 hạt giống, 723 tình huống, `npm run assign:suggest`) — vẫn KHÔNG phải đánh giá:**

| Cách xếp hạng | top-1 | hối tiếc | người chưa có LS đứng đầu | P(đúng hạn) kỳ vọng |
|---|---|---|---|---|
| cộng thô (NONE / DROP) — bản trước | 26,0% | 0,237 | 8,0% | 0,444 |
| **MINMAX / DROP — mặc định mới** | **35,9%** | **0,170** | 3,3% | **0,484** |
| MINMAX / NEUTRAL | 36,2% | 0,169 | 0,1% | 0,485 |
| *(tham chiếu)* phân công thật trong lịch sử | 45,4% | 0,131 | | 0,506 |
| *(tham chiếu)* ngẫu nhiên | 19,5% | 0,301 | | 0,387 |
| *(tham chiếu)* người có kỹ năng cao nhất / tối ưu | | | | 0,594 / 0,601 |

- Top-1 từng hạt giống, thô → chuẩn hoá: 27→43 · 33→50 · 29→38 · 23→29 · 18→28 · 25→34 · 26→29
  — **tăng ở cả 7/7**, kể cả hạt giống từng thấp hơn ngẫu nhiên. Người xếp đầu có độ tin cậy
  "mỏng": 31,7% → 19,1%.
- **Ảnh hưởng thực tế của ba thành phần: 23% / 9% / 67% → 45% / 29% / 25%** (độ lệch chuẩn của
  giá trị dùng để cộng: 0,039 / 0,023 / 0,201 → 0,370 / 0,359 / 0,374) — khớp trọng số danh
  nghĩa 45 / 30 / 25. Đúng điều phương án A nhằm tới.
- Còn cách phân công thật 9,5 điểm và cách "kinh nghiệm + tin cậy, không khả dụng" 5,0 điểm
  (40,9% khi cộng thô): phần khả dụng còn lại (25% trọng số) vẫn kéo top-1 theo kỹ năng xuống vì
  nó gần như không liên quan tới kỹ năng — đó là cái giá có chủ đích của việc cân bằng tải.

**Người chưa có lịch sử — quyết định còn treo.** Họ chỉ là ~1,5% số ứng viên. `DROP` (nguyên tắc
4, mặc định) vẫn để họ đứng đầu 3,3% số thẻ (~2 lần phần chia đều) — giảm mạnh từ 8,0% nhưng chưa
về 0. `NEUTRAL` đưa xuống 0,1% với cùng độ chính xác (36,2% so với 35,9%), tức họ **gần như không
bao giờ** được gợi ý — trái với mối lo ở §6 ("người mới mãi không được giao việc"). Tôi giữ
`DROP` làm mặc định vì nó nhất quán với nguyên tắc 4 đã duyệt và với §6, và để bước 7 đo cùng Gini
và "phần thưởng cơ hội học nghề". Đổi mặc định chỉ là một hằng số nếu bạn muốn `NEUTRAL`.

**Giới hạn cần biết** (đã ghi ở §5.9): `score` là điểm tương đối, nhóm một người luôn 50 và nhóm
hai người thì mỗi thành phần chỉ là 0 / 1; min-max nhạy với ngoại lai (một người quá nổi bật ép
những người còn lại về sát 0); con số cụ thể là của bộ dữ liệu mô phỏng này (cơ chế thì không).

**Kiểm thử**: 10 ca ở `assign.normalize.test.ts` — số tính tay 3 ứng viên (`X 100 · Z 46,125 ·
Y 16,667`, thứ tự **đổi** so với cộng thô `X · Y · Z`); suy biến (0,5); **bất biến theo thang**
(đổi sức chứa 5 → 10 không đổi kết quả chuẩn hoá, cộng thô thì đổi); hai chính sách thiếu dữ liệu
(người mới 100 với `DROP`, 65,375 với `NEUTRAL`); cờ `NO_DATA` theo **điểm cuối**; tuỳ chọn sai bị
từ chối; **tính chất trên 150 tình huống × 4 tổ hợp** (giá trị thô và `rawScore` không đổi, min → 0
và max → 1, `NEUTRAL` = trung bình, ti trọng cộng bằng 1, thứ tự và tính bất biến theo hoán vị);
và hai chốt chặn trên dữ liệu mô phỏng (top-1 tăng ở mỗi hạt giống, ảnh hưởng thực tế gần trọng
số danh nghĩa). Ca cũ chỉ phải đổi **một** dòng (so `rankCandidates` với `scoreCandidate` phải
dùng `normalize: 'NONE'`). **Cài lỗi: 36/36 bị bắt** (16 + 20, viết mới cho phần vừa đổi vì hàm
`combine` làm nhiều regex cũ không còn khớp) và 7/7 trên `onTimeProbability` (chạy riêng ca test
của nó để phép đóng băng sha256 không "bắt hộ"); mã nguyên vẹn từng byte.

**Test tìm ra một lỗi thật lúc viết**: điểm của `NEUTRAL` lệch nhau ở chữ số thập phân cuối khi
đổi thứ tự ứng viên, vì trung bình được cộng theo thứ tự đầu vào (phép cộng số thực không giao
hoán). Vô hại với người dùng nhưng phá cam kết "không phụ thuộc thứ tự đầu vào" (hai điểm sát nhau
có thể đổi hạng). Sửa bằng cách cộng theo thứ tự tăng dần (§5.9 mục 11).

**Suite**: backend 56 tệp / 429 test xanh (trước bước này: 55 / 418). `tsc` và `eslint` sạch.

**Bài học**: (1) thử các phương án **bên ngoài** mã sản phẩm trước (ở đây `rankCandidates` đã trả
giá trị thô nên chuẩn hoá thử được mà không sửa gì) — rẻ, và cho số liệu để chọn thay vì cảm
giác. (2) Số trong tài liệu phải **tái hiện được từ kho mã**: chỉ số "xác suất đúng hạn" ban đầu đo
bằng tệp tạm; đã đưa công thức ra hàm dùng chung (`onTimeProbability`) để bộ sinh và phép đánh giá
không thể lệch nhau, mã băm đóng băng của bộ sinh không đổi. (3) Test tính chất có hoán vị đầu
vào bắt được lỗi thứ tự phép cộng mà ca ví dụ không bao giờ thấy.

Bước tiếp theo: **bước 5 — tầng đọc CSDL + API gợi ý cho một thẻ + ghi `AssignRun`** (§9–10). Đầu
vào của API phải dựng đúng `ScoreContext` (IDF của không gian làm việc, `muy` từ `groupOnTimeRate`,
trọng số của nhóm) và trả **cả giá trị thô lẫn điểm tương đối** cho giao diện.

### Đã xong — Bước 5: API gợi ý phân công (20/09/2026)

**Tệp mới** (`backend/src/modules/assign/`): `assign.repo.ts` (đọc/ghi Prisma, không logic) ·
`assign.snapshot.ts` (**hàm thuần**: dòng CSDL → `{ idf, mu, ứng viên }`) · `assign.service.ts` ·
`assign.weights.ts` (hằng số + luật ba trọng số, dùng chung với bước 6) · `assign.schema.ts` ·
`assign.controller.ts` · `assign.routes.ts`. **Sửa**: `app.ts` (3 điểm gắn), `rateLimit.middleware.ts`
(+`assignSuggestLimiter`), `test/helpers.ts` (+`makeDirectUser`). **Không đổi**: schema, migration,
`assign.score.ts`, frontend, biến môi trường. Container backend bind-mount mã nguồn và chạy
`tsx watch` nên **tự nạp lại**, không cần build lại.

Đặc tả API, quy tắc "tại thời điểm `now`", che riêng tư, luật `outcome`/trọng số: **§10**.

**Kiểm chứng — 4 tệp test mới, 76 ca:**

| Tệp | Ca | Bảo đảm |
|---|---|---|
| `assign.weights.test.ts` | 10 | luật `[0,05; 0,70]`, tổng = 1 (biên, NaN/Infinity/chuỗi/thiếu, nhiều lỗi cùng lúc, 500 bộ ngẫu nhiên đối chiếu định nghĩa viết lại độc lập) |
| `assign.snapshot.test.ts` | 25 | từng quy tắc lịch sử/đang mở/`now` (biên ±1ms), dòng hỏng, thẻ đang chấm, `muy`, kho IDF, **không phụ thuộc thứ tự** (25 lần xáo), không sửa đầu vào (đóng băng), và **đối chiếu với `snapshotAsOf`** trên bộ mô phỏng (~30 thẻ lúc giao + thẻ đang mở hôm nay) |
| `assign.api.test.ts` | 39 | quyền (401/403/404), tập ứng viên **khớp `isBoardParticipant`** (ma trận 12 người × 2 mức hiển thị), điểm/cờ/tải/tạm nghỉ trên dữ liệu thật, không đọc chéo không gian, xoá vs lưu trữ, chống rò rỉ tương lai, riêng tư (che tiêu đề, không email, log không chứa tiêu đề, `readViewableBoardIds` khớp `assertBoardView`), `AssignRun`, trọng số (quyền, 400, lịch sử, đặt lại, gợi ý đổi theo trọng số), `outcome` (200/400/403/404/409, đua chạy), giới hạn tốc độ 429 |
| `assign.equivalence.test.ts` | 2 | nạp bộ mô phỏng vào Postgres, chấm qua `suggestForCard`, so **từng điểm / thành phần / cờ / bằng chứng** với đường bộ nhớ của bước 4b: các thẻ đang mở hôm nay (12:00) và ~15 thẻ **phát lại quá khứ** — **khớp tuyệt đối** |

**Cài lỗi: 103 phép, 101 bị bắt, 2 sót và cả hai là mutant tương đương** (mã nguyên vẹn từng byte
sau mỗi nhóm). Lần chạy đầu 97/103 — **bốn lỗ hổng test thật** lộ ra và đã vá:
- `R8/R9/R10`: bỏ điều kiện "chưa xoá" của thẻ / danh sách / bảng trong `readWorkspaceCards` **không
  test nào thấy**. Lý do: lịch sử và tải đi qua `readMemberships` (cũng lọc "chưa xoá") nên hai tầng
  cùng canh một việc; điều kiện ở `readWorkspaceCards` chỉ còn quyết định **kho IDF và `muy`** — thứ
  mà không ca nào nhìn tới. Vá bằng ca "đã xoá là **vô hình**": thêm thẻ/danh sách/bảng đã xoá (kèm
  thẻ đã xong trễ hạn) không được đổi **bất kỳ** con số nào của kết quả; và bỏ xoá thì kết quả phải
  đổi (để phép so sánh không rỗng).
- `C1`: bỏ giới hạn 100 ký tự của `chosenUserId` vẫn ra 400 (service từ chối "chưa ở trong thẻ") nên
  ca cũ chỉ kiểm mã trạng thái. Vá: ca body sai phải có `errors[].field` (do **zod** từ chối), còn 100
  ký tự thì phải lọt qua zod.
- Hai mutant tương đương: `W14` (`> sai số` → `>= sai số` ở tổng trọng số: biên đúng bằng 1e-6 không
  thể chạm trong số thực nhị phân vì `sum − 1` là bội của 2⁻⁵² còn 1e-6 thì không) và `V33` (service
  truyền `targetCardId: null` vào ảnh chụp: bộ chấm tự loại thẻ đang xét khỏi lịch sử và tải theo
  `card.id`, nên kết quả cuối không đổi; phía ảnh chụp đã có mutant `S8` bị bắt).

**Độ trễ** (DB test, máy dev, 30 lượt; `latencyMs` ghi trong `AssignRun` khớp số đo ngoài 198 vs 203 ms):

| Quy mô | p50 | p95 | Tách (trung vị) |
|---|---|---|---|
| 120 thẻ · 6 người · 5 bảng (mặc định) | 19 ms | 26 ms | đọc CSDL 6 · dựng ảnh chụp 3 · chấm 3 |
| **3000 thẻ · 10 người · 20 bảng** (~258 KB chữ) | **203 ms** | 236 ms | đọc CSDL 38 · dựng ảnh chụp 79 · chấm 77 |

Kết luận: ở quy mô "vài nghìn thẻ" của §2 **chưa cần bộ nhớ đệm** (giới hạn 60 lượt/10 phút/người
còn chặn thêm). Nếu sau này cần, chỗ đắt là tách từ lại toàn bộ kho mỗi lượt (`countTerms` cho IDF +
cho lịch sử từng ứng viên): đệm theo `(cardId, updatedAt)` là bước đầu tiên. Số này đo trên **dữ liệu
mô phỏng** chứ không phải tải thật.

**Quyết định đã báo trước (bạn duyệt "ok làm đi")**, kèm chỗ tôi chệch hoặc chưa nói rõ:
1. Tải chỉ đếm thẻ **cùng không gian** (hệ quả: người ở nhiều nhóm trông rảnh hơn thực tế).
2. Lịch sử gồm bảng/danh sách/thẻ **đã lưu trữ**; loại cái **đã xoá**.
3. Che tiêu đề bằng chứng nếu người hỏi không xem được bảng gốc (điểm vẫn dùng).
4. Chưa đọc `allowCrossWorkspace`.
5. Người đã ở trong thẻ vẫn được chấm, `assigned: true`.
6. `outcome` chỉ ghi nhận (mức 1); người được chọn phải đang ở trong thẻ.
7. `PUT` kiểm tra chặt, không tự sửa; `DELETE` đặt lại và đưa `feedbackCount` về 0.
8. Chưa có API sửa số thẻ song song / tạm nghỉ của cá nhân.
9. Người mới vẫn `DROP`.
- **Đính chính**: bản kế hoạch ghi "Express 5" — dự án dùng **Express 4.22** (`package.json`
  `^4.21.2`). Không ảnh hưởng vì không dùng tính năng riêng nào của phiên bản 5.
- **Chưa nói ở kế hoạch**: thẻ nằm trong **bảng đã lưu trữ** trả 404 khi xin gợi ý (đúng hành vi
  `assertCardAccess` của mọi thao tác sửa thẻ), trong khi thẻ **cũ** ở bảng lưu trữ vẫn là bằng chứng;
  trọng số lưu hỏng trong CSDL lùi về mặc định thay vì trả 500.

**Giới hạn cần biết:**
- `GET` gợi ý **có ghi CSDL** (mỗi lượt một dòng `AssignRun`, chỉ chặn bằng giới hạn tốc độ; bảng
  không có chính sách dọn).
- Thẻ có nhiều thành viên: **mỗi người** đều được ghi công vào lịch sử; một người được thêm vào thẻ
  **sau khi xong** vẫn được ghi công (đơn giản hoá, chưa lọc theo `CardMember.createdAt <= completedAt`).
- Nhánh `topUserId = null` (người xếp đầu không có điểm) chưa có ca tự nhiên để kiểm — mutant tương
  ứng không được đưa vào bộ cài lỗi.
- Đúng-hạn dựa trên `dueDate` thật: ô ngày trong `CardModal` từng **lệch múi giờ** (hiển thị UTC, lưu
  giờ máy → lùi 7 giờ mỗi lần bấm Lưu; phiên riêng đang sửa). Hạn chót cũ trong dữ liệu thật có thể đã
  lệch, làm sai thống kê "đúng hạn" cho tới khi được nhập lại.
- Số đo độ trễ là trên dữ liệu mô phỏng, một máy.

**Suite**: backend **60 tệp / 505 test xanh** (trước bước này: 56 / 429), chạy toàn bộ ~380 giây.
`tsc` và `eslint src` sạch.

**Bài học**: (1) **hai tầng cùng canh một việc thì mỗi tầng phải có một ca chỉ nó canh** — mutant
R8–R10 sống sót vì ca "thẻ đã xoá không hiện trong bằng chứng" đúng nhưng chưa từng nhìn `muy` và IDF,
hai thứ chỉ tầng đọc thẻ quyết định. (2) Phép **đối chiếu hai đường** (CSDL vs bộ nhớ) tốn ít mà có
giá trị nhất: không cần đoán trước lỗi nào, chỉ cần hai nơi phải cho cùng con số. (3) `registerLimiter`
chỉ cho 10 lần đăng ký/giờ **mỗi tệp test** nên tệp cần nhiều tài khoản phải tạo người dùng thẳng vào
CSDL (`makeDirectUser`) — ghi vào helper để lần sau khỏi vấp. (4) Chạy cài lỗi dài phải chia theo nhóm
và luôn kiểm nguyên vẹn mã bằng chạy khô (mọi regex phải khớp đúng một chỗ) sau khi xong.

Bước tiếp theo: **bước 6 — giao diện lớp 1**: nút gợi ý trong thẻ (xếp hạng, lý do, cảnh báo khi gán
tay), thanh trượt trọng số, gọi `outcome` sau khi giao, và **học trọng số mức 2** (bộ học dùng lại
`assign.weights.ts`; điều kiện `learned`, ≥ 10 lượt, ứng viên đủ ba thành phần — §8). Cần quyết định
trước: có làm API sửa hồ sơ làm việc cá nhân (số thẻ song song, tạm nghỉ) cùng lúc không.

### Đã xong — Bước 6a: học trọng số (mức 2) + hồ sơ làm việc cá nhân, phần backend (20/09/2026)

**Tệp mới** (`backend/src/modules/assign/`): `assign.learn.ts` (**hàm thuần**: `projectWeights`,
`learnStep`, `learningDecision`, `parseRunCandidates`). **Sửa**: `assign.repo.ts` (`decideAndLearn` — một
giao dịch có khoá dòng; `saveWeights` khoá cùng dòng; đọc lịch sử/số liệu phản hồi; hồ sơ cá nhân),
`assign.service.ts` (`recordOutcome` học; các trường mới của GET trọng số; hồ sơ cá nhân),
`assign.schema.ts` / `assign.controller.ts` / `assign.routes.ts` / `app.ts` (2 endpoint hồ sơ). **Không
đổi**: schema/migration, `assign.score.ts`, biến môi trường. Test: tách hàm dựng "thế giới" ra
`test/assignFixtures.ts` để hai tệp test dùng chung.

Đặc tả: §8 "Cài đặt (bước 6a)" (thuật toán, phép chiếu, đo thử) và §10.5–10.8 (API). Ba quyết định bạn duyệt
("ok làm đi"): phép chiếu thay cho "kẹp rồi chuẩn hoá"; đặc trưng học là giá trị `scaled`; làm API hồ sơ
cá nhân (tự sửa của mình).

**Kiểm chứng — 2 tệp test mới, 41 ca (`assign.learn.test.ts` thuần 24; `assign.learning.test.ts` CSDL 17):**
- *Phép chiếu*: ca tính tay; **luôn hợp lệ** trên 3000 đầu vào ngẫu nhiên rộng [−2; 3]; **là điểm hợp lệ gần nhất**
  (đối chiếu vét cạn lưới bước 0,005 trên 300 đầu vào — không chỉ "hợp lệ"); luỹ đẳng; bất biến theo hoán vị;
  và một ca ghi lại **vì sao không "kẹp rồi chuẩn hoá"** (cách đó ra 0,875, vượt trần).
- *Quyết định học*: từng lý do không học + **thứ tự kiểm tra**; biên 9 → `TOO_EARLY`, 10 → học.
- *Người chọn giả có thiên lệch cố định*: số đo ở §8 (bám theo 8/8 hạt giống; đối chứng không học gì).
- *CSDL thật*: 9 lượt đầu chỉ ghi nhận rồi lượt 10 học đúng `(0,40; 0,30; 0,30)` và lượt 11 tiếp `(0,35; 0,30; 0,35)`;
  `ACCEPTED`, `NO_TOP`, `NOT_CANDIDATE`, `MISSING_COMPONENT`, `TIE`, `NO_CHANGE` đều cộng lượt nhưng không đổi
  trọng số; phép chiếu qua CSDL `(0,70; 0,25; 0,05) + 0,05·(+1; 0; +1) → (0,70; 0,225; 0,075)`; đặt lại đưa số lượt
  về 0; nhóm khác không bị đụng tới; luồng thật gợi ý → giao → ghi kết quả; lịch sử tối đa 20 dòng, mới nhất trước;
  hồ sơ (mặc định, lưu, riêng từng người, 12 kiểu body sai, hai lần lưu cùng lúc, và **hồ sơ thực sự đổi gợi ý**:
  cờ `OVERLOADED` / `PAUSED` / hết tạm nghỉ).

**Cài lỗi: 60 phép, 57 bị bắt ngay; 3 lọt và cả ba đều đã xử lý:**
- `L24` (bỏ kiểm tra hữu hạn ở `learnStep`): phía sau `projectWeights` cũng chặn nên vẫn ném `RangeError` — chỉ khác
  thông điệp. Siết test kiểm **thông điệp của chính `learnStep`** → bị bắt.
- `Q1` (**bỏ `FOR UPDATE`**): ca "hai lượt phản hồi cùng lúc" **vẫn xanh** — hai yêu cầu HTTP hầu như không chồng
  lên nhau ở tầng CSDL nên không thể hiện lỗi, dù đây là lỗi thật (mất cập nhật). Vá bằng ca **tất định**: test tự
  mở một giao dịch giữ khoá dòng, gửi yêu cầu, chờ, để giao dịch đó đổi trọng số rồi commit; có khoá thì lượt phản
  hồi **chờ và đọc giá trị mới** (đếm 14, `(0,50; 0,25; 0,25)`), không khoá thì đọc cũ rồi ghi đè (13, `(0,40; 0,30;
  0,30)`) → bị bắt. Giữ ca cũ làm kiểm khói.
- `Q17` (bỏ vòng "thử lại khi trùng khoá P2002" ở lưu hồ sơ): **không bị bắt kể cả bằng ca tranh chấp tất định**
  (một giao dịch khác vừa tạo dòng nhưng chưa commit) — vì upsert của Prisma trên khoá này là `INSERT … ON CONFLICT DO
  UPDATE`, mã thử lại **không bao giờ chạy tới**. Đã **xoá mã chết**; ca tranh chấp giữ lại làm chốt chặn nếu ai đó
  đổi sang "tìm rồi tạo".

**Suite**: backend **62 tệp / 546 test xanh** (trước bước này: 60 / 505; +24 +17 = +41). `tsc` và `eslint src` sạch.

**Giới hạn cần biết:**
- Mọi số về học đều trên **người chọn giả** (trưởng nhóm mô phỏng), chưa phải người thật; bước 7 mới đo có hệ thống.
- **Nhãn nhiễu làm trọng số trôi**: trưởng nhóm không nhất quán mà thiên lệch trùng mặc định thì trọng số vẫn trôi
  ~0,11 khỏi mặc định (perceptron, `eta` cố định, không có cơ chế giữ chỗ). Bước 7 cần quét `eta` / thêm biên độ trước
  khi nói "học ổn định".
- Không có nút **tắt** học: nhóm chỉ có "Đặt lại" (đưa số lượt về 0 nên phải gom lại 10 phản hồi). Muốn tắt hẳn cần
  thêm cột (migration) — chưa làm.
- Chỉnh tay (`PUT`) giữ nguyên `feedbackCount`, nên nếu nhóm đã ≥ 10 lượt thì lượt giao tiếp theo có thể nhích lại
  trọng số vừa chỉnh (đúng thiết kế: chỉnh tay chỉ là điểm xuất phát).
- Một lượt gợi ý chỉ ghi được **một** người được chọn; người thêm sau trong cùng lượt không tạo thêm phản hồi.

**Bài học**: (1) **một ca "chạy song song rồi kiểm kết quả" không chứng minh có khoá** — nó xanh cả khi không có khoá vì
tính thời gian không chồng nhau; muốn bắt lỗi tranh chấp phải **tự dựng thứ tự** (giữ khoá ở một giao dịch, xem yêu cầu
kia chờ). Cài lỗi lộ ra điều này ngay lần đầu; đọc code hay chạy thử vài lần đều không thấy. (2) Cài lỗi cũng **tìm ra
mã chết** (Q17) — nhánh phòng thủ mà mình tin là cần nhưng nền tảng đã lo rồi; xoá đi đơn giản hơn là giữ một nhánh
không thể kiểm. (3) Đo trước rồi mới viết `expect` (bám theo thiên lệch 0,50→0,03…) cho ngưỡng có căn cứ và lộ luôn
điểm yếu (trôi vì nhiễu) mà nếu chỉ viết theo kỳ vọng thì không bao giờ thấy.

### Đã xong — Bước 6b: giao diện lớp 1 (21/09/2026)

**Tệp mới** (`frontend/src/`): `types/assign.ts` · `lib/api/assign.ts` · `lib/assignWeights.ts` (phép cân bằng ba thanh
trượt bằng **số nguyên phần trăm**) · `lib/assignDates.ts` (ô "tạm nghỉ": ngày thuần ↔ ISO cuối ngày theo giờ máy) ·
`lib/assignLabels.ts` (nhãn tiếng Việt dùng chung) · `components/board/cardModal/AssignSuggestPanel.tsx` (ô
**Thành viên có gợi ý**) · `components/AssignWeightsPanel.tsx` (mục **"Gợi ý phân công"** của trang cài đặt không gian) — kèm
6 tệp test. **Sửa**: `CardModal.tsx` (`run` trả `boolean`; popover Thành viên dùng panel mới, rộng 22rem, cao tối đa 70vh,
`key={card.id}`), `WorkspaceSettingsPage.tsx` (thêm mục). **Backend không đổi.**

**Ô Thành viên của thẻ** — mở ra thì gọi gợi ý (một lần, kể cả trong `React.StrictMode` nhờ dùng chung yêu cầu đang bay):
- mỗi dòng: hạng, tên, thanh **điểm tương đối** ("Phù hợp 92", chú thích là so trong danh sách của đúng thẻ này),
  **ba giá trị thô** (KN 78% · TC 100% · KD 80% — tooltip giải thích từng cái), huy hiệu cờ (quá tải ghi `6/5 thẻ`, tạm nghỉ,
  chưa có lịch sử, chưa làm việc tương tự, không đủ dữ liệu) và mức đủ dữ liệu (mỏng / vừa đủ / đủ); người không có điểm
  ghi "Chưa đủ dữ liệu để chấm" chứ không hiện 0;
- **"Vì sao?"** mở danh sách thẻ cũ làm bằng chứng (tiêu đề, % giống, đúng hạn/trễ, ngày); tiêu đề bị che hiện *Thẻ ở bảng
  riêng tư*; rỗng thì nói lý do (chưa hoàn thành thẻ nào / chưa có thẻ giống);
- bấm dòng vẫn **thêm / bỏ** thành viên như cũ. Giao cho người **quá tải hoặc tạm nghỉ** thì hỏi lại một lần
  ("Bình Trần đang quá tải (6/5 thẻ chồng lấn). Vẫn giao thẻ này?"); các cờ khác chỉ là huy hiệu. Thêm xong thì gọi
  `outcome` — **chỉ người được chọn đầu tiên của mỗi lượt gợi ý**, lỗi (vd 409) chỉ ghi log;
- **giao tay không bao giờ bị chặn**: gợi ý lỗi / bị giới hạn tốc độ (429) thì hiện thông điệp + "Thử lại" và rơi về danh sách
  thường (mọi thành viên bảng, kể cả VIEWER) — không ghi lựa chọn vì không có lượt gợi ý.

**Mục "Gợi ý phân công" ở trang cài đặt không gian**: ba thanh trượt tự cân bằng (kéo một thanh thì hai thanh kia chia lại theo
tỉ lệ, luôn tổng 100%, mỗi thanh 5–70%); Lưu / Hoàn tác / Đặt lại (có hộp xác nhận nói rõ số lượt về 0) chỉ cho OWNER/ADMIN,
thành viên thường chỉ xem; số phản hồi + tỉ lệ giao đúng người xếp đầu; trạng thái tự học ("còn 7 lượt" hoặc "đang tự học");
lịch sử đổi (Tự học / Chỉnh tay); **"Cấu hình làm việc của tôi"**: số thẻ chồng lấn tối đa (1–30) và tạm nghỉ đến hết ngày
(ô ngày thuần, đổi sang 23:59:59.999 **giờ địa phương** rồi gửi ISO có Z — không dùng `datetime-local` nên không dính lỗi lệch múi
giờ đang được sửa ở phiên riêng).

**Kiểm chứng — 6 tệp test mới, 81 ca (frontend 20 tệp / 143 test xanh; trước bước này 14 / 62):**
- `assignWeights` (15): vòng tròn chính xác cho **mọi** bộ hợp lệ (5..70, tổng 100 — 1.000+ bộ); 5.000 tình huống kéo ngẫu nhiên
  luôn ra bộ hợp lệ; kéo về đúng giá trị hiện tại thì không đổi; thanh đang bằng 0 chia đều; NaN không sinh NaN.
- `assignDates` (10, **không phụ thuộc múi giờ của máy chạy**: kỳ vọng dựng từ getter địa phương): 800 ngày liên tiếp vòng tròn,
  ngày nhuận, chuỗi không phải ngày lịch thật bị từ chối.
- `assignLabels` (5) · `lib/api/assign` (7: đường dẫn **mã hoá id**, thân yêu cầu, bóc `data.data`).
- `AssignSuggestPanel` (22) và `AssignWeightsPanel` (22): tải/lỗi/thử lại, thứ tự, giá trị thô, cờ, bằng chứng, xác nhận, ghi lựa chọn
  đúng một lần, rơi về danh sách thường, đổi thẻ/không gian với yêu cầu cũ về muộn (thành công lẫn lỗi), StrictMode, khoá khi
  đang giao, trọng số lẻ đã học hiển thị làm tròn, kéo thanh + lưu gửi đúng số thực tổng 1, đặt lại, thành viên thường chỉ xem, lịch sử
  đúng nhãn từng dòng, cấu hình cá nhân (12 kiểu số thẻ sai, ngày tạm nghỉ, lỗi lưu).

**Cài lỗi (frontend): 96 phép, 91 bị bắt, 5 sót và cả năm là mutant tương đương.** Lượt đầu 87/96 — **bốn lỗ hổng test thật**, đã vá:
đường dẫn API của *trọng số* chưa từng thử với id có ký tự đặc biệt (`A4`); bấm "Thử lại" có thật sự quay về trạng thái "đang tải"
hay để nguyên thông báo lỗi cũ trong lúc chờ (`P31`); yêu cầu **lỗi** của không gian cũ về muộn có đè lên nội dung mới không (`W18`);
và lịch sử có gắn **đúng nhãn cho đúng dòng** không — ca cũ chỉ kiểm "có cả hai nhãn đâu đó" nên đổi chỗ *Tự học ↔ Chỉnh tay*
vẫn xanh (`W19`). Năm mutant tương đương: `F9` (chia đều `[30,30,30]` thay `[33,3…]`: phần dư lớn nhất bù lại ra đúng `34/33/33`),
`D2/D3/D4` (bỏ riêng từng kiểm tra năm / tháng / ngày của ngày lịch: một ngày không tồn tại luôn lệch **ít nhất hai** trong ba thành
phần nên mỗi kiểm tra riêng lẻ là thừa) và `D9` (`new Date(null)` là năm 1970 nên vẫn ra "không tạm nghỉ").
Trước khi chạy cài lỗi tôi đã rà mutant bằng mắt và **vá trước** 6 chỗ yếu (thẻ khác thì không hiện gợi ý của thẻ cũ; đổi thẻ thì
ghi lựa chọn lại được; không lặp dòng; thanh điểm bị kẹp; cờ nguy hiểm có màu; trạng thái đang tải khi đổi không gian).

**Xem bằng mắt** (không đăng nhập được nên dùng **trang xem thử tạm với dữ liệu giả** — đã xoá, không commit): sáng, tối, khổ
375 px, khung đang tải, gợi ý lỗi 429 (rơi về danh sách thường), thành viên thường (thanh trượt khoá); kéo thanh thật bằng chuột
(45/30/25 → 60/22/18, nút Lưu bật, Hoàn tác hiện). Phát hiện và sửa một chỗ: ghi chú dưới thanh trượt bị bó hẹp trên điện thoại →
chỉ thụt lề từ khổ `sm` trở lên. **Chưa ai xem trong ứng dụng thật** — bạn cần tự mở bằng `sim1@sim.local` (mục dưới).

**Suite / kiểm tra**: frontend 20 tệp / 143 test; `tsc -b` sạch; `vite build` thành công; `oxlint` không thêm cảnh báo/lỗi nào từ tệp
mới (còn 1 lỗi có sẵn ở `TemplatesPage.tsx` và nhiều cảnh báo `set-state-in-effect` có sẵn). Backend không đổi (62 / 546).

**Giới hạn cần biết:**
- Mới chỉ gắn vào **ô Thành viên của thẻ** trong `CardModal`; các nơi gán khác (người phụ trách của **mục checklist**, khi tạo thẻ,
  kéo thả) chưa có gợi ý.
- Mỗi lần mở ô Thành viên là **một lượt gợi ý** (một dòng `AssignRun`, giới hạn 60/10 phút/người): mở đóng liên tục sẽ chạm giới hạn
  và panel rơi về danh sách thường. Chia sẻ yêu cầu đang bay chỉ chống gọi đôi của StrictMode, không phải bộ nhớ đệm.
- Ô ngày "tạm nghỉ" hiển thị theo ngôn ngữ trình duyệt (ví dụ `mm/dd/yyyy` ở trình duyệt tiếng Anh) — giá trị gửi đi không phụ thuộc.
- Chỉ ghi **một** lựa chọn cho mỗi lượt mở ô; giao thêm người thứ hai trong cùng lượt không tạo phản hồi mới.
- Học chưa được đánh giá trên người thật (xem 6a) — bước 7.

Bước tiếp theo: **bước 7 — bộ đánh giá offline** (§11): tám nhánh × 20 hạt giống, quét tham số (trong đó `eta` và mức phạt tải),
khoảng tin cậy bootstrap, chỉ số đúng hạn + Gini, và **đường hội tụ** của học trọng số với trưởng nhóm mô phỏng; chốt luôn `DROP` hay
`NEUTRAL` cho người mới (còn treo từ 4b).

### Đã xong — Bước 7a: bộ chạy đánh giá và so sánh các nhánh (21/09/2026)

**Tệp mới** (đều trong `backend/src/scripts/`, ngoài đường chạy của sản phẩm — `modules/assign/` không đổi một dòng):

| Tệp | Việc |
|---|---|
| `evalAssignStats.ts` | Hàm thuần, tất định: trung bình / độ lệch chuẩn / phân vị, **Gini**, phần việc của người nhiều nhất, **bootstrap phân vị** cho trung bình và cho **chênh lệch cặp**, `streamSeed` (hạt giống cho luồng ngẫu nhiên riêng từng thẻ) |
| `evalAssignArms.ts` | Bảy nhánh của bảng chính + bốn nhánh cắt bỏ. **Không import bộ sinh** (test đọc mã nguồn canh giữ): nhánh chỉ thấy chữ và kết quả hoàn thành |
| `evalAssignRun.ts` | Bộ chạy ba chế độ `HISTORY` / `ARM` / `LEADER`, `planDecisions`, `summarizeDecisions`, hai nhánh **tham chiếu** cần kỹ năng ẩn (người giỏi nhất, tối ưu), `EVAL_SEEDS`, `STREAM_SALTS` |
| `evalAssignReport.ts` | Dựng bảng markdown (bảng chính, so sánh cặp, cắt bỏ, đối chiếu phát lại), nhãn kết luận tự động theo khoảng tin cậy, mã băm dữ liệu |
| `evaluateAssign.ts` | CLI `npm run eval:assign` (ở 7a chỉ có `--exp=arms`; 7b thêm các thí nghiệm khác) |

**Sửa**: `simGenerator.ts` — gom công thức rút kết quả thành `sampleOutcome()` (giữ nguyên thứ tự gọi bộ số ngẫu nhiên; **mã băm
đóng băng `e7ddf9ac…` không đổi**, test đang canh), thêm tham số `loadPenalty` cho `onTimeProbability` (không đưa vào `SimConfig`
vì cấu hình nằm trong mã băm); `simReplay.ts` — xuất `simDate` (dùng chung một lần chụp "hôm nay" thay vì hai lần gọi `vnToday()` có
thể rơi vào hai bên nửa đêm); `package.json` — script `eval:assign`.

**Kết quả — 20 hạt giống 2001–2020, vòng kín** (`npm run eval:assign -- --exp=arms --out=eval-assign-result.md`; báo cáo đầy đủ ở
`backend/eval-assign-result.md`). Mỗi nhánh tự giao người xếp đầu, kết quả rút từ mô hình của bộ sinh, tham số giữ đúng mặc định đã duyệt:

| Nhánh | P(đúng hạn) [95% CI] | Hối tiếc | Top-1 | Gini | Người nhiều nhất | Người mới (1 = công bằng) |
|---|---|---|---|---|---|---|
| Ngẫu nhiên | 0,389 [0,379; 0,400] | 0,324 | 18,9% | 0,170 | 23,2% | 1,14 |
| Chia vòng tròn | 0,404 [0,395; 0,414] | 0,315 | 19,6% | 0,131 | 19,9% | 1,02 |
| Người rảnh nhất | 0,395 [0,385; 0,407] | 0,330 | 20,1% | 0,238 | 25,9% | 0,71 |
| Người hay làm nhất | 0,221 [0,204; 0,238] | 0,332 | 18,9% | 0,825 | **97,6%** | 0,00 |
| Chỉ kinh nghiệm | 0,397 [0,373; 0,419] | 0,247 | 33,0% | 0,547 | 51,7% | 0,00 |
| Chỉ tải (khả dụng) | 0,400 [0,390; 0,410] | 0,325 | 18,4% | 0,202 | 24,5% | 0,78 |
| **Đầy đủ, trọng số cố định** | **0,441** [0,427; 0,455] | 0,244 | 30,6% | 0,347 | 34,4% | 0,46 |
| *(tham chiếu)* người kỹ năng cao nhất | 0,592 [0,572; 0,612] | 0,000 | 100% | 0,365 | 35,2% | 0,94 |
| *(tham chiếu)* tối ưu | 0,611 [0,595; 0,626] | 0,009 | 90,7% | 0,292 | 29,9% | 1,04 |

**Năm so sánh chính đã đăng ký trước** (Δ P(đúng hạn) của nhánh đầy đủ trừ nhánh kia, cùng thẻ, cùng may rủi, bootstrap 95% theo hạt
giống): ngẫu nhiên **+0,052 [+0,039; +0,065]** (20 / 0 hạt giống dương / âm) · người rảnh nhất **+0,046 [+0,030; +0,062]** (18 / 2) ·
người hay làm nhất **+0,220 [+0,205; +0,236]** (20 / 0) · chỉ kinh nghiệm **+0,044 [+0,026; +0,062]** (18 / 2) · chỉ tải
**+0,041 [+0,028; +0,054]** (18 / 2). Cả năm khoảng đều nằm hẳn trên 0.

**Cắt bỏ** (bỏ một thành phần khỏi cấu hình mặc định, chia lại trọng số): bỏ khả dụng **−0,028 [−0,043; −0,014]** (3 / 17 hạt giống);
bỏ tin cậy −0,011 [−0,027; +0,005] (chưa phân biệt được); bỏ kinh nghiệm −0,013 [−0,026; −0,000] (hối tiếc +0,037, xấu hơn).

**Đọc kết quả cho đúng — bảy điều, kể cả những điều không đẹp:**
1. **Cách đánh giá đổi cả kết luận.** Phát lại lịch sử cố định (cách của bước 4) cho "chỉ kinh nghiệm" **0,490** — cao nhất trong các nhánh
   thật, hơn cả "đầy đủ" (0,471). Vòng kín cho **0,397**, ngang ngẫu nhiên (0,389), thấp hơn "đầy đủ" 0,044. Nguyên nhân đo được: khi thật
   sự làm theo gợi ý, "chỉ kinh nghiệm" dồn **51,7%** việc cho một người và người vào muộn nhận **0,00** phần chia đều — phát lại không thấy
   vì gợi ý trước không ảnh hưởng thẻ sau. Đây là lý do có vòng kín; **chương đánh giá phải nêu cả hai cách** và không được trích số của
   phát lại như "hiệu quả khi dùng".
2. **Khả dụng có ích — trái với kết luận ngầm của bước 4/4b** ("phạt tải quá nhẹ để khả dụng tạo khác biệt": thêm khả dụng giữ nguyên 0,484), vì phương
   pháp đo lúc đó (phát lại một bước). Vòng kín, với phạt tải mặc định 0,06, bỏ khả dụng làm P(đúng hạn) tụt 0,028 và dồn 45,9% việc cho một người.
   Ghi chính xác: khả dụng không tương quan với **kỹ năng** (đúng), nhưng ngăn được dồn tải khi gợi ý được làm theo thật (điều Top-1 và phát lại không đo).
3. **Khoảng cách tới tối ưu còn lớn.** Ngẫu nhiên 0,389 → tối ưu 0,611: "đầy đủ" (0,441) chỉ đi được khoảng **23%** quãng đường. Người giỏi
   nhất luôn được chọn (0,592) cho thấy trần nằm ở việc biết kỹ năng ẩn, thứ bộ chấm không bao giờ thấy.
4. **"Người hay làm nhất" tệ hơn ngẫu nhiên nhiều (0,221)**: vòng lặp "giàu càng giàu" — 97,6% việc vào một người, tải vượt xa nửa sức chứa
   nên xác suất đúng hạn rơi xuống sàn. Ở phát lại nó chỉ 0,390 (ngang ngẫu nhiên) vì tải không tích luỹ.
5. **Người mới bị thiệt ở nhánh đầy đủ (0,46 phần chia đều)**; ngẫu nhiên cho 1,14 và chia vòng tròn 1,02. Chưa chốt `DROP` hay `NEUTRAL` (số ở 7b).
6. **Mô hình kết quả có trần 0,85**, không phải 0,95: xác suất đúng hạn = 0,15 + 0,7·kỹ năng − phạt tải với kỹ năng ≤ 1; trần kẹp 0,95 của
   `onTimeProbability` không bao giờ đạt trong thế giới hợp lệ (test đã ghi lại).
7. **Phát lại cũ có rò rỉ nhẹ**: nó nhìn thấy các thẻ giao **cùng ngày nhưng xử lý sau** (như tải đang mở). Đã có từ bước 4; vòng kín xử lý thẻ theo
   thứ tự và không rò (test đo cả hai chiều: `HISTORY` có rò, `ARM`/`LEADER` không).

**Ba phát hiện kỹ thuật lúc làm** (đều đo trước khi sửa):
- **Gieo LCG bằng số nguyên kề nhau cho giá trị đầu tương quan 0,998** (`Rng(1000 + i)` và `Rng(1001 + i)`). Mỗi thẻ cần luồng ngẫu nhiên riêng
  giống hệt ở mọi nhánh (để so cặp) — nên `streamSeed` trộn bit (còn 0,01); test đo cả tương quan lẫn **tiêu chí lan truyền** (lật một bit đầu vào →
  ~16/32 bit đầu ra đổi). Bổ sung cho bước 2: phép đo "tương quan liền kề ≈ 0,001" là **trong một luồng** và vẫn đúng; còn **gieo nhiều luồng bằng số kề nhau** thì các luồng gần như trùng nhau.
- `HISTORY` khớp `replay()` cũ **đến từng chữ số** trên ba bộ dữ liệu, kể cả các tuỳ chọn trọng số / chuẩn hoá / thiếu dữ liệu / tham số — mốc đối chiếu
  đã qua cài lỗi ở bước 4 và 4b.
- **Thế giới của nhánh không rò tương lai**: thẻ nhánh sắp quyết định bị "xoá trắng" tới lúc quyết định (chưa người nhận, chưa xong); một test chạy
  chế độ `LEADER` với "trưởng nhóm" giao đúng người của bộ sinh và dùng đúng kết quả của bộ sinh, rồi kiểm **thế giới cuối cùng bằng đúng bộ dữ liệu gốc**.

**Kiểm thử**: 115 test mới (thống kê 23 · nhánh 24 · bộ chạy 46 · báo cáo 22), không cần CSDL. Ràng buộc chính: Gini / bootstrap theo số tính tay và tính chất
(hoán vị, đổi thang, Pigou–Dalton; độ phủ thực tế của khoảng 95% trên 300 mẫu); mỗi nhánh là hoán vị của họ bốc, tất định, không sửa đầu vào (đóng băng);
`sampleOutcome` **ghép đơn điệu** (cùng luồng, người có xác suất cao hơn luôn đúng hạn nếu người thấp hơn đúng hạn); kết quả của thẻ / lựa chọn của nhánh /
lựa chọn của trưởng nhóm đúng bằng luồng `(hạt giống, vị trí thẻ, mục đích)`; ở `LEADER` hai nhánh khác nhau thấy **cùng một thế giới**; mã băm tổng của 20 bộ
dữ liệu đánh giá được đóng băng (`ff6c7cc6…`).

**Cài lỗi tự động: 172 phép, 170 bị bắt, 2 tương đương** (thống kê 40 · nhánh 27 · bộ chạy 59 · báo cáo 32 · bộ sinh 14; mã nguyên vẹn từng byte sau mỗi nhóm; luôn kiểm
`mutated !== original`). Lần chạy đầu để lọt **13** phép — mỗi phép chỉ ra một chỗ test còn hổng thật — và tôi đã vá từng chỗ rồi chạy lại:
- `S19`/`S20` (bỏ **một** trong hai vòng trộn của `streamSeed`): test tương quan kề nhau vẫn qua vì vòng còn lại trộn đủ tốt (0,01); phải đo **tiêu chí lan truyền** —
  bit hạt giống lệch tới 18,45 và 19,31 (so với 15,9–16,1 của bản đủ). `S29` (bootstrap không bao giờ chọn phần tử cuối): thêm ca có ngoại lai ở đầu / cuối dãy.
- `A14` (`normalize` không chuyển xuống bộ chấm): ca đối chiếu cũ dùng trọng số 1/0/0 mà với **một** thành phần min-max chỉ là phép biến đổi đơn điệu nên không phân biệt
  được `NONE` với `MINMAX`; thêm ca nhiều thành phần. `P15`/`P32`: dữ liệu mẫu của test báo cáo trùng giá trị giữa hai cột (đổi cột nào cũng không lộ) và thiếu ca kiểm bảng cắt bỏ.
- `G14` (`Math.max(1, hạn − ngày giao)`): chỉ lộ khi việc dài 1 ngày mà bộ sinh không tạo ca đó → test trực tiếp `sampleOutcome`. `R4` (giờ quyết định 10:00 → 11:00): sai lệch
  một giờ không đổi thứ hạng nên số đo không thấy → ghim giờ bằng test riêng.
- `R7` (họ bốc 1 người bị giữ lại): cần nhóm 2 người. `R22`/`R23` (kết quả rút theo tải / sức chứa của người *xếp đầu* thay vì người *được giao*): chỉ lộ khi hai người khác nhau **và**
  phạt tải làm xác suất đổi — phạt 1,0 đẩy cả hai xuống sàn 0,05 nên không phân biệt được, phải dùng thế giới dày việc và phạt 0,3. `R25` (biên của "thẻ gần đây"): test cũ chép lại
  đúng công thức của mã nên không thể bắt; dùng hằng số viết tay (270 = 300 − 30) và tìm hạt giống có thẻ tạo đúng ngày biên. `R41` (người vào đúng ngày `minDay`); `R53` (thông báo lỗi
  bị lỗi của bộ chấm che khuất).
- **Hai phép còn lại là tương đương**: `R11` (`done: false` của thẻ xoá trắng — `completedDay: null` đã vô hiệu hoá nó) và `R19` (kiểm tra người được giao ∈ họ bốc, không thể chạm
  tới vì đã có kiểm tra hoán vị trước đó — giữ làm mã phòng thủ). Ở bộ sinh, 5/14 phép (các hằng số của mô hình kết quả) chỉ bị **phép đóng băng** bắt — đúng thiết kế, nhưng nghĩa là
  các hằng số đó không có test ngữ nghĩa riêng.

**Sai sót của chính tôi ở bước này**: (1) hai kỳ vọng tính tay sai trong test (`onTimeProbability(0,99; 0; 4)` bằng 0,843 chứ không chạm trần 0,95; một số thứ tự
của bảng độ hội tụ) — mã đúng, test sai, phát hiện nhờ chạy; (2) một bản vá test làm tệp **không biên dịch được** (lỗi thoát ký tự) và tôi không chạy lại test
ngay, nên 10 phép cài lỗi lọt sang tầng 3 đều bị "bắt" giả — nhận ra vì **10/10 phép nào qua được tầng 1–2 đều bị bắt ở tầng 3**, điều vô lý; sửa rồi chạy lại đúng
các phép đó; (3) đưa bằng heredoc Bash một script có dấu gạch chéo ngược thì bị nuốt (đã biết từ bước 3, vẫn mắc lại). Bài học: sau **mỗi** lần sửa tệp test phải chạy
lại chính nó trước khi tin bất kỳ kết quả cài lỗi nào; một loạt phép bị bắt cùng ở một tầng ngoài dự đoán là dấu hiệu cần kiểm tra, không phải tin vui.

**Chưa làm / để 7b**: nhánh thứ tám (có học trọng số) cần trưởng nhóm giả; quét tham số; độ bền trước các nguồn lệch; `DROP` hay `NEUTRAL`.

### Đã xong — Bước 7b: học trọng số, quét tham số, độ bền vững (21/09/2026)

**Tệp mới** (trong `backend/src/scripts/`): `evalAssignLeader.ts` (trưởng nhóm giả, nhánh có học, đường hội tụ) · `evalAssignExperiments.ts` (khai báo mọi điểm đo
và vòng lặp chung) · `evalAssignReportSweeps.ts` (bảng, đường hội tụ CSV + SVG). **Sửa**: `evaluateAssign.ts` (thêm `--exp=params|norm|weights|world|robust|learn|text|all|report`,
bộ nhớ kết quả từng thí nghiệm để chạy từng phần / song song; chạy hết 20 hạt giống mất khoảng một giờ tuần tự, chia 4 tiến trình song song còn ~20 phút trên máy 16 nhân), `.gitignore`.
**Kết quả nằm ở** `backend/eval-assign-sweeps.md` (+ `eval-assign-sweeps-hoitu.csv`, `eval-assign-sweeps-hoitu.svg` — dán được vào Word); các tệp `.json` thô (5,5 MB)
không commit, chạy lại là ra.

**Tham số** (vòng kín, nhánh đầy đủ, mỗi lần đổi **một** tham số; Δ P(đúng hạn) so với mặc định, cặp theo hạt giống): `H` (30 / 60 / 180 / 365 ngày): −0,008 · +0,002 · +0,003 ·
+0,006; `K` (1 / 3 / 8 / 12): +0,006 · +0,007 · +0,002 · +0,002; `m` (0,5 / 1 / 6 / 12): +0,003 · +0,004 · −0,000 · −0,001; `m_e` (0,5 / 1 / 4 / 8): **+0,012** · +0,006 · −0,002 ·
−0,005; `simMin` (0 / 0,1 / 0,2): **+0,011** · +0,005 · +0,002; sức chứa mà bộ chấm tin (2 / 3 / 5 / 8 thay vì sức chứa thật): +0,004 · +0,002 · +0,003 · +0,003. **Không tham số nào
đổi P(đúng hạn) quá 0,012** (2,7% tương đối). Trong 23 phép so sánh có 5 khoảng không chứa 0: `H = 30` (âm) và `K = 1`, `K = 3`, `m_e = 0,5`, `simMin = 0` (dương). Năm khoảng nhiều hơn
~1 phép mong đợi do may rủi, nhưng bốn phép dương **không độc lập** — cùng một hướng ("tin nhiều hơn vào vài thẻ giống nhất": `K` nhỏ, bão hoà nhanh, không ngưỡng giống) — nên đọc là "có thể
có một cải thiện nhỏ ≤ 0,012 theo hướng đó", chưa đủ để đổi gì (D3). Tham số mặc định gần bằng phẳng, không có dấu hiệu sai. Điểm đáng ghi cho chương phương pháp: gán sức chứa mặc định 5
cho mọi người khi họ chưa khai hồ sơ **không làm hại** (+0,003, chưa phân biệt được).

**Lưới trọng số** (33 điểm bội của 0,1 trong [0,1; 0,7] + mặc định): mặc định đứng **hạng 6/34**; tốt nhất là 0,40 / 0,30 / 0,30 với 0,447 (Δ +0,006 [−0,002; +0,015], chưa phân biệt
được) — **không cấu hình nào tốt hơn có ý nghĩa**. Trọng số 0,45 / 0,30 / 0,25 là điểm hợp lý trên một mặt bằng phẳng, không phải điểm tối ưu được chọn.

**Người mới: `DROP` hay `NEUTRAL`** (chuẩn hoá × xử lý thành phần thiếu, vòng kín): min-max/`DROP` (mặc định) 0,441 · min-max/`NEUTRAL` **0,445** (Δ +0,004 [−0,004; +0,012], chưa phân biệt được) ·
cộng thô/`DROP` 0,432 (−0,009, chưa phân biệt được) · cộng thô/`NEUTRAL` 0,428 (−0,013 [−0,027; +0,000]). Phần chia đều của người vào muộn (trung bình 20 hạt giống): 0,46 (`DROP`) · 0,37 (`NEUTRAL`) ·
1,13 (cộng thô/`DROP`, đổi lại hối tiếc 0,278 và Top-1 25,9%). **Hai số 0,46 và 0,37 KHÔNG cho phép kết luận `NEUTRAL` chia đều hơn**: chênh lệch cặp `NEUTRAL` − `DROP` là **−0,091 [−0,274; +0,091]**
(chưa phân biệt được: 6 hạt giống dương, 9 âm, 5 bằng; độ lệch chuẩn của chênh lệch giữa các hạt giống 0,43, hai hạt giống 2013 và 2020 lệch ngược chiều nhau khoảng ±1). Gini của `NEUTRAL` cao hơn `DROP` nhẹ
(+0,019 [+0,001; +0,039]; không nằm trong sáu phép đăng ký trước). *Đính chính của chính tôi*: bản nháp đầu của nhật ký này viết "`NEUTRAL` cho người mới ít việc hơn" chỉ dựa vào hai số trung bình; khi tính
khoảng tin cậy cặp thì câu đó không đứng vững, đã sửa, và bảng mục 2 của báo cáo nay in sẵn các chênh lệch cặp này (`newcomerDeltaLines`). **Kết quả không đủ để đổi mặc định**: `NEUTRAL` không cho kết quả tốt hơn
và không cho thấy lợi ích chia đều nào. Nhưng thí nghiệm học (dưới) lộ một hệ quả thật của `DROP` cần biết.

**Thế giới: phạt tải và mật độ việc** (Δ P(đúng hạn) của nhánh đầy đủ so với "bỏ khả dụng"; phạt tải 0 / 0,06 / 0,12 / 0,2 / 0,3): −0,002 [−0,015; +0,013] · **+0,028** [+0,014; +0,043] · **+0,040** ·
**+0,050** · **+0,060**. Khi tải không tạo hậu quả (phạt 0) khả dụng không giúp cũng không hại; hễ có hậu quả (kể cả 0,06 mặc định) thì có ích, và có ích hơn khi hậu quả nặng. "Chỉ kinh nghiệm" so với
ngẫu nhiên: +0,054 (phạt 0) → +0,007 (0,06) → **−0,027** [−0,053; −0,001] (0,2) → −0,033 (0,3) — dồn việc cho người giỏi nhất là *tự huỷ* khi tải nặng. Mật độ việc 24 / 48 / 72 thẻ mỗi bảng: "đầy
đủ" hơn ngẫu nhiên +0,052 → +0,087 → +0,105 và hơn "bỏ khả dụng" +0,028 → +0,055 → +0,056: **việc càng dày, bộ chấm càng đáng giá**.

**Độ bền trước sáu nguồn lệch của bộ sinh** (mỗi nguồn hạ thấp / nâng cao so với mặc định, 13 thế giới): "đầy đủ" **đứng đầu ở 13/13** và hơn ngẫu nhiên có ý nghĩa ở 13/13 (+0,026 đến +0,068); hơn "chỉ kinh
nghiệm" ở 12/13 (chỉ mất ý nghĩa ở nhóm 10 người: +0,018 [−0,001; +0,039]). Thứ hạng của ba nhánh còn lại **đổi** giữa các thế giới (ví dụ "chỉ kinh nghiệm" xuống cuối khi thẻ mơ hồ nhiều hoặc
người học nghề nhiều) — đúng như mong đợi và là lý do không nên trích thứ hạng của các nhánh yếu. Đây là bảng trả lời rủi ro "vòng tròn giữa bộ sinh và bộ chấm" (§12): kết luận chính không phụ
thuộc riêng vào một giả định nào của bộ sinh, dù vẫn nằm trong thế giới do chính tác giả dựng.

**Học trọng số** (trưởng nhóm giả có thiên lệch tuỳ ý 0,70 ở một thành phần; `eta` = 0,05 của sản phẩm; khoảng cách L1 tới thiên lệch, tại 0 / 10 / 20 / 40 / 80 / 100 quyết định; nhiễu 0):
ưu tiên người rảnh **0,90 → 0,10** (13 lượt học) · ưu tiên kinh nghiệm 0,50 → 0,19 (4,4 lượt học) · ưu tiên đúng hạn 0,80 → 0,37 (7,8) · đối chứng (thiên lệch trùng mặc định) **0,00** (0 lượt học:
không lỗi thì không học). Ba điều đo được:
1. **Số lượt học rất ít** (4–13 trong ~105 quyết định) vì phần lớn bất đồng là với **người mới** — bộ học bỏ qua các ca thiếu thành phần (luật §8). Hội tụ bị giới hạn bởi số ca *học được*, không phải số phản hồi.
2. **Hiện tượng "người mới bị gợi ý mãi"** (`DROP`): người chưa có lịch sử chỉ còn khả dụng nên điểm được chia lại thành chính giá trị đó (100 nếu hoàn toàn rảnh) và đứng đầu; trưởng nhóm không chọn họ
   thì họ không bao giờ có lịch sử, khả dụng mãi cao, và **86,5% số quyết định ở ba cuối có người xếp đầu là người mới** (gu ưu tiên kinh nghiệm, nhiễu 0). Tỉ lệ chấp nhận trên *mọi* quyết định vì vậy
   chỉ 10,9% ở ba cuối; tách riêng các quyết định mà **mọi ứng viên đủ dữ liệu** (mẫu số chung của hai nhánh) mới thấy tác dụng học thật: chấp nhận ba cuối **47,5% → 100%** (Δ +0,525 [+0,275; +0,850],
   khoảng rộng vì số ca ít), ưu tiên người rảnh 54,1% → 93,7% (Δ +0,396 [+0,355; +0,435]), ưu tiên đúng hạn 66,3% → 88,8% (Δ +0,225 [+0,050; +0,425]). Đối chứng nhiễu 0: cả hai nhánh **100%** — phép đo không có
   lỗi ẩn. Đây là hệ quả **thật** của `DROP` mà số liệu bảng người mới ở trên không thấy.
3. **Nhiễu làm trọng số trôi, và `eta` lớn làm trôi nặng hơn**: đối chứng (gu trùng mặc định, chỉ nhiễu) trôi tới 0,10 (nhiễu 0,1) và **0,25** (nhiễu 0,25) khỏi mặc định; ở nhiễu 0,25 nhánh có học chấp
   nhận **kém** cố định 0,034 (Δ −0,034 [−0,051; −0,019], đủ dữ liệu). Quét `eta` (0,01 → 0,2): với gu rõ (nhiễu 0) khoảng cách cuối giảm từ 0,32 xuống 0,15 rồi nhích lên 0,17; với nhiễu 0,25 cực tiểu nằm ở
   `eta` 0,02–0,05 rồi tăng (0,35 → 0,43); đối chứng nhiễu 0,25: 0,11 → 0,30 khi `eta` tăng. **0,05 là một điểm thoả hiệp hợp lý, không tối ưu cho cả hai phía** — không có căn cứ đổi, nhưng nếu nhóm thật
   có phản hồi nhiễu thì `eta` nhỏ hơn an toàn hơn.

**Gu nằm ngoài không gian đặc trưng** (trưởng nhóm nhìn giá trị *thô* thay vì giá trị đã chuẩn hoá): "khoảng cách tới thiên lệch" không còn ý nghĩa (đích khác không gian) và tăng (0,50 → 0,74); nhưng tỉ lệ chấp nhận
vẫn tăng khi gu gần khả dụng (ưu tiên người rảnh **+0,136** [+0,110; +0,162]) và **không tăng** với ưu tiên kinh nghiệm (−0,001 [−0,019; +0,018]). Hiểu đúng: bộ học chỉ bám được gu biểu diễn được trong không gian
đặc trưng của nó.

**Ảnh hưởng khách quan của việc học** (nhánh có học tự giao người xếp đầu theo trọng số đã học, nhiễu 0,1): so với nhánh cố định, Δ P(đúng hạn) = ưu tiên kinh nghiệm **−0,009** [−0,018; +0,001] · ưu tiên đúng hạn
**−0,005** [−0,014; +0,004] · ưu tiên người rảnh **−0,012** [−0,022; −0,003] (hối tiếc +0,038). **Học theo gu của nhóm không làm kết quả khách quan tốt hơn** (thậm chí kém nhẹ với gu "người rảnh") —
đúng như đã báo trước: gu của trưởng nhóm giả là tuỳ ý và không biết kỹ năng ẩn. Đây là cái giá *khách quan* (nhỏ) của việc gợi ý bám theo gu; lợi ích của cá nhân hoá là ở **chấp nhận và tin tưởng của người
dùng**, không phải ở đúng hạn — và điều đó chỉ đo được với người thật.

**Chuỗi xử lý văn bản** (láng giềng gần nhất có cùng chủ đề ẩn không, 20 hạt giống; hoàn tất việc bước 3 hẹn cho bước 7): mặc định (uni + bi-gram, tiêu đề ×2) Top-1 **96,1%**, P@5 **82,9%**. Chỉ uni-gram:
Top-1 −0,19 điểm (chưa phân biệt được), P@5 **−0,63 điểm** [−1,13; −0,14] → **bi-gram giúp nhẹ nhưng có ý nghĩa ở P@5**. Trọng số tiêu đề ×1: −0,39 / +0,13 điểm (đều chưa phân biệt được — **×1 và ×2 ngang nhau**);
×3: P@5 −1,02; ×5: P@5 −2,03 (đều có ý nghĩa); chỉ tiêu đề −5,35; chỉ mô tả −22,9 điểm. `TITLE_WEIGHT = 2` vẫn là giả định tiên nghiệm nhưng nằm ở rìa mặt bằng tốt (thêm nữa thì hại).

**Kiểm thử**: 97 test mới, không cần CSDL (trưởng nhóm giả + nhánh có học 32 · thí nghiệm 28 · báo cáo và đường hội tụ 37). Ràng buộc chính: trưởng nhóm chọn đúng người có tiện ích lớn nhất
(số tính tay), thiếu thành phần tính 0,5, hoà thì người đứng trước, nhiễu là Gauss chuẩn (tỉ lệ chọn khớp Φ(1) ≈ 0,84), tất định theo luồng; **nhánh có học đối chiếu với `learningDecision` / `learnStep`
của sản phẩm** (không có bản sao luật học); các điểm quét **đúng bằng danh sách đã công bố** (đổi lưới phải là một quyết định có ý thức, không phải lỡ tay); `runLearning` được **dựng lại bằng tay**
từ các hàm của module và phải trùng từng chữ số; bảng và SVG kiểm bằng số tính tay (toạ độ điểm, thoát ký tự XML, không NaN, đường toàn 0).

**Cài lỗi tự động: 136 phép, 134 bị bắt, 2 tương đương** (trưởng nhóm + nhánh có học 40 · báo cáo và đường hội tụ 66 · thí nghiệm 30; mã nguyên vẹn từng byte sau mỗi nhóm). Lần chạy đầu (126 phép) để lọt **12** — mỗi phép chỉ ra một chỗ test còn hổng thật; tôi đọc từng chỗ, vá 10 chỗ rồi chạy lại đúng 10 phép đó (đều bị bắt), còn 2 là tương đương:
- `L15` (tiện ích tốt nhất khởi đầu 0 thay vì −∞): chỉ lộ khi **mọi** tiện ích đều âm (nhiễu rất lớn) → test với bộ số ngẫu nhiên kịch bản, ba người đều âm, phải chọn người lớn nhất chứ không phải người đầu danh sách.
- `W24b` (bảng quét `eta` lấy điểm **đầu** thay vì điểm cuối của đường) và `W26` (mũi tên ba đầu → ba cuối của nhánh cố định bị đảo): dữ liệu mẫu đối xứng (đầu = cuối) nên đảo gì cũng không lộ → dữ liệu mẫu bất đối xứng, mỗi cột một cặp số khác nhau.
- `W34` (đường hội tụ bỏ mốc cuối): mốc cuối luôn chỉ còn **một** hạt giống nên bị loại dù sao; chỉ lộ khi mọi hạt giống cùng độ dài → test riêng. `W45` (sàn 0,2 của trục y): mọi giá trị > 0 đã làm trần ≥ 0,2 nhờ phép làm tròn lên,
  nên sàn chỉ có tác dụng khi đường **toàn 0** — và đó chính là gu "đối chứng" nhiễu 0 (không có lỗi để học) → test đường toàn 0. `W53` (mục 4 chỉ in khi có phạt tải): thiếu ca chỉ có mật độ.
- `X17` (mục tiêu hội tụ không qua phép chiếu): bốn gu đều hợp lệ nên phép chiếu chỉ đổi ở chữ số thứ 16 — không test ngữ nghĩa nào phân biệt được → test **tạm sửa** một gu ra ngoài tập hợp lệ (0,9 / 0,05 / 0,05) và kiểm mục tiêu là điểm hợp lệ gần nhất
  (0,7 / 0,15 / 0,15), khôi phục trong `finally`. `X19` (nhánh cố định dùng chung giữa không gian `SCALED` và `RAW`): thêm ca hai không gian cùng gu / nhiễu (tỉ lệ chấp nhận đo được 57,7% so với 31,5%). `X20` (trưởng nhóm không nhận nhiễu của điểm) và
  `X23` (nhánh có học ở thí nghiệm khách quan không có trưởng nhóm, tức không bao giờ học): test dựng lại bằng tay từng bước và kiểm trọng số cuối **tiến sát gu** (khoảng cách L1 từ 0,90 xuống ~0,03).
- **Hai phép tương đương**: `L20` (người xếp đầu không có điểm vẫn truyền `topUserId`: `learningDecision` trả `learn: false` ở **mọi** nhánh khi người đó không có điểm — `NO_TOP` hay `MISSING_COMPONENT` — nên hành vi của nhánh không đổi;
  giữ dòng này để khớp đúng `assign.service.ts`) và `X26` (biến thể "chỉ mô tả" đặt trọng số tiêu đề 0 → 1, nhưng tiêu đề là chuỗi rỗng).
- Sau đó tôi **thêm** dòng chênh lệch cặp của "người mới" và Gini vào báo cáo (xem đính chính ở trên) và cài 10 phép cho phần mới: bị bắt cả 10 ở lần đầu.

**Sai sót / ngoặt của chính tôi ở bước này**: (1) câu "`NEUTRAL` cho người mới ít việc hơn" — kết luận từ hai số trung bình mà chưa tính khoảng tin cậy; sai, đã sửa và bổ sung vào báo cáo (đọc kỹ ở mục `DROP` hay `NEUTRAL`); (2) khi thấy tỉ lệ chấp nhận thấp
(10–76%) tôi nghi có **lỗi của bộ chạy**; đo từng bất đồng thì tất cả là người mới dưới `DROP` — không phải lỗi mà là một đặc tính thật (đã thêm phép đo "đủ dữ liệu" để tách ra, bằng bọc nhánh, không sửa bộ chạy); (3) lại một lần nữa gõ script
qua heredoc Bash có dấu gạch chéo ngược (`'\n'` thành xuống dòng thật) và bắt được **trước khi chạy** nhờ kiểm bằng `grep` sau khi vá; (4) bản nháp nhật ký ghi "24 phép so sánh" trong khi đúng là 23 — đã sửa theo số đếm.

**Quyết định còn treo / đề nghị** (không tự đổi gì — D3):
- **`DROP` hay `NEUTRAL`**: số liệu không đủ để đổi (kết quả ngang nhau; chia đều cho người mới cũng chưa phân biệt được, xem đính chính ở trên). Nhưng hiện tượng "người mới bị gợi ý mãi" (86,5% ở gu ưu tiên kinh nghiệm) là một rủi ro trải nghiệm thật.
  Hướng nhẹ nhất để cân nhắc, **chưa cài**: người `NO_HISTORY` không được xếp trên người có bằng chứng "đủ" chỉ nhờ khả dụng (ví dụ kẹp điểm của họ về mức tối đa của người có dữ liệu, hoặc hiện "chưa đủ dữ liệu" thay
  cho điểm 100). Cần bạn quyết có làm không.
- **`eta`**: giữ 0,05 (không có căn cứ đổi). Nếu muốn giảm rủi ro trôi khi phản hồi nhiễu: nút "tắt học" (cần migration, xem 10.9) hoặc `eta` nhỏ hơn.
- Bốn điểm hơi tốt hơn (`K = 1`, `K = 3`, `m_e = 0,5`, `simMin = 0`; ba tham số) **chưa đủ căn cứ** vì 23 phép so sánh; nếu muốn xét, phải kiểm lại trên hạt giống **mới** (ví dụ 3001–3020) — không được dùng chính 2001–2020 để chọn rồi báo số.

**Giới hạn cần biết** (ngoài các giới hạn chung của bước 7a): (1) **trưởng nhóm giả** là một mô hình gu tuỳ ý một người, không có người dùng thật; (2) hạt giống 2001–2003 đã được xem lúc kiểm tra đường ống
(không chỉnh gì dựa vào chúng) và tôi cũng đo mức tải trên 1001–1010 lúc lập kế hoạch (chỉ mô tả thế giới, không chọn gì); (3) khoảng tin cậy cho từng phép so sánh mô tả **không** hiệu chỉnh đa so sánh —
chỉ sáu phép chính là đăng ký trước; (4) thế giới chỉ 6 người / ~105 quyết định; nhóm 10 người và mật độ 72 thẻ được thử trong bảng độ bền / thế giới nhưng chưa phải cấu hình gốc của mọi phép đo; (5) số liệu học là
**học trên người chọn giả** và dừng ở ~105 quyết định — nhóm thật có thể có nhiều hoặc ít phản hồi hơn.

Bước tiếp theo: **bước 8 — lớp 2 tối giản** (chia việc cả danh sách, vòng lặp tham lam ~50 dòng + màn xem trước), rồi bước 9 (đánh giá lớp 2 + viết chương). Trước đó nên chốt hai quyết định treo ở trên.

### Đã xong — Bước 8a: lớp 2, chia việc cho cả danh sách — phần backend (22/09/2026)

**Tệp mới**: `backend/src/modules/assign/assign.plan.ts` (hàm thuần: `urgencyOrder`, `planAssignments`, `PLAN_MAX_CARDS = 30`, `PLAN_VERSION`;
khoảng 50 dòng thuật toán) · `test/assign.plan.test.ts` (21 test) · `test/assign.planapi.test.ts` (16 test, CSDL thật). **Sửa**: `assign.repo.ts`
(`readPlanCards`), `assign.service.ts` (`planForList`, và tách `readScoringInputs` dùng chung với gợi ý một thẻ), `assign.controller.ts`,
`assign.routes.ts` (`listAssignRoutes`), `rateLimit.middleware.ts` (`assignPlanLimiter`: 10 lượt / 10 phút), `app.ts` (gắn `/api/lists/:listId/assignment-plan`
trước `/api/lists`). Không đổi schema, không migration, không sửa bộ chấm. Đặc tả đầy đủ ở §10.10.

**Năm quyết định đã duyệt trước khi làm**: (1) chỉ chia thẻ **chưa có người nhận**; (2) bỏ qua người đang tạm nghỉ, người quá tải vẫn được xét nhưng có cờ;
(3) **không ghi** `AssignRun`, không học từ chỉnh sửa trên bản xem trước; (4) áp dụng bằng API giao thẻ có sẵn, không làm API giao hàng loạt;
(5) không đổi gì ở phần đã duyệt (`DROP`, trọng số, tham số).

**Vì sao chọn "cộng thẻ vừa giao vào tải"** (đo trước khi chọn; bảng ở §10.10): thiết kế ghi "trừ điểm dần" mà không nói cách. Đo thăm dò 36 đợt × 12 thẻ (hạt giống
dev 9301–9312) cho thấy cách đơn giản nhất — cộng thẻ vừa giao vào "thẻ đang mở" của người đó — giảm phần của người nhận nhiều nhất từ 49,1% xuống 35,4% và có
P(đúng hạn) cao nhất trong các cách thực tế (0,485 so với 0,459 của chấm riêng từng thẻ); trần ⌈n/m⌉ và phạt điểm làm đều hơn nhưng **không** làm đúng hạn tốt hơn
(0,470; 0,485; 0,477). Vì vậy không thêm tham số nào. Đây là số thăm dò (36 đợt, không kiểm định), **không phải** kết quả chính thức: bước 9 đo lại trên hạt giống mới.

**Điều cần biết, không giấu**:
- Cách này **chỉ giảm chứ không chia đều**: người nhiều nhất vẫn 35% (chia đều ~17–20%). Nguyên nhân là cơ chế, không phải lỗi: min-max biến mọi chênh lệch thành 0..1 nên khả dụng
  (trọng số 0,25) không thắng nổi kinh nghiệm + tin cậy (0,75) khi một người vượt trội cả hai. Có test ghi lại: người vượt trội vẫn nhận mọi thẻ, khả dụng của người đó giảm
  1 → 0,8 → 0,6 → 0,4, và cờ `OVERLOADED` bật đúng lúc đủ sức chứa (bản xem trước dựa vào cờ này để người dùng đổi người).
- Kế hoạch **kế thừa nguyên** điểm yếu của lớp 1: với `DROP`, người chưa có lịch sử được điểm 100 khi rảnh nên có thể nhận những thẻ đầu của đợt (cờ `NO_HISTORY` cảnh báo).
- Kế hoạch **đúng bằng lần lượt bấm gợi ý số 1 cho từng thẻ rồi giao thật** (khác duy nhất: bỏ qua người tạm nghỉ). Test tích hợp làm đúng vậy trên CSDL thật và đối chiếu từng người, điểm
  tương đối, điểm thô, độ tin cậy, ba thành phần, tải, sức chứa, cờ và toàn bộ xếp hạng — với trọng số mặc định và với trọng số nhóm thiên về khả dụng (0,05 / 0,25 / 0,70).
- Độ trễ đo: 3 / 22 / 74 ms mỗi thẻ ở nhóm 120 / 1000 / 3000 thẻ; 30 thẻ ở 3000 thẻ mất ≈ 2,2 s trên một luồng Node — lý do của hạn mức 10 lượt / 10 phút và trần 30 thẻ.

**Kiểm thử**: 37 test mới (hàm thuần 21 · API 16); toàn bộ suite backend 71 tệp / 795 test xanh, `tsc` và `eslint` sạch. Hàm thuần đối chiếu số tính tay (luân phiên A, B, A, B với tải 0/1/1/2 và 0/0/1/1;
thẻ không ngày chồng lấn mọi khoảng; thẻ chỉ có ngày bắt đầu; người đang có sẵn thẻ chồng lấn), tính tất định qua 20 lần xáo trộn đầu vào, không sửa đầu vào (đóng băng toàn bộ), và một test trên
bộ mô phỏng (người nhận nhiều nhất và Gini thấp hơn rõ so với chấm riêng từng thẻ). Test API: quyền (401 / 403 / 404), thẻ nào được chia, cắt 30 thẻ, riêng tư (không bằng chứng, không email, chuỗi tiêu đề lịch sử
không xuất hiện ở đâu trong phản hồi), **không ghi gì** (đếm sáu bảng trước và sau), người tạm nghỉ (kể cả biên `>=`), sức chứa và số thẻ đang mở, tất định, trọng số lưu hỏng lùi về mặc định, giới hạn tốc độ.

**Cài lỗi tự động: 89 phép, 87 bị bắt, 2 tương đương** (hàm thuần 29 · dịch vụ 39 · kho dữ liệu 12 · route và giới hạn 9; mã nguyên vẹn từng byte sau mỗi nhóm). Lần chạy đầu để lọt 5 chỗ thật, mỗi chỗ chỉ ra một lỗ của test:
- `P15` / `P16` / `P20` (thẻ ảo lấy ngày bắt đầu bằng hạn; lấy hạn bằng ngày bắt đầu; bỏ các thẻ đang mở thật của người đó): dữ liệu mẫu chỉ có cửa sổ trùng nhau hoàn toàn nên cách nào cũng ra cùng kết quả.
  Thêm ba ca: thẻ sau chỉ chồng lấn đoạn cuối của thẻ trước; thẻ chỉ có ngày bắt đầu (không hạn) chiếm mọi thời điểm từ ngày đó; người đang có sẵn 2 thẻ chồng lấn.
- `S19` / `S26` (sức chứa trong kết quả bị thay bằng hằng số 5): mọi người trong dữ liệu mẫu đều sức chứa mặc định 5 nên hằng số nào cũng "đúng" — đặt sức chứa 3 và 4 cho hai người.
- Hai phép đầu của nhóm dịch vụ (`S1`, `S2`: trọng số hỏng) ban đầu **được báo là bị bắt vì lỗi cú pháp** (tôi xoá dòng `if` mà để lại `else`) — bắt vì lý do sai; viết lại cho đúng, thêm ca "trọng số lưu hỏng lùi về mặc định" cho kế hoạch và một
  phép đảo điều kiện; cả ba đều bị bắt.
- **Hai phép tương đương**: `P18` (thẻ ảo mang `cardId` rỗng: id đó chỉ dùng để bỏ chính thẻ đang chấm, mà thẻ đang chấm không bao giờ nằm trong tải ảo) và `R12` (đổi thứ tự đọc thẻ trong kho dữ liệu: tầng dịch vụ luôn sắp lại theo `urgencyOrder`).

**Sai sót / ngoặt của chính tôi ở bước này**: (1) 18 test hàm thuần và 14 test API viết đầu tiên đều xanh ngay lần chạy đầu — điều đó **không** chứng tỏ chúng đủ mạnh, cài lỗi mới lộ ra 5 lỗ; (2) viết sai hai phép cài lỗi (lỗi cú pháp) và chỉ phát hiện vì
chúng bị bắt ngay ở tầng đầu trong khi không test nào của tầng đó nói về trọng số hỏng — cùng bài học của bước 7: một phép bị bắt phải bị bắt vì đúng lý do.

**Chưa làm / để 8b**: màn xem trước (nút "Chia việc gợi ý…" ở menu danh sách, sửa từng dòng, áp dụng từng thẻ); đánh giá lớp 2 chính thức ở bước 9 (cân tải, việc trễ hạn, hạt giống mới, so sánh đăng ký trước).

### Đã xong — Bước 8b: lớp 2, màn xem trước chia việc — phần giao diện (22/09/2026)

**Tệp mới** (`frontend/src/`): `components/board/AssignPlanModal.tsx` (màn xem trước) + test (20) · `lib/assignPlan.ts` (phần tính toán thuần: lựa chọn ban đầu, thẻ sẽ giao, phân bố sau khi chia,
cảnh báo, nhãn ô chọn, giao tuần tự) + test (11) · `components/board/ListColumn.plan.test.tsx` (5). **Sửa**: `ListColumn.tsx` (mục menu + mở màn xem trước; prop tuỳ chọn `onAssignApplied`),
`pages/BoardPage.tsx` (truyền `reloadLists`), `lib/api/assign.ts` + test (`fetchAssignPlan`), `types/assign.ts` (kiểu của kế hoạch). Backend không đổi.

**Hành vi** (đặc tả ở cuối §10.10): mục "Chia việc gợi ý… (N thẻ chưa giao)" ở menu "⋯" của danh sách, chỉ khi sửa được bảng, khoá và có giải thích khi không có thẻ nào chưa giao (đếm ở máy khách: chưa
xong và chưa có thành viên); màn xem trước mỗi thẻ một dòng theo thứ tự xử lý, người được gợi ý chọn sẵn, điểm tương đối + tải + ba giá trị **thô**, huy hiệu cờ, cảnh báo quá tải / tạm nghỉ,
đổi người hoặc "Không giao", bỏ tick từng thẻ, bảng "Sau khi áp dụng" cập nhật ngay; **Áp dụng** giao tuần tự bằng `addCardMember`, thẻ lỗi không chặn thẻ sau và được báo riêng kèm lý do, thẻ đã giao khoá lại,
áp dụng lại chỉ giao phần còn lại; đóng khi còn thẻ lỗi vẫn báo bảng tải lại đúng một lần; `React.StrictMode` chỉ gọi máy chủ một lần (giới hạn 10 lượt / 10 phút).

**Giới hạn cần biết**: (1) đổi sang người KHÔNG được gợi ý thì không có ba giá trị thô (máy chủ chỉ gửi ba giá trị của người được gợi ý; xếp hạng gọn chỉ có điểm, tải, cờ); (2) "đang mở" ở bảng phân bố là mọi thẻ chưa xong
của người đó, kể cả thẻ không trùng thời gian — thô hơn tải mà bộ chấm dùng (chỉ đếm thẻ chồng lấn), nên có ghi chú ngay dưới bảng; (3) kế hoạch không được lưu và không khoá thẻ; (4) không học từ chỉnh sửa (§10.10);
(5) với `DROP`, người chưa có lịch sử có thể đứng đầu một số thẻ (huy hiệu "Chưa có lịch sử" — thấy rõ trên dữ liệu giả lúc xem giao diện).

**Kiểm thử**: 37 test mới (thuần 11 · màn hình 20 · menu 5 · API 1); toàn bộ suite frontend 23 tệp / 180 test xanh, `tsc -b` sạch, `oxlint` không có cảnh báo ở tệp mới (còn **một lỗi có sẵn** ở
`pages/TemplatesPage.tsx:170` — hook gọi trong callback — không thuộc bước này, chưa sửa). Test kiểm hành vi nhìn thấy được: thứ tự dòng, gợi ý chọn sẵn, giá trị thô, cảnh báo, phân bố, đổi người / bỏ tick, giao tuần tự
(chứng minh không bao giờ hai yêu cầu cùng lúc), thẻ lỗi, khoá nút khi đang giao, Escape / bấm nền, khoá cuộn trang nền, kết quả cũ về muộn khi đổi danh sách.

**Cài lỗi tự động: 105 phép, 104 bị bắt, 1 tương đương** (màn hình 63 · tính toán thuần 25 · menu 13 · API 4; mã nguyên vẹn từng byte sau mỗi nhóm; chạy lại **toàn bộ** trên mã cuối cùng). Phép tương đương duy nhất: rào `applying ||` đầu hàm `apply()`, trùng với nút đã bị khoá trong lúc giao (không có đường nào trong giao diện để bấm hai lần). Lần chạy đầu (65 phép ở màn hình) để lọt 7, xem ở dưới.

**Xem giao diện bằng mắt**: dùng trang xem thử tạm với dữ liệu giả (thay bộ chuyển của axios, không cần đăng nhập; đã xoá, không commit): sáng, tối, 375 px, trạng thái đang tính, và luồng áp dụng khi một thẻ lỗi
(năm thẻ "Đã giao", một thẻ "Không giao được: …", chân trang "1 thẻ chưa giao được", nút "Áp dụng cho 1 thẻ"). Không có lỗi trong console. **Tôi chưa mở tính năng này trong ứng dụng thật** (không đăng nhập được vào tài khoản
mô phỏng) — bạn nên tự bấm thử một lần với `sim1@sim.local`.

**Sai sót / ngoặt của chính tôi ở bước này**: (1) lần chạy đầu 4/5 test của menu đỏ: bộ khung thử của tôi thiếu ràng buộc khoảng cách của `PointerSensor` nên dnd-kit nuốt cú bấm vào nút menu (dùng lại đúng bộ cảm biến của `BoardPage`
như test cũ); (2) kiểm dấu xuống dòng bằng `grep -c $'\r'` báo 0 với các tệp CRLF — sai, nên bản vá đầu vào `ListColumn.tsx` hỏng ở phép kiểm chắc chắn (chưa ghi gì); đã kiểm bằng Python và sửa giữ nguyên CRLF;
(3) viết lại một dòng biểu thức chính quy của tập lệnh cài lỗi bằng heredoc và bị nuốt dấu gạch chéo ngược lần nữa (đã biết từ bước 3, 7) — sửa bằng công cụ Edit; (4) khi xem giao diện phát hiện một lỗi **test không thấy**: sau khi giao xong
một phần, bảng "Sau khi áp dụng" không tính các thẻ đã giao (chỉ đếm thẻ còn phải giao) nên số thẻ đang mở của người nhận bị báo thấp — sửa và thêm ca kiểm; (5) lần cài lỗi đầu để lọt 7 phép: 4 là mã thừa
(hai dòng đặt lại trạng thái lúc tải, dòng đặt lại cờ trước khi đóng, biểu thức `isDone ||` ở ô tick) — xoá mã thừa thay vì giữ; 1 là rào phòng thủ trùng với nút đã khoá (`applying ||` trong `apply()`) — giữ, ghi là tương đương;
2 là lỗ thật (kết quả cũ về muộn đè lên khi đổi danh sách; màu huy hiệu cờ) — thêm test.

**Chưa làm**: đánh giá lớp 2 chính thức (bước 9: cân tải, việc trễ hạn, hạt giống mới, so sánh đăng ký trước; có thể cần đo thêm cân bằng mạnh hơn: trần hoặc phạt điểm, §10.10).

### Đã xong — Bước 9a: đánh giá lớp 2, khung đo (hàm thuần, chưa có số chính thức) (22/09/2026)

**Tệp mới** (`backend/src/scripts/`): `evalPlanArms.ts` (các "cách chia" đối chứng an toàn không biết kỹ năng ẩn — `pickIndependent`, `pickPlannedLikeProduct`, `pickCapped`,
`pickPenalty`, `makeRoundRobin`, và vòng lặp tham lam dùng chung `runGreedyBatch`) · `evalPlanBatches.ts` (`cutBatch`/`cutBatches`: cắt một "đợt chia việc" — lát cắt K thẻ kế
tiếp theo thời gian — ra khỏi bộ mô phỏng, dựng lại đúng ảnh chụp lịch sử/tải bằng `snapshotAsOf` có sẵn) · `evalPlanRun.ts` (nối các cách chia với một đợt: `planned` **gọi
thẳng `planAssignments()` thật**, `oracleGreedy` là tham chiếu cần kỹ năng ẩn viết riêng; `scoreRows`, `summarizeBatch`, `meanSummaries`; `PLAN_EVAL_SEEDS = 3001–3020`) ·
`evalPlanReport.ts` (bảng markdown, tái dùng nguyên `fmtMeanCI`/`fmtDiff`/`verdict`/`datasetFingerprint`/`mdTable` đã có từ bước 7, không viết lại) · `evalPlan.ts` (CLI
`npm run eval:plan`, không cần bộ nhớ đệm vì một lượt chạy 20 hạt giống chỉ mất khoảng nửa phút). **Sửa**: `test/assign.plan.test.ts` (bài test "giới hạn ưu trội người mạnh"
nay gọi `cutBatches` dùng chung thay vì lặp lại logic cắt lát cắt) · `package.json` (`eval:plan`) · `.gitignore` (`/eval-plan-*.json`). Không đổi `assign.plan.ts` /
`assign.score.ts` / tham số nào đã duyệt — đúng lời hứa ghi sẵn trong `assign.plan.ts` ("dùng chung cho máy chủ và cho bước 9… cùng một hàm, không bản sao"): nhánh `planned`
không viết lại thuật toán, và có test đối chiếu (bên dưới) chứng minh điều đó.

**Bảy cách chia** (đúng thứ tự bảng thăm dò cũ ở §10.10): `independent` (chấm riêng từng thẻ, không cộng tải — mô phỏng tính năng gợi ý cũ trước khi có lớp 2), `planned`
(cách đã cài), `plannedCap` (thêm trần ⌈K/người⌉), `plannedPenalty10`/`plannedPenalty20` (trừ điểm mỗi thẻ đã nhận), `roundRobin` (sàn dưới cùng), `oracleGreedy` (tham chiếu
cần biết kỹ năng ẩn — **tham lam từng thẻ theo đúng thứ tự xử lý, không phải lời giải tối ưu toàn cục cho cả đợt**, ghi rõ trong mọi báo cáo để không phóng đại). Một đợt được
mô phỏng bằng lát cắt K thẻ kế tiếp theo thời gian (không có khái niệm "danh sách" riêng trong mô phỏng — xem lý do trong chính `evalPlanBatches.ts` và trong giới hạn của báo
cáo bước 9b).

**Kiểm thử**: 71 test mới (`evalplanarms` 18 · `evalplanbatches` 17 · `evalplanrun` 27 · `evalplanreport` 9); toàn bộ suite backend 75 tệp / 864 test xanh, `tsc` và `eslint`
sạch. Quan trọng nhất là **test đối chiếu**: nhánh `planned` phải **đúng bằng** (a) gọi thẳng `planAssignments()` và (b) gọi vòng lặp tham lam dùng chung với đúng luật của
sản phẩm — kiểm trên 6 tổ hợp (2 hạt giống dev × 3 ngày quyết định) trên bộ mô phỏng thật. `oracleGreedy` có một phép đối chiếu độc lập (viết lại vòng lặp trong chính bài
test, không dùng chung mã nguồn) và một phép "sinh đôi" (hai người giống hệt kỹ năng, sức chứa nhỏ) chứng minh đúng cả thứ tự chọn lẫn số tải báo cáo ra.

**Cài lỗi tự động: 86 phép, 85 bị bắt, 1 tương đương** (nhánh 31 · cắt đợt 18 · bộ chạy 24 · báo cáo 13; mã nguyên vẹn từng byte sau mỗi nhóm). Phép tương đương: `C13`
(bỏ điều kiện `assigneeId === null` trong `scoreRows` khi tính `pOnTime`) — vô hại vì `chosenSkill` được tính ở một dòng riêng, không bị mutant chạm tới, và **luôn** là `null`
đúng lúc `assigneeId` là `null`; điều kiện `chosenSkill === null` còn lại trong biểu thức đã tự động cho ra cùng kết quả, chứng minh được chứ không chỉ đoán.

**Sai sót / ngoặt của chính tôi ở bước này** — lần cài lỗi đầu để lọt 15 phép, tất cả đều vì test đầu tiên chỉ dùng dữ liệu "thực tế ngẫu nhiên" thay vì dữ liệu **cố tình ép**
vào đúng trường hợp biên:
- Nhóm nhánh (2 phép): `pickCapped`/`pickPenalty` từ chối tham số sai (`cap`/`lambda` âm) nhưng không có ca nào thử `NaN`, `Infinity`, hay biên `0` — thêm ca.
- Nhóm cắt đợt (5 phép): bộ mô phỏng ngẫu nhiên không may tạo ra đúng trường hợp cần thử (hai thẻ **cùng ngày giao** để thấy hoà; thẻ có hạn **bằng** ngày giao để thấy phép
  kẹp tối thiểu 1 ngày; danh sách người **không** theo thứ tự bảng chữ cái để thấy thiếu sắp xếp) — phải dựng một bộ dữ liệu mô phỏng **tự tay** (không qua `generateSimulation`)
  để ép đúng các trường hợp đó, thay vì tiếp tục thử với dữ liệu ngẫu nhiên và hy vọng trúng.
- Nhóm bộ chạy (5 phép, toàn bộ ở `oracleGreedy`): bài test "đối chiếu độc lập" ban đầu dùng bộ mô phỏng ngẫu nhiên rất nhỏ (3 người, 4 thẻ) nhưng **sức chứa mặc định quá
  rộng** so với vài thẻ đó nên tải tích luỹ không bao giờ vượt nửa sức chứa — đúng ngưỡng mà công thức phạt tải bắt đầu có tác dụng (§7 "Ghi chú bước 4/4b") — nên hoà không
  bao giờ xảy ra và việc cộng dồn tải không đổi kết quả chọn. Phải dựng cặp "sinh đôi" với sức chứa = 1 (kẹp ngưỡng phạt xuống rất thấp) để ép hoà ở thẻ đầu, ép đổi người ở
  thẻ hai (tải vừa cộng dồn đủ gây phạt), và ép hoà lại ở thẻ ba — mới thấy được cả hướng phá hoà, dấu `>`/`>=`, và việc đọc tải từ đúng chỗ.
- Nhóm báo cáo (2 phép): (a) `expect(text).toContain('40,0%')` tưởng chắc chắn nhưng giá trị 0,4 lại **trùng ngẫu nhiên** với giá trị mặc định của cột Top-1 trong chính dữ
  liệu giả — bảng đọc nhầm cột "người nhiều nhất" thành cột khác vẫn qua được vì con số 40,0% vẫn xuất hiện ở đâu đó trong bảng; phải neo đúng vào một chuỗi ô cụ thể
  (`'| Cách đã cài | 40,0% |'`) thay vì kiểm "có xuất hiện ở đâu đó"; (b) lặp lại đúng lỗi đã gặp ở nhóm nhánh trong chính bước này: `.toThrow()` không kèm nội dung để một
  lỗi **khác** (đọc `undefined.perSeed`) vẫn coi là "bắt được" — phải kiểm đúng thông điệp.

Bài học chung (nhắc lại từ các bước trước, lần này rõ hơn): **cài lỗi tự động chỉ lộ ra lỗ khi dữ liệu thử chạm đúng trường hợp biên** — dữ liệu mô phỏng ngẫu nhiên, dù thật,
không thay được việc dựng dữ liệu tự tay ép đúng vào ranh giới cần kiểm (hoà điểm, sức chứa nhỏ, biên số, thứ tự không sắp sẵn).

**Chưa làm / để 9b**: chạy chính thức trên 20 hạt giống 3001–3020, năm so sánh đã đăng ký trước (`planned` so với `independent`/`roundRobin`/`plannedCap`/`plannedPenalty10`/
`oracleGreedy`, hai chỉ số chính "người nhiều nhất" và "P(đúng hạn)"), quét cỡ đợt K, đối chiếu DROP/NEUTRAL ở góc nhìn cả đợt, viết số liệu chính thức vào tài liệu này và
phần "chương đánh giá" cho luận văn.
