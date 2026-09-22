# Đánh giá module gợi ý phân công — lớp 2: chia việc cho cả danh sách (bước 9)

Ngày chạy 2026-09-22 · 20 hạt giống (3001–3020) · mỗi hạt giống gộp 3 đợt (ngày quyết định 90, 150, 210), cỡ đợt K = 12 thẻ · hệ số phạt tải của thế giới 0,06 · sha256 dữ liệu `72ccdf3344cc168f…`

## 1. Mô tả bảy cách chia

| Cách chia | Người nhiều nhất | Gini | P(đúng hạn) [95% CI] | Hối tiếc | Top-1 | Rủi ro (<0,5) | Không ai nhận |
|---|---|---|---|---|---|---|---|
| Chấm riêng từng thẻ, không cộng tải | 49,7% | 0,482 | 0,455 [0,429; 0,481] | 0,205 | 36,4% | 54,0% | 0,0% |
| Cộng thẻ vừa giao vào tải (cách đã cài) | 35,3% | 0,313 | 0,493 [0,472; 0,512] | 0,186 | 40,1% | 48,3% | 0,0% |
| Cách trên + trần ⌈K/người⌉ thẻ mỗi người | 22,2% | 0,101 | 0,479 [0,464; 0,493] | 0,219 | 34,3% | 51,8% | 0,0% |
| Cách trên + phạt 10 điểm mỗi thẻ đã nhận | 28,9% | 0,206 | 0,489 [0,469; 0,508] | 0,201 | 38,3% | 49,4% | 0,0% |
| Cách trên + phạt 20 điểm mỗi thẻ đã nhận | 26,8% | 0,154 | 0,480 [0,462; 0,498] | 0,215 | 35,3% | 51,1% | 0,0% |
| Chia vòng tròn | 22,2% | 0,067 | 0,398 [0,381; 0,416] | 0,330 | 18,3% | 69,4% | 0,0% |
| Tối ưu tham lam (biết kỹ năng ẩn, không phải tối ưu toàn cục) | 36,3% | 0,338 | 0,607 [0,587; 0,626] | 0,019 | 80,4% | 22,8% | 0,0% |

*Người nhiều nhất* và *Gini* đo mức tập trung việc (số thẻ mỗi người nhận) — chỉ số chính của bước này cùng với *P(đúng hạn)*. *P(đúng hạn)* là xác suất đúng hạn kỳ vọng (mô hình kết quả của bộ sinh) của người được chọn, tính với tải **lúc giao**, trung bình trên các hạt giống kèm khoảng tin cậy bootstrap 95%. *Hối tiếc* = kỹ năng ẩn người giỏi nhất họ bốc trừ kỹ năng người được chọn. *Rủi ro* = tỉ lệ thẻ có P(đúng hạn) < 0,5.

## 2. So sánh cặp đã đăng ký trước (nhánh 1 − nhánh 2, cùng thẻ, cùng may rủi)

| Phép so sánh (nhánh 1 − nhánh 2) | Δ người nhiều nhất [95% CI] | Kết luận (tập trung) | Δ P(đúng hạn) [95% CI] | Kết luận (đúng hạn) |
|---|---|---|---|---|
| Cộng thẻ vừa giao vào tải (cách đã cài) − Chấm riêng từng thẻ, không cộng tải | -0,144 [-0,176; -0,114] | nhánh 1 tốt hơn | +0,038 [+0,024; +0,053] | nhánh 1 tốt hơn |
| Cộng thẻ vừa giao vào tải (cách đã cài) − Chia vòng tròn | +0,131 [+0,113; +0,151] | nhánh 1 kém hơn | +0,095 [+0,075; +0,116] | nhánh 1 tốt hơn |
| Cộng thẻ vừa giao vào tải (cách đã cài) − Cách trên + trần ⌈K/người⌉ thẻ mỗi người | +0,131 [+0,113; +0,151] | nhánh 1 kém hơn | +0,014 [+0,005; +0,023] | nhánh 1 tốt hơn |
| Cộng thẻ vừa giao vào tải (cách đã cài) − Cách trên + phạt 10 điểm mỗi thẻ đã nhận | +0,064 [+0,049; +0,081] | nhánh 1 kém hơn | +0,004 [-0,004; +0,012] | chưa phân biệt được |
| Cộng thẻ vừa giao vào tải (cách đã cài) − Tối ưu tham lam (biết kỹ năng ẩn, không phải tối ưu toàn cục) | -0,010 [-0,033; +0,014] | chưa phân biệt được | -0,114 [-0,130; -0,099] | nhánh 1 kém hơn |

Năm phép so sánh chính được chọn trước khi chạy trên 20 hạt giống này. Hai chỉ số chính tách riêng, không gộp thành một số: "người nhiều nhất" thấp hơn là tốt hơn (đỡ dồn tải); "P(đúng hạn)" cao hơn là tốt hơn. Kết luận chỉ dựa vào việc khoảng tin cậy có chứa 0 hay không.

## 3. Quét cỡ đợt K (mô tả, không phải so sánh chính)

| Cỡ đợt K | Người nhiều nhất (đã cài) | Gini (đã cài) | P(đúng hạn) (đã cài) | Người nhiều nhất (độc lập) | P(đúng hạn) (độc lập) |
|---|---|---|---|---|---|
| 6 | 40,3% | 0,383 | 0,514 [0,483; 0,543] | 53,9% | 0,490 [0,457; 0,523] |
| 12 | 35,3% | 0,313 | 0,493 [0,472; 0,512] | 49,7% | 0,455 [0,429; 0,481] |
| 24 | 32,1% | 0,246 | 0,441 [0,422; 0,459] | 46,9% | 0,384 [0,362; 0,407] |

## 4. Thành phần thiếu dữ liệu: DROP so với NEUTRAL (mô tả — nối lại quyết định còn treo từ bước 4b/7b)

| So sánh (NEUTRAL − DROP) | Δ người nhiều nhất [95% CI] | Δ Gini [95% CI] | Δ P(đúng hạn) [95% CI] | Kết luận (đúng hạn) |
|---|---|---|---|---|
| NEUTRAL − DROP, nhánh "đã cài" | +0,007 [+0,001; +0,014] | +0,009 [+0,000; +0,018] | +0,003 [+0,000; +0,006] | nhánh 1 tốt hơn |

Bước 7b đã đo sự khác biệt DROP/NEUTRAL cho **người mới** ở góc nhìn từng thẻ (không phân biệt được, xem nhật ký 7b); bảng này chỉ đo lại ở góc nhìn **cả đợt** trên ba chỉ số chính, không tính lại chỉ số người mới.

## Giới hạn (đọc trước khi trích dẫn)

- Mô phỏng không có khái niệm "danh sách" riêng trong một bảng: một **đợt chia việc** ở đây là một lát cắt K thẻ kế tiếp theo thời gian, không phân biệt thẻ thuộc bảng/danh sách nào (vì `planAssignments` cũng không dùng thông tin đó để chấm điểm).
- *Tối ưu tham lam* cần biết kỹ năng ẩn và chọn tốt nhất **tại từng thẻ theo đúng thứ tự xử lý** — không phải lời giải tối ưu toàn cục cho cả đợt (không giải bài toán ghép tối ưu kiểu Hungary); khoảng cách với nhánh này là cận trên tham khảo, không phải khoảng cách tới lời giải tốt nhất có thể.
- Mỗi hạt giống là một đơn vị độc lập cho khoảng tin cậy (không tính trên từng thẻ); mỗi hạt giống đã gộp trung bình 3 đợt.
- Mọi số liệu nằm trong thế giới giả định của bộ sinh (ASSIGN_MODULE.md §7); chứng minh thuật toán hoạt động như thiết kế, không chứng minh hiệu quả ngoài đời.