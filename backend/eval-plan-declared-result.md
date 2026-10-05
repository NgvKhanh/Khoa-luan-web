# Đánh giá lớp 2 (chia việc cả đợt) khi có thành phần Hồ sơ — bước 19

Ngày chạy 2026-09-28 · 20 hạt giống (3001–3020, cùng bộ của bước 9) · mỗi hạt giống gộp 3 đợt (ngày 90, 150, 210), K = 12 thẻ · hồ sơ tự khai theo cấu hình mặc định đã đăng ký (§17.10) · sha256 dữ liệu `72ccdf3344cc168f…`, hồ sơ `c0d26faa8cbbab4f…`

> **Mô tả, không phải kiểm định**: §17.10 chỉ ghi "Gini lớp 2 (bước 19)" trong nhóm chỉ số *phụ*, không đăng ký tiêu chí đạt / không đạt cho lớp 2. Cột "Đúng hạn" chỉ đọc khoảng tin cậy có chứa 0 hay không.

## 1. W1 — thế giới mặc định (có lịch sử trước đợt)

| Cách chia | Bộ chấm | Người nhiều nhất | Gini | P(đúng hạn) [95% CI] | Hối tiếc | Top-1 |
|---|---|---|---|---|---|---|
| Cộng thẻ vừa giao vào tải (cách đã cài) | 3 thành phần (như bước 9, không hồ sơ) | 35,3% | 0,313 | 0,493 [0,472; 0,512] | 0,186 | 40,1% |
| Cộng thẻ vừa giao vào tải (cách đã cài) | 4 thành phần (mặc định mới + hồ sơ tự khai) | 35,8% | 0,325 | 0,490 [0,466; 0,512] | 0,186 | 41,5% |
| Cách trên + phạt 10 điểm mỗi thẻ đã nhận | 3 thành phần (như bước 9, không hồ sơ) | 28,9% | 0,206 | 0,489 [0,469; 0,508] | 0,201 | 38,3% |
| Cách trên + phạt 10 điểm mỗi thẻ đã nhận | 4 thành phần (mặc định mới + hồ sơ tự khai) | 28,6% | 0,197 | 0,489 [0,467; 0,510] | 0,200 | 37,9% |

## 2. W2 — nhóm mới (không ai có lịch sử / tải trước đợt)

| Cách chia | Bộ chấm | Người nhiều nhất | Gini | P(đúng hạn) [95% CI] | Hối tiếc | Top-1 |
|---|---|---|---|---|---|---|
| Cộng thẻ vừa giao vào tải (cách đã cài) | 3 thành phần (như bước 9, không hồ sơ) | 23,9% | 0,101 | 0,416 [0,396; 0,437] | 0,323 | 18,9% |
| Cộng thẻ vừa giao vào tải (cách đã cài) | 4 thành phần (mặc định mới + hồ sơ tự khai) | 25,7% | 0,135 | 0,435 [0,419; 0,450] | 0,296 | 22,4% |
| Cách trên + phạt 10 điểm mỗi thẻ đã nhận | 3 thành phần (như bước 9, không hồ sơ) | 22,2% | 0,067 | 0,415 [0,395; 0,436] | 0,324 | 18,6% |
| Cách trên + phạt 10 điểm mỗi thẻ đã nhận | 4 thành phần (mặc định mới + hồ sơ tự khai) | 24,3% | 0,101 | 0,430 [0,415; 0,446] | 0,302 | 21,9% |

## 3. Chênh lệch 4 thành phần − 3 thành phần (cùng thẻ, cùng hạt giống)

| Thế giới | Cách chia | Δ người nhiều nhất [95% CI] | Δ Gini [95% CI] | Δ P(đúng hạn) [95% CI] | Đúng hạn (4 − 3 thành phần) |
|---|---|---|---|---|---|
| W1 | Cộng thẻ vừa giao vào tải (cách đã cài) | +0,006 [-0,007; +0,019] | +0,012 [-0,012; +0,039] | -0,003 [-0,009; +0,003] | chưa phân biệt được |
| W1 | Cách trên + phạt 10 điểm mỗi thẻ đã nhận | -0,003 [-0,014; +0,008] | -0,009 [-0,026; +0,008] | +0,001 [-0,008; +0,010] | chưa phân biệt được |
| W2 | Cộng thẻ vừa giao vào tải (cách đã cài) | +0,018 [+0,010; +0,026] | +0,034 [+0,018; +0,051] | +0,019 [-0,002; +0,040] | chưa phân biệt được |
| W2 | Cách trên + phạt 10 điểm mỗi thẻ đã nhận | +0,021 [+0,014; +0,028] | +0,034 [+0,024; +0,045] | +0,016 [-0,005; +0,036] | chưa phân biệt được |

## Giới hạn

- Cùng các giới hạn của bước 9 (đợt = lát cắt K thẻ theo thời gian; thế giới giả định của bộ sinh, §7).
- Hồ sơ tự khai là **mô phỏng** với mức trung thực mặc định (30% không khai, 15% khai quá / khai thiếu, một nửa cụm từ trùng từ của thẻ); bước 15 cho thấy lợi ích của Hồ sơ đổi mạnh theo các giả định này — số ở đây chỉ đúng cho đúng một điểm của đường cong.
- W2 xoá trắng cả lịch sử lẫn tải trước đợt: mọi người bắt đầu như nhau, thành phần duy nhất phân biệt được họ lúc đầu đợt là Hồ sơ.