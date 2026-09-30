# Chọn trọng số mặc định của thành phần Hồ sơ (bước 15 — pha DEV)

Ngày chạy 2026-09-27 · 20 hạt giống (9801–9820) · sha256 dữ liệu `f7702727065c8966…` · sha256 hồ sơ `7a37232d9c1f1189…`

Luật đăng ký trước (§17.10): `d` **nhỏ nhất** có P(đúng hạn) ở W2 trong phạm vi 0,002 của giá trị tốt nhất **và** không kém `d = 0` quá 0,005 ở W1. **Cách đọc chốt trước khi chạy pha này** (khi chạy thử 2 hạt giống lộ ra hai điều kiện có thể không có giao nếu lấy "tốt nhất" trên mọi `d`): (1) chỉ giữ các `d` qua điều kiện W1 (luôn có `d = 0`); (2) lấy W2 tốt nhất trong tập đó; (3) chọn `d` nhỏ nhất trong phạm vi 0,002 của giá trị đó. Chỉ số: xác suất đúng hạn kỳ vọng của người được giao, vòng kín, trung bình theo hạt giống.

| d | P(đúng hạn) W1 | P(đúng hạn) W2 | W1 − (d = 0) | Thoả luật |
|---|---|---|---|---|
| 0,00 | 0,464 [0,452; 0,476] | 0,417 [0,403; 0,431] | – | qua W1 |
| 0,05 | 0,464 [0,450; 0,478] | 0,428 [0,413; 0,444] | -0,000 [-0,011; +0,010] | qua W1 |
| 0,10 | 0,466 [0,451; 0,480] | 0,425 [0,409; 0,441] | +0,001 [-0,011; +0,013] | qua W1 |
| 0,15 | 0,467 [0,449; 0,485] | 0,435 [0,421; 0,448] | +0,003 [-0,012; +0,018] | qua W1 |
| 0,20 | 0,466 [0,448; 0,483] | 0,442 [0,425; 0,460] | +0,001 [-0,011; +0,013] | **chọn** |
| 0,25 | 0,465 [0,446; 0,482] | 0,439 [0,420; 0,456] | +0,000 [-0,013; +0,013] | qua W1 |
| 0,30 | 0,466 [0,448; 0,483] | 0,434 [0,419; 0,449] | +0,002 [-0,011; +0,014] | qua W1 |
| 0,40 | 0,455 [0,438; 0,471] | 0,435 [0,418; 0,453] | -0,009 [-0,022; +0,003] | kém W1 |

- `d` cho W2 cao nhất trên mọi `d`: 0,20; qua điều kiện W1: 0,00, 0,05, 0,10, 0,15, 0,20, 0,25, 0,30; trong phạm vi W2: 0,20.
- **Chọn `d` = 0,20**.
- Đây là hạt giống DEV (chọn tham số). Số liệu để trích dẫn là pha XÁC NHẬN trên 4001–4020 (`eval-declared-result.md`).