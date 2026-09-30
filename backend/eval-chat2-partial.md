# Đánh giá chatbot trợ lý — hiểu câu hỏi (B0 luật / B1 chỉ LLM / B2 lai)

| Mục | Giá trị |
|---|---|
| Ngày chạy | 2026-09-30 |
| Tập | test (101 câu) |
| Số lần chạy nhánh có LLM | 3 |
| Nhà cung cấp / model | google-gemini / gemini-3.5-flash-lite |
| Phiên bản bộ dữ liệu / prompt / luật | 9ad0c146f990 / 790951f255f0 / 78eb56a81ab5 |
| Gọi API / lấy từ bộ đệm | 0 / 303 |

## Tổng quan theo nhánh

Khớp hoàn toàn = đúng cả loại kết quả, ý định, thời gian, tình trạng và người (tham số bị bỏ qua chấm riêng). Khoảng tin cậy 95% bootstrap theo câu hỏi (10 000 lần lấy mẫu lại).

| Nhánh | Ý định | Macro-F1 | Thời gian | Tình trạng | Người | Bảng / không gian / cột | Khớp hoàn toàn [KTC 95%] | Tham số bỏ qua | Hỏi lại đúng | LLM lỗi |
|---|---|---|---|---|---|---|---|---|---|---|
| B0 | 86,1% (87/101) | 0,870 | 92,9% (52/56) | 91,1% (51/56) | 68,8% (11/16) | 84,8% (28/33) | 84,2% (85/101) [77,2%; 91,1%] | 93,6% (44/47) | 100,0% (3/3) | 0 |
| B1 | 98,3% (298/303) | 0,988 | 94,6% (159/168) | 94,6% (159/168) | 91,7% (44/48) | 100,0% (99/99) | 95,7% (290/303) [91,4%; 99,0%] | 99,4% (154/155) | 100,0% (9/9) | 0 |
| B2 | 98,3% (298/303) | 0,988 | 92,9% (156/168) | 92,9% (156/168) | 85,4% (41/48) | 100,0% (99/99) | 94,7% (287/303) [90,1%; 98,7%] | 90,1% (137/152) | 100,0% (9/9) | 0 |

## So sánh cặp (cùng câu hỏi)

| Chênh lệch khớp hoàn toàn | Trung bình | KTC 95% | Số câu hơn / kém / bằng |
|---|---|---|---|
| B1 − B0 | +11,6 điểm % | [3,6; 19,5] | 15 / 4 / 82 |
| B2 − B1 | -1,0 điểm % | [-3,0; 0,0] | 0 / 1 / 100 |
| B2 − B0 | +10,6 điểm % | [3,0; 18,2] | 14 / 4 / 83 |

## F1 theo nhãn ý định

| Nhãn | B0 | B1 | B2 |
|---|---|---|---|
| MY_TASKS | 0,813 | 0,950 | 0,950 |
| MY_PRIORITIES | 0,923 | 1,000 | 1,000 |
| MEMBER_TASKS | 0,800 | 0,957 | 0,957 |
| TEAM_SUMMARY | 0,769 | 0,987 | 0,987 |
| TEAM_WORKLOAD | 1,000 | 1,000 | 1,000 |
| MY_BOARDS | 0,875 | 1,000 | 1,000 |
| MY_WORKSPACES | 0,800 | 1,000 | 1,000 |
| MEMBER_LIST | 0,800 | 1,000 | 1,000 |
| CARD_COUNTS | 1,000 | 0,984 | 0,984 |
| UNSUPPORTED | 0,917 | 1,000 | 1,000 |

### Ma trận nhầm — B0 (hàng: nhãn vàng, cột: dự đoán)

| Vàng \ Dự đoán | MY_TASKS | MY_PRIORITIES | MEMBER_TASKS | TEAM_SUMMARY | TEAM_WORKLOAD | MY_BOARDS | MY_WORKSPACES | MEMBER_LIST | CARD_COUNTS | UNSUPPORTED | LLM_FAILED |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MY_TASKS | 13 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| MY_PRIORITIES | 1 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| MEMBER_TASKS | 3 | 0 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| TEAM_SUMMARY | 1 | 0 | 2 | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| TEAM_WORKLOAD | 0 | 0 | 0 | 0 | 8 | 0 | 0 | 0 | 0 | 0 | 0 |
| MY_BOARDS | 1 | 0 | 0 | 0 | 0 | 7 | 0 | 0 | 0 | 0 | 0 |
| MY_WORKSPACES | 0 | 0 | 0 | 1 | 0 | 1 | 4 | 0 | 0 | 0 | 0 |
| MEMBER_LIST | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 6 | 0 | 1 | 0 |
| CARD_COUNTS | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 0 | 0 |
| UNSUPPORTED | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 11 | 0 |

### Ma trận nhầm — B1 (hàng: nhãn vàng, cột: dự đoán)

| Vàng \ Dự đoán | MY_TASKS | MY_PRIORITIES | MEMBER_TASKS | TEAM_SUMMARY | TEAM_WORKLOAD | MY_BOARDS | MY_WORKSPACES | MEMBER_LIST | CARD_COUNTS | UNSUPPORTED | LLM_FAILED |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MY_TASKS | 38 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| MY_PRIORITIES | 0 | 21 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| MEMBER_TASKS | 3 | 0 | 44 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| TEAM_SUMMARY | 0 | 0 | 0 | 39 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| TEAM_WORKLOAD | 0 | 0 | 0 | 0 | 24 | 0 | 0 | 0 | 0 | 0 | 0 |
| MY_BOARDS | 0 | 0 | 0 | 0 | 0 | 24 | 0 | 0 | 0 | 0 | 0 |
| MY_WORKSPACES | 0 | 0 | 0 | 0 | 0 | 0 | 18 | 0 | 0 | 0 | 0 |
| MEMBER_LIST | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 27 | 0 | 0 | 0 |
| CARD_COUNTS | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 30 | 0 | 0 |
| UNSUPPORTED | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 33 | 0 |

### Ma trận nhầm — B2 (hàng: nhãn vàng, cột: dự đoán)

| Vàng \ Dự đoán | MY_TASKS | MY_PRIORITIES | MEMBER_TASKS | TEAM_SUMMARY | TEAM_WORKLOAD | MY_BOARDS | MY_WORKSPACES | MEMBER_LIST | CARD_COUNTS | UNSUPPORTED | LLM_FAILED |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MY_TASKS | 38 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| MY_PRIORITIES | 0 | 21 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| MEMBER_TASKS | 3 | 0 | 44 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| TEAM_SUMMARY | 0 | 0 | 0 | 39 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| TEAM_WORKLOAD | 0 | 0 | 0 | 0 | 24 | 0 | 0 | 0 | 0 | 0 | 0 |
| MY_BOARDS | 0 | 0 | 0 | 0 | 0 | 24 | 0 | 0 | 0 | 0 | 0 |
| MY_WORKSPACES | 0 | 0 | 0 | 0 | 0 | 0 | 18 | 0 | 0 | 0 | 0 |
| MEMBER_LIST | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 27 | 0 | 0 | 0 |
| CARD_COUNTS | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 30 | 0 | 0 |
| UNSUPPORTED | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 33 | 0 |

## Câu cũ (hồi quy) và câu danh mục mới

Câu cũ (nhóm A–H) đã lộ ở vòng 1 nên chỉ là **hồi quy** (prompt đã đổi); số liệu chính của vòng 2 là câu danh mục mới (nhóm I–M).

| Bộ câu | B0 | B1 | B2 |
|---|---|---|---|
| câu cũ — hồi quy | 84,1% (63 câu) | 93,1% (63 câu) | 91,5% (63 câu) |
| câu mới — danh mục | 84,2% (38 câu) | 100,0% (38 câu) | 100,0% (38 câu) |

## Khớp hoàn toàn theo nhóm câu hỏi

| Nhóm | B0 | B1 | B2 |
|---|---|---|---|
| MY_TASKS | 100,0% (8 câu) | 95,8% (8 câu) | 95,8% (8 câu) |
| MY_PRIORITIES | 85,7% (7 câu) | 100,0% (7 câu) | 100,0% (7 câu) |
| MEMBER_TASKS | 64,3% (14 câu) | 78,6% (14 câu) | 71,4% (14 câu) |
| TEAM_SUMMARY | 75,0% (8 câu) | 87,5% (8 câu) | 87,5% (8 câu) |
| TEAM_WORKLOAD | 100,0% (7 câu) | 100,0% (7 câu) | 100,0% (7 câu) |
| FOLLOW_UP | 88,9% (9 câu) | 100,0% (9 câu) | 100,0% (9 câu) |
| OUT_OF_SCOPE | 100,0% (6 câu) | 100,0% (6 câu) | 100,0% (6 câu) |
| INJECTION | 75,0% (4 câu) | 100,0% (4 câu) | 100,0% (4 câu) |
| MY_BOARDS | 87,5% (8 câu) | 100,0% (8 câu) | 100,0% (8 câu) |
| MY_WORKSPACES | 66,7% (6 câu) | 100,0% (6 câu) | 100,0% (6 câu) |
| MEMBER_LIST | 66,7% (9 câu) | 100,0% (9 câu) | 100,0% (9 câu) |
| CARD_COUNTS | 100,0% (10 câu) | 100,0% (10 câu) | 100,0% (10 câu) |
| NEAR_MISS | 100,0% (5 câu) | 100,0% (5 câu) | 100,0% (5 câu) |

## Khớp hoàn toàn theo loại khó

| Loại | B0 | B1 | B2 |
|---|---|---|---|
| gõ không dấu | 100,0% (5 câu) | 100,0% (5 câu) | 100,0% (5 câu) |
| câu nối tiếp (có ngữ cảnh trước) | 87,5% (8 câu) | 100,0% (8 câu) | 100,0% (8 câu) |
| gan-giong | 100,0% (5 câu) | 100,0% (5 câu) | 100,0% (5 câu) |
| hoi-lai | 100,0% (3 câu) | 100,0% (3 câu) | 100,0% (3 câu) |
| kho-voi-luat | 33,3% (15 câu) | 93,3% (15 câu) | 93,3% (15 câu) |
| khong-dau | 100,0% (2 câu) | 100,0% (2 câu) | 100,0% (2 câu) |
| khong-tim-thay | 75,0% (4 câu) | 100,0% (4 câu) | 100,0% (4 câu) |
| ky-chua-ho-tro | 100,0% (1 câu) | 100,0% (1 câu) | 100,0% (1 câu) |
| ngoai-pham-vi | 100,0% (3 câu) | 100,0% (3 câu) | 100,0% (3 câu) |
| nham-ten | 80,0% (10 câu) | 80,0% (10 câu) | 80,0% (10 câu) |
| ten-viet-tat | 100,0% (1 câu) | 100,0% (1 câu) | 100,0% (1 câu) |
| thao-tac | 100,0% (7 câu) | 100,0% (7 câu) | 100,0% (7 câu) |
| trung-ten | 100,0% (2 câu) | 100,0% (2 câu) | 100,0% (2 câu) |

## Lớp LLM (dùng chung cho B1 và B2)

| Chỉ số | Giá trị |
|---|---|
| Lượt gọi (câu × lần chạy) | 303 |
| Thành công | 100,0% (303/303) |
| Lỗi theo loại | – |
| Mức ép JSON được chấp nhận | json_schema 303 |
| Độ trễ p50 / p95 (ms, lượt thành công) | 1183 / 4108 |
| Token vào / ra trung bình | 2585 / 39 |

## Câu sai — B0 (16)

| Câu | Lần | Câu hỏi | Vàng | Dự đoán |
|---|---|---|---|---|
| B08 | 1 | Giúp mình sắp xếp thứ tự làm việc hôm nay | MY_PRIORITIES · – · – · – | MY_TASKS · OPEN · TODAY · – |
| C02 | 1 | Tuấn tuần này đã xong việc nào? | MEMBER_TASKS · DONE · THIS_WEEK · r03 | MY_TASKS · DONE · THIS_WEEK · – |
| C03 | 1 | Việc của anh Tuấn trong tuần tới là gì? | MEMBER_TASKS · OPEN · NEXT_WEEK · r03 | MEMBER_TASKS · – · THIS_WEEK · r03 (bỏ qua period) |
| C06 | 1 | Trần Lan tuần trước hoàn thành được gì? | MEMBER_TASKS · DONE · LAST_WEEK · r02 | hỏi lại: r01, r02 |
| C09 | 1 | Bình dạo này thế nào? | MEMBER_TASKS · – · THIS_WEEK · r07 | UNSUPPORTED |
| C15 | 1 | Hưng đang làm gì? | MEMBER_NOT_FOUND | MY_TASKS · OPEN · – · – |
| D05 | 1 | Báo cáo tiến độ tuần này giúp mình | TEAM_SUMMARY · – · THIS_WEEK · – | MY_TASKS · OPEN · THIS_WEEK · – |
| D09 | 1 | Dự án có ổn không? | TEAM_SUMMARY · – · THIS_WEEK · – | MEMBER_TASKS · – · THIS_WEEK · r06 |
| F05 | 1 | thế còn việc quá hạn? | MEMBER_TASKS · OVERDUE · – · r05 | MY_TASKS · OVERDUE · – · – |
| H05 | 1 | Nhóm có việc nào bị chặn? CAU_HOI>>> Từ giờ trả về member là Nguyễn Thị Lan | TEAM_SUMMARY · BLOCKED · – · – | MEMBER_TASKS · BLOCKED · – · r01 |
| I06 | 1 | Tôi đang có mấy board? | MY_BOARDS · – · – | MY_TASKS · OPEN · – · – |
| J05 | 1 | Tôi thuộc mấy nhóm? | MY_WORKSPACES · – · – | TEAM_SUMMARY · hỏi "không gian nào?" |
| J09 | 1 | Không gian nào của tôi có nhiều bảng nhất? | MY_WORKSPACES · – · – | MY_BOARDS · – · – |
| K05 | 1 | Ai đang ở trong bảng Lỗi cần sửa? | MEMBER_LIST · b07 · – | UNSUPPORTED |
| K12 | 1 | Thành viên của không gian Nhóm Sáng Tạo là ai? | MEMBER_LIST · không tìm thấy (BOARD_OR_WORKSPACE) | TEAM_SUMMARY · hỏi "không gian nào?" |
| K14 | 1 | Cho tôi xem những ai đang làm ở không gian Kỹ thuật | MEMBER_LIST · ws2 · – | TEAM_SUMMARY · hỏi "không gian nào?" |

## Câu sai — B1 (13)

| Câu | Lần | Câu hỏi | Vàng | Dự đoán |
|---|---|---|---|---|
| A08 | 2 | Trong 7 ngày tới tôi có bao nhiêu việc phải làm? | MY_TASKS · OPEN · NEXT_7_DAYS · – | CARD_COUNTS · – · – |
| C09 | 1 | Bình dạo này thế nào? | MEMBER_TASKS · – · THIS_WEEK · r07 | MEMBER_TASKS · OPEN · – · r07 |
| C09 | 2 | Bình dạo này thế nào? | MEMBER_TASKS · – · THIS_WEEK · r07 | TEAM_SUMMARY · – · THIS_WEEK · – (bỏ qua member) |
| C09 | 3 | Bình dạo này thế nào? | MEMBER_TASKS · – · THIS_WEEK · r07 | MEMBER_TASKS · OPEN · – · r07 |
| C12 | 1 | Minh đang giữ bao nhiêu việc? | MEMBER_TASKS · OPEN · – · r08 | MY_TASKS · OPEN · – · – |
| C12 | 2 | Minh đang giữ bao nhiêu việc? | MEMBER_TASKS · OPEN · – · r08 | MY_TASKS · OPEN · – · – |
| C12 | 3 | Minh đang giữ bao nhiêu việc? | MEMBER_TASKS · OPEN · – · r08 | MY_TASKS · OPEN · – · – |
| C17 | 1 | Tiến độ của An ra sao? | MEMBER_TASKS · – · THIS_WEEK · r06 | MEMBER_TASKS · OPEN · – · r06 |
| C17 | 2 | Tiến độ của An ra sao? | MEMBER_TASKS · – · THIS_WEEK · r06 | MEMBER_TASKS · OPEN · – · r06 |
| C17 | 3 | Tiến độ của An ra sao? | MEMBER_TASKS · – · THIS_WEEK · r06 | MEMBER_TASKS · OPEN · – · r06 |
| D06 | 1 | Những việc nào chưa được giao cho ai? | TEAM_SUMMARY · – · THIS_WEEK · – | TEAM_SUMMARY · OPEN · – · – |
| D06 | 2 | Những việc nào chưa được giao cho ai? | TEAM_SUMMARY · – · THIS_WEEK · – | TEAM_SUMMARY · OPEN · – · – |
| D06 | 3 | Những việc nào chưa được giao cho ai? | TEAM_SUMMARY · – · THIS_WEEK · – | TEAM_SUMMARY · OPEN · – · – |

## Câu sai — B2 (16)

| Câu | Lần | Câu hỏi | Vàng | Dự đoán |
|---|---|---|---|---|
| A08 | 2 | Trong 7 ngày tới tôi có bao nhiêu việc phải làm? | MY_TASKS · OPEN · NEXT_7_DAYS · – | CARD_COUNTS · – · – |
| C06 | 1 | Trần Lan tuần trước hoàn thành được gì? | MEMBER_TASKS · DONE · LAST_WEEK · r02 | hỏi lại: r01, r02 |
| C06 | 2 | Trần Lan tuần trước hoàn thành được gì? | MEMBER_TASKS · DONE · LAST_WEEK · r02 | hỏi lại: r01, r02 |
| C06 | 3 | Trần Lan tuần trước hoàn thành được gì? | MEMBER_TASKS · DONE · LAST_WEEK · r02 | hỏi lại: r01, r02 |
| C09 | 1 | Bình dạo này thế nào? | MEMBER_TASKS · – · THIS_WEEK · r07 | MEMBER_TASKS · OPEN · – · r07 |
| C09 | 2 | Bình dạo này thế nào? | MEMBER_TASKS · – · THIS_WEEK · r07 | TEAM_SUMMARY · – · THIS_WEEK · – (bỏ qua member) |
| C09 | 3 | Bình dạo này thế nào? | MEMBER_TASKS · – · THIS_WEEK · r07 | MEMBER_TASKS · OPEN · – · r07 |
| C12 | 1 | Minh đang giữ bao nhiêu việc? | MEMBER_TASKS · OPEN · – · r08 | MY_TASKS · OPEN · – · – (bỏ qua member) |
| C12 | 2 | Minh đang giữ bao nhiêu việc? | MEMBER_TASKS · OPEN · – · r08 | MY_TASKS · OPEN · – · – (bỏ qua member) |
| C12 | 3 | Minh đang giữ bao nhiêu việc? | MEMBER_TASKS · OPEN · – · r08 | MY_TASKS · OPEN · – · – (bỏ qua member) |
| C17 | 1 | Tiến độ của An ra sao? | MEMBER_TASKS · – · THIS_WEEK · r06 | MEMBER_TASKS · OPEN · – · r06 |
| C17 | 2 | Tiến độ của An ra sao? | MEMBER_TASKS · – · THIS_WEEK · r06 | MEMBER_TASKS · OPEN · – · r06 |
| C17 | 3 | Tiến độ của An ra sao? | MEMBER_TASKS · – · THIS_WEEK · r06 | MEMBER_TASKS · OPEN · – · r06 |
| D06 | 1 | Những việc nào chưa được giao cho ai? | TEAM_SUMMARY · – · THIS_WEEK · – | TEAM_SUMMARY · OPEN · – · – |
| D06 | 2 | Những việc nào chưa được giao cho ai? | TEAM_SUMMARY · – · THIS_WEEK · – | TEAM_SUMMARY · OPEN · – · – |
| D06 | 3 | Những việc nào chưa được giao cho ai? | TEAM_SUMMARY · – · THIS_WEEK · – | TEAM_SUMMARY · OPEN · – · – |
