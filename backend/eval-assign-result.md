# Đánh giá module gợi ý phân công — so sánh các nhánh (bước 7a)

Ngày chạy 2026-09-21 · 20 hạt giống (2001–2020) · giai đoạn đánh giá từ ngày 60 · hệ số phạt tải của thế giới 0,06 · sha256 dữ liệu `ff6c7cc6ef628c2f…`

## 1. Vòng kín: mỗi nhánh tự giao người xếp đầu, kết quả rút từ mô hình của bộ sinh

| Nhánh | P(đúng hạn) [95% CI] | Hối tiếc | Top-1 | Top-3 | MRR | Gini | Người nhiều nhất | Người mới (1 = công bằng) | Đúng hạn thực |
|---|---|---|---|---|---|---|---|---|---|
| Ngẫu nhiên | 0,389 [0,379; 0,400] | 0,324 | 18,9% | 59,2% | 0,447 | 0,170 | 23,2% | 1,14 | 41,8% |
| Chia vòng tròn | 0,404 [0,395; 0,414] | 0,315 | 19,6% | 59,9% | 0,453 | 0,131 | 19,9% | 1,02 | 44,0% |
| Người rảnh nhất | 0,395 [0,385; 0,407] | 0,330 | 20,1% | 57,8% | 0,452 | 0,238 | 25,9% | 0,71 | 42,5% |
| Người hay làm nhất | 0,221 [0,204; 0,238] | 0,332 | 18,9% | 54,6% | 0,450 | 0,825 | 97,6% | 0,00 | 25,8% |
| Chỉ kinh nghiệm | 0,397 [0,373; 0,419] | 0,247 | 33,0% | 66,4% | 0,547 | 0,547 | 51,7% | 0,00 | 42,6% |
| Chỉ tải (khả dụng) | 0,400 [0,390; 0,410] | 0,325 | 18,4% | 57,5% | 0,441 | 0,202 | 24,5% | 0,78 | 42,2% |
| Đầy đủ, trọng số cố định | 0,441 [0,427; 0,455] | 0,244 | 30,6% | 66,9% | 0,532 | 0,347 | 34,4% | 0,46 | 45,9% |
| Tham chiếu: người kỹ năng cao nhất | 0,592 [0,572; 0,612] | 0,000 | 100,0% | 100,0% | 1,000 | 0,365 | 35,2% | 0,94 | 62,0% |
| Tham chiếu: tối ưu (xác suất đúng hạn cao nhất) | 0,611 [0,595; 0,626] | 0,009 | 90,7% | 98,4% | 0,946 | 0,292 | 29,9% | 1,04 | 62,5% |

*P(đúng hạn)* là chỉ số chính: xác suất đúng hạn kỳ vọng của người được giao (mô hình kết quả của bộ sinh: kỹ năng ẩn + tải thật), trung bình trên các hạt giống, kèm khoảng tin cậy bootstrap 95% theo hạt giống. *Hối tiếc* = kỹ năng ẩn của người giỏi nhất họ bốc trừ kỹ năng của người được chọn (thấp = tốt). *Top-1/Top-3/MRR* tính theo người có kỹ năng ẩn cao nhất (không tính tải nên khả dụng không thể thắng ở đây). *Gini* và *người nhiều nhất* đo mức dồn việc (số việc mỗi người nhận); *người mới* = việc người vào muộn nhận / phần chia đều kỳ vọng. *Đúng hạn thực* = tỉ lệ đúng hạn của các thẻ đã xong đến cuối lịch sử.

## 2. So sánh cặp đã đăng ký trước (nhánh 1 − nhánh 2, cùng thẻ, cùng may rủi)

| Phép so sánh (nhánh 1 − nhánh 2) | Δ P(đúng hạn) [95% CI] | Hạt giống +/−/= | Kết luận (P đúng hạn) | Δ hối tiếc [95% CI] | Kết luận (hối tiếc) |
|---|---|---|---|---|---|
| Đầy đủ, trọng số cố định − Ngẫu nhiên | +0,052 [+0,039; +0,065] | 20 / 0 / 0 | nhánh 1 tốt hơn | -0,080 [-0,098; -0,063] | nhánh 1 tốt hơn |
| Đầy đủ, trọng số cố định − Người rảnh nhất | +0,046 [+0,030; +0,062] | 18 / 2 / 0 | nhánh 1 tốt hơn | -0,086 [-0,109; -0,064] | nhánh 1 tốt hơn |
| Đầy đủ, trọng số cố định − Người hay làm nhất | +0,220 [+0,205; +0,236] | 20 / 0 / 0 | nhánh 1 tốt hơn | -0,088 [-0,112; -0,066] | nhánh 1 tốt hơn |
| Đầy đủ, trọng số cố định − Chỉ kinh nghiệm | +0,044 [+0,026; +0,062] | 18 / 2 / 0 | nhánh 1 tốt hơn | -0,003 [-0,023; +0,018] | chưa phân biệt được |
| Đầy đủ, trọng số cố định − Chỉ tải (khả dụng) | +0,041 [+0,028; +0,054] | 18 / 2 / 0 | nhánh 1 tốt hơn | -0,081 [-0,097; -0,064] | nhánh 1 tốt hơn |

Năm phép so sánh chính được chọn trước khi chạy; các phép so sánh khác trong báo cáo chỉ mang tính mô tả. Cột "Hạt giống +/−/=" là số hạt giống (trên 20) mà nhánh 1 hơn / kém / bằng nhánh 2. Kết luận chỉ dựa vào việc khoảng tin cậy có chứa 0 hay không.

## 3. Nghiên cứu cắt bỏ (vòng kín)

| Nhánh | P(đúng hạn) [95% CI] | Hối tiếc | Top-1 | Top-3 | MRR | Gini | Người nhiều nhất | Người mới (1 = công bằng) | Đúng hạn thực |
|---|---|---|---|---|---|---|---|---|---|
| Đầy đủ, trọng số cố định | 0,441 [0,427; 0,455] | 0,244 | 30,6% | 66,9% | 0,532 | 0,347 | 34,4% | 0,46 | 45,9% |
| Bỏ khả dụng | 0,413 [0,397; 0,428] | 0,239 | 33,5% | 67,1% | 0,549 | 0,535 | 45,9% | 0,00 | 44,4% |
| Bỏ tin cậy | 0,430 [0,411; 0,448] | 0,258 | 30,9% | 65,8% | 0,532 | 0,359 | 33,5% | 0,34 | 46,5% |
| Bỏ kinh nghiệm | 0,428 [0,418; 0,437] | 0,281 | 23,9% | 62,4% | 0,485 | 0,219 | 26,3% | 0,98 | 44,4% |
| Chỉ kinh nghiệm | 0,397 [0,373; 0,419] | 0,247 | 33,0% | 66,4% | 0,547 | 0,547 | 51,7% | 0,00 | 42,6% |
| Chỉ tin cậy | 0,409 [0,395; 0,422] | 0,263 | 27,9% | 63,1% | 0,509 | 0,445 | 40,4% | 0,00 | 44,9% |
| Chỉ tải (khả dụng) | 0,400 [0,390; 0,410] | 0,325 | 18,4% | 57,5% | 0,441 | 0,202 | 24,5% | 0,78 | 42,2% |

| Phép so sánh (nhánh 1 − nhánh 2) | Δ P(đúng hạn) [95% CI] | Hạt giống +/−/= | Kết luận (P đúng hạn) | Δ hối tiếc [95% CI] | Kết luận (hối tiếc) |
|---|---|---|---|---|---|
| Bỏ khả dụng − Đầy đủ, trọng số cố định | -0,028 [-0,043; -0,014] | 3 / 17 / 0 | nhánh 1 kém hơn | -0,005 [-0,023; +0,013] | chưa phân biệt được |
| Bỏ tin cậy − Đầy đủ, trọng số cố định | -0,011 [-0,027; +0,005] | 8 / 12 / 0 | chưa phân biệt được | +0,014 [-0,009; +0,034] | chưa phân biệt được |
| Bỏ kinh nghiệm − Đầy đủ, trọng số cố định | -0,013 [-0,026; -0,000] | 9 / 11 / 0 | nhánh 1 kém hơn | +0,037 [+0,021; +0,052] | nhánh 1 kém hơn |

## 4. Đối chiếu: phát lại lịch sử cố định (mỗi thẻ được xếp hạng trên lịch sử do bộ sinh tạo)

| Nhánh | P(đúng hạn) [95% CI] | Hối tiếc | Top-1 | Top-3 | MRR | Gini (gợi ý) | Người nhiều nhất (gợi ý) |
|---|---|---|---|---|---|---|---|
| Ngẫu nhiên | 0,390 [0,380; 0,399] | 0,324 | 18,9% | 59,2% | 0,447 | 0,170 | 23,2% |
| Chia vòng tròn | 0,395 [0,385; 0,405] | 0,315 | 19,6% | 59,9% | 0,453 | 0,131 | 19,9% |
| Người rảnh nhất | 0,377 [0,369; 0,385] | 0,360 | 15,7% | 51,0% | 0,412 | 0,475 | 41,9% |
| Người hay làm nhất | 0,390 [0,376; 0,404] | 0,317 | 25,0% | 66,1% | 0,496 | 0,715 | 69,2% |
| Chỉ kinh nghiệm | 0,490 [0,475; 0,505] | 0,172 | 44,5% | 78,0% | 0,639 | 0,332 | 31,0% |
| Chỉ tải (khả dụng) | 0,402 [0,394; 0,411] | 0,324 | 20,9% | 53,3% | 0,444 | 0,289 | 30,3% |
| Đầy đủ, trọng số cố định | 0,471 [0,458; 0,485] | 0,211 | 37,1% | 73,2% | 0,587 | 0,273 | 31,0% |
| Tham chiếu: người kỹ năng cao nhất | 0,607 [0,590; 0,623] | 0,000 | 100,0% | 100,0% | 1,000 | 0,365 | 35,2% |
| Tham chiếu: tối ưu (xác suất đúng hạn cao nhất) | 0,614 [0,599; 0,629] | 0,007 | 91,9% | 98,8% | 0,953 | 0,322 | 32,1% |
| Tham chiếu: phân công thật của bộ sinh | 0,523 [0,507; 0,537] | 0,125 | 51,4% | – | – | 0,205 | 26,2% |
| Tham chiếu: ngẫu nhiên (kỳ vọng) | 0,390 [0,384; 0,397] | 0,322 | 19,5% | – | – | – | – |

Cách này đo được chất lượng xếp hạng nhưng gợi ý trước không ảnh hưởng thẻ sau nên **không** thấy được việc dồn về một người, tải tự điều chỉnh, hay người mới không được giao thì mãi không có lịch sử. So sánh với bảng 1 cho biết kết luận có phụ thuộc cách đánh giá hay không. Phát lại này cũng nhìn thấy các thẻ giao cùng ngày nhưng xử lý sau (như tải đang mở); vòng kín thì không.

## Giới hạn (đọc trước khi trích dẫn)

- Mọi số liệu nằm trong **thế giới giả định của tác giả** (xác suất đúng hạn 0,15 + 0,7·kỹ năng − phạt tải, 25% giao sai, 12% thẻ mơ hồ…). Chúng chứng minh thuật toán hoạt động như thiết kế trong thế giới đó, **không** chứng minh hiệu quả ngoài đời.
- Mỗi bộ chỉ có 6 người, khoảng 105 quyết định. Khoảng tin cậy tính trên 20 hạt giống (mỗi hạt giống là một đơn vị độc lập), không tính trên từng thẻ.
- Tham số giữ đúng mặc định đã duyệt trước khi chạy; không chọn "cấu hình đẹp nhất" trên các hạt giống này.