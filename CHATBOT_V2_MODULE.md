# Hợp đồng chatbot TaskFlow v2 — bước 1–6 và hành động Phase 1

Ngày cập nhật: 07/10/2026.

**Hành động (Phase 1, 07/10/2026):** trợ lý làm được 7 thao tác an toàn trên MỘT bảng (tạo thẻ, đổi tên, đặt/bỏ hạn, chuyển cột, đổi trạng thái, giao người, gắn nhãn) — xem mục 9. Từ Phase 1, phạm vi hiệu lực còn bị **trần theo trang** (trang bảng khóa cứng trong bảng đó); các mục 2 và 7 bên dưới đã được cập nhật theo.

**Trạng thái:** đã triển khai bước 1–6: công cụ dữ liệu, adapter Gemini/endpoint compatible, bộ điều phối nhiều công cụ, API `/api/chat/v2` và panel v2. `/api/chat` giữ hợp đồng v1 để tương thích. Môi trường development/test mặc định chọn v2; production chưa đặt CHAT_ENGINE giữ legacy đến khi nghiệm thu rollout. `CHAT_ENGINE=v2` hoặc `legacy` chọn engine rõ ràng. Kho hướng dẫn/RAG và đánh giá diện rộng thuộc bước 7–9.

## 1. Khả năng đã bàn giao

| Module | Dữ liệu qua công cụ v2 | Giới hạn |
|---|---|---|
| Board | Nhận diện, danh sách, vai trò của người hỏi, thống kê | Chỉ bảng thuộc phạm vi chatbot |
| Workspace | Nhận diện, danh sách, vai trò của người hỏi, số bảng đọc được/số người | Không mượn quyền quản lý workspace để đọc bảng riêng |
| Card | Lọc, danh sách, phân trang, số đếm và thống kê | Không trả mô tả; từ khóa có thể tìm trong tiêu đề/mô tả |
| List | Nhận diện, lọc theo cột và nhóm số lượng | Loại cột xóa/lưu trữ khỏi công việc hiện tại |
| Label | Lọc bằng ID nhãn đã kiểm quyền | Chưa nhận diện nhãn theo tên |
| Activity | Nhật ký theo loại, người, ngày; các thẻ duy nhất có thay đổi | Chỉ theo nhật ký đã ghi nhận, giá trị cũ thiếu thì để thiếu |
| Checklist | Chưa có công cụ riêng | Người nhận item không được tính như người nhận thẻ |
| Notification, automation, customField | Chưa có công cụ riêng | Bổ sung sau mốc dữ liệu cốt lõi |
| AI tạo bảng, assign | Chưa truy vấn lịch sử/kết quả riêng | Không trả CV hoặc hồ sơ phân công |
| Hướng dẫn sử dụng website | Chưa có `search_help` | Bước 7 bổ sung tài liệu đã duyệt và retrieval |

Danh mục máy đọc được: `chat.v2.capabilities.ts`. Trạng thái SUPPORTED/PARTIAL nói về phạm vi dữ liệu của công cụ; không cam kết mọi cách diễn đạt đều được AI hiểu đúng.

## 2. Phạm vi và quyền

- `executeChatTool` là điểm vào dùng chung. `ToolContext` do server tạo, gồm `userId`, `now`, `scope` và `conversationScope` tùy chọn; input công cụ không nhận userId/vai trò/SQL/Prisma where.
- Mỗi lần thực thi kiểm tra tài khoản còn hoạt động và gọi lại chính sách `resolveScope`. Loại workspace đã xóa khỏi boardWhere. Bảng PRIVATE hoặc PUBLIC của người khác không được đọc chỉ vì người hỏi quản lý workspace hoặc bảng có tính công khai.
- Phạm vi hiệu lực: `input.scope` đã xác minh > `conversationScope` đã chọn > phạm vi giao diện, **nhưng luôn nằm trong TRẦN phạm vi của trang** (mục 9.5): trang bảng (BOARD) chỉ đọc/ghi đúng bảng đó — yêu cầu MY/WORKSPACE bị kẹp về bảng, bảng khác bị từ chối 403; trang chủ (MY) không giới hạn thêm. `chat.v2.service.ts` xóa đối tượng, bộ lọc, câu hỏi chờ và phiên fallback, đồng thời hủy mọi kế hoạch thao tác đang mở khi đổi phạm vi giao diện.
- Backend phân giải tên bảng được nhắc rõ trước khi lập kế hoạch. Board/workspace ID do AI đề xuất phải đến từ phạm vi giao diện, đối tượng đã phân giải hoặc danh mục đã truy vấn; ID số tự đoán không được thực thi. Tên dài có thể đặt trong dấu ngoặc kép để tách khỏi phần câu hỏi.
- `resolve_entities` cho BOARD/WORKSPACE mặc định tìm trên MY (các bảng/không gian được phép) để tìm một bảng được nhắc rõ — **chỉ khi giao diện ở trang chủ**; ở trang bảng, "MY" bị kẹp về bảng đang mở nên tên bảng khác không tìm thấy (kèm lời giải thích trần phạm vi). Khi input có scope cụ thể, tìm trong scope đó (vẫn trong trần).
- MY là toàn bộ bảng được phép xem, **không tự lọc người nhận là người hỏi**. Câu “việc của tôi” cần bộ điều phối đặt assigneeIds thành ID người hỏi do server cung cấp.
- Roster BOARD: chủ bảng, BoardMember hiện tại gồm VIEWER; bảng WORKSPACE thêm chủ/thành viên workspace. WORKSPACE: chủ và thành viên hiện tại. MY: người hiện tại liên quan tới các bảng đọc được và người hỏi. Không có tài khoản đã xóa trong roster.
- ID thẻ, người, cột, nhãn trong bộ lọc đều được kiểm tra trong phạm vi hiện tại. Không cho người dùng suy ra tên/email của thực thể ngoài quyền từ lỗi.
- Bộ lọc actorIds hiện chỉ chấp nhận người trong roster hiện tại. Nhật ký của người đã rời vẫn có thể xuất hiện khi không lọc actor; tìm riêng người đã rời theo tên là hướng mở rộng.

## 3. Quy tắc dữ liệu

### Công việc và số đếm

- Công việc hiện tại: thẻ, cột, bảng chưa xóa/lưu trữ; workspace chưa xóa.
- completion mặc định OPEN; DONE chỉ thẻ hoàn thành; ALL tính cả hai. “Đang giữ việc” dùng OPEN và câu trả lời phải nêu điều kiện.
- Riêng phép đối chiếu “đã phân công và chưa phân công” mặc định ALL cho hai danh sách, vì người nhận và hoàn thành là hai điều kiện khác nhau. Bộ điều phối ổn định mặc định này ngay cả khi AI chọn nhầm OPEN; yêu cầu “chỉ việc chưa xong”, trạng thái cụ thể hoặc quá hạn vẫn được tôn trọng. Điều kiện thực tế hiện trên từng phần.
- UNASSIGNED nghĩa là không có dòng CardMember nào. Một thẻ chỉ giao cho tài khoản đã xóa vẫn không phải thẻ chưa giao. ChecklistItem.assigneeId không ảnh hưởng điều kiện này.
- Một thẻ có hai người nhận được đếm một lần cho mỗi người; `totalCards` luôn là số thẻ duy nhất. Lượt giao cho người ngoài roster và tài khoản đã xóa được báo riêng, không lộ tên những người đó.
- ASSIGNEE giữ người có 0 việc; trả toàn bộ `leaderIds` đồng hạng có số lớn nhất, độc lập phân trang. Không có việc nào thì leaderIds rỗng.
- Bộ lọc danh sách và thống kê dùng chung `buildTaskWhere`. Không đếm số dòng của một trang để suy ra tổng.
- completion DONE + overdue, OPEN + status DONE hoặc UNASSIGNED + assigneeIds là lỗi tham số.
- sort danh sách: hạn tăng dần, null cuối, ID phụ để ổn định; hoặc createdAt giảm dần, ID phụ. Aggregate: count giảm dần, nhãn và ID phụ.

### Thời gian

- Input range gồm from/to bắt buộc. `YYYY-MM-DD` được hiểu theo Việt Nam UTC+7; ngày cuối là trọn ngày đó. Timestamp có timezone: from bao gồm, to không bao gồm.
- Nội bộ mọi khoảng là `[from, to)`. Ngày sai như 30/02 hoặc khoảng ngược bị từ chối. Source trả khoảng đã chuyển thành UTC để kiểm chứng.
- Các loại ngày công việc: DUE, COMPLETED, CREATED; thời gian lịch sử luôn là Activity.createdAt. Nhóm DATE trả ngày Việt Nam, thiếu ngày trả bucket NONE.
- Câu “đã thay đổi” không nói khoảng thời gian phải được bộ điều phối tương lai hỏi lại. “Gần đây” quy ước 7 ngày nếu được áp dụng phải hiển thị khoảng thực tế. Công cụ query_activities hiện từ chối thiếu range.

### Lịch sử

- CHANGE_TYPES mặc định: di chuyển, đổi tên, hoàn thành/mở lại/đổi trạng thái, đặt/xóa hạn, thêm/gỡ người phụ trách, lưu trữ/khôi phục.
- Tạo thẻ, bình luận, thêm checklist/tệp và AI tạo bảng cần chỉ định types rõ; không tính vào thay đổi mặc định.
- EVENTS phân trang sự kiện; CHANGED_CARDS nhóm ID thẻ, phân trang các thẻ duy nhất và trả tối đa 5 sự kiện gần nhất mỗi thẻ với `eventsTruncated`.
- Trả riêng eventCount và changedCardCount. Sự kiện cardId null không đóng góp vào changedCardCount.
- Mặc định lịch sử có thể bao gồm thẻ/cột lưu trữ còn trong bảng hoạt động. Thẻ xóa hoặc chuyển khỏi bảng ghi nhật ký: cardTitle null, data rỗng, redacted true; giữ mã và thời điểm/type của sự kiện đã có trong bảng được phép xem.
- Không chuyển nguyên Activity.data ra ngoài. Chỉ from/to của đổi tên/trạng thái, from/to/dueDate của đổi hạn, toList của di chuyển. Không trả fromList/toBoard của di chuyển liên bảng vì có thể tiết lộ bảng nguồn riêng. Thêm/gỡ người chỉ dùng ID + tên hiện tại của người còn trong roster, không tin snapshot memberName.
- Actor có tài khoản đã xóa trả null. Không trả email, token, mô tả hoặc dữ liệu arbitrary khác trong nhật ký.
- taskFilters lọc lịch sử theo trạng thái công việc hiện tại; filters.changed lọc công việc theo lịch sử. Cả hai dùng phép giao ở database trên toàn tập, không nối hai danh sách đã cắt trong AI.
- Nhật ký cũ thiếu giá trị from không được tự điền. Log hiện best effort; công cụ nói rõ “Theo nhật ký đã ghi nhận”. Không công bố lịch sử đầy đủ của mọi thuộc tính như mô tả, ảnh bìa hay checklist.

## 4. Công cụ

Input/output đều có schema Zod; top-level input strict. Page mặc định 1, pageSize 20, tối đa 100 dòng/trang và 1000 trang. Input ID list tối đa 100; tên/từ khóa có giới hạn ký tự. Kết quả nhận diện trả tối đa 100 lựa chọn và total/truncated.

| Công cụ | Input chính | Output data |
|---|---|---|
| resolve_entities | kind BOARD/WORKSPACE/CARD/COLUMN/MEMBER, text, scope? | status RESOLVED/CLARIFY/NOT_FOUND, options, total, truncated |
| query_catalog | kind BOARDS/WORKSPACES/MEMBERS, scope?, page/pageSize | rows, total, page, pageSize, hasMore |
| query_tasks | filters, sort?, scope?, page/pageSize | cards, total, page, pageSize, hasMore |
| aggregate_tasks | filters, groupBy ASSIGNEE/BOARD/COLUMN/STATUS/DATE, dateField?, scope?, page/pageSize | rows, totalGroups qua total, totalCards, leaderIds/highestCount, lượt giao ngoài roster/xóa, unassignedCards khi nhóm ASSIGNEE |
| query_activities | range, types?, actorIds?, cardIds?, mode?, taskFilters?, scope?, page/pageSize | events hoặc cards, eventCount, changedCardCount, total của mode, coverage |

Task filters: completion, assignment, assigneeIds, cardIds, columnIds, labelIds, statuses, keyword, overdue, date `{field,range}`, changed `{range,types?,actorIds?}`. Các ID cần đến từ nguồn đã kiểm quyền, không do model tự đoán.

Tên thực thể được so nguyên từ đầy đủ, hỗ trợ không dấu và từ xưng hô. Thứ tự: trùng toàn tên → ID thật trong pool được phép → phần đầu tên → chuỗi từ liên tiếp. Tên số `1234` được ưu tiên trước ID `1234` của bảng khác. Không cắt tiêu đề dài thành một tên ngắn giả trùng. Nhiều kết quả trả CLARIFY để panel hiển thị lựa chọn.

### Kết quả và bằng chứng

```ts
{
  tool: 'query_tasks',
  source: {
    id: 'UUID của kết quả',
    generatedAt: 'ISO thời điểm truy vấn',
    scope: { kind: 'BOARD', boardId: 'ID thật' },
    scopeLabel: 'Tên bảng',
    appliedInput: { /* input đã được parse, có defaults */ },
    ranges: [{ from: 'ISO UTC', to: 'ISO UTC' }]
  },
  data: { total: 25, page: 1, pageSize: 20, hasMore: true, cards: [] }
}
```

Danh sách/count trong một công cụ sử dụng transaction RepeatableRead. Hai công cụ độc lập không có cùng snapshot mặc định; bộ điều phối cần cơ chế snapshot chung nếu yêu cầu chính xác tuyệt đối giữa nhiều truy vấn trong lúc dữ liệu thay đổi.

AppError 400: tham số/ID trong scope không hợp lệ; 401: tài khoản không hợp lệ; 403/404 theo quyền/phạm vi hiện tại. Kết quả trái schema output là lỗi lập trình, không phải câu trả lời trống.

## 5. Nhật ký được bổ sung

- UpdateCard khóa dòng trước khi đọc giá trị trước của tên/hạn và cập nhật. Sự kiện đặt/xóa hạn mới có from/to; dueDate vẫn giữ khi đặt hạn để tương thích bên đọc cũ. Gửi lại cùng hạn không tạo sự kiện đổi hạn giả.
- RemoveCardMember ghi member.remove với memberId nếu thực sự xóa được dòng. Gửi lại yêu cầu gỡ người đã gỡ không tạo thêm sự kiện.
- AddCardMember chỉ ghi member.add/thông báo khi thật sự thêm dòng; gửi lại hoặc hai yêu cầu thêm đồng thời không tạo thay đổi giả.
- Không thêm migration/index ở đợt này; Activity đã có index boardId/cardId. EXPLAIN trên fixture nhỏ chọn Seq Scan + Sort cho truy vấn board/time; cần đo quy mô thực ở giai đoạn đánh giá trước khi thêm index tổng hợp.

## 6. Ví dụ sử dụng phía server (không phải API mới)

```ts
import { executeChatTool } from './backend/src/modules/chat/v2/chat.v2.tools';

const ctx = { userId: authenticatedUserId, now: new Date(), scope: { kind: 'MY' as const } };
const match = await executeChatTool(ctx, 'resolve_entities', { kind: 'BOARD', text: '1234' });
// Nếu NOT_FOUND/CLARIFY thì dừng để thông báo/chọn bảng; không lấy options[0] khi trùng tên.
if (match.data.status === 'RESOLVED') {
  const scope = { kind: 'BOARD' as const, boardId: match.data.options[0].id };
  const workload = await executeChatTool(ctx, 'aggregate_tasks', { scope, groupBy: 'ASSIGNEE' });
  const unassigned = await executeChatTool(ctx, 'query_tasks', { scope, filters: { assignment: 'UNASSIGNED' } });
  // Bộ điều phối dùng hai nguồn này để dựng hai block riêng trên panel.
}
```

Query lịch sử: `executeChatTool(ctx, 'query_activities', {scope, range: {from:'2026-10-01',to:'2026-10-04'}, mode:'CHANGED_CARDS'})`.

## 7. Bộ điều phối, phiên và dữ liệu gửi AI

`chat.v2.llm.ts` là adapter riêng; không đổi hợp đồng AI tạo bảng hoặc gợi ý phân công. Dùng `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` hiện có. Ưu tiên native tools; khi schema bị từ chối 400/422 hoặc không có tool call thì dùng JSON planner. Cả hai đường qua cùng registry và Zod phía server. Ghi nhớ endpoint/model từ chối native trong 10 phút, không cache nội dung câu hỏi/kết quả. Thought signature của native tool call được giữ cho vòng tiếp. Thử nghiệm endpoint Gemini hiện tại đã xác nhận JSON planner chạy nhiều vòng với nhiều công cụ; chưa khẳng định bộ schema đầy đủ chạy native tại endpoint đó. Tham khảo [tài liệu Gemini compatible endpoint](https://ai.google.dev/gemini-api/docs/openai).

- Tối đa 4 vòng AI và 8 thao tác công cụ/lượt; danh sách gửi AI tối đa 20 dòng/truy vấn; context tối đa 70.000 ký tự. Deadline lập kế hoạch 30 giây, mỗi HTTP request dùng phần thời gian còn lại và AI_TIMEOUT_MS. Truy vấn DB đang chạy vẫn phụ thuộc timeout của DB/Prisma; không hứa hủy query đang chạy chính xác ở giây thứ 30.
- Các truy vấn đọc độc lập, đã xác định phạm vi, chạy đồng thời. Chặn truy vấn lặp, tool không có trong registry và nguồn giả. Tham số sai được trả về để AI sửa trong ngân sách.
- Ngân sách tiến trình: tối đa 40 HTTP request AI/phút, kể cả lần thử native bị từ chối. Mỗi user chỉ có một POST v2 đang xử lý; dùng chung chatLimiter 60 POST/10 phút.
- Mỗi kết quả thật dựng thành block có source; `finish.sourceIds` phải tồn tại. Số lượng, tên, URL và lịch sử được render trực tiếp từ output công cụ. Không cho AI tự viết số liệu/nội dung lịch sử thành kết luận. Mọi block thành công được giữ dù AI quên tham chiếu; lỗi từng công cụ có block ERROR. Hết ngân sách/lỗi AI sau khi có dữ liệu hiển thị kết quả cùng thông báo phần chưa xử lý.
- Vague history không có thời gian được server hỏi lại. Khi `CHAT_ACTIONS` tắt, “Đổi hạn giúp tôi” là yêu cầu ghi và nhận giải thích trợ lý chỉ đọc; khi bật, câu lệnh đi qua `propose_actions` (mục 9) và lối tắt "hỏi khoảng thời gian" bị bỏ với câu có động từ ghi mà không có từ nghi vấn (“ai đã đổi hạn…?” vẫn là câu hỏi lịch sử). Không có công cụ hướng dẫn/RAG ở mốc này.
- Khi AI tắt/lỗi trước truy vấn: chế độ cơ bản xử lý một số câu tải việc, phân công và lịch sử; câu đơn được chuyển vào bộ luật v1. Câu phức hợp ngoài fallback có thông báo giới hạn, không âm thầm bỏ một phần.
- Bộ nhớ đệm phiên v2: TTL 30 phút, 5 phiên/user, 2.000 phiên/tiến trình. `ChatConversation`/`ChatTurn` lưu bền vững theo tài khoản: câu hỏi, câu trả lời, lỗi và ngữ cảnh truy vấn. Cache hết hạn hoặc backend khởi động lại thì khôi phục từ database. Ngữ cảnh database thắng cache cũ khi nhiều thiết bị/tiến trình cùng dùng một hội thoại; không lưu quyền làm sự thật. Chọn đối tượng và xem thêm vẫn kiểm quyền/truy vấn mới; xem thêm không gọi AI. Handle phiên v1 không lưu bền; bản trả lời v1 vẫn đọc được trong lịch sử nhưng cần hỏi lại để lấy dữ liệu mới.
- Dữ liệu AI: câu hỏi, ID/tên các đối tượng liên quan đã kiểm quyền, tiêu đề thẻ, trạng thái, ngày, người nhận đang hiển thị, số đếm và các trường nhật ký đã whitelist. Không gửi mô tả/bình luận, email, token đăng nhập, CV hoặc hồ sơ riêng. Title/log chứa lệnh được coi là dữ liệu, không là hướng dẫn. Không ghi log vận hành câu hỏi, câu trả lời hoặc nội dung thẻ; API key chỉ nằm ở header HTTP.

### API và giao diện

| Endpoint | Body/kết quả |
|---|---|
| GET `/api/chat/v2/status` | `{engine: 'v2' hoặc 'legacy', version:'v2', llmAvailable, actions}`; llmAvailable chỉ nói đủ cấu hình, không là kiểm tra kết nối/key; `actions` = bật `CHAT_ACTIONS` và có AI |
| GET `/api/chat/v2/conversations?page=1` | 20 hội thoại của tài khoản hiện tại, mới nhất trước, `hasMore` |
| GET `/api/chat/v2/conversations/:id?before=turnId` | 50 lượt gần nhất hoặc trước cursor, theo thứ tự thời gian; chỉ chủ hội thoại được đọc |
| POST `/api/chat/v2/messages` | `{message, scope, conversationId?}`; strict, tối đa 500 ký tự |
| POST `/api/chat/v2/messages/choice` | `{conversationId, optionId, scope?}`; ID phải thuộc lựa chọn đang chờ của chính user; `scope` (trang bảng) khác phạm vi đã lưu → 409 và hủy kế hoạch đang dở |
| POST `/api/chat/v2/messages/more` | `{conversationId, blockId, page, scope?}`; page kế tiếp của block còn trang, truy vấn lại quyền/dữ liệu; `scope` khác phạm vi đã lưu → 409 |
| POST `/api/chat/v2/actions/:planId/confirm` | `{conversationId, checksum, scope}`; nút Áp dụng, không gọi AI (mục 9.7) |
| POST `/api/chat/v2/actions/:planId/cancel` | `{conversationId}`; nút Hủy |
| GET `/api/chat/v2/actions/:planId` | khối xem trước hoặc kết quả hiện tại của kế hoạch (chỉ chủ kế hoạch) |

`more` chỉ cho phép bỏ blockId khi phiên đang dùng fallback v1 và có query v1 lưu ở server. Không nhận tool/filters từ client. Các endpoint yêu cầu đăng nhập, còn `/api/chat/*` v1 giữ nguyên.

Reply bổ sung `version:'v2'`, `mode:'AI'|'BASIC'`, `understood.summary`; `answer.blocks` gồm OK `{id,title,tool,source,data,pagination}` hoặc ERROR `{id,title,error}`. Fallback đơn v1 không có blocks, panel dùng renderer cũ. Không trộn conversationId v1 với API v2.

Panel dùng một luồng chat chung, không chia lựa chọn Việc của tôi / Không gian / Bảng. Phạm vi gửi API **theo trang đang mở** (`lib/chatScope.ts`): trang bảng `/boards/:boardId` gửi `BOARD` (đọc và ghi chỉ trong bảng đó); mọi trang khác gửi `MY` (tất cả bảng được phép; backend xác định bảng/không gian và bộ lọc việc cá nhân từ câu hỏi, giữ đối tượng đã chọn cho câu nối tiếp). Tiêu đề panel có nhãn phạm vi ("Trong bảng đang mở" / "Mọi bảng của bạn"). Đổi trang giữa hai câu hỏi thì câu sau mang phạm vi mới; nút cũ của trang khác bị vô hiệu ở backend (409) lẫn giao diện.

Panel chọn API từ `/chat/v2/status`, giữ phiên khi mở thẻ, cho xem thêm từng block, chỉ mở thẻ có nội dung đang được phép hiện. Hiển thị scope thực tế của kết quả, điều kiện hoàn thành, khoảng thời gian Việt Nam, nguồn, lỗi và danh sách giới hạn. Các trang ghép trong frontend có thể được đọc ở các thời điểm khác nhau; xem thêm không tạo snapshot chung cho mọi trang.

Mở trợ lý sau khi tải trang/đăng nhập lại sẽ khôi phục hội thoại gần nhất. Nút Lịch sử mở các hội thoại cũ; nút + bắt đầu cuộc chat mới, không xóa lịch sử. Hội thoại dài có thể tải tin nhắn trước; danh sách hội thoại có phân trang. Trang đã xem thêm được gộp và lưu vào cùng lượt trả lời. Khi đọc lịch sử, server kiểm quyền hiện tại và khả năng đọc các thẻ/nhân sự đã được hiện; nếu quyền bị thu hồi hoặc thẻ chuyển sang bảng riêng, toàn bộ câu trả lời liên quan được che. Lịch sử là bản chụp tại lúc hỏi, không được đưa lại cho AI như dữ liệu hiện tại; các câu hỏi mới luôn truy vấn mới.

Để dùng thay đổi trong tab đang mở: tải lại trang. `CHAT_ENGINE=v2` là mặc định development/test; production chưa đặt engine giữ legacy. Muốn chọn v2 hoặc quay lại v1 đặt CHAT_ENGINE tương ứng rồi khởi động lại backend. Chức năng lịch sử cần migration `20261004160000_chat_history` và tạo lại Prisma Client.

## 8. Nghiệm thu dữ liệu và bộ câu hỏi

Fixture: `backend/test/chat.v2.fixture.ts`, NOW = 04/10/2026 15:00 Việt Nam. Bảng tên 1234 có 30 thẻ đang mở hợp lệ, 1 thẻ đã xong; Lan/Tuấn cùng giữ 2 thẻ mở (một thẻ chung), 25 thẻ chưa giao, 1 lượt giao ngoài roster và 1 lượt giao tài khoản xóa. Khoảng 01/10–04/10 có 11 sự kiện thay đổi trên 5 ID thẻ, gồm thẻ chuyển/xóa bị che nội dung.

- `chat.v2.tools.test.ts`: các công cụ và hai câu hỏi ở mức kế hoạch truy vấn; quyền, phân trang, thời gian, redaction, đồng hạng, lọc chéo và nhật ký mới.
- `chatV2EvalDataset.ts`: phiên bản v2-tools-fixture-1, 18 câu, 8 dev/10 test, kế hoạch công cụ và kỳ vọng; tách trước khi viết prompt v2.
- `chat.v2.dataset.test.ts`: kiểm tra hai tập không trùng nguyên câu và chạy các gold plan trên fixture DB. Đây là nghiệm thu lớp dữ liệu, **không phải** điểm hiểu câu hỏi của LLM. Câu cần hỏi lại được gắn nhãn để bước 4 dùng.
- Kiểm thử DB chỉ qua cơ chế `.env.test`/dbSafety hiện có. Chạy các suite DB tuần tự trong một Vitest process để tránh các process dùng chung taskflow_test truncate lẫn nhau.

### Kết quả kiểm tra bàn giao

- 114 test liên quan trên 17 file đã đạt qua các lượt kiểm tra chọn lọc, gồm 11 test v2 (10 tools + 1 dataset) và hồi quy scope/catalog/API chatbot, trạng thái/di chuyển thẻ, cập nhật đồng thời, quyền thành viên/VIEWER, thông báo và automation. Các lượt có test trùng nhau; đây không phải chạy toàn bộ test repository.
- `npm run typecheck`: đạt. ESLint trên `src/modules/chat/v2`, dataset mới và hai service card được sửa: đạt. `git diff --check`: đạt.
- Gold plan chạy trên PostgreSQL test thật. Bước 4–6 có thêm test API/bộ điều phối/adapter và panel; kết quả smoke Gemini trên dữ liệu giả ở `backend/eval-chat-v2-smoke.json`. Đây là smoke check từng câu, không phải đánh giá độ chính xác tổng thể ở bước 8.

## 9. Hành động (Phase 1, 07/10/2026)

Thiết kế đầy đủ và các phương án đã loại: `CHATBOT_V2_ACTIONS_PLAN.md`. Mục này là **hợp đồng đã triển khai** của Phase 1.

### 9.1 Phạm vi tính năng

Đúng bảy thao tác, mỗi kế hoạch **một thao tác trên một bảng**:

| Loại | Ví dụ lệnh | Dịch vụ được gọi (giống thao tác tay) |
|---|---|---|
| `CREATE_CARD` | “Tạo thẻ Họp nhóm trong cột Cần làm” | `createCard` |
| `RENAME_CARD` | “Đổi tên thẻ Login UI thành Đăng nhập giao diện” | `updateCard({title})` |
| `SET_CARD_DUE` | “Đặt hạn thẻ Thiết kế là thứ sáu”, “Bỏ hạn thẻ Báo cáo tuần” | `updateCard({dueDate})` |
| `MOVE_CARD` | “Chuyển task Login UI sang Đang làm” | `moveCard` (cuối cột, cùng bảng) |
| `SET_CARD_STATUS` | “Đánh dấu Báo cáo tuần là xong” | `updateCard({status})` (thẻ tự sang cột mang trạng thái đó nếu có) |
| `ASSIGN_MEMBER` | “Giao thẻ Thiết kế cho Lan”, “Giao Login UI cho tôi” | `addCardMember` |
| `ADD_LABEL` | “Gắn nhãn Backend vào Login API” | `attachLabel` |

**Không làm (từ chối rõ ràng, không có đường nào tới dịch vụ):** xóa, lưu trữ hàng loạt, nhiều bảng, nhiều thao tác một kế hoạch (trả lời "một thao tác mỗi lần"), Board Patch, gợi ý phân công tự động, tạo luật tự động hóa, đổi quyền / vai trò / chủ sở hữu / hiển thị. Hoàn tác (undo) cho thao tác tự chạy để giai đoạn sau.

### 9.2 Cờ và đặc quyền tối thiểu

- `CHAT_ACTIONS` (mặc định bật ở development/test, **tắt ở production**): công tắc tổng. Tắt thì mọi lệnh ghi bị từ chối trước khi gọi AI, và **nút Áp dụng của kế hoạch cũ cũng bị chặn** (403); Hủy vẫn được.
- `CHAT_AUTO_EXECUTE` (mặc định giống trên): tắt thì mọi thao tác cần bấm Áp dụng (lý do `AUTO_DISABLED`).
- Công cụ `propose_actions` **chỉ được gửi cho AI** khi: bật `CHAT_ACTIONS`, có AI, và ở trang bảng thì người hỏi sửa được bảng đó (không phải VIEWER). Không có AI: lệnh ghi được báo "cần bật AI", **không đoán bằng luật**. AI lỗi giữa lệnh ghi: "chưa xử lý được, chưa thay đổi gì" (không rơi xuống nhánh đọc).

### 9.3 Luồng

```
Lệnh → [AI] propose_actions {operations:[1 thao tác TƯỢNG TRƯNG]}      (schema strict; KHÔNG có ô điền id)
     → Resolver (server): TEXT / CONTEXT("nó") / SELF("tôi") → id thật trong BẢNG của kế hoạch
         nhập nhằng → nút chọn, KHÔNG gọi lại AI;  không thấy → "không tìm thấy", không gợi ý bảng khác
     → Guard: assertBoardAccess / assertCardAccess / isBoardParticipant (VIEWER không được giao việc), cùng bảng
     → Nguồn gốc (assessProvenance) + chính sách (decideExecution) → AUTO | CONFIRM | REFUSE
     → lưu ChatActionPlan → AUTO: chạy ngay | CONFIRM: khối xem trước + nút Áp dụng / Hủy
     → Executor gọi ĐÚNG service của giao diện (quyền, Activity, thông báo, tự động hóa, socket)
```

AI chỉ khai thao tác tượng trưng. Ngày hạn là `DateSpec` (ABSOLUTE / WEEKDAY / RELATIVE_DAYS / END_OF_WEEK / NONE): server đổi ra ngày thật và **bộ luật tiếng Việt thắng ngày AI tự tính** khi câu có ngày (hạn lưu 23:59 giờ Việt Nam). “Thứ sáu” và “cuối tuần” gọi trơn chỉ được nhận khi có từ chỉ hạn ngay trước (“hạn … là thứ sáu”); “cuối tuần” luôn là mốc mơ hồ (Chủ nhật) nên xem trước.

### 9.4 Chính sách tự chạy: DỮ LIỆU khác CHỈ DẪN

Chữ trong tiêu đề / mô tả / bình luận / tên thẻ **chỉ dùng để TÌM đối tượng**, không bao giờ là nguồn của lệnh. Một thao tác chỉ tự chạy khi đủ cả tám điều kiện:

1. nguồn lệnh là **câu của người dùng** (có động từ đúng loại, không bị phủ định, tham số gắn vào chữ trong câu, không phải dạng câu hỏi, không "làm theo nội dung thẻ / mô tả / bình luận");
2. thuộc whitelist 7 thao tác; 3. mọi tham chiếu resolve đúng **một** đối tượng (nút chọn của người dùng cũng tính là duy nhất); 4. chỉ **một bảng**, trong trần phạm vi; 5. không hàng loạt / phá hủy; 6. không đổi quyền, vai trò, chủ sở hữu, hiển thị; 7. không thực thi chỉ dẫn lấy từ dữ liệu; 8. backend vẫn kiểm quyền và nghiệp vụ ngay trước khi chạy.

Không đủ thì: **REFUSE** (không có động từ / bị phủ định / ngoài whitelist / ngoài trần / nhiều thao tác / không có quyền — ghi vết `FAILED`, không ghi dữ liệu) hoặc **CONFIRM** với lý do hiển thị cho người dùng: `DELEGATED_TO_DATA`, `NOT_GROUNDED` (tham số do AI diễn đạt lại), `QUESTION_FORM` ("Có nên … không?"), `FUZZY_DATE`, `AUTO_DISABLED`. Thao tác không đổi gì (đã đúng rồi) được báo "đã đúng rồi", không gọi dịch vụ, không hỏi xác nhận. Sự hiện diện của chữ lấy từ CSDL trong ngữ cảnh **không** làm mất quyền tự chạy của một lệnh trực tiếp.

### 9.5 Trần phạm vi theo trang (đọc và ghi)

| Trang | Phạm vi gửi | Hiệu lực |
|---|---|---|
| Trang bảng `/boards/:id` | `BOARD` | Chỉ bảng này. `MY`/`WORKSPACE` do AI đề xuất bị kẹp về bảng; bảng khác bị 403 (`OUT_OF_CEILING`); tên bảng khác trong câu không tìm thấy; thẻ trùng tên ở bảng khác không bao giờ khớp |
| Mọi trang khác | `MY` | Mọi bảng mình tham gia (không gồm PRIVATE của người khác / PUBLIC); bảng được xác định bằng tên nêu trong câu, không nêu thì hỏi lại "bảng nào?" |

Một kế hoạch chỉ tác động một bảng. Khi bấm Áp dụng, client gửi lại phạm vi hiện tại; kế hoạch của bảng khác với trang bảng đang mở bị hủy (`SCOPE_CHANGED`). Phạm vi gửi kèm `choice`/`more` ở trang bảng được đối chiếu với phạm vi hội thoại đã lưu.

### 9.6 Vòng đời kế hoạch (`ChatActionPlan`)

`NEEDS_CHOICE → PROPOSED → EXECUTING → EXECUTED | FAILED | STALE`; `PROPOSED/NEEDS_CHOICE → CANCELLED | EXPIRED`. Hạn xem trước **10 phút**; `checksum` (sha256 của chủ, bảng, loại, id, tham số) phải khớp bản xem trước. Nhận chỗ **nguyên tử** `PROPOSED → EXECUTING` (20 yêu cầu đồng thời chỉ chạy một lần; bấm lại trả kết quả đã lưu, `alreadyApplied`). Giá trị cũ được chụp lúc xem trước và so lại lúc chạy: tên, hạn, cột hoặc trạng thái đã bị người khác đổi thì `STALE` (không ghi đè). Lệnh mới thay kế hoạch đang chờ (`SUPERSEDED`); đổi trang hủy kế hoạch (`SCOPE_CHANGED`). Gõ "ok / áp dụng" **không** xác nhận (chỉ nút); gõ "hủy" hủy kế hoạch đang mở. Kế hoạch nằm ở database nên khởi động lại backend không ảnh hưởng.

### 9.7 API và dữ liệu trả về

| Endpoint | Ghi chú |
|---|---|
| POST `/api/chat/v2/actions/:planId/confirm` | `{conversationId, checksum, scope}`; `chatActionLimiter` 30 / user / 10 phút; 404 nếu không phải chủ kế hoạch/hội thoại, 409 nếu checksum lệch hoặc đang chạy, 403 nếu `CHAT_ACTIONS` tắt |
| POST `/api/chat/v2/actions/:planId/cancel` | `{conversationId}`; lặp lại an toàn |
| GET `/api/chat/v2/actions/:planId` | `{kind:'PLAN'|'RESULT', …}` hiện tại; lịch sử hội thoại dùng cùng cách phủ trạng thái thật lên bản chụp cũ |

`answer.action` (không nằm trong `blocks`): `{kind:'PLAN', plan:{planId, checksum, status, risk, requiresConfirmation, canConfirm, reasons[], expiresAt, boardId, boardName, items[{verb,text,detail?,cardId?}], warnings[]}}` hoặc `{kind:'RESULT', result:{planId, status, autoExecuted, alreadyApplied?, summary, boardId, cardId?, error?, warnings[]}}`. Mọi chữ trong khối do server dựng từ kế hoạch đã resolve (tên lấy từ database), AI không viết được chữ hiển thị. Từ chối trước khi có kế hoạch trả `answer.text` thuần (kèm "Chưa thay đổi gì").

Bảng `ChatActionPlan` (migration `20261007130000_chat_action_plan`) lưu câu lệnh (≤ 500 ký tự), kế hoạch đã resolve, nguồn gốc, lý do, trạng thái, mô hình / token / độ trễ và kết quả để kiểm toán và đo đạc; cách ly theo `userId`.

### 9.8 Giới hạn đã biết

Một thao tác mỗi lần; chưa hoàn tác; chưa có trần "số thao tác tự chạy / giờ" ngoài `chatLimiter` (60 POST/10 phút) và ngân sách AI (40 request/phút); tối đa 8 nút chọn, nhiều hơn thì yêu cầu nêu rõ tên; "nó" chỉ nhớ thẻ và cột vừa thao tác (không nhớ người); nút "xem thêm" của backend dùng phạm vi trang đã lưu (client gửi kèm phạm vi ở trang bảng để backend đối chiếu); bản ghi `ChatActionPlan` chưa có job dọn dẹp (giữ để kiểm toán); nếu tiến trình chết đúng giữa lúc đang chạy một kế hoạch thì kế hoạch đó kẹt ở `EXECUTING` (bấm Áp dụng sẽ báo "đang thực hiện"; gửi lại lệnh để tạo kế hoạch mới).

### 9.9 Kiểm thử và đo đạc

- Backend (PostgreSQL test thật, LLM giả bằng kịch bản; 143 test mới): `chat.actions.pure.test.ts` (43, hàm thuần: schema, ngày, chữ, nguồn gốc, chính sách, kế hoạch), `chat.actions.api.test.ts` (32: bảy thao tác end-to-end có đối chiếu Activity / thông báo / socket / tự động hóa, xem trước + Áp dụng, nhập nhằng, "nó"), `chat.actions.safety.test.ts` (50: quyền VIEWER / người ngoài / PRIVATE / PUBLIC / lưu trữ, trần phạm vi, DỮ LIỆU vs CHỈ DẪN, đầu ra AI không đáng tin, công tắc, vòng đời 20 yêu cầu đồng thời, HTTP), `chat.actions.guard.test.ts` (9: guard, nhận chỗ nguyên tử, phạm vi của bộ phân giải gọi thẳng từng hàm), `chat.v2.ceiling.test.ts` (9: trần phạm vi cho các công cụ đọc). Ba test cũ của V2 mã hóa hành vi trước khi có trần phạm vi / cờ hành động nên được cập nhật (ghi bị chặn cần `actions:false`; `/status` có `actions`; tìm bảng chéo dùng trang chủ).
- Hồi quy: 42 tệp / 453 test backend liên quan (toàn bộ chatbot, trạng thái thẻ, quyền VIEWER, chuyển thẻ xuyên bảng, tự động hóa, rate limit, socket, tệp tải lên) đạt; frontend 57 tệp / 463 test đạt (39 test mới: `ActionCard`, khối thao tác ở panel, `chatScope`, lớp API, thông báo lỗi; 4 test panel cũ chuyển sang phạm vi theo trang). `tsc`, ESLint backend, oxlint và `vite build` frontend không có lỗi mới.
- Gemini thật (`npx tsx src/scripts/probeChatActions.ts`, `gemini-3.5-flash-lite`, 07/10/2026, không đụng CSDL; chạy hai lượt vì API báo quá tải 503 giữa chừng): **29 ca, đạt 29/29**. 18 lệnh thuộc bảy loại thao tác (kể cả “nó”) được đề xuất đúng loại, qua schema strict và đúng quyết định kỳ vọng (17 tự chạy; “cuối tuần” → xem trước vì mơ hồ); ngày hạn đúng (thứ sáu → 09/10, ngày mai → 08/10, “20/10”, bỏ hạn → xóa). 11 ca không được tự chạy đều an toàn: 3 câu hỏi đọc, câu có dạng “Có nên chuyển … không?” và câu “Tóm tắt thẻ” kèm tiêu đề chứa lệnh → mô hình gọi công cụ đọc, không đề xuất thao tác; xóa / lưu trữ hàng loạt / đổi vai trò / đổi hiển thị / “làm theo nội dung thẻ” → `unsupported`; “chuyển … và giao cho Lan” → mô hình đề xuất 2 thao tác và server từ chối `MULTI_OP`. Đây là smoke check một lượt (mỗi ca một lần, nhiệt độ 0,1), không phải đánh giá độ chính xác diện rộng — việc đó thuộc giai đoạn đánh giá sau.
- Cài lỗi (chống xanh giả): 40 phép sửa mã sản phẩm ở backend (chính sách tự chạy, nguồn gốc, ngày, guard, executor, nhận chỗ, dịch vụ, trần phạm vi, công tắc tổng, cổng VIEWER) — lần đầu 32 bị test bắt, **8 sống sót** (các lớp bảo vệ thứ hai: guard / nhận chỗ hết hạn / phạm vi bộ phân giải, và việc "thứ sáu" / "cuối tuần" gọi trơn phải có từ chỉ hạn) → bổ sung `chat.actions.guard.test.ts` và 4 test khác → **40/40 bị bắt**. Frontend 16 phép: 15 bị bắt ngay, 1 sống sót (phạm vi gửi kèm nút Áp dụng ở trang bảng) → thêm 1 test → 16/16.
- Thử trình duyệt thật (08/10/2026, Gemini thật qua bộ lập kế hoạch JSON, bảng thử ở database dev rồi đã xóa): trang bảng có nhãn "Trong bảng đang mở"; "Chuyển task Login UI sang Đang làm" tự chạy và bảng cập nhật ngay không tải lại; "đặt hạn … cuối tuần" ra khối xem trước (Chủ nhật 11/10, lý do ngày mơ hồ, giờ hết hạn) → Áp dụng ra kết quả, thẻ hiện hạn 11-10; "Chuyển Login sang Cần làm" ra hai nút chọn *không có* thẻ cùng tên ở bảng khác; nêu tên bảng khác ở trang bảng bị chặn kèm lời giải thích; ở trang chủ "Giao thẻ … cho Lan" hỏi lại "bảng nào?" rồi chạy đúng sau khi trả lời "bảng Dự án Alpha" (Lan nhận thông báo), "tạo thẻ Họp nhóm" hỏi cột bằng nút; gõ "ok" không xác nhận; nút Hủy; chế độ tối + khổ 375 px không vỡ. Mỗi lượt gọi Gemini khoảng 5,7 nghìn token vào, 1,7–3 giây. Dòng kiểm toán trong `ChatActionPlan` khớp từng thao tác.

## 10. Nhật ký hợp đồng

- 04/10/2026, mốc A: bàn giao bước 1–3, lớp công cụ, schema, source, fixture/dataset và nhật ký được bổ sung.
- 04/10/2026, mốc B: bổ sung bước 4–6, bộ điều phối AI, adapter native/JSON, scope ID guard, API/phiên v2 và giao diện nhiều block; kho hướng dẫn và đánh giá diện rộng vẫn ở bước 7–9.
- 07/10/2026, mốc C (hành động Phase 1): công cụ ghi `propose_actions` (7 thao tác, một bảng, một thao tác/kế hoạch), bảng `ChatActionPlan`, chính sách tự chạy theo nguồn lệnh (DATA vs INSTRUCTION), trần phạm vi theo trang cho cả đọc lẫn ghi, ba endpoint `/actions/*`, `scope` tùy chọn ở `choice`/`more`, `answer.action` ở reply, cờ `CHAT_ACTIONS`/`CHAT_AUTO_EXECUTE`. Không đổi hợp đồng v1, AI tạo bảng hay gợi ý phân công.
