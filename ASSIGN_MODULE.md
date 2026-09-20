# Module Gợi ý phân công công việc (cá nhân hoá từ lịch sử)

> **Trạng thái: xong bước 0–5 (kể cả 4b)** — thiết kế đã chốt; nền dữ liệu, bộ dữ
> liệu mô phỏng, bộ tách từ + TF-IDF + hồ sơ người, **bộ chấm cặp (việc, người)**
> đã có, chạy được trên dữ liệu mô phỏng và **đã chuẩn hoá thành phần trong nhóm
> ứng viên (phương án A)** để trọng số có nghĩa. **Bước 5: API** — xếp hạng ứng viên
> cho một thẻ từ dữ liệu thật trong Postgres, ghi nhật ký `AssignRun`, ghi người được
> chọn, xem/chỉnh/đặt lại trọng số của nhóm (§10). Chưa có giao diện và chưa học
> trọng số (bước 6), chưa có đánh giá chính thức (bước 7). Còn treo: chính sách cho
> **người chưa có lịch sử** (DROP hay NEUTRAL — nhật ký bước 4b).
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
v1 phình to rồi bị xoá. Lớp 2 bản này chỉ là vòng lặp tham lam khoảng 50 dòng.

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
- Kẹp mỗi trọng số vào `[0.05, 0.70]`, rồi chuẩn hoá cho tổng bằng 1.

**Bốn chốt chặn để không loạn**:

1. Chỉ bắt đầu học sau **ít nhất 10 lượt** có phản hồi trong nhóm đó; trước đó
   chỉ ghi nhận (mức 1).
2. Chỉ học khi người được chọn **nằm trong danh sách ứng viên đã chấm**.
3. Chỉ học khi cả hai người **đủ cả ba thành phần** — tránh học từ so sánh khập
   khiễng giữa người có dữ liệu và người không.
4. Lưu **lịch sử mọi lần đổi trọng số** → vẽ được **đường hội tụ** trong luận
   văn. Biểu đồ đó chính là bằng chứng nhìn thấy được rằng cá nhân hoá có xảy ra.

Có nút đặt lại về mặc định. Trọng số hiện tại luôn xem được, không giấu.

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
| POST | `/api/assignment/runs/:runId/outcome` | Ghi người thực sự được chọn (nuôi mức 1 và mức 2) | **bước 5** (chỉ ghi nhận) |
| GET / PUT / DELETE | `/api/workspaces/:workspaceId/assignment-weights` | Xem, chỉnh ba thanh trượt, đặt lại mặc định | **bước 5** |
| POST | `/api/lists/:listId/assignment-plan` | Lớp 2 (bước 8): xếp việc cho cả danh sách, trả bản xem trước | chưa làm |

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
assign.weights.ts   hằng số + kiểm tra ba trọng số (hàm thuần; bước 6 dùng lại cho bộ học)
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
  VIEWER được gán tay trước đó) vẫn ghi được nhưng `accepted = false`; bước 6 sẽ **không học** từ lượt
  đó (chốt chặn 2 của §8).
- **Bước 5 chỉ ghi nhận (mức 1)**: `learned` luôn `false`, không đụng tới trọng số.

### 10.6 Trọng số của nhóm

- `GET` → `{ workspaceId, weights, defaults, custom, feedbackCount, updatedAt }`; chưa từng chỉnh thì
  trả mặc định và **không tạo dòng** nào (đọc không ghi).
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

### 10.8 Chưa làm (cố ý)

Học trọng số (mức 2), giao diện, API sửa hồ sơ làm việc cá nhân (số thẻ song song, tạm nghỉ — để bước
6 khi có chỗ để bấm), đọc chéo không gian, bộ nhớ đệm (đo độ trễ trước, xem nhật ký bước 5), lớp 2.

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
