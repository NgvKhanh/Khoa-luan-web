# Đánh giá thành phần Hồ sơ (hồ sơ tự khai) — bước 15, pha XÁC NHẬN

Ngày chạy 2026-09-27 · 20 hạt giống (4001–4020) · sha256 dữ liệu `731ceece47af07df…` · sha256 hồ sơ `e2f1d7e9aca42da0…`

Cấu hình chốt TRƯỚC khi chạy: `d` = 0,20 (chọn trên hạt giống dev 9801–9820), trọng số mặc định (1 − d)·(0,45; 0,30; 0,25) + d; hồ sơ sinh theo núm mặc định §17.10 (θ 0,5 · khai quá 0,15 · khai thiếu 0,15 · trùng từ 0,5 · không khai 0,3). Chạy MỘT lần; không chỉnh gì sau khi thấy số.

## Bốn so sánh chính (đăng ký trước)

| # | So sánh | Thế giới | Chênh lệch [KTC 95%] | Tiêu chí (cận dưới >) | Kết quả |
|---|---|---|---|---|---|
| P1 | đầy đủ-4 − đầy đủ-3 | W1 mặc định | +0,009 [-0,007; +0,023] (12/20 hạt giống hơn) | -0,005 | KHÔNG ĐẠT |
| P2 | đầy đủ-4 − đầy đủ-3 | W2 nhóm mới | +0,006 [-0,017; +0,028] (12/20 hạt giống hơn) | 0 | KHÔNG ĐẠT |
| P3 | đầy đủ-4 − đầy đủ-3 | W3 quyết định lạnh | +0,012 [-0,022; +0,045] (13/20 hạt giống hơn) | 0 | KHÔNG ĐẠT |
| P4 | chỉ-Hồ-sơ − ngẫu nhiên | W2 nhóm mới | +0,020 [+0,001; +0,041] (13/20 hạt giống hơn) | 0 | **ĐẠT** |

**1/4 so sánh đạt tiêu chí.** W3: 20/20 hạt giống có quyết định lạnh, trung bình 14,0 thẻ lạnh / hạt giống (xác định trên thế giới của đầy đủ-3, đo hai nhánh trên cùng các thẻ).

## Mô tả theo thế giới

### W1 — mặc định

| Nhánh | P(đúng hạn) [KTC 95%] | Top-1 | Hối tiếc | Gini việc | Người nhiều nhất | Người vào muộn (1 = đều) | Người mới đứng đầu |
|---|---|---|---|---|---|---|---|
| Đầy đủ-3 (không Hồ sơ) | 0,466 [0,450; 0,481] | 33,7% | 0,251 | 0,356 | 33,3% | 0,37 | 1,6% |
| Đầy đủ-4 (có Hồ sơ) | 0,474 [0,460; 0,489] | 34,6% | 0,239 | 0,329 | 31,8% | 0,43 | 1,5% |
| Chỉ Hồ sơ | 0,420 [0,401; 0,439] | 26,2% | 0,270 | 0,522 | 46,5% | 0,62 | 1,5% |
| Ngẫu nhiên | 0,399 [0,393; 0,406] | 19,5% | 0,350 | 0,169 | 23,0% | 1,05 | 2,1% |
| Chỉ kinh nghiệm | 0,408 [0,378; 0,437] | 30,9% | 0,277 | 0,565 | 51,2% | 0,00 | 0,0% |
| Tham chiếu: tối ưu | 0,638 [0,625; 0,652] | 92,4% | 0,007 | 0,302 | 30,7% | 0,83 | 3,1% |

### W2 — nhóm mới (không ai có lịch sử khi bắt đầu)

| Nhánh | P(đúng hạn) [KTC 95%] | Top-1 | Hối tiếc | Gini việc | Người nhiều nhất | Người vào muộn (1 = đều) | Người mới đứng đầu |
|---|---|---|---|---|---|---|---|
| Đầy đủ-3 (không Hồ sơ) | 0,436 [0,422; 0,450] | 28,1% | 0,292 | 0,355 | 33,5% | 0,36 | 7,6% |
| Đầy đủ-4 (có Hồ sơ) | 0,443 [0,426; 0,459] | 25,9% | 0,283 | 0,341 | 32,4% | 0,46 | 7,9% |
| Chỉ Hồ sơ | 0,420 [0,401; 0,439] | 26,2% | 0,271 | 0,521 | 46,4% | 0,62 | 7,5% |
| Ngẫu nhiên | 0,399 [0,393; 0,406] | 19,5% | 0,350 | 0,169 | 23,0% | 1,05 | 12,0% |
| Chỉ kinh nghiệm | 0,227 [0,207; 0,247] | 22,1% | 0,337 | 0,833 | 100,0% | 0,00 | 3,9% |
| Tham chiếu: tối ưu | 0,638 [0,625; 0,652] | 92,6% | 0,007 | 0,303 | 30,7% | 0,83 | 10,6% |

## Đường cong theo mức trung thực của người khai

### Xác suất khai quá (pOver) — W1 — mặc định

| Xác suất khai quá (pOver) | P(đúng hạn) đầy đủ-4 | Đầy đủ-4 − đầy đủ-3 [KTC 95%] | Kết luận |
|---|---|---|---|
| 0,00 | 0,475 [0,459; 0,492] | +0,010 [-0,003; +0,022] | chưa phân biệt được |
| 0,15 | 0,474 [0,460; 0,489] | +0,009 [-0,007; +0,023] | chưa phân biệt được |
| 0,30 | 0,469 [0,454; 0,484] | +0,003 [-0,008; +0,015] | chưa phân biệt được |
| 0,50 | 0,461 [0,445; 0,478] | -0,004 [-0,015; +0,005] | chưa phân biệt được |
| 0,70 | 0,461 [0,444; 0,478] | -0,005 [-0,017; +0,007] | chưa phân biệt được |

W1 — mặc định: điểm hoà vốn (mức đầu tiên mà đầy đủ-4 không còn hơn trung bình) = 0,50.

### Xác suất khai quá (pOver) — W2 — nhóm mới

| Xác suất khai quá (pOver) | P(đúng hạn) đầy đủ-4 | Đầy đủ-4 − đầy đủ-3 [KTC 95%] | Kết luận |
|---|---|---|---|
| 0,00 | 0,452 [0,434; 0,470] | +0,016 [-0,006; +0,037] | chưa phân biệt được |
| 0,15 | 0,443 [0,426; 0,459] | +0,006 [-0,017; +0,028] | chưa phân biệt được |
| 0,30 | 0,436 [0,418; 0,455] | -0,000 [-0,025; +0,023] | chưa phân biệt được |
| 0,50 | 0,436 [0,424; 0,449] | -0,000 [-0,019; +0,019] | chưa phân biệt được |
| 0,70 | 0,424 [0,411; 0,436] | -0,013 [-0,032; +0,006] | chưa phân biệt được |

W2 — nhóm mới: điểm hoà vốn (mức đầu tiên mà đầy đủ-4 không còn hơn trung bình) = 0,30.

### Độ trùng từ với thẻ (overlap) — W1 — mặc định

| Độ trùng từ với thẻ (overlap) | P(đúng hạn) đầy đủ-4 | Đầy đủ-4 − đầy đủ-3 [KTC 95%] | Kết luận |
|---|---|---|---|
| 0,10 | 0,471 [0,456; 0,486] | +0,006 [-0,008; +0,018] | chưa phân biệt được |
| 0,30 | 0,474 [0,460; 0,489] | +0,009 [-0,005; +0,023] | chưa phân biệt được |
| 0,50 | 0,474 [0,460; 0,489] | +0,009 [-0,007; +0,023] | chưa phân biệt được |
| 0,70 | 0,480 [0,468; 0,493] | +0,015 [-0,000; +0,030] | chưa phân biệt được |
| 0,90 | 0,481 [0,469; 0,494] | +0,016 [-0,000; +0,031] | chưa phân biệt được |

W1 — mặc định: điểm hoà vốn (mức đầu tiên mà đầy đủ-4 không còn hơn trung bình) = không có trong dải quét.

### Độ trùng từ với thẻ (overlap) — W2 — nhóm mới

| Độ trùng từ với thẻ (overlap) | P(đúng hạn) đầy đủ-4 | Đầy đủ-4 − đầy đủ-3 [KTC 95%] | Kết luận |
|---|---|---|---|
| 0,10 | 0,422 [0,412; 0,432] | -0,014 [-0,034; +0,005] | chưa phân biệt được |
| 0,30 | 0,434 [0,419; 0,449] | -0,003 [-0,025; +0,019] | chưa phân biệt được |
| 0,50 | 0,443 [0,426; 0,459] | +0,006 [-0,017; +0,028] | chưa phân biệt được |
| 0,70 | 0,455 [0,441; 0,470] | +0,019 [-0,000; +0,038] | chưa phân biệt được |
| 0,90 | 0,451 [0,438; 0,463] | +0,014 [-0,003; +0,031] | chưa phân biệt được |

W2 — nhóm mới: điểm hoà vốn (mức đầu tiên mà đầy đủ-4 không còn hơn trung bình) = 0,10.

### Tỉ lệ người không khai (pNone) — W1 — mặc định

| Tỉ lệ người không khai (pNone) | P(đúng hạn) đầy đủ-4 | Đầy đủ-4 − đầy đủ-3 [KTC 95%] | Kết luận |
|---|---|---|---|
| 0,00 | 0,482 [0,468; 0,496] | +0,016 [+0,006; +0,027] | nhánh 1 tốt hơn |
| 0,30 | 0,474 [0,460; 0,489] | +0,009 [-0,007; +0,023] | chưa phân biệt được |
| 0,60 | 0,469 [0,454; 0,484] | +0,003 [-0,010; +0,015] | chưa phân biệt được |
| 0,90 | 0,465 [0,450; 0,481] | -0,001 [-0,003; +0,001] | chưa phân biệt được |

W1 — mặc định: điểm hoà vốn (mức đầu tiên mà đầy đủ-4 không còn hơn trung bình) = 0,90.

### Tỉ lệ người không khai (pNone) — W2 — nhóm mới

| Tỉ lệ người không khai (pNone) | P(đúng hạn) đầy đủ-4 | Đầy đủ-4 − đầy đủ-3 [KTC 95%] | Kết luận |
|---|---|---|---|
| 0,00 | 0,472 [0,458; 0,485] | +0,035 [+0,017; +0,053] | nhánh 1 tốt hơn |
| 0,30 | 0,443 [0,426; 0,459] | +0,006 [-0,017; +0,028] | chưa phân biệt được |
| 0,60 | 0,442 [0,422; 0,462] | +0,006 [-0,013; +0,024] | chưa phân biệt được |
| 0,90 | 0,430 [0,411; 0,447] | -0,007 [-0,018; 0,000] | chưa phân biệt được |

W2 — nhóm mới: điểm hoà vốn (mức đầu tiên mà đầy đủ-4 không còn hơn trung bình) = 0,90.

## Một người cố tình khai mọi chủ đề

Người khai quá = người có kỹ năng ẩn trung bình thấp nhất lúc vào nhóm (trường hợp xấu nhất); mọi người khác giữ hồ sơ như trên.

| Thế giới | P(đúng hạn) có người khai quá − trung thực [KTC 95%] | Phần việc người đó nhận: trung thực | có khai quá | đầy đủ-3 |
|---|---|---|---|---|
| W1 — mặc định | -0,011 [-0,019; -0,003] | 17,3% | 24,4% | 17,6% |
| W2 — nhóm mới | -0,006 [-0,017; +0,006] | 19,8% | 28,7% | 14,1% |

## Người không khai: DROP / NEUTRAL / ZERO

| Thế giới | Người không khai = | P(đúng hạn) [KTC 95%] | − NEUTRAL [KTC 95%] | Người vào muộn (1 = đều) |
|---|---|---|---|---|
| W1 — mặc định | DROP | 0,477 [0,463; 0,492] | +0,003 [-0,004; +0,010] | 0,41 |
| W1 — mặc định | NEUTRAL (mặc định) | 0,474 [0,460; 0,489] | – | 0,43 |
| W1 — mặc định | ZERO | 0,481 [0,467; 0,495] | +0,007 [-0,005; +0,020] | 0,39 |
| W2 — nhóm mới | DROP | 0,447 [0,434; 0,462] | +0,005 [-0,006; +0,016] | 0,48 |
| W2 — nhóm mới | NEUTRAL (mặc định) | 0,443 [0,426; 0,459] | – | 0,46 |
| W2 — nhóm mới | ZERO | 0,442 [0,426; 0,458] | -0,001 [-0,010; +0,010] | 0,44 |

## Giới hạn (phải nêu trong luận văn)

- Kết quả phụ thuộc giả định người ta khai trung thực tới đâu và từ khai trùng từ của thẻ tới đâu — vì vậy báo **đường cong**, không một con số.
- Vẫn là thế giới mô phỏng (§7): chứng minh thuật toán hoạt động như thiết kế, không chứng minh hiệu quả ngoài đời.
- Chưa làm (khác đăng ký §17.10): so sánh "max" với "trung bình 2 mục cao nhất"; học trọng số với trưởng nhóm giả tin / không tin hồ sơ; Gini lớp 2 để bước 19.
- Mỗi hạt giống là một đơn vị độc lập cho khoảng tin cậy (bootstrap cặp 10 000 lần).