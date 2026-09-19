# Module Gợi ý phân công công việc (cá nhân hoá từ lịch sử)

> **Trạng thái: đang ở bước 0** — mới chốt thiết kế, chưa có dòng mã sản phẩm nào.
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

### 5.1 Tách từ

- Chuẩn hoá NFC, hạ chữ thường, bỏ dấu — **dùng lại** `normalizeText` ở
  `backend/src/modules/ai/ai.rules.ts:86` và hàm bỏ dấu ở dòng 118.
- Bỏ khoảng 100 hư từ tiếng Việt tự soạn ("và", "của", "cho", "các", "một",
  "được", "khi", "để"...).
- Sinh **uni-gram + bi-gram liền kề**. Bi-gram là cách rẻ nhất để bắt cụm
  "đăng nhập", "kiểm thử", "cơ sở dữ liệu" mà không cần thư viện tách từ.
- Bỏ token dài dưới 2 ký tự và token chỉ gồm chữ số.

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

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/api/cards/:cardId/assignment-suggestions` | Lớp 1: xếp hạng ứng viên cho một thẻ, trả kèm bằng chứng và `runId` |
| POST | `/api/assignment/runs/:runId/outcome` | Ghi người thực sự được chọn (nuôi mức 1 và mức 2) |
| GET / PUT | `/api/workspaces/:id/assignment-weights` | Xem và chỉnh ba thanh trượt, kèm nút đặt lại |
| POST | `/api/lists/:listId/assignment-plan` | Lớp 2 (bước 8): xếp việc cho cả danh sách, trả bản xem trước |

Phân quyền: chỉ thành viên của bảng mới gọi được; chỉ ADMIN/OWNER của không gian
làm việc mới sửa được trọng số. Vai trò VIEWER không được gọi.

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
