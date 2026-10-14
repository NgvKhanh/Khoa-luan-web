**Review TaskFlow — 20/09/2026 — commit `96ea268`**

Phạm vi: backend Express/Prisma, frontend React, xác thực/phân quyền, chia sẻ bảng, vòng đời dữ liệu, upload, realtime, automation/scheduler, AI sinh bảng và công cụ đánh giá. Phần gợi ý phân công mới thêm cũng được rà soát theo chức năng đã có ở bước 0–3. Không sửa mã nguồn ứng dụng trong đợt review này.

P1 = cần ưu tiên sửa vì liên quan truy cập trái phép hoặc sai dữ liệu người dùng; P2 = lỗi chức năng/độ tin cậy cần xử lý tiếp. Các kết luận dưới đây nêu rõ bằng chứng từ API, kiểm thử cô lập hoặc đọc luồng mã.

1. **[P1] Liên kết Google giữ lại mật khẩu và phiên của người đăng ký trước bằng email người khác.**

   Vị trí: [auth.service.ts:192](D:/Build-Project/TESTKL/backend/src/modules/auth/auth.service.ts:192).

   Kẻ khác đăng ký tài khoản bằng email của nạn nhân, không cần xác minh email. Khi chủ email đăng nhập Google, nhánh `byEmail` liên kết vào chính tài khoản đó, đặt `emailVerifiedAt`, nhưng giữ nguyên `passwordHash` và `tokenVersion`. Người đăng ký trước tiếp tục dùng mật khẩu lẫn cookie cũ để vào tài khoản đã liên kết.

   Đã tái hiện qua API và database test: sau `/auth/google`, cả cookie trước liên kết và `/auth/login` bằng mật khẩu cũ vẫn trả 200. Chỉ bước xác minh ID token Google được mock; luồng liên kết và lưu dữ liệu chạy thật. Cần quy trình nhận lại tài khoản chưa xác minh: vô hiệu mật khẩu chưa được chủ email xác nhận, thu hồi phiên/token liên quan, hoặc yêu cầu xác minh trước khi cho liên kết.

2. **[P1] Mời bằng email cấp ngay quyền cho tài khoản chưa chứng minh sở hữu email.**

   Vị trí: [boardMember.service.ts:124](D:/Build-Project/TESTKL/backend/src/modules/board/boardMember.service.ts:124), [workspaceMember.service.ts:94](D:/Build-Project/TESTKL/backend/src/modules/workspace/workspaceMember.service.ts:94).

   Cả hai luồng chỉ tìm tài khoản theo email rồi tạo membership. Nếu kẻ khác đăng ký trước bằng email đồng nghiệp, khi quản trị viên thêm đồng nghiệp theo email, tài khoản do kẻ đó kiểm soát được quyền ngay mà không cần mở thư mời. Đây là đường truy cập bảng riêng tư độc lập với lỗi liên kết Google.

   Đã tái hiện với bảng PRIVATE: người nhận có `emailVerifiedAt = null` vẫn được thêm và GET bảng trả 200. Cần để lời mời ở trạng thái chờ cho đến khi xác minh địa chỉ nhận; chỉ cấp ngay cho tài khoản đã xác minh email.

3. **[P1] Người ngoài bảng PUBLIC đọc được email thành viên và mã mời qua API thông thường.**

   Vị trí: [boardMember.service.ts:30](D:/Build-Project/TESTKL/backend/src/modules/board/boardMember.service.ts:30), [board.service.ts:109](D:/Build-Project/TESTKL/backend/src/modules/board/board.service.ts:109).

   `assertBoardView` chấp nhận người ngoài đối với bảng PUBLIC, nhưng `/api/boards/:id/members` vẫn serialize email. GET chi tiết bảng spread toàn bộ bản ghi, bao gồm `inviteToken`, dù endpoint `/invite-link` yêu cầu quyền quản lý. Endpoint export và các DTO lồng user cũng cần được kiểm tra cùng chính sách. Việc làm sạch dữ liệu chỉ ở `/api/public/...` không bảo vệ các đường đọc còn lại.

   Đã tái hiện bằng tài khoản không có membership: API members trả email chủ bảng, API detail trả `inviteToken` với `canManage:false`; gọi `/invite-link` bằng cùng tài khoản lại bị 403. Cần DTO theo quyền đọc, bỏ email với người ngoài và chỉ trả mã mời khi có quyền quản lý.

4. **[P1] Xóa danh sách không thu hồi quyền đọc công khai các thẻ bên trong.**

   Vị trí: [publicBoard.service.ts:69](D:/Build-Project/TESTKL/backend/src/modules/board/publicBoard.service.ts:69), [list.service.ts:138](D:/Build-Project/TESTKL/backend/src/modules/list/list.service.ts:138).

   Xóa danh sách chỉ đặt `List.deletedAt`; `getPublicCard` kiểm tra trạng thái Card và Board nhưng bỏ qua List. Người có URL cũ vẫn đọc được nội dung, bình luận và thông tin tệp của thẻ sau khi danh sách chứa nó bị xóa. List lưu trữ cũng thiếu kiểm tra tương tự; đường đọc chi tiết thẻ có đăng nhập dùng cùng kiểu kiểm tra thiếu cha.

   Đã tái hiện qua API: DELETE list thành công, database xác nhận `deletedAt` khác null, nhưng GET `/api/public/cards/:cardId` không đăng nhập vẫn trả 200 và nội dung thẻ. Cần kiểm tra trạng thái toàn bộ chuỗi Card → List → Board ở các đường đọc, kể cả phục vụ tệp liên quan.

5. **[P1] Lưu ngày giờ không chỉnh sửa vẫn làm lệch hạn chót 7 giờ tại Việt Nam.**

   Vị trí: [CardModal.tsx:1010](D:/Build-Project/TESTKL/frontend/src/components/board/CardModal.tsx:1010), [CardModal.tsx:1037](D:/Build-Project/TESTKL/frontend/src/components/board/CardModal.tsx:1037), [CardModal.tsx:1567](D:/Build-Project/TESTKL/frontend/src/components/board/CardModal.tsx:1567).

   `datetime-local` nhận giá trị từ `toISOString().slice(0,16)` — giờ UTC bị bỏ hậu tố múi giờ — rồi lúc lưu lại được `new Date(value)` hiểu là giờ địa phương. Tại UTC+7, một hạn 10:00 mở ra thành 03:00; bấm Lưu mà không sửa gửi thời điểm sớm hơn 7 giờ. Ngày bắt đầu và hạn checklist đều bị ảnh hưởng.

   Đã chạy đúng biểu thức với `TZ=Asia/Ho_Chi_Minh`: `2026-09-19T03:00:00.000Z` trở thành `2026-09-18T20:00:00.000Z`. Cần format bằng thành phần ngày giờ địa phương khi đưa vào input, chỉ chuyển sang ISO UTC lúc gửi API.

6. **[P1] Phản hồi bảng cũ có thể ghi đè danh sách đang hiển thị ở bảng mới.**

   Vị trí: [BoardPage.tsx:361](D:/Build-Project/TESTKL/frontend/src/pages/BoardPage.tsx:361).

   Component được tái sử dụng khi đổi `boardId`. Mở A rồi chuyển sang B khi request A còn chờ; nếu B trả trước và A trả sau, `.then(setLists)` của A ghi đè danh sách B. Trang mang tiêu đề B nhưng chứa ID cột/thẻ A, nên thao tác sửa/lưu trữ có thể tác động nhầm bảng. Fetch thành viên, `reloadLists` và refetch realtime cần cùng cơ chế chống kết quả cũ.

   Đã tái hiện bằng component `BoardPage` thật, MemoryRouter và request điều khiển được: title giữ Board B, danh sách chuyển thành List A; bấm đổi tên gọi `updateList('listA', ...)`. Cần hủy request hoặc kiểm tra thế hệ request/`boardId` trước cả cập nhật dữ liệu, lỗi và trạng thái loading.

7. **[P2] Bảng đã lưu trữ vẫn xuất hiện trong kết quả tìm kiếm của người ngoài.**

   Vị trí: [search.service.ts:37](D:/Build-Project/TESTKL/backend/src/modules/search/search.service.ts:37), [card.service.ts:296](D:/Build-Project/TESTKL/backend/src/modules/card/card.service.ts:296).

   Bộ lọc Board chỉ kiểm tra `deletedAt`, thiếu `archivedAt:null`. Lưu trữ bảng PUBLIC khiến endpoint chi tiết từ chối truy cập, nhưng API tìm kiếm vẫn trả các thẻ của bảng. Các truy vấn mine/calendar có cùng điểm cần thống nhất.

   Đã tái hiện: GET public board trả 404 sau lưu trữ, trong khi `/api/search/cards?q=...` của tài khoản ngoài bảng vẫn trả thẻ đó. Cần dùng chung điều kiện bảng đang hoạt động cho các truy vấn hiển thị nội dung.

8. **[P2] Chuyển hàng loạt thẻ không chạy automation theo danh sách đích.**

   Vị trí: [list.service.ts:270](D:/Build-Project/TESTKL/backend/src/modules/list/list.service.ts:270).

   `moveAllCards` cập nhật trực tiếp `listId/position` và chỉ phát sự kiện reload. Nó không gọi `runAutomationsForCard('CARD_MOVED_TO_LIST', ...)` như luồng chuyển một thẻ.

   Đã tái hiện với luật chuyển vào Done → `SET_DONE`: chuyển hàng loạt để `isDone=false`; chuyển cùng thẻ bằng endpoint đơn lẻ làm `isDone=true`. Cần dùng chung xử lý sau khi chuyển cho cả hai đường, đồng thời thống nhất activity và notification.

9. **[P2] VIEWER của bảng WORKSPACE vẫn được gán làm người thực hiện.**

   Vị trí: [board.service.ts:168](D:/Build-Project/TESTKL/backend/src/modules/board/board.service.ts:168).

   `isBoardParticipant` tìm membership với điều kiện loại VIEWER; khi không tìm thấy, hàm rơi xuống nhánh membership của workspace và trả true. Vì vậy người đã được chỉ định VIEWER nhưng vẫn thuộc workspace được gán vào thẻ/checklist, trái với chính sách VIEWER của hàm và khả năng chỉnh sửa thực tế.

   Đã tái hiện qua API: GET bảng báo `canEdit:false`, nhưng owner POST gán người đó vào thẻ thành công. Cần đọc membership trước rồi trả false rõ ràng nếu role là VIEWER; chỉ xét quyền kế thừa workspace khi chưa có membership trực tiếp.

10. **[P2] Request kéo thả cũ xóa snapshot của lần kéo mới.**

    Vị trí: [useBoardDnd.ts:232](D:/Build-Project/TESTKL/frontend/src/pages/boardPage/useBoardDnd.ts:232).

    Kéo A sang L2 và để request lưu A chờ; bắt đầu kéo B sang L2; request A hoàn tất rồi người dùng hủy kéo B. Request cũ đặt `listsSnapshotRef.current = null`, làm mất snapshot của B. UI giữ cả A và B ở L2 dù server chỉ chuyển A; refetch sau đó có thể sửa lại giao diện.

    Đã tái hiện bằng kiểm thử hook thật với request điều khiển được: trạng thái mong muốn L1=[B], L2=[A], nhưng nhận L1=[], L2=[A,B] và chỉ một API move được gọi. Cần snapshot và mã lượt kéo riêng, hoặc khóa lần kéo kế tiếp trong lúc đang lưu.

11. **[P2] Cắt chuỗi AI giữa một emoji làm request sinh kế hoạch trả 500.**

    Vị trí: [ai.build.ts:103](D:/Build-Project/TESTKL/backend/src/modules/ai/ai.build.ts:103), [ai.service.ts:199](D:/Build-Project/TESTKL/backend/src/modules/ai/ai.service.ts:199).

    `cut()` dùng `slice(0,max)` theo đơn vị UTF-16. Nếu emoji nằm đúng biên 500 ký tự của tiêu đề, kết quả chứa nửa surrogate pair. Zod chấp nhận chuỗi này, nhưng PostgreSQL từ chối JSONB khi lưu `AiRun.plan`.

    Đã tái hiện qua API với `'- ' + 'x'.repeat(499) + '😀'`: đầu vào hợp lệ trả 500 tại `prisma.aiRun.create`. Cần cắt theo ranh giới Unicode hợp lệ cho mọi trường; hàm `truncateInput` hiện có đã xử lý trường hợp tương tự cho văn bản đầu vào.

12. **[P2] Bộ luật AI bỏ các công việc đánh số từ 100 trở lên.**

    Vị trí: [ai.rules.ts:127](D:/Build-Project/TESTKL/backend/src/modules/ai/ai.rules.ts:127).

    Regex bullet chỉ nhận số có 1–2 chữ số. Trong tài liệu STRUCTURED, mục `100.` trở đi trở thành TEXT rồi bị bỏ khi dựng kế hoạch. Đây không phải giới hạn số thẻ được thông báo cho người dùng.

    Đã gửi 105 dòng dạng `1. Task number 1` qua API trong chế độ bộ luật: chỉ tạo 99 thẻ; không có cảnh báo mất các mục còn lại (chỉ có cảnh báo chung `LLM_UNAVAILABLE`). Cần nhận số thứ tự dài hơn và có kiểm thử vượt biên 99/100.

13. **[P2] Hai lần cập nhật trạng thái đồng thời có thể làm sai `completedAt`.**

    Vị trí: [card.service.ts:427](D:/Build-Project/TESTKL/backend/src/modules/card/card.service.ts:427).

    Quyết định có ghi `completedAt` dựa vào `card.isDone` đọc trước lệnh UPDATE. Hai request cùng đọc false; A ghi true kèm timestamp, B ghi false nhưng bỏ cập nhật timestamp vì snapshot của B vốn false. Kết quả là thẻ chưa xong nhưng còn `completedAt`; chiều ngược lại có thể tạo thẻ đã xong không có mốc hoàn thành. Phần dữ liệu phục vụ gợi ý phân công sẽ nhận trạng thái không nhất quán.

    Đã mô phỏng thứ tự xen kẽ bằng hàm `updateCard` thật với dependency stub; migration không có CHECK constraint bảo vệ bất biến này. Frontend cho toggle liên tiếp trong lúc request trước còn chờ. Cần thực hiện so sánh/cập nhật nguyên tử trên giá trị hiện tại trong DB, hoặc dùng kiểm soát phiên bản và retry; giữ mốc hoàn thành khi trạng thái thực tế không đổi.

14. **[P2] Cache đánh giá AI không phân biệt endpoint/nhà cung cấp.**

    Vị trí: [evalCache.ts:24](D:/Build-Project/TESTKL/backend/src/scripts/evalCache.ts:24), [evaluateAi.ts:102](D:/Build-Project/TESTKL/backend/src/scripts/evaluateAi.ts:102).

    Khóa cache chỉ có arm, model, run và prompt. Nếu đổi `AI_BASE_URL`/nhà cung cấp nhưng giữ model identifier và thư mục cache, lần đánh giá tiếp theo dùng phản hồi của endpoint cũ. Metadata báo cáo lại ghi provider hiện tại, làm sai nguồn kết quả/token/latency trong phép so sánh nhà cung cấp.

    Xác minh từ cách tạo khóa, đọc cache và tạo metadata; không gọi dịch vụ LLM thật. Cần thêm danh tính endpoint/provider và phiên bản cấu hình request ảnh hưởng kết quả vào khóa hoặc namespace cache. Không đưa API key thô vào khóa lưu trữ/log.

15. **[P2] Lệnh lint frontend hiện thất bại.**

    Vị trí: [TemplatesPage.tsx:72](D:/Build-Project/TESTKL/frontend/src/pages/TemplatesPage.tsx:72), [TemplatesPage.tsx:170](D:/Build-Project/TESTKL/frontend/src/pages/TemplatesPage.tsx:170).

    Handler async thông thường được đặt tên `useUserTemplate`, nên quy tắc Hooks coi nó là hook bị gọi trong callback onClick. `npm run lint` kết thúc với exit code 1. Đây là lỗi của bước kiểm tra lint; không phải bằng chứng trang bị crash khi chạy. Đổi tên thành `handleUseUserTemplate` và cập nhật chỗ gọi là đủ cho lỗi này.

16. **[P2] Hàng đợi đánh dấu sao có thể tiếp tục bằng phiên đăng nhập khác.**

    Vị trí: [BoardsContext.tsx:204](D:/Build-Project/TESTKL/frontend/src/context/BoardsContext.tsx:204).

    A bấm sao hai lần khi request đầu còn chờ, đăng xuất, rồi B đăng nhập trên cùng trình duyệt. Callback của provider cũ vẫn gọi đệ quy `runStarRequest` khi request đầu hoàn tất. Request chờ được gửi với cookie hiện tại của B; nếu hai người cùng xem được bảng, thao tác của A làm đổi sao cá nhân của B.

    Đã xác nhận bằng kiểm thử provider thật: request tiếp theo vẫn chạy sau unmount và sử dụng phiên mô phỏng B. Luồng logout thông thường có unmount provider, nên đây là lỗi continuation của mutation queue, không phải toàn bộ cache người dùng bị dùng chung. Cần hủy queue khi unmount và kiểm tra phiên trước khi tiếp tục request.

**Kiểm chứng và giới hạn**

| Kiểm tra | Kết quả |
|---|---|
| Backend `npm run typecheck` | Qua |
| Backend `npm run lint` | Qua |
| Backend toàn bộ `npm test` | 54 file, 397 test qua; 293 giây |
| Frontend `npm test` | 14 file, 62 test qua |
| Frontend `npm run build` | Qua |
| Frontend `npm run lint` | Không qua: 1 lỗi Hooks, kèm warnings |
| Probe backend riêng cho review | 7 kịch bản xác nhận hành vi lỗi; đã xóa file test tạm |
| Probe frontend | Tái hiện sửa nhầm bảng, race snapshot kéo thả và queue vượt phiên; xác nhận lệch giờ bằng biểu thức thực tế |

Test backend dùng database test riêng, email và LLM được mock/cô lập. Không chạy gửi email, OAuth hoặc LLM thật; chưa chạy E2E trình duyệt hay đo tải. Các phát hiện đã phân biệt giữa tái hiện chạy thật và kết luận từ luồng mã. Bộ test hiện có chưa bao phủ những tổ hợp quyền, trạng thái cha, Unicode và request đồng thời nêu trên.

Trong lúc review có chỉnh sửa ngoài phiên review tại `backend/src/modules/assign/assign.profile.ts` để bổ sung metadata hồ sơ; đã đọc phần diff này. Kết quả typecheck/lint ghi trên ứng với lần chạy trước khi diff đó xuất hiện. Không hoàn tác hay chỉnh sửa phần công việc đang làm này.

Nên xử lý các lỗi P1 trước; sau đó thống nhất điều kiện truy cập/vòng đời dữ liệu và mutation dùng chung, rồi bổ sung regression test theo đúng kịch bản của từng lỗi.
