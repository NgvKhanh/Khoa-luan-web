# Review backend — 30/09/2026

Phạm vi: code backend trong working tree, bao gồm các thay đổi chatbot chưa commit. Rà soát tập trung vào phân quyền, dữ liệu trả về, thao tác đồng thời, gợi ý phân công và độ an toàn của kiểm thử. Đây không phải kết luận rằng mọi đường chạy đã được kiểm tra hết.

## 1. [P1] Bộ test có thể xóa CV đang dùng của ứng dụng

Vị trí: `backend/test/assign.profileapi.test.ts:34–39`; `backend/src/config/upload.ts:10` và `CV_DIR` trong cùng file.

`before` ban đầu là một `Set` rỗng, nhưng `afterEach` luôn xóa mọi file trong `CV_DIR` không thuộc tập đó. Ba test đầu tiên không gọi `startTracking()`. Vì `CV_DIR` được tính từ `process.cwd()/uploads/cv`, chạy test tại thư mục backend dùng chung thư mục upload với backend trong Docker; tách database không tách được file.

Đã tái hiện bằng cách đặt một file giả có sẵn trong thư mục upload cô lập, rồi chạy test đầu tiên `chua khai`: test qua, nhưng file giả bị xóa.

Đề xuất: dùng thư mục upload tạm riêng cho mỗi lượt test, chỉ dọn tài nguyên do lượt test tạo. Việc chỉ chuyển `startTracking()` vào `beforeEach` chưa bảo vệ được file thật được tải lên trong lúc test chạy.

## 2. [P1] Người ngoài có thể tự tạo quyền tải CV của người khác

Vị trí: `backend/src/modules/declaredProfile/declaredProfile.service.ts:142–164`; `backend/src/modules/workspace/workspaceMember.service.ts:111–117`.

`managedAmong()` coi chủ/admin của bất kỳ workspace chung nào là người được tải CV. Trong khi đó, chủ workspace có thể thêm ngay một tài khoản đã xác minh email, không cần người đó chấp nhận.

Tái hiện: B chưa liên quan đến A; tải CV của A nhận 404. B tạo workspace, thêm A bằng email, rồi tải lại cùng URL và nhận 200 cùng file CV. Điều kiện: A đã tải CV và đang bật `useForAssign`.

Đề xuất: quyền tải CV cần sự đồng ý của chủ CV, hoặc tư cách thành viên đã chấp nhận lời mời; không dựa vào quan hệ mà bên yêu cầu tự tạo được.

## 3. [P2] Các API khác vẫn trả email và mã mời đã bị che ở API đọc thông thường

Vị trí: `backend/src/modules/board/board.service.ts:213–214,473–513`; `backend/src/modules/card/card.service.ts:338–362`; `backend/src/modules/list/list.service.ts:45–59`.

Với bảng PUBLIC, tài khoản ngoài bảng gọi `/members` được che email, nhưng vẫn đọc được email qua `/export`, `/lists` và chi tiết thẻ có thành viên/bình luận. `/export` còn trả nguyên `Board`, gồm `inviteToken`. Ngoài ra, VIEWER bị `/invite-link` từ chối 403 nhưng vẫn lấy được token qua `GET /api/boards` vì `listMyBoards()` trải toàn bộ thuộc tính bảng vào response.

Đã kiểm tra qua các HTTP endpoint tương ứng. Mã mời vẫn cần quản trị viên duyệt yêu cầu tham gia; lỗi này không đồng nghĩa tự động có quyền sửa bảng.

Đề xuất: trả dữ liệu theo danh sách trường được phép, áp dụng cùng quy tắc che email cho mọi đường đọc và loại `inviteToken` khỏi response thông thường.

## 4. [P2] Khách của một bảng đọc được thành viên toàn workspace qua chatbot

Vị trí: `backend/src/modules/chat/chat.catalog.ts:105–110,279–284`.

Ở phạm vi BOARD, `workspacesOfScope()` đưa workspace cha vào catalog dù người hỏi chỉ là khách của bảng. Nhánh `MEMBER_LIST` sau đó truy vấn workspace theo ID mà không kiểm tra người hỏi có thuộc workspace đó không.

Tái hiện: khách VIEWER chỉ được mời vào một bảng PRIVATE; `GET /api/workspaces/:id/members` trả 403. Hỏi chatbot “Không gian Nhóm Nội Bộ có những thành viên nào?” với scope của bảng đó lại trả tên và vai trò của cả những người không nằm trong bảng.

Đề xuất: kiểm tra quyền workspace trước khi đưa vào catalog và trước truy vấn danh sách thành viên workspace.

## 5. [P2] Sắp xếp thẻ có thể kéo ngược thẻ khác đã chuyển sang bảng riêng tư

Vị trí: `backend/src/modules/card/card.service.ts:675–695`.

`moveCard()` đọc danh sách thẻ đích trước transaction, rồi cập nhật cả `position` lẫn `listId` cho mọi ID trong snapshot, chỉ lọc theo ID. Một thẻ khác vừa chuyển đi vẫn bị batch cũ chuyển trở lại.

Đã tái hiện thứ tự xen kẽ một cách xác định: editor bắt đầu sắp xếp A ở bảng X; chủ bảng chuyển B từ X sang bảng PRIVATE Y; thao tác của editor tiếp tục và kéo B trở lại X, dù editor không có quyền xem Y. Các thao tác database và hàm `moveCard()` đều chạy thật; chỉ chèn điểm xen kẽ sau truy vấn snapshot.

Đề xuất: chỉ đổi `listId` của thẻ thực sự được di chuyển; các thẻ còn lại chỉ cập nhật vị trí với điều kiện vẫn thuộc danh sách mong đợi. Việc đọc/sắp xếp/ghi cần cơ chế đồng bộ hoặc kiểm tra phiên bản để phát hiện xung đột.

## 6. [P2] Gợi ý phân công đưa VIEWER vào danh sách người nhận việc

Vị trí: `backend/src/modules/assign/assign.repo.ts:62–69`.

`readCandidates()` loại VIEWER khi đọc BoardMember nhưng thêm lại mọi WorkspaceMember cho bảng WORKSPACE. Người đồng thời là thành viên workspace và VIEWER trực tiếp của bảng vì thế vẫn được chấm điểm, trong khi `isBoardParticipant()` từ chối người đó.

Đã xác nhận API gợi ý trả người này trong `candidates`, còn POST gán cùng người vào thẻ trả 400. Cùng nguồn ứng viên cũng được dùng cho kế hoạch phân công.

Đề xuất: vai trò trực tiếp VIEWER phải ưu tiên hơn quyền kế thừa từ workspace, thống nhất với quy tắc khi giao việc.

## 7. [P2] Chatbot báo thiếu tổng số thẻ khi vượt giới hạn catalog

Vị trí: `backend/src/modules/chat/chat.catalog.ts:320–331,348–368`.

`cardCounts()` giới hạn danh sách ở 3.000 cột và 500 bảng trước khi cộng tổng. Giới hạn để nhận diện tên/hiển thị vì vậy làm sai số tổng hợp, thay vì chỉ rút gọn bảng kết quả.

Đã tái hiện với 501 bảng có quyền đọc, mỗi bảng một thẻ chưa xong: database có 501 thẻ nhưng `CARD_COUNTS` báo 500.

Đề xuất: tính tổng bằng `count/groupBy` trên toàn bộ phạm vi có quyền đọc; chỉ giới hạn các dòng trình bày, không giới hạn tập dùng để tính tổng.

## Kiểm chứng và thao tác trong lượt review

- `npm run typecheck` và `npm run lint`: thành công.
- 7 kiểm thử tạm xác nhận các hành vi lỗi ở mục 2–7: đều tái hiện thành công trên database và thư mục upload riêng. Đây là kiểm thử chứng minh lỗi, không phải kết luận backend đã hết lỗi.
- Lỗi mục 1 được xác nhận thêm bằng test có sẵn trên thư mục cô lập chứa file giả.
- Full suite đã được dừng khi phát hiện rủi ro xóa file. Không có kết luận toàn bộ test suite đã qua.
- Lượt chạy probe đầu trên database test chung bị xung đột với một tiến trình test khác; các lỗi fixture của lượt đó không được tính là lỗi backend. Kết luận phía trên dùng lượt chạy đã cô lập.
- Trong quá trình rà soát, phát hiện một CV trong database phát triển thiếu file trên đĩa. Đã khôi phục từ bản gốc trong Downloads: tên và kích thước khớp metadata, nội dung trích xuất khớp chính xác `cvText`, checksum file phục hồi khớp bản gốc. Không có snapshot thư mục trước lượt test để xác định chắc chắn thời điểm file bị mất.
- Không sửa code chức năng hoặc bộ test hiện có trong lượt review này. Các file kiểm chứng tạm và database riêng được dọn sau khi kiểm chứng.
