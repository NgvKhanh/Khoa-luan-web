# -*- coding: utf-8 -*-
"""
Dựng Chương 3 (Phân tích và thiết kế hệ thống TaskFlow) + Phụ lục A rồi chèn vào tệp khóa luận gốc.

Chạy:  python tao_chuong3.py [đường_dẫn_tệp_gốc.docx] [đường_dẫn_tệp_ra.docx]
  - mặc định đọc  C:/Users/Admin/Downloads/Khoa_luan_NguyenVanKhanh_11236129_Chuong1-2.docx
  - mặc định ghi  ../bao-cao/Khoa_luan_NguyenVanKhanh_11236129_Chuong1-3.docx
Sau đó chạy:  powershell -ExecutionPolicy Bypass -File cap_nhat_trang_word.ps1   (Word cập nhật mục lục, điền số trang
danh mục bảng/hình, xuất PDF để xem trước).
Trước đó phải sinh hình:  use-case/ (python ve_use_case.py; node chup_png.js)  và  bieu-do/ (python ve_bieu_do.py).

Cách chèn: chỉ thay ĐÚNG các đoạn giữ chỗ của mẫu (khối "CHƯƠNG 3. THIẾT KẾ HỆ THỐNG" + các đề mục mẫu,
khối "Phụ lục A", mục "Bảng 3.1 / Hình 3.1" trong danh mục), thêm từ viết tắt, sửa tên Chương 3 ở mục 1.6 và
tiểu kết Chương 2. Mọi phần khác của tệp giữ nguyên từng byte. Định dạng (đề mục, chú thích, bảng) sao chép từ
chính các đoạn của Chương 1-2.
"""
import json
import os
import re
import struct
import sys
import zipfile
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else "C:/Users/Admin/Downloads/Khoa_luan_NguyenVanKhanh_11236129_Chuong1-2.docx"
DST = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "..", "bao-cao", "Khoa_luan_NguyenVanKhanh_11236129_Chuong1-3.docx")
UC = os.path.join(HERE, "use-case")
BD = os.path.join(HERE, "bieu-do")

TEXT_W_CM = 15.0      # bề rộng vùng chữ của mẫu: A4, lề trái 3,5 cm, lề phải 2,5 cm
MAX_H_CM = 22.0
CM_PER_PX = 0.0212    # 1 px của hình ~ 0,6 pt khi in (giữ cỡ chữ trong hình đồng đều)
EMU_PER_CM = 360000

# ============================ NỘI DUNG ============================
# Khối: ("h1"|"h2"|"h3", text) | ("p", text) | ("li", text) | ("fig", key, path, caption) | ("tbl", key, caption, header, rows, widths)
#       ("spec", key, caption, rows)   - bảng 2 cột đặc tả use case
# Chữ đậm **...**, nghiêng __...__. Tham chiếu {H:key} / {B:key} được thay bằng "Hình 3.x" / "Bảng 3.x".

spec_uc = json.load(open(os.path.join(UC, "spec.json"), encoding="utf-8"))
UC_BY_KEY = {d["key"]: d for d in spec_uc}

C = []


def h1(t): C.append(("h1", t))
def h2(t): C.append(("h2", t))
def h3(t): C.append(("h3", t))
def p(t): C.append(("p", t))
def li(t): C.append(("li", t))
def fig(key, path, cap): C.append(("fig", key, path, cap))
def tbl(key, cap, header, rows, widths): C.append(("tbl", key, cap, header, rows, widths))
def spec(key, cap, rows): C.append(("spec", key, cap, rows))


def ucfig(key, cap):
    fig(key, os.path.join(UC, "png", key + ".png"), cap)


def bdfig(key, cap):
    fig(key, os.path.join(BD, "png", key + ".png"), cap)


h1("CHƯƠNG 3. PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG TASKFLOW")
p("Chương này trình bày phân tích và thiết kế của TaskFlow, nền tảng quản lý công việc theo mô hình Kanban mà hai cơ chế hỗ "
  "trợ quyết định của khóa luận được tích hợp vào. Nội dung đi từ phân tích yêu cầu, mô hình hóa chức năng bằng biểu đồ use "
  "case và biểu đồ hoạt động, đến kiến trúc tổng thể, thiết kế cơ sở dữ liệu, biểu đồ trình tự của các luồng chính, cơ chế "
  "phân quyền, cơ chế cập nhật thời gian thực và vị trí của các thành phần AI trong kiến trúc. Như đã nêu ở mục 1.5, các chức "
  "năng quản lý công việc là nền tảng triển khai chứ không phải đóng góp nghiên cứu, vì vậy chúng được trình bày ở mức đủ để "
  "hiểu môi trường hoạt động của hai cơ chế; thiết kế bên trong của module sinh bảng và module gợi ý phân công được trình bày "
  "ở Chương 4.")

# ---------------- 3.1 ----------------
h2("3.1. Phân tích yêu cầu")
h3("3.1.1. Các tác nhân của hệ thống")
p("TaskFlow không có vai trò quản trị viên toàn hệ thống. Mọi quyền quản trị đều gắn với một không gian làm việc hoặc một bảng "
  "cụ thể: cùng một người có thể là chủ sở hữu ở bảng này nhưng chỉ là người xem ở bảng khác. Vì vậy, các tác nhân chính được "
  "xác định theo vai trò của người dùng trong ngữ cảnh đang thao tác và được tổ chức theo quan hệ tổng quát hóa: tác nhân có "
  "vai trò cao hơn kế thừa toàn bộ chức năng của tác nhân có vai trò thấp hơn. Bên cạnh đó, hệ thống làm việc với một số hệ "
  "thống bên ngoài và một tiến trình chạy ngầm, được mô hình hóa thành tác nhân phụ. Các tác nhân được tổng hợp trong {B:tacnhan}.")
tbl("tacnhan", "Các tác nhân của hệ thống TaskFlow", ["STT", "Tác nhân", "Loại", "Mô tả"], [
    ["1", "Khách", "Chính", "Người truy cập chưa đăng nhập; chỉ đăng ký, đăng nhập và xem bảng ở chế độ công khai."],
    ["2", "Người dùng", "Chính", "Người đã đăng nhập. Mọi tác nhân chính bên dưới đều là Người dùng."],
    ["3", "Thành viên không gian", "Chính", "Người thuộc một không gian làm việc (vai trò MEMBER trở lên)."],
    ["4", "Quản trị viên không gian", "Chính", "Vai trò ADMIN hoặc OWNER của không gian; quản lý thành viên, tên không gian và trọng số phân công."],
    ["5", "Chủ sở hữu không gian", "Chính", "Vai trò OWNER của không gian; được chuyển quyền sở hữu và xóa không gian."],
    ["6", "Người xem bảng", "Chính", "Vai trò VIEWER của bảng; chỉ xem, theo dõi, đặt nhắc hạn và xuất dữ liệu."],
    ["7", "Thành viên bảng", "Chính", "Vai trò MEMBER trở lên của bảng, hoặc thành viên không gian khi bảng ở chế độ hiển thị Không gian làm việc; được thêm và sửa nội dung bảng."],
    ["8", "Quản trị viên bảng", "Chính", "Vai trò ADMIN hoặc OWNER của bảng, hoặc OWNER/ADMIN của không gian chứa bảng; quản lý thành viên và chế độ hiển thị."],
    ["9", "Chủ sở hữu bảng", "Chính", "Người tạo hoặc được chuyển quyền sở hữu bảng; được lưu trữ và xóa bảng."],
    ["10", "Google", "Phụ (hệ thống ngoài)", "Xác thực người dùng khi đăng nhập bằng tài khoản Google."],
    ["11", "Dịch vụ email", "Phụ (hệ thống ngoài)", "Máy chủ SMTP gửi email xác minh, đặt lại mật khẩu, lời mời, nhắc hạn và email tổng hợp."],
    ["12", "Unsplash", "Phụ (hệ thống ngoài)", "Cung cấp thư viện ảnh nền cho bảng."],
    ["13", "Dịch vụ AI (Gemini)", "Phụ (hệ thống ngoài)", "Mô hình ngôn ngữ lớn dùng cho module sinh bảng và trợ lý ảo; hệ thống vẫn hoạt động khi chưa cấu hình."],
    ["14", "Bộ lập lịch", "Phụ (tiến trình hệ thống)", "Tiến trình định kỳ trong máy chủ: quét nhắc hạn mỗi phút, tạo thẻ định kỳ mỗi 5 phút, kiểm tra email tổng hợp mỗi 15 phút."],
], [700, 2100, 1700, 4000])

h3("3.1.2. Yêu cầu chức năng")
p("Từ phạm vi đề tài và các luồng nghiệp vụ của nền tảng, yêu cầu chức năng được chia thành 13 nhóm, mỗi nhóm tương ứng với "
  "một use case tổng quát ở mục 3.2. {B:chucnang} tóm tắt các nhóm, tác nhân chính và nội dung của từng nhóm. Hai nhóm UC11 và "
  "UC12 là nơi tích hợp hai cơ chế hỗ trợ quyết định của khóa luận; nhóm UC13 (trợ lý ảo) là chức năng tiện ích của sản "
  "phẩm, không thuộc phạm vi nghiên cứu.")
ACT = {"UC01": "Khách, Người dùng", "UC02": "Khách", "UC03": "Người dùng",
       "UC04": "Thành viên, Quản trị viên, Chủ sở hữu không gian", "UC05": "Người dùng, Người xem bảng, Thành viên bảng, Chủ sở hữu bảng",
       "UC06": "Người dùng, Quản trị viên bảng, Chủ sở hữu bảng", "UC07": "Người xem bảng, Thành viên bảng",
       "UC08": "Người xem bảng, Thành viên bảng", "UC09": "Người dùng", "UC10": "Người dùng, Bộ lập lịch", "UC11": "Người dùng",
       "UC12": "Thành viên bảng, Quản trị viên bảng, Quản trị viên không gian", "UC13": "Người dùng"}
rows = []
for u in sorted(UC_BY_KEY["uc00_tong_quat"]["useCases"], key=lambda x: x["code"]):
    rows.append([u["code"], u["name"], ACT[u["code"]], u["desc"]])
tbl("chucnang", "Các nhóm chức năng của hệ thống", ["Mã", "Nhóm chức năng", "Tác nhân chính", "Nội dung chính"], rows,
    [850, 2050, 2200, 3400])

h3("3.1.3. Yêu cầu phi chức năng")
p("Bên cạnh các chức năng, hệ thống phải đáp ứng các yêu cầu về bảo mật, tính toàn vẹn, khả năng cộng tác, độ tin cậy của "
  "thành phần AI và khả năng bảo trì. {B:phichucnang} liệt kê các yêu cầu này cùng cách thiết kế đáp ứng; các mục được dẫn "
  "chiếu trình bày chi tiết ở phần sau của chương.")
tbl("phichucnang", "Yêu cầu phi chức năng và cách đáp ứng", ["Mã", "Yêu cầu", "Cách đáp ứng trong thiết kế"], [
    ["NF1", "Bảo mật xác thực: mật khẩu không lưu dạng rõ, phiên đăng nhập thu hồi được ngay.",
     "Băm mật khẩu bằng bcrypt; JWT đặt trong cookie httpOnly (SameSite=Lax, hạn 7 ngày); trường tokenVersion tăng khi đổi hoặc đặt lại mật khẩu để vô hiệu mọi phiên và kết nối thời gian thực cũ; giới hạn số lần đăng nhập."],
    ["NF2", "Phân quyền: mọi thao tác được kiểm tra quyền ở máy chủ, không dựa vào giao diện.",
     "Các hàm kiểm tra quyền dùng chung ở tầng nghiệp vụ, áp dụng cho API, tệp đính kèm và phòng Socket.IO (mục 3.7)."],
    ["NF3", "Toàn vẹn dữ liệu: thao tác nhiều bước không để lại trạng thái dở dang.",
     "Giao dịch cơ sở dữ liệu cho di chuyển thẻ và áp dụng kế hoạch AI; xóa mềm và lưu trữ thay cho xóa cứng; kế hoạch AI chỉ áp dụng được một lần (mục 3.5, 3.6)."],
    ["NF4", "Kiểm tra dữ liệu đầu vào.",
     "Lược đồ Zod cho dữ liệu gửi lên mọi API; kiểm tra loại tệp theo nội dung thật và giới hạn kích thước tệp."],
    ["NF5", "Phản hồi nhanh và cộng tác nhiều người trên cùng một bảng.",
     "Cập nhật lạc quan trên giao diện kèm hoàn tác khi lỗi; sự kiện Socket.IO theo phòng của bảng (mục 3.8)."],
    ["NF6", "Chống lạm dụng và kiểm soát chi phí gọi dịch vụ.",
     "Giới hạn tần suất cho đăng nhập, đăng ký, quên mật khẩu, sinh bảng AI, gợi ý phân công, tải CV và trợ lý ảo."],
    ["NF7", "Độ tin cậy của thành phần AI: hệ thống không phụ thuộc vào việc LLM luôn sẵn sàng; kết quả AI luôn qua bước duyệt của con người.",
     "Tầng luật luôn chạy, LLM là tùy chọn có thời gian chờ; đầu ra kiểm tra theo lược đồ; bước xem trước bắt buộc; gợi ý phân công không tự giao việc (mục 3.9)."],
    ["NF8", "Khả năng giải thích và truy vết.",
     "Thẻ sinh ra gắn dòng nguồn; gợi ý kèm điểm thành phần, độ tin cậy và thẻ bằng chứng; nhật ký AiRun, AssignRun, Activity."],
    ["NF9", "Khả năng bảo trì, kiểm thử và triển khai.",
     "TypeScript ở cả hai phía; tổ chức mã theo module; kiểm thử tự động bằng Vitest, Supertest, Testing Library với cơ sở dữ liệu kiểm thử riêng; máy chủ và PostgreSQL chạy bằng Docker Compose."],
], [800, 3000, 4700])

# ---------------- 3.2 ----------------
h2("3.2. Mô hình hóa chức năng bằng biểu đồ use case")
p("Các biểu đồ use case dùng bốn loại quan hệ của UML: liên kết giữa tác nhân và use case; «include» khi use case cơ sở luôn "
  "thực hiện use case được bao hàm; «extend» khi use case mở rộng chỉ xảy ra khi thỏa điều kiện; và tổng quát hóa giữa các tác "
  "nhân. Tác nhân là hệ thống bên ngoài được vẽ dưới dạng hộp có nhãn «hệ thống ngoài». Mã use case tổng quát có dạng UCxx, mã "
  "use case con có dạng UCxx.y; danh sách đầy đủ các use case con kèm mô tả được trình bày ở Phụ lục A.")
h3("3.2.1. Biểu đồ use case tổng quát")
p("{H:uc00_tong_quat} là biểu đồ use case tổng quát của hệ thống. Ở mức này, mọi người dùng đã đăng nhập được gộp thành tác "
  "nhân Người dùng; quyền cụ thể theo vai trò trong không gian và trong bảng được thể hiện ở các biểu đồ phân rã. Các dịch vụ "
  "bên ngoài (Google, dịch vụ email, Unsplash, dịch vụ AI) và bộ lập lịch được xem là phần bên trong hệ thống nên không vẽ ở "
  "biểu đồ tổng quát. Cần lưu ý không phải Người dùng nào cũng thực hiện được mọi thao tác trong một use case: chẳng hạn chỉ "
  "Quản trị viên bảng được duyệt yêu cầu tham gia và chỉ Chủ sở hữu bảng được xóa bảng.")
ucfig("uc00_tong_quat", "Biểu đồ use case tổng quát của hệ thống TaskFlow")

h3("3.2.2. Phân rã các use case")
p("Mỗi use case tổng quát được phân rã thành một biểu đồ; hai use case Quản lý bảng (UC05) và Quản lý thẻ công việc (UC08) có "
  "nhiều chức năng con nên được tách thành hai phần.")
p("{H:uc01_xac_thuc} phân rã UC01. Khách có thể đăng ký bằng email hoặc đăng nhập bằng email và mật khẩu; đăng nhập bằng Google "
  "là phần mở rộng của đăng nhập, và nếu email chưa có tài khoản thì hệ thống tự tạo tài khoản cùng không gian làm việc cá nhân. "
  "Đăng ký, quên mật khẩu và gửi lại email xác minh cần đến dịch vụ email. Việc chưa xác minh email không chặn đăng nhập mà chỉ "
  "hiển thị lời nhắc.")
ucfig("uc01_xac_thuc", "Biểu đồ use case phân rã: Xác thực tài khoản (UC01)")
p("{H:uc02_cong_khai} phân rã UC02. Bảng ở chế độ Công khai có thể được xem qua đường dẫn mà không cần đăng nhập, ở chế độ chỉ "
  "đọc tuyệt đối: không kéo-thả, không bình luận, email của các thành viên được ẩn.")
ucfig("uc02_cong_khai", "Biểu đồ use case phân rã: Xem bảng công khai (UC02)")
p("{H:uc03_tai_khoan} phân rã UC03: Người dùng xem và cập nhật hồ sơ, đổi ảnh đại diện, đổi mật khẩu và chọn giao diện sáng "
  "hoặc tối. Khi đổi mật khẩu, mọi phiên đăng nhập và kết nối thời gian thực cũ của người dùng bị thu hồi.")
ucfig("uc03_tai_khoan", "Biểu đồ use case phân rã: Quản lý tài khoản cá nhân (UC03)")
p("{H:uc04_khong_gian} phân rã UC04 theo ba vai trò trong không gian. Thành viên xem tổng quan, danh sách thành viên và có thể "
  "tự rời không gian; Quản trị viên quản lý thành viên và vai trò, có thể mời qua email người chưa có tài khoản; chỉ Chủ sở hữu "
  "được chuyển quyền sở hữu và xóa không gian. Không gian cá nhân không thể bị xóa hay chuyển quyền sở hữu.")
ucfig("uc04_khong_gian", "Biểu đồ use case phân rã: Quản lý không gian làm việc (UC04)")
p("{H:uc05a_bang} và {H:uc05b_cau_hinh_tu_dong_hoa} phân rã UC05. Phần thứ nhất gồm các thao tác trên bảng, chia theo vai trò: "
  "Người dùng tạo bảng (trống hoặc từ mẫu); Người xem bảng xem nội dung, lọc, thống kê, xem nhật ký hoạt động, theo dõi và xuất "
  "bảng ra tệp JSON; Thành viên bảng sửa tên, đổi hình nền (có thể chọn ảnh từ Unsplash), đánh dấu sao, lưu thành mẫu và quản "
  "lý mục đã lưu trữ; Chủ sở hữu bảng lưu trữ hoặc xóa bảng.")
ucfig("uc05a_bang", "Biểu đồ use case phân rã: Quản lý bảng, phần 1 - thao tác trên bảng (UC05)")
p("Phần thứ hai gồm các cấu hình dùng chung của bảng: nhãn, trường tùy chỉnh, mẫu thẻ, luật tự động hóa và lịch tạo thẻ định "
  "kỳ. Luật tự động hóa có dạng “khi … thì …” với hai loại điều kiện (thẻ được tạo, thẻ được chuyển vào một danh sách) và tối "
  "đa năm hành động (đánh dấu hoàn thành, gắn nhãn, giao thành viên); luật không có hành động di chuyển hay tạo thẻ để tránh "
  "vòng lặp vô hạn giữa các luật. Bộ lập lịch kiểm tra định kỳ để tạo thẻ theo lịch đã đặt.")
ucfig("uc05b_cau_hinh_tu_dong_hoa", "Biểu đồ use case phân rã: Quản lý bảng, phần 2 - cấu hình và tự động hóa (UC05)")
p("{H:uc06_chia_se} phân rã UC06. Người dùng nhận được liên kết mời có thể xem trước bảng và gửi yêu cầu tham gia. Quản trị viên "
  "bảng mời thành viên theo email (gửi email kèm liên kết nếu người được mời chưa có tài khoản), quản lý liên kết mời, duyệt "
  "yêu cầu, đổi vai trò, xóa thành viên và đổi chế độ hiển thị của bảng (Riêng tư, Không gian làm việc, Công khai); chỉ Chủ sở "
  "hữu bảng được chuyển quyền sở hữu.")
ucfig("uc06_chia_se", "Biểu đồ use case phân rã: Chia sẻ và phân quyền bảng (UC06)")
p("{H:uc07_danh_sach} phân rã UC07. Mỗi danh sách có thể gắn một trạng thái công việc (Chưa làm, Đang làm, Chờ duyệt, Hoàn "
  "thành, Bị chặn) hoặc để tự do. Khi gắn trạng thái cho danh sách hoặc chuyển toàn bộ thẻ sang danh sách khác, hệ thống luôn "
  "đồng bộ trạng thái của các thẻ theo danh sách chứa chúng, thể hiện bằng quan hệ «include».")
ucfig("uc07_danh_sach", "Biểu đồ use case phân rã: Quản lý danh sách công việc (UC07)")
p("{H:uc08a_the} và {H:uc08b_cong_tac} phân rã UC08. Phần thứ nhất gồm các thao tác trên thẻ. Trạng thái của thẻ và danh sách "
  "chứa thẻ được giữ đồng bộ hai chiều: thẻ được kéo vào danh sách có trạng thái sẽ nhận trạng thái đó; ngược lại, đổi trạng "
  "thái của thẻ sẽ chuyển thẻ sang danh sách mang trạng thái tương ứng nếu bảng có danh sách như vậy. Khi thêm hoặc di chuyển "
  "thẻ, các luật tự động hóa phù hợp được thực thi (quan hệ «extend»).")
ucfig("uc08a_the", "Biểu đồ use case phân rã: Quản lý thẻ công việc, phần 1 - thao tác trên thẻ (UC08)")
p("Phần thứ hai gồm các thao tác cộng tác trong cửa sổ chi tiết thẻ: giao người phụ trách, gắn nhãn, nhập trường tùy chỉnh, "
  "quản lý checklist (giao người và đặt hạn cho từng mục, chuyển mục thành thẻ), đính kèm tệp, bình luận có nhắc tên và trả "
  "lời bình luận theo luồng một cấp.")
ucfig("uc08b_cong_tac", "Biểu đồ use case phân rã: Quản lý thẻ công việc, phần 2 - cộng tác trên thẻ (UC08)")
p("{H:uc09_tra_cuu} phân rã UC09: tìm kiếm nhanh trên thanh tiêu đề, tìm kiếm nâng cao xuyên bảng với bộ lọc có thể lưu lại, "
  "xem các thẻ được giao cho mình, lịch công việc theo tháng hoặc tuần (cho phép kéo-thả để đổi hạn), bảng điều khiển cá nhân "
  "và nhật ký hoạt động của bản thân. Mọi kết quả chỉ gồm các bảng mà người dùng có quyền xem.")
ucfig("uc09_tra_cuu", "Biểu đồ use case phân rã: Tra cứu và theo dõi công việc (UC09)")
p("{H:uc10_thong_bao} phân rã UC10. Thông báo được tạo khi có sự kiện liên quan đến người dùng và được đẩy ngay qua Socket.IO. "
  "Bộ lập lịch đảm nhận hai use case chạy ngầm: gửi nhắc hạn theo các mốc người dùng đã đặt và gửi email tổng hợp hằng ngày "
  "cho người đã bật tùy chọn.")
ucfig("uc10_thong_bao", "Biểu đồ use case phân rã: Quản lý thông báo (UC10)")
p("{H:uc11_ai_sinh_bang} phân rã UC11, use case tích hợp module sinh bảng. Đầu vào là văn bản gõ trực tiếp hoặc tệp DOCX/PDF; "
  "với tệp, máy chủ trích xuất chữ và dùng thẳng nội dung tệp. Bước sinh kế hoạch luôn bao hàm phân tích bằng bộ luật, còn việc "
  "gọi mô hình ngôn ngữ lớn là phần mở rộng chỉ xảy ra khi đã cấu hình. Kế hoạch phải qua bước xem và chỉnh sửa trước khi được "
  "áp dụng để tạo bảng, và mỗi kế hoạch chỉ áp dụng được một lần.")
ucfig("uc11_ai_sinh_bang", "Biểu đồ use case phân rã: Sinh bảng tự động bằng AI (UC11)")
p("{H:uc12_phan_cong} phân rã UC12, use case tích hợp module gợi ý phân công. Thành viên bảng xem danh sách người phù hợp cho "
  "một thẻ hoặc lập kế hoạch chia các thẻ chưa có người nhận của cả danh sách; cả hai đều bao hàm bước tính điểm và xếp hạng "
  "ứng viên. Khi thành viên giao thẻ theo gợi ý, lựa chọn được ghi nhận để học trọng số. Mỗi người dùng tự khai hồ sơ năng lực, "
  "CV và hồ sơ làm việc (số thẻ làm song song tối đa, thời gian tạm nghỉ); Quản trị viên không gian điều chỉnh hoặc đặt lại "
  "trọng số; Quản trị viên bảng được xem CV của thành viên khi chủ CV cho phép dùng hồ sơ cho gợi ý.")
ucfig("uc12_phan_cong", "Biểu đồ use case phân rã: Gợi ý phân công công việc (UC12)")
p("{H:uc13_tro_ly} phân rã UC13. Trợ lý ảo là chức năng tiện ích, không thuộc hai cơ chế nghiên cứu. Người dùng đặt câu hỏi bằng "
  "ngôn ngữ tự nhiên trong phạm vi trang đang mở; mô hình ngôn ngữ hiểu câu hỏi và chọn công cụ truy vấn, còn việc truy vấn dữ "
  "liệu do máy chủ thực hiện với quyền được kiểm tra lại ở mỗi lượt, nên trợ lý không thể trả lời bằng dữ liệu nằm ngoài quyền "
  "của người hỏi.")
ucfig("uc13_tro_ly", "Biểu đồ use case phân rã: Hỏi đáp với trợ lý ảo (UC13)")

h3("3.2.3. Đặc tả một số use case chính")
p("Mục này đặc tả sáu use case tiêu biểu: ba use case nền tảng (đăng nhập, di chuyển thẻ, mời thành viên vào bảng) và ba use "
  "case gắn với hai cơ chế hỗ trợ quyết định (sinh kế hoạch bảng, áp dụng kế hoạch, xem gợi ý và giao thẻ). Các use case còn "
  "lại có luồng xử lý tương tự và được mô tả ngắn trong Phụ lục A.")
spec("dt_dangnhap", "Đặc tả use case UC01.1 Đăng nhập", [
    ("Mã, tên", ["UC01.1 - Đăng nhập"]),
    ("Tác nhân", ["Khách"]),
    ("Mô tả", ["Khách đăng nhập bằng email và mật khẩu để sử dụng các chức năng cần xác thực."]),
    ("Tiền điều kiện", ["Khách đã có tài khoản đăng ký bằng email và mật khẩu."]),
    ("Luồng chính", ["1. Khách mở trang đăng nhập, nhập email và mật khẩu, bấm “Đăng nhập”.",
                     "2. Hệ thống kiểm tra giới hạn số lần thử và định dạng dữ liệu.",
                     "3. Hệ thống tìm tài khoản theo email và so khớp mật khẩu với giá trị băm đã lưu.",
                     "4. Hệ thống tạo JWT chứa mã người dùng và tokenVersion, đặt vào cookie httpOnly có hạn 7 ngày.",
                     "5. Hệ thống chuyển người dùng về trang đang xem trước đó hoặc trang chủ."]),
    ("Luồng thay thế, ngoại lệ", ["2a. Vượt quá số lần thử cho phép: hệ thống từ chối tạm thời và yêu cầu thử lại sau.",
                                  "3a. Email không tồn tại hoặc sai mật khẩu: hệ thống báo “Email hoặc mật khẩu không đúng”, không tiết lộ email có tồn tại hay không; quay lại bước 1.",
                                  "3b. Tài khoản chỉ đăng nhập bằng Google (không có mật khẩu): hệ thống hướng dẫn dùng nút “Đăng nhập với Google”."]),
    ("Hậu điều kiện", ["Trình duyệt giữ cookie phiên; các yêu cầu tiếp theo và kết nối Socket.IO được xác thực bằng cookie này."]),
])
spec("dt_dichuyen", "Đặc tả use case UC08.6 Di chuyển thẻ", [
    ("Mã, tên", ["UC08.6 - Di chuyển thẻ"]),
    ("Tác nhân", ["Thành viên bảng"]),
    ("Mô tả", ["Di chuyển thẻ trong cùng danh sách, sang danh sách khác hoặc sang bảng khác bằng kéo-thả."]),
    ("Tiền điều kiện", ["Đã đăng nhập; có quyền sửa bảng chứa thẻ và bảng chứa danh sách đích."]),
    ("Luồng chính", ["1. Thành viên kéo thẻ và thả vào vị trí mới.",
                     "2. Giao diện hiển thị ngay vị trí mới và lưu ảnh chụp trạng thái cũ.",
                     "3. Hệ thống kiểm tra quyền sửa ở bảng nguồn và bảng đích.",
                     "4. Trong một giao dịch, hệ thống cập nhật danh sách và vị trí của thẻ, đánh lại vị trí các thẻ còn lại ở danh sách nguồn và đích.",
                     "5. Nếu thẻ sang danh sách khác có gắn trạng thái, hệ thống đổi trạng thái của thẻ theo danh sách đó.",
                     "6. Hệ thống ghi nhật ký hoạt động, gửi thông báo cho người phụ trách và người theo dõi, chạy các luật tự động “thẻ được chuyển vào danh sách”.",
                     "7. Hệ thống phát sự kiện board:lists-changed để màn hình của các thành viên khác tự cập nhật."]),
    ("Luồng thay thế, ngoại lệ", ["1a. Thả lại trong cùng danh sách: chỉ cập nhật thứ tự, không đổi trạng thái, không ghi nhật ký di chuyển.",
                                  "3a. Không có quyền: hệ thống trả lỗi, giao diện hoàn tác về vị trí cũ và báo lỗi.",
                                  "4a. Chuyển sang bảng khác: hệ thống gỡ nhãn và giá trị trường tùy chỉnh thuộc bảng cũ, gỡ người phụ trách không phải thành viên của bảng đích."]),
    ("Hậu điều kiện", ["Thẻ nằm ở vị trí mới với trạng thái đồng bộ theo danh sách; mọi người đang mở bảng thấy cùng một trạng thái."]),
])
spec("dt_moi", "Đặc tả use case UC06.5 Mời thành viên vào bảng", [
    ("Mã, tên", ["UC06.5 - Mời thành viên vào bảng"]),
    ("Tác nhân", ["Quản trị viên bảng; Dịch vụ email"]),
    ("Mô tả", ["Mời một người vào bảng theo email với vai trò được chọn."]),
    ("Tiền điều kiện", ["Đã đăng nhập, có quyền quản lý bảng; bảng chưa bị lưu trữ hoặc xóa."]),
    ("Luồng chính", ["1. Quản trị viên mở “Chia sẻ bảng”, nhập email và chọn vai trò (Quản trị viên, Thành viên, Người xem).",
                     "2. Hệ thống kiểm tra quyền quản lý bảng và tìm tài khoản theo email.",
                     "3. Hệ thống thêm người đó vào bảng với vai trò đã chọn và gửi thông báo cho họ.",
                     "4. Hệ thống phát sự kiện board:members-changed tới phòng của bảng và board:access-changed tới người được thêm."]),
    ("Luồng thay thế, ngoại lệ", ["2a. Email chưa có tài khoản: hệ thống bảo đảm bảng có liên kết mời và gửi email chứa liên kết; người nhận đăng ký rồi gửi yêu cầu tham gia qua liên kết (UC06.1, UC06.2).",
                                  "2b. Người này đã là thành viên của bảng: hệ thống báo lỗi.",
                                  "2c. Không gửi được email: hệ thống báo không gửi được lời mời, đề nghị thử lại sau."]),
    ("Hậu điều kiện", ["Người được mời có quyền trên bảng theo vai trò đã chọn, hoặc đã nhận được email mời."]),
])
spec("dt_sinh", "Đặc tả use case UC11.4 Sinh kế hoạch bảng", [
    ("Mã, tên", ["UC11.4 - Sinh kế hoạch bảng"]),
    ("Tác nhân", ["Người dùng; Dịch vụ AI (Gemini)"]),
    ("Mô tả", ["Từ mô tả dự án, hệ thống đề xuất kế hoạch gồm danh sách, thẻ, ngày bắt đầu, hạn hoàn thành, nhãn và các cảnh báo cần kiểm tra."]),
    ("Tiền điều kiện", ["Đã đăng nhập; là thành viên của không gian làm việc đích; mô tả đạt độ dài tối thiểu."]),
    ("Luồng chính", ["1. Người dùng chọn không gian làm việc, khoảng thời gian dự án và nhập mô tả (hoặc tải tệp; khi đó máy chủ trích xuất chữ từ tệp).",
                     "2. Hệ thống kiểm tra quyền trong không gian và cắt mô tả theo giới hạn độ dài (mặc định 20 000 ký tự).",
                     "3. Tầng luật tách dòng, nhận diện tiêu đề nhóm, gạch đầu dòng, biểu thức thời gian và tên thành viên; xác định mô tả có cấu trúc hay dạng văn xuôi.",
                     "4. Nếu đã cấu hình LLM, hệ thống gửi lời nhắc kèm lược đồ JSON tới Gemini và kiểm tra hình dạng bản nháp trả về.",
                     "5. Hệ thống hợp nhất kết quả, lập lịch ngày và kiểm tra các bất biến của BoardPlan, chẳng hạn ngày bắt đầu không sau hạn hoàn thành.",
                     "6. Hệ thống lưu lượt chạy (AiRun) và trả về kế hoạch kèm cảnh báo để người dùng xem trước."]),
    ("Luồng thay thế, ngoại lệ", ["2a. Vượt giới hạn tần suất gọi: hệ thống yêu cầu thử lại sau.",
                                  "4a. Chưa cấu hình LLM, gọi lỗi, quá thời gian chờ hoặc bản nháp sai lược đồ: hệ thống ghi cảnh báo và dùng kết quả tầng luật; luồng tiếp tục ở bước 5.",
                                  "5a. Kế hoạch không qua được kiểm tra hợp đồng: hệ thống báo không tạo được kế hoạch từ mô tả này."]),
    ("Hậu điều kiện", ["Có một kế hoạch chưa áp dụng gắn với người dùng; chưa có dữ liệu bảng nào được tạo."]),
])
spec("dt_apdung", "Đặc tả use case UC11.8 Áp dụng kế hoạch để tạo bảng", [
    ("Mã, tên", ["UC11.8 - Áp dụng kế hoạch để tạo bảng"]),
    ("Tác nhân", ["Người dùng"]),
    ("Mô tả", ["Tạo bảng thật từ kế hoạch đã xem và chỉnh sửa."]),
    ("Tiền điều kiện", ["Đã có kế hoạch (UC11.4) thuộc người dùng và chưa được áp dụng."]),
    ("Luồng chính", ["1. Người dùng chỉnh sửa tên danh sách, thẻ, ngày, bỏ chọn thẻ không cần và bấm “Tạo bảng”.",
                     "2. Hệ thống kiểm tra lại toàn bộ kế hoạch theo lược đồ BoardPlan và kiểm tra quyền của người dùng trong không gian.",
                     "3. Trong một giao dịch, hệ thống đánh dấu lượt chạy đã áp dụng, tạo bảng, các danh sách (kèm trạng thái suy ra từ tên danh sách), các thẻ được chọn và nhãn.",
                     "4. Hệ thống ghi nhật ký hoạt động và lưu số chỉnh sửa của người dùng vào lượt chạy.",
                     "5. Giao diện mở bảng vừa tạo."]),
    ("Luồng thay thế, ngoại lệ", ["1a. Không chọn thẻ nào: hệ thống yêu cầu chọn ít nhất một thẻ.",
                                  "2a. Kế hoạch không tồn tại hoặc không thuộc người dùng: hệ thống báo không tìm thấy.",
                                  "3a. Kế hoạch đã được áp dụng (bấm hai lần, mở hai thẻ trình duyệt): yêu cầu sau bị từ chối, không tạo bảng trùng."]),
    ("Hậu điều kiện", ["Bảng mới thuộc không gian đã chọn; người dùng là chủ sở hữu bảng."]),
])
spec("dt_goiy", "Đặc tả use case UC12.1 Xem gợi ý người phụ trách và UC12.4 Giao thẻ theo gợi ý", [
    ("Mã, tên", ["UC12.1 - Xem gợi ý người phụ trách cho thẻ; UC12.4 - Giao thẻ theo gợi ý"]),
    ("Tác nhân", ["Thành viên bảng"]),
    ("Mô tả", ["Xem danh sách người phù hợp cho một thẻ kèm bằng chứng và chọn người để giao."]),
    ("Tiền điều kiện", ["Đã đăng nhập, có quyền sửa thẻ."]),
    ("Luồng chính", ["1. Thành viên mở chi tiết thẻ và mở phần gợi ý người phụ trách.",
                     "2. Hệ thống kiểm tra quyền sửa thẻ và lấy danh sách ứng viên là những người có thể nhận thẻ trong bảng.",
                     "3. Hệ thống đọc lịch sử thẻ đã hoàn thành trong không gian, hồ sơ làm việc, hồ sơ tự khai và trọng số hiện tại.",
                     "4. Hệ thống tính bốn thành phần điểm (kinh nghiệm, độ tin cậy, khả dụng, hồ sơ tự khai) cùng độ chắc chắn của ước lượng, xếp hạng theo trọng số, gắn cảnh báo quá tải hoặc tạm nghỉ và các thẻ làm bằng chứng.",
                     "5. Hệ thống lưu lượt gợi ý (AssignRun) và hiển thị kết quả.",
                     "6. Thành viên chọn một người; hệ thống giao thẻ cho người đó và gửi thông báo.",
                     "7. Hệ thống ghi nhận người được chọn cho lượt gợi ý; nếu đủ điều kiện, cập nhật trọng số của không gian theo phản hồi."]),
    ("Luồng thay thế, ngoại lệ", ["2a. Người dùng chỉ có vai trò Người xem bảng: bị từ chối.",
                                  "3a. Không gian chưa có lịch sử: ứng viên nhận ước lượng bằng mức trung bình của nhóm kèm độ chắc chắn thấp.",
                                  "6a. Thành viên không chọn ai trong gợi ý hoặc tự giao người khác: lượt gợi ý không có kết quả, không học trọng số."]),
    ("Hậu điều kiện", ["Thẻ có người phụ trách; lượt gợi ý lưu đủ dữ liệu để đánh giá ở Chương 6."]),
])

# ---------------- 3.3 ----------------
h2("3.3. Biểu đồ hoạt động")
p("Biểu đồ hoạt động mô tả trình tự các bước nghiệp vụ và các điểm rẽ nhánh của một luồng, phân làn theo tác nhân thực hiện. Mục "
  "này trình bày 17 luồng, mỗi nhóm use case tổng quát có ít nhất một luồng chính, sắp theo thứ tự mã use case. Bốn luồng được "
  "phân tích kỹ hơn là đăng nhập (luồng nền tảng về bảo mật), di chuyển thẻ (thao tác cốt lõi của Kanban), sinh bảng bằng AI và "
  "gợi ý giao việc (hai luồng gắn với hai cơ chế của khóa luận); các luồng còn lại được trình bày ngắn gọn, tập trung vào các "
  "điểm rẽ nhánh và quy tắc nghiệp vụ.")
h3("3.3.1. Hoạt động đăng nhập")
p("{H:hd1_dang_nhap} mô tả hoạt động đăng nhập. Hai cách đăng nhập hội tụ tại cùng một bước: hệ thống ký JWT chứa mã người dùng "
  "và tokenVersion rồi đặt vào cookie httpOnly; nhờ vậy phần còn lại của hệ thống không cần phân biệt người dùng đăng nhập bằng "
  "cách nào. Nhánh sai thông tin quay về bước nhập lại mà không cho biết email có tồn tại hay không.")
bdfig("hd1_dang_nhap", "Biểu đồ hoạt động: Đăng nhập (UC01.1, UC01.2)")
h3("3.3.2. Hoạt động đăng ký và xác minh email")
p("{H:hd5_dang_ky} mô tả hoạt động đăng ký và xác minh email. Tài khoản được tạo cùng một không gian làm việc cá nhân và người "
  "dùng được đăng nhập ngay; việc gửi email xác minh thất bại không chặn đăng ký mà chỉ được ghi nhật ký. Mã xác minh chỉ được "
  "lưu dưới dạng băm SHA-256 và được đánh dấu đã dùng bằng một lệnh cập nhật có điều kiện, nên mỗi liên kết chỉ dùng được một "
  "lần. Chưa xác minh email vẫn dùng được hệ thống, nhưng chỉ tài khoản đã xác minh mới được thêm thẳng vào không gian hoặc bảng "
  "theo email.")
bdfig("hd5_dang_ky", "Biểu đồ hoạt động: Đăng ký và xác minh email (UC01.3, UC01.4)")
h3("3.3.3. Hoạt động quên và đặt lại mật khẩu")
p("{H:hd6_quen_mat_khau} mô tả hoạt động quên và đặt lại mật khẩu. Hệ thống luôn trả cùng một thông báo dù email có tài khoản hay"
  " không, để chức năng này không bị dùng để dò danh sách email đã đăng ký. Việc đánh dấu mã đã dùng và đổi mật khẩu nằm trong "
  "cùng một giao dịch, nên nếu bước đổi mật khẩu lỗi thì liên kết không bị mất hiệu lực. Sau khi đặt lại, tokenVersion tăng và "
  "mọi kết nối Socket.IO của tài khoản bị ngắt; người lấy lại tài khoản bị chiếm đoạt nhờ vậy đẩy được ngay kẻ chiếm đoạt ra khỏi"
  " hệ thống.")
bdfig("hd6_quen_mat_khau", "Biểu đồ hoạt động: Quên và đặt lại mật khẩu (UC01.5, UC01.6)")
h3("3.3.4. Hoạt động xem bảng công khai")
p("{H:hd7_xem_bang_cong_khai} mô tả hoạt động của khách khi xem một bảng công khai. Các API công khai không yêu cầu đăng nhập, "
  "chỉ trả dữ liệu để đọc và có giới hạn tần suất riêng. Mỗi yêu cầu, kể cả khi mở một thẻ, đều kiểm tra lại bảng còn ở chế độ "
  "Công khai; thông tin người dùng đi kèm chỉ gồm tên và ảnh đại diện, không có email.")
bdfig("hd7_xem_bang_cong_khai", "Biểu đồ hoạt động: Xem bảng công khai (UC02.1, UC02.2, UC02.3)")
h3("3.3.5. Hoạt động đổi mật khẩu")
p("{H:hd8_doi_mat_khau} mô tả hoạt động đổi mật khẩu. Tài khoản tạo bằng Google chưa có mật khẩu nên được hướng sang chức năng "
  "quên mật khẩu để đặt mật khẩu lần đầu. Khi đổi thành công, tokenVersion tăng làm mọi JWT đã cấp hết hiệu lực; phiên hiện tại "
  "được cấp cookie mới nên không bị đăng xuất, còn các phiên trên thiết bị khác bị từ chối ở yêu cầu kế tiếp. Thanh phân nhánh và"
  " thanh hợp nhất thể hiện hai việc này diễn ra độc lập với nhau.")
bdfig("hd8_doi_mat_khau", "Biểu đồ hoạt động: Đổi mật khẩu (UC03.4)")
h3("3.3.6. Hoạt động tạo không gian và thêm thành viên")
p("{H:hd9_khong_gian} mô tả hoạt động tạo không gian làm việc và thêm thành viên. Người tạo trở thành Chủ sở hữu; chỉ Chủ sở hữu "
  "và Quản trị viên của không gian mới thêm được thành viên. Nếu email chưa có tài khoản, hoặc tài khoản chưa xác minh email, hệ "
  "thống chỉ gửi email mời đăng ký mà không cấp quyền, tránh trường hợp một tài khoản đăng ký trước bằng email của người khác "
  "nhận được quyền truy cập.")
bdfig("hd9_khong_gian", "Biểu đồ hoạt động: Tạo không gian và thêm thành viên (UC04.1, UC04.7, UC04.8)")
h3("3.3.7. Hoạt động tạo bảng")
p("{H:hd10_tao_bang} mô tả hai cách tạo bảng: bảng trống với tên, không gian và nền do người dùng chọn, hoặc bảng dựng từ một mẫu"
  " của hệ thống hay mẫu đã lưu trong không gian, khi đó các danh sách kèm trạng thái và các thẻ của mẫu được tạo luôn. Cả hai "
  "cách đều yêu cầu người tạo là thành viên của không gian; bảng mới mặc định ở chế độ Riêng tư và người tạo là Chủ sở hữu bảng.")
bdfig("hd10_tao_bang", "Biểu đồ hoạt động: Tạo bảng (UC05.1, UC05.2)")
h3("3.3.8. Hoạt động thiết lập và thực thi luật tự động")
p("{H:hd11_luat_tu_dong} gồm hai luồng có điểm bắt đầu riêng. Luồng thứ nhất là thiết lập luật: danh sách, nhãn và thành viên "
  "được chọn trong luật phải thuộc đúng bảng. Luồng thứ hai do hệ thống tự thực hiện mỗi khi có thẻ được tạo hoặc được chuyển "
  "sang danh sách khác. Các hành động chỉ đổi trạng thái, gắn nhãn hoặc giao người, không bao giờ di chuyển thẻ, nên một luật "
  "không thể kích hoạt luật khác thành vòng lặp; lỗi của một luật chỉ được ghi nhật ký để không làm hỏng thao tác tạo hoặc chuyển"
  " thẻ đang diễn ra.")
bdfig("hd11_luat_tu_dong", "Biểu đồ hoạt động: Thiết lập và thực thi luật tự động (UC05.23)")
h3("3.3.9. Hoạt động tham gia bảng bằng liên kết mời")
p("{H:hd12_tham_gia_bang} mô tả hoạt động tham gia bảng bằng liên kết mời với ba làn: người dùng, hệ thống và quản trị viên bảng."
  " Có liên kết chưa đủ để vào bảng: người mở liên kết chỉ xem trước tên và nền bảng, sau đó gửi yêu cầu để quản trị viên duyệt. "
  "Quản trị viên có thể vô hiệu hoá liên kết bất cứ lúc nào, khi đó mọi liên kết đã gửi đi đều hết hiệu lực.")
bdfig("hd12_tham_gia_bang", "Biểu đồ hoạt động: Tham gia bảng bằng liên kết mời (UC06.1, UC06.2, UC06.7, UC06.8)")
h3("3.3.10. Hoạt động thêm và sắp xếp danh sách")
p("{H:hd13_danh_sach} mô tả hai thao tác thường gặp với danh sách. Khi thêm danh sách mà không chọn trạng thái, hệ thống đoán "
  "trạng thái từ tên (ví dụ danh sách “Đang xử lý” được gắn trạng thái Đang làm, “Đã xong” được gắn Hoàn thành), không khớp thì "
  "để danh sách tự do; thẻ thêm vào danh sách sẽ nhận trạng thái tương ứng. Khi kéo danh sách sang vị trí mới, vị trí của mọi "
  "danh sách trong bảng được đánh lại trong một giao dịch; nếu máy chủ từ chối, giao diện tải lại thứ tự từ máy chủ.")
bdfig("hd13_danh_sach", "Biểu đồ hoạt động: Thêm và sắp xếp danh sách (UC07.2, UC07.6)")
h3("3.3.11. Hoạt động di chuyển thẻ")
p("{H:hd2_di_chuyen_the} mô tả hoạt động di chuyển thẻ. Giao diện hiển thị vị trí mới ngay khi thả để thao tác có cảm giác tức "
  "thì, nhưng máy chủ mới là nơi quyết định: nếu không có quyền, giao diện hoàn tác về ảnh chụp đã lưu. Các bước đổi trạng thái "
  "theo danh sách, ghi nhật ký, gửi thông báo và chạy luật tự động chỉ diễn ra khi thẻ thật sự chuyển sang danh sách khác; việc "
  "chỉ đổi thứ tự trong cùng danh sách vẫn phát sự kiện thời gian thực để các màn hình khác cập nhật thứ tự.")
bdfig("hd2_di_chuyen_the", "Biểu đồ hoạt động: Di chuyển thẻ (UC08.6)")
h3("3.3.12. Hoạt động bình luận trên thẻ")
p("{H:hd14_binh_luan} mô tả hoạt động bình luận. Người xem bảng không được bình luận. Câu trả lời luôn được gắn vào bình luận gốc"
  " của luồng, nên luồng chỉ có một cấp kể cả khi người dùng trả lời một câu trả lời. Mỗi người nhận chỉ một thông báo cho một "
  "bình luận, theo thứ tự ưu tiên được nhắc tên, được trả lời, rồi đến thành viên và người theo dõi thẻ; người đã mất quyền xem "
  "bảng bị loại khỏi danh sách nhận.")
bdfig("hd14_binh_luan", "Biểu đồ hoạt động: Bình luận trên thẻ (UC08.23, UC08.24, UC08.25)")
h3("3.3.13. Hoạt động tìm kiếm nâng cao")
p("{H:hd15_tim_kiem} mô tả hoạt động tìm kiếm nâng cao. Phạm vi tìm luôn được giới hạn trong các bảng người dùng được xem, sau đó"
  " mới ghép thêm các điều kiện lọc; kết quả được phân trang 20 thẻ mỗi trang. Bộ lọc được lưu theo tên cho từng người dùng, lưu "
  "trùng tên thì điều kiện cũ bị ghi đè.")
bdfig("hd15_tim_kiem", "Biểu đồ hoạt động: Tìm kiếm nâng cao (UC09.2, UC09.3)")
h3("3.3.14. Hoạt động nhắc hạn và nhận thông báo")
p("{H:hd16_nhac_han} mô tả hoạt động nhắc hạn, có thêm làn của bộ lập lịch chạy nền mỗi phút. Mốc nhắc là riêng của từng người. "
  "Trước khi gửi, bộ lập lịch kiểm tra lại người đặt nhắc còn quyền xem bảng hay không, vì quyền có thể đã bị thu hồi từ lúc đặt."
  " Bước đánh dấu đã gửi và bước tạo thông báo nằm trong cùng một giao dịch và chỉ thành công khi hạn của thẻ chưa đổi, nên nhắc "
  "hạn không bị gửi hai lần hoặc gửi theo hạn cũ. Email nhắc hạn chỉ được gửi khi người dùng bật tuỳ chọn này.")
bdfig("hd16_nhac_han", "Biểu đồ hoạt động: Nhắc hạn và nhận thông báo (UC08.3, UC10.3, UC10.4, UC10.6)")
h3("3.3.15. Hoạt động sinh bảng bằng AI")
p("{H:hd3_sinh_bang_ai} mô tả hoạt động sinh bảng tự động. Làn “Dịch vụ AI (Gemini)” chỉ tham gia khi đã cấu hình LLM; mọi nhánh "
  "lỗi của LLM (chưa cấu hình, lỗi mạng, quá thời gian chờ, bản nháp sai lược đồ) đều hội tụ về kết quả của tầng luật kèm cảnh "
  "báo, nên người dùng luôn nhận được một kế hoạch. Không có dữ liệu bảng nào được ghi trước khi người dùng xem trước và xác "
  "nhận, đúng nguyên tắc con người trong vòng lặp đã nêu ở mục 2.3.4.")
bdfig("hd3_sinh_bang_ai", "Biểu đồ hoạt động: Sinh bảng tự động bằng AI (UC11)")
h3("3.3.16. Hoạt động gợi ý và giao việc")
p("{H:hd4_goi_y_giao_viec} mô tả hoạt động gợi ý và giao việc. Hệ thống chỉ xếp hạng và trình bày bằng chứng; quyết định giao "
  "thẻ luôn do thành viên thực hiện. Lựa chọn của thành viên được ghi lại cho lượt gợi ý, và chỉ khi đã đủ số lượt phản hồi tối "
  "thiểu đồng thời người được chọn khác người xếp đầu, hệ thống mới điều chỉnh trọng số của không gian theo ưu tiên của nhóm "
  "(mục 2.7.2).")
bdfig("hd4_goi_y_giao_viec", "Biểu đồ hoạt động: Gợi ý và giao việc (UC12.1, UC12.4, UC12.6)")
h3("3.3.17. Hoạt động hỏi đáp với trợ lý ảo")
p("{H:hd17_tro_ly_ao} mô tả hoạt động hỏi đáp với trợ lý ảo. Khi đã cấu hình LLM, mô hình chỉ chọn công cụ truy vấn và tham số; "
  "máy chủ kiểm tra tham số, giới hạn phạm vi, tự chạy các truy vấn chỉ đọc có kiểm tra quyền rồi gửi kết quả lại cho mô hình. "
  "Vòng lặp dừng khi mô hình kết thúc hoặc cần hỏi lại người dùng, hoặc khi chạm giới hạn 4 vòng, 8 lần gọi công cụ, 30 giây. Khi"
  " chưa cấu hình LLM hoặc mô hình lỗi, trợ lý dùng chế độ cơ bản dựa trên luật. Trợ lý chỉ đọc dữ liệu: yêu cầu tạo, sửa hay "
  "giao việc bị từ chối kèm hướng dẫn thao tác trực tiếp trên website.")
bdfig("hd17_tro_ly_ao", "Biểu đồ hoạt động: Hỏi đáp với trợ lý ảo (UC13.1–UC13.5)")

# ---------------- 3.4 ----------------
h2("3.4. Kiến trúc tổng thể")
h3("3.4.1. Mô hình kiến trúc")
p("TaskFlow được xây dựng theo kiến trúc khách – chủ ba tầng như {H:kt_kien_truc}. Tầng giao diện là một ứng dụng trang đơn "
  "(Single Page Application – SPA) chạy trên trình duyệt; tầng ứng dụng là máy chủ Node.js/Express cung cấp API REST và kênh "
  "WebSocket; tầng dữ liệu là cơ sở dữ liệu PostgreSQL truy cập qua Prisma ORM cùng thư mục lưu tệp tải lên. Máy chủ và cơ sở "
  "dữ liệu chạy trong Docker Compose.")
bdfig("kt_kien_truc", "Kiến trúc tổng thể của hệ thống TaskFlow")
p("Giao diện giao tiếp với máy chủ qua hai kênh. Kênh REST/JSON qua HTTPS dùng cho mọi thao tác đọc và ghi; JWT nằm trong cookie "
  "httpOnly nên mã JavaScript trên trình duyệt không đọc được, giảm rủi ro bị đánh cắp phiên qua lỗi chèn mã kịch bản. Kênh "
  "WebSocket (Socket.IO) chỉ dùng để máy chủ báo cho trình duyệt biết có thay đổi; dữ liệu thực vẫn được tải lại qua REST, nhờ "
  "đó quy tắc phân quyền chỉ phải cài đặt ở một nơi.")
p("Bên trong máy chủ, mỗi yêu cầu đi qua chuỗi middleware (CORS, đọc cookie, xác thực, kiểm tra dữ liệu bằng Zod, giới hạn tần "
  "suất, kiểm soát tệp tải lên), tới router và controller, rồi tới tầng nghiệp vụ. Tầng nghiệp vụ là nơi duy nhất truy cập cơ sở "
  "dữ liệu và luôn kiểm tra quyền trước khi thao tác, kể cả khi lớp phía trên đã kiểm tra, nên một sai sót ở lớp trên không làm "
  "lộ dữ liệu. Các tác vụ nền (nhắc hạn, tạo thẻ định kỳ, email tổng hợp) chạy trong cùng tiến trình máy chủ theo chu kỳ cố định "
  "và gọi lại các hàm nghiệp vụ.")
h3("3.4.2. Tổ chức các module phía máy chủ")
p("Mã nguồn máy chủ được tổ chức theo module nghiệp vụ; mỗi module gồm các tệp định tuyến (routes), điều khiển (controller), "
  "lược đồ kiểm tra dữ liệu (schema) và nghiệp vụ (service). {B:module} liệt kê các module và trách nhiệm chính.")
tbl("module", "Các module phía máy chủ", ["Module", "Trách nhiệm chính", "Ví dụ API"], [
    ["auth", "Đăng ký, đăng nhập (kể cả Google), xác minh email, quên và đặt lại mật khẩu, hồ sơ cá nhân", "/api/auth/login, /api/auth/me"],
    ["workspace", "Không gian làm việc, thành viên và vai trò, tổng quan công việc", "/api/workspaces/:id/members"],
    ["board", "Bảng, thành viên bảng, liên kết mời, yêu cầu tham gia, mẫu bảng, bảng công khai", "/api/boards/:id, /api/public/boards/:id"],
    ["list", "Danh sách, sắp xếp, chuyển toàn bộ thẻ, lưu trữ", "/api/boards/:id/lists, /api/lists/:id/move-all-cards"],
    ["card", "Thẻ, thành viên thẻ, nhãn trên thẻ, checklist, bình luận, đính kèm, nhắc hạn, mẫu thẻ, lịch định kỳ, lịch công việc", "/api/cards/:id/move, /api/cards/:id/comments"],
    ["label, customField", "Nhãn và trường tùy chỉnh của bảng", "/api/boards/:id/labels, /api/boards/:id/custom-fields"],
    ["automation", "Luật tự động hóa và thực thi luật", "/api/boards/:id/automation-rules"],
    ["activity, notification, watch", "Nhật ký hoạt động, thông báo, tùy chọn nhận thông báo, theo dõi", "/api/activities, /api/notifications"],
    ["search", "Tìm kiếm nâng cao, bộ lọc đã lưu", "/api/search/cards, /api/search/filters"],
    ["unsplash", "Tìm ảnh nền, ghi nhận lượt tải theo yêu cầu của Unsplash", "/api/unsplash"],
    ["ai", "Module sinh bảng: trích xuất tài liệu, sinh kế hoạch, áp dụng kế hoạch", "/api/ai/board-plans, /api/ai/board-plans/:runId/apply"],
    ["assign, declaredProfile", "Module gợi ý phân công: gợi ý cho thẻ, kế hoạch cho danh sách, ghi kết quả, trọng số, hồ sơ", "/api/cards/:id/assignment-suggestions"],
    ["chat", "Trợ lý ảo", "/api/chat"],
], [1500, 3700, 3300])
h3("3.4.3. Tổ chức phía giao diện")
p("Ứng dụng giao diện được chia thành các trang gắn với đường dẫn, các thành phần giao diện dùng lại theo miền nghiệp vụ, các "
  "context giữ trạng thái dùng chung (phiên đăng nhập, danh sách bảng, danh sách không gian, trợ lý ảo, giao diện sáng/tối) và "
  "lớp thư viện gọi API bằng Axios. Hai bố cục chính là MainLayout cho các trang tổng quan và BoardViewLayout cho trang bảng. "
  "Trang bảng tách phần xử lý thành các hook riêng cho kéo-thả, phím tắt và đồng bộ thời gian thực; kéo-thả dùng thư viện "
  "@dnd-kit với cập nhật lạc quan và hoàn tác theo ảnh chụp khi máy chủ từ chối.")
h3("3.4.4. Công nghệ sử dụng")
p("{B:congnghe} tổng hợp các công nghệ chính ở từng tầng của hệ thống.")
tbl("congnghe", "Các công nghệ sử dụng", ["Tầng", "Công nghệ", "Vai trò"], [
    ["Giao diện", "React 19, TypeScript, Vite, Tailwind CSS 4", "Xây dựng ứng dụng trang đơn"],
    ["Giao diện", "React Router, Axios, Socket.IO client, @dnd-kit", "Điều hướng, gọi API, nhận sự kiện thời gian thực, kéo-thả"],
    ["Máy chủ", "Node.js, Express 4, TypeScript", "API REST và xử lý nghiệp vụ"],
    ["Máy chủ", "Zod 4", "Kiểm tra dữ liệu đầu vào và lược đồ BoardPlan"],
    ["Máy chủ", "Socket.IO 4", "Cập nhật thời gian thực"],
    ["Máy chủ", "jsonwebtoken, bcryptjs, google-auth-library", "Xác thực"],
    ["Máy chủ", "Multer, mammoth, pdf-parse", "Tải tệp lên, trích xuất chữ từ DOCX và PDF"],
    ["Máy chủ", "Nodemailer, express-rate-limit", "Gửi email, giới hạn tần suất"],
    ["Dữ liệu", "PostgreSQL 16, Prisma ORM 7", "Lưu trữ và truy cập dữ liệu, quản lý migration"],
    ["Dịch vụ ngoài", "Gemini API (qua điểm cuối tương thích OpenAI), Google Identity, Unsplash API, SMTP", "Mô hình ngôn ngữ lớn, đăng nhập Google, ảnh nền, email"],
    ["Kiểm thử, triển khai", "Vitest, Supertest, Testing Library, Docker Compose", "Kiểm thử tự động, đóng gói môi trường"],
], [1900, 3800, 2800])

# ---------------- 3.5 ----------------
h2("3.5. Thiết kế cơ sở dữ liệu")
h3("3.5.1. Mô hình thực thể – liên kết")
p("Cơ sở dữ liệu gồm 43 bảng, được khai báo bằng lược đồ Prisma và quản lý thay đổi bằng migration. {H:erd1a_nguoi_dung_bang} "
  "và {H:erd1b_the_cong_viec} trình bày phần lõi phục vụ quản lý công việc; {H:erd2_ai_phan_cong} trình bày phần dữ liệu của "
  "hai module AI. Để sơ đồ dễ đọc, mỗi thực thể chỉ ghi các thuộc tính chính và một số khóa ngoại tới bảng User được lược đường nối.")
bdfig("erd1a_nguoi_dung_bang", "Sơ đồ thực thể – liên kết: người dùng, không gian làm việc và bảng")
bdfig("erd1b_the_cong_viec", "Sơ đồ thực thể – liên kết: danh sách, thẻ và nội dung của thẻ")
p("Thiết kế dữ liệu có một số quyết định đáng chú ý sau.")
li("Phần lớn bảng dùng khóa chính dạng chuỗi cuid do ứng dụng sinh ra, không để lộ số lượng bản ghi như khóa tăng dần.")
li("Xóa mềm bằng trường deletedAt cho người dùng, không gian, bảng, danh sách, thẻ, bình luận và quan hệ thành viên; tách biệt "
   "với lưu trữ (archivedAt) là trạng thái người dùng có thể khôi phục.")
li("Thứ tự hiển thị của danh sách, thẻ và mục checklist được lưu bằng trường position kiểu số nguyên và được đánh lại trong "
   "giao dịch mỗi khi kéo-thả.")
li("Trạng thái công việc (CardStatus) được lưu ở thẻ, còn danh sách có thể gắn một trạng thái hoặc để trống; bất biến “status là "
   "DONE khi và chỉ khi isDone đúng và completedAt khác rỗng” được duy trì ở tầng nghiệp vụ.")
li("Bảng Activity ghi lại mọi thay đổi quan trọng kèm thời điểm và dữ liệu JSON; đây vừa là nhật ký hiển thị cho người dùng, "
   "vừa là nguồn lịch sử cho module gợi ý phân công (thời điểm hoàn thành so với hạn, việc mở lại thẻ).")
li("Hai bảng AiRun và AssignRun lưu từng lượt chạy của hai module AI cùng đầu vào, đầu ra, độ trễ và quyết định của người dùng, "
   "phục vụ cả chức năng (áp dụng kế hoạch đúng một lần, học trọng số) lẫn đánh giá thực nghiệm ở Chương 6.")
bdfig("erd2_ai_phan_cong", "Sơ đồ thực thể – liên kết: dữ liệu của module sinh bảng và module gợi ý phân công")
h3("3.5.2. Danh sách các bảng dữ liệu")
p("{B:dsbang} liệt kê toàn bộ các bảng theo nhóm chức năng.")
tbl("dsbang", "Danh sách các bảng dữ liệu theo nhóm", ["Nhóm", "Bảng và mục đích"], [
    ["Người dùng, xác thực", "User: tài khoản; AuthToken: mã dùng một lần để xác minh email và đặt lại mật khẩu (lưu dạng băm, có hạn); NotificationPreference: tùy chọn nhận thông báo; SavedFilter: bộ lọc tìm kiếm đã lưu."],
    ["Không gian làm việc", "Workspace: không gian (có cờ không gian cá nhân); WorkspaceMember: thành viên và vai trò."],
    ["Bảng, chia sẻ", "Board: bảng, chế độ hiển thị, liên kết mời; BoardMember: thành viên và vai trò; BoardStar: bảng yêu thích; BoardJoinRequest: yêu cầu tham gia; Watch: theo dõi bảng, danh sách hoặc thẻ."],
    ["Danh sách, thẻ", "List; Card; CardMember: người phụ trách (ghi cả người giao); Label, CardLabel: nhãn; Checklist, ChecklistItem; Comment: bình luận và trả lời; Attachment: tệp đính kèm; CardReminder: mốc nhắc hạn riêng của từng người."],
    ["Tùy biến, tự động hóa", "CustomField, CustomFieldOption, CardFieldValue: trường tùy chỉnh; BoardTemplate, BoardTemplateList, BoardTemplateCard: mẫu bảng; CardTemplate, CardTemplateChecklist, CardTemplateItem: mẫu thẻ; AutomationRule, AutomationAction: luật tự động; RecurringCardSchedule: lịch tạo thẻ định kỳ."],
    ["Nhật ký, thông báo", "Activity: nhật ký hoạt động; Notification: thông báo trong ứng dụng."],
    ["Module sinh bảng", "AiRun: mỗi lượt sinh kế hoạch (đầu vào, kế hoạch, chỉ số LLM, kế hoạch đã áp dụng)."],
    ["Module gợi ý phân công", "AssignRun: mỗi lượt gợi ý; WorkspaceAssignWeights, AssignWeightHistory: trọng số của không gian và lịch sử thay đổi; MemberWorkProfile: hồ sơ làm việc theo không gian; UserAssignProfile: hồ sơ tự khai và CV."],
    ["Trợ lý ảo", "ChatConversation, ChatTurn: hội thoại và từng lượt hỏi đáp."],
], [2300, 6200])
h3("3.5.3. Mô tả chi tiết một số bảng chính")
p("Các bảng từ {B:t_board} đến {B:t_assignrun} mô tả chi tiết sáu bảng giữ vai trò trung tâm: Board, List, Card, Activity và hai "
  "bảng nhật ký của hai module AI. Cột “Ràng buộc” ghi khóa chính (PK), khóa ngoại (FK), duy nhất (UQ), cho phép rỗng (NULL) "
  "và giá trị mặc định.")
COLW = [2300, 1700, 1400, 3100]
HDR = ["Trường", "Kiểu", "Ràng buộc", "Ý nghĩa"]
tbl("t_board", "Bảng Board", HDR, [
    ["id", "String", "PK", "Mã bảng (cuid)"],
    ["ownerId", "String", "FK → User", "Chủ sở hữu bảng"],
    ["workspaceId", "String", "FK → Workspace", "Không gian chứa bảng"],
    ["name", "String", "", "Tên bảng"],
    ["color, backgroundImage", "String", "backgroundImage NULL", "Màu nền hoặc ảnh nền"],
    ["inviteToken", "String", "UQ, NULL", "Mã liên kết mời tham gia (NULL khi tắt liên kết)"],
    ["visibility", "BoardVisibility", "Mặc định PRIVATE", "Chế độ hiển thị: PRIVATE, WORKSPACE, PUBLIC"],
    ["archivedAt", "DateTime", "NULL", "Thời điểm lưu trữ"],
    ["createdAt, updatedAt", "DateTime", "", "Thời điểm tạo, cập nhật"],
    ["deletedAt", "DateTime", "NULL", "Xóa mềm"],
], COLW)
tbl("t_list", "Bảng List", HDR, [
    ["id", "String", "PK", "Mã danh sách"],
    ["boardId", "String", "FK → Board", "Bảng chứa danh sách"],
    ["name", "String", "", "Tên danh sách"],
    ["position", "Int", "Mặc định 0", "Thứ tự trong bảng"],
    ["status", "CardStatus", "NULL", "Trạng thái gắn với danh sách; NULL là danh sách tự do"],
    ["archivedAt, deletedAt", "DateTime", "NULL", "Lưu trữ, xóa mềm"],
    ["createdAt, updatedAt", "DateTime", "", "Thời điểm tạo, cập nhật"],
], COLW)
tbl("t_card", "Bảng Card", HDR, [
    ["id", "String", "PK", "Mã thẻ"],
    ["listId", "String", "FK → List", "Danh sách chứa thẻ"],
    ["title", "String", "", "Tiêu đề"],
    ["description", "String", "NULL", "Mô tả (Markdown)"],
    ["status", "CardStatus", "", "TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED"],
    ["isDone, completedAt", "Boolean, DateTime", "completedAt NULL", "Cờ hoàn thành và thời điểm hoàn thành, luôn khớp với status"],
    ["startDate, dueDate", "DateTime", "NULL", "Ngày bắt đầu, hạn hoàn thành"],
    ["coverColor, coverImageUrl", "String", "NULL", "Ảnh bìa hoặc màu bìa"],
    ["position", "Int", "Mặc định 0", "Thứ tự trong danh sách"],
    ["archivedAt, deletedAt", "DateTime", "NULL", "Lưu trữ, xóa mềm"],
    ["createdAt, updatedAt", "DateTime", "", "Thời điểm tạo, cập nhật"],
], COLW)
tbl("t_activity", "Bảng Activity", HDR, [
    ["id", "String", "PK", "Mã bản ghi"],
    ["boardId", "String", "FK → Board", "Bảng xảy ra hoạt động"],
    ["cardId", "String", "FK → Card, NULL", "Thẻ liên quan (nếu có)"],
    ["userId", "String", "FK → User", "Người thực hiện"],
    ["type", "String", "", "Loại hoạt động, ví dụ card.move, card.status, ai.board.create"],
    ["data", "Json", "", "Dữ liệu chi tiết, ví dụ danh sách cũ và mới"],
    ["createdAt", "DateTime", "", "Thời điểm xảy ra"],
], COLW)
tbl("t_airun", "Bảng AiRun", HDR, [
    ["id", "String", "PK", "Mã lượt chạy (runId)"],
    ["userId, workspaceId, boardId", "String", "FK, NULL", "Người gọi, không gian đích, bảng được tạo sau khi áp dụng"],
    ["actorKey", "String", "", "Khóa người gọi, dùng để chỉ chủ lượt chạy mới được áp dụng"],
    ["inputKind, inputText", "AiInputKind, String", "", "Loại đầu vào (TEXT, DOCX, PDF) và văn bản đã cắt theo giới hạn"],
    ["mode, modeAuto, structuredRatio", "AiPlanMode, Float", "", "Chế độ xử lý (STRUCTURED, FREEFORM) và tỉ lệ dòng có cấu trúc"],
    ["llmUsed, provider, model", "Boolean, String", "", "Có dùng bản nháp của LLM không, nhà cung cấp, mô hình"],
    ["promptTokens, completionTokens, latencyMs", "Int", "NULL", "Số token và độ trễ của lượt gọi LLM"],
    ["llmFailReason, strictParseOk", "String, Boolean", "llmFailReason NULL", "Lý do LLM thất bại; đầu ra có hợp lệ ngay lần đầu không"],
    ["plan, warnings", "Json", "", "Kế hoạch đề xuất (BoardPlan) và các cảnh báo"],
    ["cardCount, droppedCards", "Int", "", "Số thẻ đề xuất và số thẻ bị loại ở bước kiểm tra"],
    ["appliedPlan, accepted, editCount, appliedAt", "Json, Boolean, Int, DateTime", "NULL", "Kế hoạch thực sự áp dụng, cờ chấp nhận, số chỉnh sửa, thời điểm áp dụng"],
    ["createdAt", "DateTime", "", "Thời điểm sinh kế hoạch"],
], COLW)
tbl("t_assignrun", "Bảng AssignRun", HDR, [
    ["id", "String", "PK", "Mã lượt gợi ý (runId)"],
    ["workspaceId, boardId, cardId", "String", "FK, NULL", "Không gian, bảng và thẻ được gợi ý"],
    ["actorKey", "String", "", "Khóa người yêu cầu gợi ý"],
    ["algorithmVersion", "String", "", "Phiên bản thuật toán chấm điểm"],
    ["weights", "Json", "", "Trọng số đã dùng ở lượt này"],
    ["candidates, candidateCount", "Json, Int", "", "Danh sách ứng viên kèm điểm thành phần, số ứng viên"],
    ["topUserId, chosenUserId", "String", "NULL", "Người xếp đầu và người thực sự được chọn"],
    ["accepted, decidedAt", "Boolean, DateTime", "decidedAt NULL", "Người được chọn có trùng người xếp đầu không, thời điểm quyết định"],
    ["learned", "Boolean", "", "Lượt này có được dùng để cập nhật trọng số không"],
    ["latencyMs, createdAt", "Int, DateTime", "latencyMs NULL", "Thời gian tính gợi ý, thời điểm tạo"],
], COLW)

# ---------------- 3.6 ----------------
h2("3.6. Biểu đồ trình tự")
p("Biểu đồ trình tự mô tả sự trao đổi thông điệp theo thời gian giữa các thành phần của kiến trúc ở mục 3.4. Các luồng tương ứng "
  "với 17 biểu đồ hoạt động ở mục 3.3 và theo cùng thứ tự; bốn luồng dài (đăng nhập, đăng ký, sinh bảng bằng AI, gợi ý giao việc)"
  " được tách thành hai biểu đồ để dễ đọc. Thông điệp đồng bộ được vẽ bằng mũi tên đặc, thông điệp trả về bằng nét đứt, sự kiện "
  "gửi đi không chờ phản hồi bằng mũi tên mở; khung alt thể hiện các nhánh loại trừ nhau, khung opt thể hiện phần chỉ xảy ra khi "
  "thỏa điều kiện, khung loop thể hiện phần lặp lại.")
h3("3.6.1. Đăng nhập và gọi API có xác thực")
p("{H:tt1a_dang_nhap} mô tả trình tự đăng nhập. Máy chủ trả cùng một thông báo lỗi cho cả trường hợp email không tồn tại và sai "
  "mật khẩu. Khi đăng nhập thành công, JWT được đặt vào cookie httpOnly bằng tiêu đề Set-Cookie, giao diện không trực tiếp giữ "
  "token.")
bdfig("tt1a_dang_nhap", "Biểu đồ trình tự: Đăng nhập")
p("{H:tt1b_goi_api_xac_thuc} mô tả một yêu cầu bất kỳ sau khi đăng nhập. Middleware requireAuth xác minh chữ ký và hạn của JWT "
  "rồi đối chiếu tokenVersion trong token với giá trị hiện tại trong cơ sở dữ liệu. Vì tokenVersion tăng khi người dùng đổi hoặc "
  "đặt lại mật khẩu, mọi token cũ bị vô hiệu ngay lập tức mà không cần duy trì danh sách token bị thu hồi.")
bdfig("tt1b_goi_api_xac_thuc", "Biểu đồ trình tự: Gọi API có xác thực")
h3("3.6.2. Đăng ký và xác minh email")
p("{H:tt5a_dang_ky} mô tả trình tự đăng ký. Email xác minh được gửi ngay trong yêu cầu đăng ký nhưng lỗi gửi chỉ được ghi nhật "
  "ký; máy chủ vẫn trả mã 201 kèm cookie đăng nhập. Cơ sở dữ liệu chỉ lưu giá trị băm của mã, mã gốc chỉ nằm trong liên kết gửi "
  "qua email.")
bdfig("tt5a_dang_ky", "Biểu đồ trình tự: Đăng ký tài khoản")
p("{H:tt5b_xac_minh_email} mô tả trình tự xác minh email. Máy chủ băm mã nhận được rồi đánh dấu đã dùng bằng một lệnh cập nhật có"
  " điều kiện (chưa dùng, còn hạn) trong cùng giao dịch ghi thời điểm xác minh; khi hai yêu cầu cùng dùng một liên kết, chỉ một "
  "yêu cầu thành công.")
bdfig("tt5b_xac_minh_email", "Biểu đồ trình tự: Xác minh email")
h3("3.6.3. Quên và đặt lại mật khẩu")
p("{H:tt6_quen_mat_khau} mô tả trình tự quên và đặt lại mật khẩu. Phản hồi cho yêu cầu quên mật khẩu giống nhau trong mọi trường "
  "hợp; khung opt chỉ chạy khi email có tài khoản. Ở bước đặt lại, mật khẩu mới được băm trước khi mở giao dịch để giao dịch "
  "không kéo dài; nếu mã không hợp lệ, giao dịch được hoàn tác và mật khẩu cũ được giữ nguyên.")
bdfig("tt6_quen_mat_khau", "Biểu đồ trình tự: Quên và đặt lại mật khẩu")
h3("3.6.4. Xem bảng công khai")
p("{H:tt7_xem_bang_cong_khai} mô tả trình tự xem bảng công khai. Giao diện gọi song song hai API lấy thông tin bảng và các danh "
  "sách, cả hai đều kiểm tra bảng đang ở chế độ Công khai. Nhóm API này nằm dưới tiền tố /api/public, không đi qua middleware "
  "requireAuth và không có API ghi nào.")
bdfig("tt7_xem_bang_cong_khai", "Biểu đồ trình tự: Xem bảng công khai")
h3("3.6.5. Đổi mật khẩu")
p("{H:tt8_doi_mat_khau} thể hiện cách thu hồi phiên bằng tokenVersion. Sau khi đổi mật khẩu, máy chủ ngắt mọi kết nối Socket.IO "
  "của tài khoản và cấp cookie mới cho phiên hiện tại; giao diện chủ động kết nối lại Socket.IO bằng cookie mới vì Socket.IO "
  "không tự kết nối lại khi bị máy chủ ngắt. Phiên trên thiết bị khác vẫn giữ JWT cũ và bị từ chối ở yêu cầu kế tiếp do "
  "tokenVersion không còn khớp.")
bdfig("tt8_doi_mat_khau", "Biểu đồ trình tự: Đổi mật khẩu")
h3("3.6.6. Tạo không gian và thêm thành viên")
p("{H:tt9_khong_gian} mô tả trình tự tạo không gian và thêm thành viên. Không gian và bản ghi thành viên với vai trò OWNER được "
  "tạo trong cùng một lệnh. Người được thêm nhận thông báo và sự kiện workspace:changed qua phòng user:<id> của mình, nên danh "
  "sách không gian trên màn hình của họ cập nhật ngay; trường hợp chỉ gửi email mời, máy chủ trả mã 200 kèm địa chỉ đã mời thay "
  "vì 201.")
bdfig("tt9_khong_gian", "Biểu đồ trình tự: Tạo không gian và thêm thành viên")
h3("3.6.7. Tạo bảng")
p("{H:tt10_tao_bang} mô tả trình tự tạo bảng trống. Ảnh nền được tìm qua máy chủ để khoá API của Unsplash không lộ ra trình "
  "duyệt; khi người dùng chọn ảnh Unsplash, giao diện báo lượt dùng ảnh theo yêu cầu của Unsplash mà không chờ phản hồi. Tạo bảng"
  " từ mẫu dùng hai API riêng là POST /api/boards/from-template và /api/boards/from-saved-template, với cùng bước kiểm tra thành "
  "viên không gian.")
bdfig("tt10_tao_bang", "Biểu đồ trình tự: Tạo bảng")
h3("3.6.8. Thiết lập và thực thi luật tự động")
p("{H:tt11_luat_tu_dong} gồm hai phần: lưu luật và thực thi luật khi có thẻ mới. Luật chạy ngay trong yêu cầu tạo thẻ, sau khi "
  "thẻ đã được ghi; máy chủ đọc lại thẻ trước khi trả về để phản hồi phản ánh đúng kết quả của luật, chẳng hạn thẻ đã được đánh "
  "dấu hoàn thành.")
bdfig("tt11_luat_tu_dong", "Biểu đồ trình tự: Thiết lập và thực thi luật tự động")
h3("3.6.9. Tham gia bảng bằng liên kết mời")
p("{H:tt12_tham_gia_bang} mô tả trình tự tham gia bảng. Yêu cầu tham gia được đẩy tới giao diện của quản trị viên đang mở bảng "
  "qua sự kiện board:join-requests-changed. Khi duyệt, việc đổi trạng thái yêu cầu và thêm thành viên nằm trong cùng một giao "
  "dịch, sau đó người yêu cầu nhận thông báo qua phòng user:<id> của mình.")
bdfig("tt12_tham_gia_bang", "Biểu đồ trình tự: Tham gia bảng bằng liên kết mời")
h3("3.6.10. Thêm và sắp xếp danh sách")
p("{H:tt13_danh_sach} mô tả trình tự thêm và đổi vị trí danh sách. Cả hai thao tác đều kết thúc bằng sự kiện board:lists-changed,"
  " nên màn hình của các thành viên khác cập nhật theo cùng cơ chế với di chuyển thẻ ở {H:tt2_di_chuyen_the}.")
bdfig("tt13_danh_sach", "Biểu đồ trình tự: Thêm và sắp xếp danh sách")
h3("3.6.11. Di chuyển thẻ và đồng bộ thời gian thực")
p("{H:tt2_di_chuyen_the} cho thấy hai đặc điểm của thiết kế. Thứ nhất, giao diện của người thao tác cập nhật lạc quan trước khi "
  "máy chủ trả lời và hoàn tác nếu bị từ chối. Thứ hai, máy chủ không gửi nội dung thay đổi qua Socket.IO mà chỉ phát sự kiện "
  "board:lists-changed tới phòng của bảng; giao diện của các thành viên khác tự tải lại dữ liệu sau một khoảng trì hoãn ngắn để "
  "gộp nhiều sự kiện liên tiếp.")
bdfig("tt2_di_chuyen_the", "Biểu đồ trình tự: Di chuyển thẻ và đồng bộ thời gian thực")
h3("3.6.12. Bình luận trên thẻ")
p("{H:tt14_binh_luan} mô tả trình tự bình luận. Thông báo và sự kiện cập nhật đi theo hai loại phòng khác nhau: notification:new "
  "được gửi vào phòng user:<id> của từng người nhận, còn board:lists-changed được gửi vào phòng board:<id> để mọi người đang mở "
  "bảng tải lại bình luận.")
bdfig("tt14_binh_luan", "Biểu đồ trình tự: Bình luận trên thẻ")
h3("3.6.13. Tìm kiếm nâng cao")
p("{H:tt15_tim_kiem} mô tả trình tự tìm kiếm nâng cao. Điều kiện về quyền xem được ghép thẳng vào câu truy vấn thay vì lọc sau "
  "khi đọc, nên tổng số kết quả và phân trang luôn khớp với những gì người dùng được xem. Bộ lọc đã lưu là dữ liệu riêng của từng"
  " người dùng.")
bdfig("tt15_tim_kiem", "Biểu đồ trình tự: Tìm kiếm nâng cao")
h3("3.6.14. Nhắc hạn và nhận thông báo")
p("{H:tt16_nhac_han} mô tả trình tự nhắc hạn. Bộ lập lịch chạy trong cùng tiến trình máy chủ và tự quét mỗi 60 giây, không nhận "
  "yêu cầu từ giao diện. Khi nhận sự kiện notification:new, giao diện gọi lại API đếm số thông báo chưa đọc; khi người dùng bấm "
  "vào thông báo, thông báo được đánh dấu đã đọc rồi giao diện mở đúng bảng và thẻ liên quan.")
bdfig("tt16_nhac_han", "Biểu đồ trình tự: Nhắc hạn và nhận thông báo")
h3("3.6.15. Sinh và áp dụng kế hoạch bảng")
p("{H:tt3a_sinh_ke_hoach} mô tả bước sinh kế hoạch. Gemini chỉ được gọi trong nhánh đã cấu hình LLM, và đầu ra luôn được kiểm tra "
  "hình dạng bằng Zod trước khi dùng; nhánh còn lại dùng kết quả của tầng luật. Kết quả là một kế hoạch (BoardPlan) cùng mã lượt "
  "chạy; chưa có dữ liệu bảng nào được ghi.")
bdfig("tt3a_sinh_ke_hoach", "Biểu đồ trình tự: Sinh kế hoạch bảng")
p("{H:tt3b_ap_dung_ke_hoach} mô tả bước áp dụng. Máy chủ kiểm tra lại kế hoạch do giao diện gửi lên vì người dùng có thể đã "
  "chỉnh sửa, rồi trong một giao dịch vừa đánh dấu lượt chạy đã áp dụng vừa tạo toàn bộ bảng. Việc đánh dấu nằm trong cùng giao "
  "dịch bảo đảm áp dụng lặp không tạo dữ liệu trùng: hai yêu cầu đồng thời chỉ có một yêu cầu thành công, và nếu bước tạo bảng "
  "lỗi thì lượt chạy vẫn có thể được áp dụng lại.")
bdfig("tt3b_ap_dung_ke_hoach", "Biểu đồ trình tự: Áp dụng kế hoạch bảng")
h3("3.6.16. Gợi ý và giao việc")
p("{H:tt4a_xem_goi_y} mô tả bước tạo gợi ý: toàn bộ phép tính chạy trong tầng nghiệp vụ trên dữ liệu đọc từ cơ sở dữ liệu, không "
  "gọi dịch vụ bên ngoài, và mỗi lượt gợi ý được lưu thành một bản ghi AssignRun.")
bdfig("tt4a_xem_goi_y", "Biểu đồ trình tự: Xem gợi ý người phụ trách")
p("{H:tt4b_giao_va_hoc} mô tả bước giao việc. Việc giao thẻ dùng đúng API giao thành viên thông thường, sau đó giao diện gửi kết "
  "quả lựa chọn cho lượt gợi ý. Máy chủ chỉ chấp nhận kết quả khi người được chọn thực sự đã được giao vào thẻ, và chỉ cập nhật "
  "trọng số trong khung opt khi đủ điều kiện học.")
bdfig("tt4b_giao_va_hoc", "Biểu đồ trình tự: Giao thẻ theo gợi ý và học trọng số")
h3("3.6.17. Hỏi đáp với trợ lý ảo")
p("{H:tt17_tro_ly_ao} mô tả trình tự hỏi đáp. Mô hình ngôn ngữ không truy cập cơ sở dữ liệu: mọi truy vấn do máy chủ thực hiện "
  "bằng các công cụ chỉ đọc định nghĩa sẵn, với tham số được kiểm tra bằng Zod và quyền với phạm vi được kiểm tra ở từng lần gọi."
  " Mỗi lượt hỏi đáp được lưu vào lịch sử hội thoại; câu trả lời gồm các khối kết quả có ghi nguồn để người dùng đối chiếu.")
bdfig("tt17_tro_ly_ao", "Biểu đồ trình tự: Hỏi đáp với trợ lý ảo")

# ---------------- 3.7 ----------------
h2("3.7. Thiết kế cơ chế phân quyền")
p("Cơ chế phân quyền của TaskFlow gồm hai lớp. Lớp xác thực trả lời câu hỏi “người gọi là ai”: JWT trong cookie httpOnly được "
  "kiểm tra chữ ký, hạn và tokenVersion ở middleware requireAuth (mục 3.6.1). Lớp phân quyền trả lời câu hỏi “người này được làm "
  "gì trên đối tượng này” và được cài đặt ở tầng nghiệp vụ dưới dạng các hàm kiểm tra dùng chung, gọi ở đầu mỗi thao tác.")
p("Quyền trên một bảng được xác định từ ba nguồn: vai trò của người dùng trong bảng (OWNER, ADMIN, MEMBER, VIEWER), vai trò trong "
  "không gian chứa bảng (OWNER, ADMIN, MEMBER) và chế độ hiển thị của bảng (PRIVATE, WORKSPACE, PUBLIC). Từ đó hình thành bốn mức "
  "quyền tăng dần: xem (assertBoardView), sửa nội dung (assertBoardAccess), quản lý (assertBoardManage) và chủ sở hữu "
  "(assertBoardOwner). Bảng ở chế độ WORKSPACE cho mọi thành viên của không gian quyền sửa; bảng PUBLIC cho bất kỳ ai quyền xem "
  "nhưng không cho sửa. Chủ sở hữu và quản trị viên của không gian có quyền quản lý thành viên của mọi bảng trong không gian, "
  "nhưng không tự động được xem nội dung bảng PRIVATE nếu không phải thành viên của bảng đó. {B:matran} tóm tắt quyền theo vai trò.")
tbl("matran", "Ma trận phân quyền trên một bảng", ["Thao tác", "Khách", "Người xem", "Thành viên", "Quản trị viên", "Chủ sở hữu"], [
    ["Xem bảng, thẻ, bình luận, tải tệp đính kèm", "Chỉ bảng công khai", "Có", "Có", "Có", "Có"],
    ["Theo dõi, đặt nhắc hạn, xuất bảng ra JSON", "–", "Có", "Có", "Có", "Có"],
    ["Thêm, sửa, di chuyển, lưu trữ danh sách và thẻ; bình luận; đính kèm", "–", "–", "Có", "Có", "Có"],
    ["Cấu hình nhãn, trường tùy chỉnh, luật tự động, lịch định kỳ, mẫu thẻ", "–", "–", "Có", "Có", "Có"],
    ["Xem gợi ý và lập kế hoạch phân công", "–", "–", "Có", "Có", "Có"],
    ["Mời, xóa thành viên, đổi vai trò, liên kết mời, duyệt yêu cầu, đổi chế độ hiển thị", "–", "–", "–", "Có", "Có"],
    ["Xem CV của thành viên (khi chủ CV cho phép)", "–", "–", "–", "Có", "Có"],
    ["Lưu trữ, xóa bảng; chuyển quyền sở hữu", "–", "–", "–", "–", "Có"],
], [3700, 1100, 900, 950, 1000, 850])
p("Cùng một bộ hàm kiểm tra được dùng cho mọi kênh truy cập: API REST, việc phục vụ tệp đính kèm (đường dẫn /uploads/cards kiểm "
  "tra quyền xem bảng chứa tệp thay vì phục vụ tệp tĩnh) và việc vào phòng Socket.IO của bảng. Khi người dùng bị xóa khỏi bảng "
  "hoặc không gian, hoặc khi bảng đổi chế độ hiển thị, máy chủ chủ động đưa các kết nối không còn đủ quyền ra khỏi phòng của bảng; "
  "khi người dùng đổi mật khẩu, mọi kết nối đang mở của họ bị ngắt. Với các tài nguyên cần tránh lộ sự tồn tại, như lượt chạy AI "
  "hay CV của người khác, máy chủ trả mã 404 thay vì 403.")

# ---------------- 3.8 ----------------
h2("3.8. Thiết kế cơ chế thời gian thực")
p("Kênh thời gian thực dùng Socket.IO. Khi kết nối, máy chủ xác thực bằng chính JWT trong cookie và tokenVersion như với API REST. "
  "Mỗi kết nối tự động vào phòng riêng của người dùng (user:<id>); khi mở một bảng, giao diện gửi yêu cầu vào phòng của bảng "
  "(board:<id>) và máy chủ chỉ chấp nhận nếu người dùng có quyền xem bảng. Danh sách người đang mở bảng được tính từ các kết nối "
  "trong phòng và được phát lại mỗi khi có người vào hoặc ra. {B:sukien} liệt kê các sự kiện.")
tbl("sukien", "Các sự kiện thời gian thực", ["Sự kiện", "Phòng", "Khi nào phát", "Phản ứng của giao diện"], [
    ["board:lists-changed", "board", "Mọi thay đổi nội dung bảng: thẻ, danh sách, checklist, bình luận, mô tả", "Trang bảng và cửa sổ chi tiết thẻ tải lại sau 400 ms"],
    ["board:members-changed", "board", "Thêm, xóa thành viên, đổi vai trò, chuyển quyền sở hữu", "Tải lại danh sách thành viên và quyền"],
    ["board:meta-changed", "board", "Đổi tên, màu, ảnh nền, chế độ hiển thị, chủ bảng", "Tải lại thông tin bảng"],
    ["board:join-requests-changed", "board", "Có yêu cầu tham gia mới, được duyệt hoặc bị từ chối", "Cập nhật danh sách yêu cầu tham gia"],
    ["board:presence", "board", "Có người mở hoặc rời bảng", "Hiển thị người đang trực tuyến"],
    ["board:removed", "user", "Người nhận bị xóa khỏi bảng", "Rời trang bảng, về danh sách bảng"],
    ["board:access-changed", "user", "Danh sách bảng người nhận được xem thay đổi", "Tải lại danh sách bảng"],
    ["workspace:changed", "user", "Không gian hoặc thành viên không gian thay đổi", "Tải lại không gian và bảng"],
    ["notification:new", "user", "Có thông báo mới", "Cập nhật chuông thông báo"],
], [2700, 800, 2700, 2300])
p("Thiết kế dùng sự kiện thô: board:lists-changed bao trùm mọi thay đổi nội dung bảng thay vì gửi chi tiết từng trường. Trang bảng "
  "và cửa sổ chi tiết thẻ lắng nghe độc lập, mỗi bên trì hoãn 400 ms rồi tải lại phần dữ liệu của mình; cửa sổ chi tiết thẻ bỏ qua "
  "việc tải lại khi người dùng đang gõ tiêu đề hoặc mô tả để không làm mất bản nháp. Khi mất kết nối rồi kết nối lại, giao diện tự "
  "vào lại phòng của bảng và tải bù dữ liệu. Ưu điểm của cách làm này là đơn giản, không có nguy cơ hai phía lệch trạng thái và "
  "không phải lọc nội dung theo quyền trên kênh thời gian thực; đổi lại là một lượt tải lại dữ liệu cho mỗi nhóm thay đổi, chấp "
  "nhận được với quy mô nhóm nhỏ và vừa đã xác định ở mục 1.3.2.")

# ---------------- 3.9 ----------------
h2("3.9. Vị trí của các thành phần AI trong kiến trúc")
p("Hai cơ chế hỗ trợ quyết định của khóa luận được cài đặt thành hai module độc lập trong tầng nghiệp vụ: module ai (sinh bảng) và "
  "các module assign, declaredProfile (gợi ý phân công). Chúng dùng chung hạ tầng của nền tảng (xác thực, phân quyền, cơ sở dữ "
  "liệu, nhật ký hoạt động, thông báo) nhưng không thay đổi luồng nghiệp vụ hiện có: kết quả của AI chỉ đi vào hệ thống thông qua "
  "đúng các thao tác mà người dùng vẫn thực hiện bằng tay, như tạo bảng, tạo thẻ hay giao thành viên. {B:ai} so sánh vị trí của "
  "hai module và của trợ lý ảo.")
tbl("ai", "Vị trí của các thành phần AI trong hệ thống", ["Tiêu chí", "Module sinh bảng (UC11)", "Module gợi ý phân công (UC12)", "Trợ lý ảo (UC13)"], [
    ["Điểm tích hợp trên giao diện", "Hộp thoại tạo bảng bằng AI", "Cửa sổ chi tiết thẻ; menu của danh sách (kế hoạch phân công)", "Nút trợ lý trên mọi trang"],
    ["API chính", "POST /api/ai/board-plans; POST /api/ai/board-plans/:runId/apply", "GET /api/cards/:id/assignment-suggestions; POST /api/lists/:id/assignment-plan; POST /api/assignment/runs/:runId/outcome", "/api/chat"],
    ["Dữ liệu đầu vào", "Mô tả dự án (văn bản, DOCX, PDF)", "Lịch sử thẻ đã hoàn thành, nhật ký, hồ sơ, trọng số của không gian", "Câu hỏi và dữ liệu trong phạm vi được xem"],
    ["Dùng LLM", "Có, tùy chọn (Gemini); luôn có tầng luật", "Không (TF-IDF, ước lượng thống kê, học trực tuyến)", "Có (Gemini)"],
    ["Ghi dữ liệu nghiệp vụ", "Chỉ khi người dùng xác nhận áp dụng", "Chỉ khi người dùng chọn người để giao", "Không ghi"],
    ["Khi dịch vụ ngoài lỗi", "Dùng kết quả tầng luật kèm cảnh báo", "Không phụ thuộc dịch vụ ngoài", "Báo không xử lý được câu hỏi"],
    ["Nhật ký phục vụ đánh giá", "AiRun", "AssignRun, AssignWeightHistory", "Lượt hội thoại"],
], [1800, 2000, 2900, 1800])
p("Thiết kế này thể hiện ba nguyên tắc đã xác lập ở Chương 2. Thứ nhất, con người trong vòng lặp: không module nào tự ghi dữ liệu "
  "nghiệp vụ khi chưa có xác nhận. Thứ hai, không phụ thuộc cứng vào LLM: module sinh bảng luôn có tầng luật làm nền, module gợi ý "
  "phân công không dùng LLM. Thứ ba, khả năng đánh giá: mỗi lượt chạy được lưu kèm đầu vào, đầu ra, độ trễ và quyết định cuối cùng "
  "của người dùng, tạo thành dữ liệu cho Chương 6. Thiết kế chi tiết bên trong hai module được trình bày ở Chương 4; các vấn đề "
  "cài đặt như hợp đồng API, giao dịch, giới hạn tần suất và kiểm thử được trình bày ở Chương 5.")

h2("Tiểu kết chương 3")
p("Chương 3 đã phân tích và thiết kế nền tảng TaskFlow. Về chức năng, hệ thống được mô hình hóa thành 13 use case tổng quát với hai "
  "tác nhân chính ở mức tổng quát và các tác nhân theo vai trò ở mức phân rã, kèm đặc tả sáu use case tiêu biểu, 17 biểu đồ hoạt động và 21 biểu đồ trình tự phủ đủ 13 nhóm chức năng. "
  "Về thiết kế, hệ thống theo kiến trúc khách – chủ ba tầng với tầng nghiệp vụ là nơi duy nhất truy cập dữ liệu và kiểm "
  "tra quyền; cơ sở dữ liệu gồm 43 bảng với các quyết định về xóa mềm, thứ tự hiển thị, đồng bộ trạng thái và nhật ký hoạt động; "
  "cơ chế phân quyền hai lớp được áp dụng thống nhất cho API, tệp đính kèm và kênh thời gian thực; cơ chế thời gian thực dùng sự "
  "kiện thô kết hợp tải lại dữ liệu. Hai cơ chế hỗ trợ quyết định được đặt thành hai module độc lập, chỉ đi vào hệ thống qua các "
  "thao tác thông thường sau khi người dùng xác nhận. Chương 4 sẽ trình bày chi tiết phương pháp thiết kế bên trong hai module này.")

# ============================ PHỤ LỤC A ============================
GROUPS = [("UC01", ["uc01_xac_thuc"]), ("UC02", ["uc02_cong_khai"]), ("UC03", ["uc03_tai_khoan"]), ("UC04", ["uc04_khong_gian"]),
          ("UC05", ["uc05a_bang", "uc05b_cau_hinh_tu_dong_hoa"]), ("UC06", ["uc06_chia_se"]), ("UC07", ["uc07_danh_sach"]),
          ("UC08", ["uc08a_the", "uc08b_cong_tac"]), ("UC09", ["uc09_tra_cuu"]), ("UC10", ["uc10_thong_bao"]),
          ("UC11", ["uc11_ai_sinh_bang"]), ("UC12", ["uc12_phan_cong"]), ("UC13", ["uc13_tro_ly"])]
GEN_NAME = {u["code"]: u["name"] for u in UC_BY_KEY["uc00_tong_quat"]["useCases"]}


# ============================ DỰNG XML ============================

def fmt_runs(text, base_rpr=""):
    """Chuỗi có **đậm** / __nghiêng__ -> các <w:r>."""
    out = []
    for part in re.split(r"(\*\*.+?\*\*|__.+?__)", text):
        if not part:
            continue
        rpr = base_rpr
        if part.startswith("**"):
            part, rpr = part[2:-2], base_rpr + "<w:b/>"
        elif part.startswith("__"):
            part, rpr = part[2:-2], base_rpr + "<w:i/>"
        rp = f"<w:rPr>{rpr}</w:rPr>" if rpr else ""
        out.append(f'<w:r>{rp}<w:t xml:space="preserve">{escape(part)}</w:t></w:r>')
    return "".join(out)


def x_heading(level, text):
    return f'<w:p><w:pPr><w:pStyle w:val="{level}"/>{"" if level == 1 else "<w:keepNext/>"}</w:pPr>{fmt_runs(text)}</w:p>'


def x_para(text):
    return f'<w:p><w:pPr><w:ind w:firstLine="567"/></w:pPr>{fmt_runs(text)}</w:p>'


def x_li(text):
    return f'<w:p><w:pPr><w:ind w:left="567" w:hanging="283"/></w:pPr>{fmt_runs("– " + text)}</w:p>'


def x_table_caption(text):
    return (f'<w:p><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="60"/><w:jc w:val="center"/></w:pPr>'
            f'<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')


def x_fig_caption(text):
    return (f'<w:p><w:pPr><w:spacing w:before="60" w:after="240"/><w:jc w:val="center"/></w:pPr>'
            f'<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')


def x_cell(width, paras, header=False, shade=None, align="left", bold=False, keep=False):
    sh = f'<w:shd w:val="clear" w:color="auto" w:fill="{shade}"/>' if shade else ""
    ps = []
    for t in paras:
        rpr = "<w:sz w:val=\"24\"/><w:szCs w:val=\"24\"/>" + ("<w:b/>" if (header or bold) else "")
        kn = "<w:keepNext/>" if keep else ""
        ps.append(f'<w:p><w:pPr>{kn}<w:spacing w:before="40" w:after="40" w:line="264" w:lineRule="auto"/>'
                  f'<w:jc w:val="{"center" if header else align}"/></w:pPr>{fmt_runs(t, rpr)}</w:p>')
    return (f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/>{sh}<w:vAlign w:val="center"/></w:tcPr>'
            + "".join(ps) + "</w:tc>")


def x_table(header, rows, widths, center_cols=()):
    total = sum(widths)
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    out = [f'<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="{total}" w:type="dxa"/><w:jc w:val="center"/>'
           '<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
           '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
           '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
           '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="85" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar>'
           f'<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>{grid}</w:tblGrid>']
    if header:
        out.append('<w:tr><w:trPr><w:cantSplit/><w:tblHeader/><w:jc w:val="center"/></w:trPr>'
                   + "".join(x_cell(w, [h], header=True, shade="D9E2F3") for w, h in zip(widths, header)) + "</w:tr>")
    for r in rows:
        cells = []
        for k, (w, v) in enumerate(zip(widths, r)):
            paras = v if isinstance(v, list) else [v]
            cells.append(x_cell(w, paras, align="center" if k in center_cols else "left"))
        out.append('<w:tr><w:trPr><w:cantSplit/><w:jc w:val="center"/></w:trPr>' + "".join(cells) + "</w:tr>")
    out.append("</w:tbl>")
    return "".join(out)


def x_spec_table(rows):
    widths = [2000, 6500]
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    out = [f'<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="8500" w:type="dxa"/><w:jc w:val="center"/>'
           '<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
           '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
           '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
           '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="85" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar>'
           f'<w:tblLook w:val="04A0" w:firstRow="0" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>{grid}</w:tblGrid>']
    for i, (label, paras) in enumerate(rows):
        keep = i < len(rows) - 1  # giữ cả bảng đặc tả trên một trang khi vừa
        out.append('<w:tr><w:trPr><w:cantSplit/><w:jc w:val="center"/></w:trPr>'
                   + x_cell(widths[0], [label], shade="EEF3FA", bold=True, keep=keep) + x_cell(widths[1], paras, keep=keep) + "</w:tr>")
    out.append("</w:tbl>")
    return "".join(out)


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    w, h = struct.unpack(">II", head[16:24])
    return w, h


class Media:
    def __init__(self):
        self.items = []  # (rid, zipname, srcpath)
        self.next_doc_pr = 7001

    def add(self, src):
        rid = f"rIdC3img{len(self.items) + 1}"
        name = f"media/c3_{len(self.items) + 1:02d}_{os.path.basename(src)}"
        self.items.append((rid, name, src))
        return rid


MEDIA = Media()


def x_figure(path, caption_text):
    if not os.path.exists(path):
        raise SystemExit(f"Thiếu hình {path} - hãy chạy các script vẽ trước")
    wpx, hpx = png_size(path)
    wpx, hpx = wpx / 2, hpx / 2  # PNG chụp ở tỉ lệ 2x
    w_cm = min(TEXT_W_CM, wpx * CM_PER_PX)
    h_cm = w_cm * hpx / wpx
    if h_cm > MAX_H_CM:
        h_cm, w_cm = MAX_H_CM, MAX_H_CM * wpx / hpx
    cx, cy = int(w_cm * EMU_PER_CM), int(h_cm * EMU_PER_CM)
    rid = MEDIA.add(path)
    did = MEDIA.next_doc_pr
    MEDIA.next_doc_pr += 1
    name = escape(os.path.basename(path))
    drawing = (
        f'<w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
        f'<wp:extent cx="{cx}" cy="{cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="{did}" name="Hình {did}"/>'
        f'<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        f'<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        f'<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="{did}" name="{name}"/>'
        f'<pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr>'
        f'<pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        f'<pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></pic:spPr>'
        f'</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>')
    return (f'<w:p><w:pPr><w:keepNext/><w:spacing w:after="60"/><w:jc w:val="center"/></w:pPr>{drawing}</w:p>'
            + x_fig_caption(caption_text))


def build_chapter():
    # Đánh số trước để tham chiếu {H:..} / {B:..} trỏ đúng
    fig_no, tab_no = {}, {}
    fcaps, tcaps = [], []
    for b in C:
        if b[0] == "fig":
            fig_no[b[1]] = f"Hình 3.{len(fig_no) + 1}"
            fcaps.append(f"{fig_no[b[1]]}: {b[3]}")
        elif b[0] in ("tbl", "spec"):
            tab_no[b[1]] = f"Bảng 3.{len(tab_no) + 1}"
            tcaps.append(f"{tab_no[b[1]]}: {b[2]}")

    def refs(t):
        def rep(m):
            kind, key = m.group(1), m.group(2)
            table = fig_no if kind == "H" else tab_no
            if key not in table:
                raise SystemExit(f"Tham chiếu không tồn tại: {m.group(0)}")
            return table[key]
        return re.sub(r"\{([HB]):([a-z0-9_]+)\}", rep, t)

    out = []
    for b in C:
        k = b[0]
        if k == "h1":
            out.append(x_heading(1, b[1]))
        elif k == "h2":
            out.append(x_heading(2, b[1]))
        elif k == "h3":
            out.append(x_heading(3, b[1]))
        elif k == "p":
            out.append(x_para(refs(b[1])))
        elif k == "li":
            out.append(x_li(refs(b[1])))
        elif k == "fig":
            out.append(x_figure(b[2], f"{fig_no[b[1]]}: {b[3]}"))
        elif k == "tbl":
            _, key, cap, header, rows_, widths = b
            centers = (0,) if key in ("tacnhan", "chucnang", "phichucnang") else ()
            if key == "matran":
                centers = (1, 2, 3, 4, 5)
            out.append(x_table_caption(f"{tab_no[key]}: {cap}"))
            out.append(x_table(header, rows_, widths, centers))
        elif k == "spec":
            _, key, cap, rows_ = b
            out.append(x_table_caption(f"{tab_no[key]}: {cap}"))
            out.append(x_spec_table(rows_))
    return "".join(out), fcaps, tcaps


def build_appendix():
    out = [
        '<w:p><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="28"/></w:rPr>'
        '<w:t xml:space="preserve">Phụ lục A: Danh sách chi tiết các use case</w:t></w:r></w:p>',
        x_para("Phụ lục này liệt kê toàn bộ các use case con của 13 use case tổng quát ở mục 3.2, theo đúng mã trên các biểu đồ "
               "phân rã. Cột “Tác nhân / quan hệ” ghi tác nhân liên kết trực tiếp và các quan hệ «include», «extend» của use case."),
    ]
    for i, (code, keys) in enumerate(GROUPS, 1):
        out.append('<w:p><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="120" w:line="259" w:lineRule="auto"/></w:pPr>'
                   '<w:r><w:rPr><w:b/><w:bCs/><w:i/><w:iCs/><w:sz w:val="28"/></w:rPr>'
                   f'<w:t xml:space="preserve">Phụ lục A.{i}: {code} {escape(GEN_NAME[code])}</w:t></w:r></w:p>')
        rows = []
        for key in keys:
            for u in UC_BY_KEY[key]["useCases"]:
                who = ", ".join(u["actors"])
                if u["relation"]:
                    who = (who + "; " if who else "") + u["relation"]
                rows.append([u["code"], u["name"], who, u["desc"]])
        out.append(x_table_caption(f"Bảng A.{i}: Các use case con của {code} {GEN_NAME[code]}"))
        out.append(x_table(["Mã", "Use case", "Tác nhân / quan hệ", "Mô tả"], rows, [1150, 2050, 2000, 3300], center_cols=(0,)))
    return "".join(out)


# ============================ CHÈN VÀO TỆP GỐC ============================

def para_bounds(xml, i):
    s = max(xml.rfind("<w:p ", 0, i), xml.rfind("<w:p>", 0, i))
    e = xml.find("</w:p>", i) + 6
    return s, e


def plain(par_xml):
    return "".join(re.findall(r"<w:t(?: [^>]*)?>([^<]*)</w:t>", par_xml))


def find_par_by_text(xml, startswith, start=0, end=None):
    end = len(xml) if end is None else end
    for m in re.finditer(r"<w:p[ >]", xml[start:end]):
        s = start + m.start()
        e = xml.find("</w:p>", s) + 6
        if plain(xml[s:e]).strip().startswith(startswith):
            return s, e
    raise SystemExit(f"Không tìm thấy đoạn bắt đầu bằng: {startswith}")


def main():
    zin = zipfile.ZipFile(SRC)
    files = {n: zin.read(n) for n in zin.namelist()}
    doc = files["word/document.xml"].decode("utf-8")
    body_start = doc.find("LỜI CAM ĐOAN")  # sau trang bìa (tránh hộp văn bản lồng nhau)

    chapter_xml, fcaps, tcaps = build_chapter()

    # 1) Thay khối giữ chỗ Chương 3: từ đoạn "CHƯƠNG 3. THIẾT KẾ HỆ THỐNG" tới trước đoạn ngắt trang trước "CHƯƠNG………"
    i3 = doc.find("THIẾT KẾ HỆ THỐNG")
    s3, _ = para_bounds(doc, i3)
    nxt_s, _ = find_par_by_text(doc, "CHƯƠNG………", start=i3)
    brk_s = max(doc.rfind("<w:p ", 0, nxt_s - 1), doc.rfind("<w:p>", 0, nxt_s - 1))
    brk = doc[brk_s:nxt_s]
    if 'w:type="page"' not in brk:
        raise SystemExit("Không thấy ngắt trang trước CHƯƠNG……… - cấu trúc tệp đã khác mẫu")
    doc = doc[:s3] + chapter_xml + doc[brk_s:]

    # 2) Phụ lục A: từ "Phụ lục A: Tên nội dung phụ lục" tới trước đoạn ngắt trang trước "Phụ lục B:"
    a_s, _ = find_par_by_text(doc, "Phụ lục A: Tên nội dung", start=body_start)
    b_s, _ = find_par_by_text(doc, "Phụ lục B:", start=a_s)
    brk_s = max(doc.rfind("<w:p ", 0, b_s - 1), doc.rfind("<w:p>", 0, b_s - 1))
    if 'w:type="page"' not in doc[brk_s:b_s]:
        raise SystemExit("Không thấy ngắt trang trước Phụ lục B")
    doc = doc[:a_s] + build_appendix() + doc[brk_s:]

    # 3) Danh mục bảng / hình: thay mục mẫu "Bảng 3.1: Tên nội dung bảng" và "Hình 3.1: Tên nội dung hình"
    def replace_list_entry(doc, prefix, caps):
        s, e = find_par_by_text(doc, prefix, start=body_start)
        old = doc[s:e]
        ppr = re.search(r"<w:pPr>.*?</w:pPr>", old, flags=re.S).group(0)
        new = "".join(f'<w:p>{ppr}<w:r><w:t xml:space="preserve">{escape(c)}</w:t></w:r><w:r><w:tab/><w:t>…</w:t></w:r></w:p>'
                      for c in caps)
        return doc[:s] + new + doc[e:]
    doc = replace_list_entry(doc, "Bảng 3.1", tcaps)
    doc = replace_list_entry(doc, "Hình 3.1", fcaps)

    # 4) Tên Chương 3 ở mục 1.6 và tiểu kết Chương 2 (theo tên đã chốt)
    old16 = ("Chương 3, Phân tích và kiến trúc hệ thống TaskFlow, trình bày yêu cầu, kiến trúc tổng thể, mô hình dữ liệu, "
             "cơ chế phân quyền, cơ chế thời gian thực và vị trí của các thành phần AI trong kiến trúc.")
    new16 = ("Chương 3, Phân tích và thiết kế hệ thống TaskFlow, trình bày yêu cầu, các biểu đồ use case, biểu đồ hoạt động, "
             "biểu đồ trình tự, kiến trúc tổng thể, thiết kế cơ sở dữ liệu, cơ chế phân quyền, cơ chế thời gian thực và vị trí "
             "của các thành phần AI trong kiến trúc.")
    old2 = "Chương 3 sẽ trình bày phân tích và kiến trúc của nền tảng TaskFlow"
    new2 = "Chương 3 sẽ trình bày phân tích và thiết kế của nền tảng TaskFlow"
    for o, n in ((old16, new16), (old2, new2)):
        if doc.count(o) != 1:
            print(f"CẢNH BÁO: không sửa được câu (không tìm thấy nguyên vẹn): {o[:60]}...")
        else:
            doc = doc.replace(o, n)

    # 5) Danh mục từ viết tắt: thêm các từ mới, giữ thứ tự chữ cái
    new_abbr = [("CSDL", "Cơ sở dữ liệu", None), ("ERD", "Sơ đồ thực thể – liên kết", "Entity Relationship Diagram"),
                ("JWT", "Mã thông báo web dạng JSON", "JSON Web Token"), ("ORM", "Ánh xạ đối tượng – quan hệ", "Object Relational Mapping"),
                ("REST", "Kiểu kiến trúc chuyển trạng thái đại diện", "Representational State Transfer"),
                ("SMTP", "Giao thức truyền thư đơn giản", "Simple Mail Transfer Protocol"),
                ("SPA", "Ứng dụng trang đơn", "Single Page Application"), ("UC", "Ca sử dụng", "Use case"),
                ("UML", "Ngôn ngữ mô hình hóa thống nhất", "Unified Modeling Language")]
    t0 = doc.find("<w:tbl>", doc.find("DANH MỤC CÁC TỪ VIẾT TẮT", body_start))
    t1 = doc.find("</w:tbl>", t0) + 8
    table = doc[t0:t1]
    rows = re.findall(r"<w:tr[ >].*?</w:tr>", table, flags=re.S)
    head, body_rows = rows[0], rows[1:]
    template = next(r for r in body_rows if ">AI<" in r)
    existing = {plain(re.search(r"<w:tc>.*?</w:tc>", r, flags=re.S).group(0)).strip(): r for r in body_rows}

    def fill_cell(cell, texts):
        """Giữ đúng số đoạn = số chuỗi; đoạn i nhận chuỗi i (định dạng chép từ đoạn mẫu)."""
        paras = re.findall(r"<w:p[ >].*?</w:p>", cell, flags=re.S)
        new_paras = []
        for k, t in enumerate(texts):
            src_p = paras[min(k, len(paras) - 1)]
            first = True
            def sub(m):
                nonlocal first
                if first:
                    first = False
                    return f'<w:t xml:space="preserve">{escape(t)}</w:t>'
                return ""
            q = re.sub(r"<w:t(?: [^>]*)?>[^<]*</w:t>", sub, src_p)
            new_paras.append(q)
        start = cell.find(paras[0])
        end = cell.rfind(paras[-1]) + len(paras[-1])
        return cell[:start] + "".join(new_paras) + cell[end:]

    def make_row(abbr, viet, eng):
        r = re.sub(r' w14:paraId="[^"]*"', "", template)
        r = re.sub(r' w14:textId="[^"]*"', "", r)
        cells = re.findall(r"<w:tc>.*?</w:tc>", r, flags=re.S)
        meaning = [viet] + ([f"({eng})"] if eng else [])
        return r.replace(cells[0], fill_cell(cells[0], [abbr])).replace(cells[1], fill_cell(cells[1], meaning))
    for a, viet, eng in new_abbr:
        if a not in existing:
            existing[a] = make_row(a, viet, eng)
    ordered = [existing[k] for k in sorted(existing, key=lambda s: s.upper())]
    new_table = table[: table.find(head)] + head + "".join(ordered) + "</w:tbl>"
    doc = doc[:t0] + new_table + doc[t1:]

    files["word/document.xml"] = doc.encode("utf-8")

    # 6) Ảnh: thêm tệp media + quan hệ; bảo đảm có kiểu png
    rels = files["word/_rels/document.xml.rels"].decode("utf-8")
    add = "".join(f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="{name}"/>'
                  for rid, name, _ in MEDIA.items)
    rels = rels.replace("</Relationships>", add + "</Relationships>")
    files["word/_rels/document.xml.rels"] = rels.encode("utf-8")
    for rid, name, src in MEDIA.items:
        files["word/" + name] = open(src, "rb").read()
    ct = files["[Content_Types].xml"].decode("utf-8")
    if 'Extension="png"' not in ct:
        ct = ct.replace("<Types ", "<Types ", 1).replace("</Types>", '<Default Extension="png" ContentType="image/png"/></Types>')
        files["[Content_Types].xml"] = ct.encode("utf-8")

    os.makedirs(os.path.dirname(os.path.abspath(DST)), exist_ok=True)
    with open(os.path.join(HERE, "_chu_thich_chuong3.json"), "w", encoding="utf-8") as f:
        json.dump({"captions": tcaps + fcaps}, f, ensure_ascii=False, indent=1)
    with zipfile.ZipFile(DST, "w", zipfile.ZIP_DEFLATED) as zout:
        for n in zin.namelist():
            zout.writestr(zin.getinfo(n), files[n])
        for rid, name, src in MEDIA.items:
            zout.write(src, "word/" + name)
    print(f"Đã ghi {os.path.abspath(DST)}: {len(fcaps)} hình, {len(tcaps)} bảng ở Chương 3, {len(GROUPS)} bảng ở Phụ lục A")


if __name__ == "__main__":
    main()
