"""Áp các sửa đổi chương 1-2 khóa luận (hướng A: nội dung chương khớp với mã đang chạy).

Nội dung từng thay thế lấy nguyên văn từ docs/bao-cao/DE_XUAT_SUA_CHUONG_1_2_MUC_1.md (mục A-E, user duyệt 16/10/2026).
Mỗi thay thế phải khớp ĐÚNG MỘT chỗ trong vùng của nó (chương 1, chương 2, danh mục tài liệu); không khớp hoặc khớp
nhiều chỗ thì dừng và KHÔNG ghi tệp ra.

Ngoài các đoạn văn, script còn:
  - thay công thức (2.1), (2.6), (2.8) và đổi dấu trong (2.10);
  - sửa hai dòng Bảng 1.1, thêm ba dòng vào đầu Bảng 2.4;
  - thêm ba tài liệu [13]-[15], đánh số lại [13]-[45] cũ thành [16]-[48] (chỉ chương 2 và danh mục tài liệu);
  - thay ảnh Hình 1.1 bằng bieu-do/png/h11_vi_tri_hai_co_che.png (vẽ bằng: python bieu-do/ve_bieu_do.py h11);
  - đặt lại số trang trong DANH MỤC BẢNG / DANH MỤC HÌNH thành "…" và ghi _chu_thich_v3.json để
    cap_nhat_trang_word.ps1 -CaptionFile _chu_thich_v3.json điền lại số trang mới.

Dùng: python sua_chuong12.py <vào.docx> <ra.docx>
Lưu ý: tao_chuong3.py lấy chương 1-2 từ tệp mẫu; nếu sinh lại chương 3 thì chạy lại script này lên tệp kết quả.
"""
import json
import os
import re
import struct
import sys
import zipfile
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
HINH_1_1 = os.path.join(HERE, "bieu-do", "png", "h11_vi_tri_hai_co_che.png")
CAPTION_OUT = os.path.join(HERE, "_chu_thich_v3.json")
ZWSP = chr(0x200B)
ELLIPSIS = chr(0x2026)

P_RE = re.compile(r"<w:p[ >].*?</w:p>", re.S)
T_RE = re.compile(r"<w:t(?: [^>]*)?>([^<]*)</w:t>")
RUN_RE = re.compile(r"<w:r(?: [^>]*)?>(<w:rPr>.*?</w:rPr>)?(.*?)</w:r>", re.S)
SIMPLE_RUN_BODY = re.compile(r"^(?:<w:t(?: [^>]*)?>[^<]*</w:t>|<w:tab/>|<w:lastRenderedPageBreak/>)*$")
CITE_RE = re.compile(r"\[(\d+)\]")


class Loi(Exception):
    pass


# ----------------------------------------------------------------------------- công thức (OMML)

FM = '<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr>'


def _mt(s):
    sp = ' xml:space="preserve"' if (s != s.strip() or "  " in s) else ""
    return f"<m:t{sp}>{escape(s)}</m:t>"


def v(s):  # biến (nghiêng)
    return f"<m:r>{FM}{_mt(s)}</m:r>"


def o(s):  # toán tử / chữ đứng
    return f'<m:r><m:rPr><m:sty m:val="p"/></m:rPr>{FM}{_mt(s)}</m:r>'


def scr(s):  # chữ viết tay đứng (ký hiệu tập hợp, như 𝒜 trong (2.9))
    return f'<m:r><m:rPr><m:scr m:val="script"/><m:sty m:val="p"/></m:rPr>{FM}{_mt(s)}</m:r>'


def nor(s):  # chữ thường của văn bản (số hiệu công thức)
    return f"<m:r><m:rPr><m:nor/></m:rPr>{_mt(s)}</m:r>"


def _ctrl():
    return f"<m:ctrlPr>{FM}</m:ctrlPr>"


def sub(base, s):
    return f"<m:sSub><m:sSubPr>{_ctrl()}</m:sSubPr><m:e>{base}</m:e><m:sub>{s}</m:sub></m:sSub>"


def xi(name, idx):
    return sub(v(name), v(idx))


def frac(num, den):
    return f"<m:f><m:fPr>{_ctrl()}</m:fPr><m:num>{num}</m:num><m:den>{den}</m:den></m:f>"


def nsum(idx, body):
    return (f'<m:nary><m:naryPr><m:chr m:val="∑"/><m:limLoc m:val="undOvr"/><m:supHide m:val="1"/>{_ctrl()}'
            f"</m:naryPr><m:sub>{idx}</m:sub><m:sup>{v(ZWSP)}</m:sup><m:e>{body}</m:e></m:nary>")


def M(*parts):
    return ("m", "<m:oMath>" + "".join(parts) + "</m:oMath>")


def display(tag, *parts):
    return "<m:oMath>" + "".join(parts) + v("  ") + nor(f"({tag})") + "</m:oMath>"


# ----------------------------------------------------------------------------- tiện ích XML


def unesc(s):
    return s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'").replace("&amp;", "&")


def wtext(p):
    """Chữ thường của đoạn (bỏ công thức)."""
    p2 = re.sub(r"<m:oMath>.*?</m:oMath>", "", p, flags=re.S)
    return unesc("".join(T_RE.findall(p2)))


def split_para(p):
    m = re.match(r"(<w:p(?: [^>]*)?>)(<w:pPr>.*?</w:pPr>)?(.*)(</w:p>)$", p, re.S)
    if not m:
        raise Loi("không tách được đoạn: " + p[:120])
    return m.group(1), m.group(2) or "", m.group(3), m.group(4)


def run_text(body):
    """Chữ (kèm \\t) của phần thân một run đơn giản."""
    out = []
    for m in re.finditer(r"<w:t(?: [^>]*)?>([^<]*)</w:t>|<w:tab/>", body):
        out.append("\t" if m.group(0) == "<w:tab/>" else unesc(m.group(1)))
    return "".join(out)


def make_run(rpr, text):
    parts = []
    for i, chunk in enumerate(text.split("\t")):
        if i:
            parts.append("<w:tab/>")
        if chunk:
            parts.append(f'<w:t xml:space="preserve">{escape(chunk)}</w:t>')
    return f"<w:r>{rpr or ''}{''.join(parts)}</w:r>"


def merged_items(body):
    """Tách thân đoạn thành danh sách: ('run', rPr, text) cho các run chữ liền nhau cùng rPr đã gộp,
    ('raw', xml) cho mọi thứ khác (công thức, đánh dấu, ảnh...)."""
    items = []
    pos = 0
    for m in RUN_RE.finditer(body):
        if m.start() > pos:
            items.append(("raw", body[pos:m.start()]))
        rpr, rb = m.group(1) or "", m.group(2)
        if SIMPLE_RUN_BODY.match(rb):
            text = run_text(rb)
            if items and items[-1][0] == "run" and items[-1][1] == rpr and m.start() == pos:
                items[-1] = ("run", rpr, items[-1][2] + text)
            else:
                items.append(("run", rpr, text))
        else:
            items.append(("raw", m.group(0)))
        pos = m.end()
    if pos < len(body):
        items.append(("raw", body[pos:]))
    return items


def join_items(items):
    return "".join(make_run(it[1], it[2]) if it[0] == "run" else it[1] for it in items)


# ----------------------------------------------------------------------------- tài liệu


class Doc:
    def __init__(self, xml):
        self.x = xml
        self.log = []

    # --- vùng
    def heading_at(self, text):
        hits = [m.start() for m in P_RE.finditer(self.x)
                if 'w:val="TOC' not in m.group(0) and wtext(m.group(0)).strip() == text]
        if len(hits) != 1:
            raise Loi(f"đề mục '{text}': {len(hits)} chỗ")
        return hits[0]

    def region(self, name):
        bounds = {
            "c1": ("CHƯƠNG 1. TỔNG QUAN VỀ ĐỀ TÀI", "CHƯƠNG 2. CƠ SỞ LÝ THUYẾT VÀ CÁC NGHIÊN CỨU LIÊN QUAN"),
            "c2": ("CHƯƠNG 2. CƠ SỞ LÝ THUYẾT VÀ CÁC NGHIÊN CỨU LIÊN QUAN", "CHƯƠNG 3. PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG TASKFLOW"),
            "c3": ("CHƯƠNG 3. PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG TASKFLOW", "TÀI LIỆU THAM KHẢO"),
            "tl": ("TÀI LIỆU THAM KHẢO", "PHỤ LỤC"),
            "dm": ("DANH MỤC BẢNG", "MỞ ĐẦU"),
        }[name]
        a, b = self.heading_at(bounds[0]), self.heading_at(bounds[1])
        if not a < b:
            raise Loi(f"vùng {name} ngược")
        if "<w:txbxContent" in self.x[a:b]:
            raise Loi(f"vùng {name} có hộp văn bản lồng - regex đoạn không an toàn")
        return a, b

    def paras(self, reg):
        a, b = self.region(reg)
        for m in P_RE.finditer(self.x, a, b):
            yield m.start(), m.end(), m.group(0)

    def find(self, reg, *, starts=None, contains=None, exact=None):
        hits = []
        for s, e, p in self.paras(reg):
            t = wtext(p)
            if starts is not None and not t.startswith(starts):
                continue
            if contains is not None and contains not in t:
                continue
            if exact is not None and t.strip() != exact:
                continue
            hits.append((s, e, p))
        key = starts or contains or exact
        if len(hits) != 1:
            raise Loi(f"[{reg}] '{key[:60]}': khớp {len(hits)} đoạn (cần đúng 1)")
        return hits[0]

    def put(self, s, e, new):
        self.x = self.x[:s] + new + self.x[e:]

    # --- thao tác trên đoạn
    def rewrite(self, label, reg, segments, **kw):
        s, e, p = self.find(reg, **kw)
        head, ppr, body, tail = split_para(p)
        marks = "".join(re.findall(r"<w:bookmark(?:Start|End) [^>]*/>", body))
        rpr = ""
        for it in merged_items(body):
            if it[0] == "run" and it[2].strip():
                rpr = it[1]
                break
        out = []
        for seg in segments:
            if isinstance(seg, tuple):
                out.append(seg[1])
            else:
                out.append(make_run(rpr, seg))
        self.put(s, e, head + ppr + marks + "".join(out) + tail)
        self.log.append(f"viết lại  {label}")

    def replace(self, label, reg, old, new, **kw):
        s, e, p = self.find(reg, **kw)
        head, ppr, body, tail = split_para(p)
        items = merged_items(body)
        n = sum(it[2].count(old) for it in items if it[0] == "run")
        if n != 1:
            raise Loi(f"{label}: chuỗi cũ xuất hiện {n} lần trong đoạn (cần 1): '{old[:60]}'")
        items = [("run", it[1], it[2].replace(old, new)) if it[0] == "run" else it for it in items]
        self.put(s, e, head + ppr + join_items(items) + tail)
        self.log.append(f"sửa chữ   {label}")

    def formula(self, label, reg, tag, new_omath):
        hits = [(s, e, p) for s, e, p in self.paras(reg)
                if "<m:oMathPara>" in p and f"<m:t>({tag})</m:t>" in p]
        if len(hits) != 1:
            raise Loi(f"công thức ({tag}): {len(hits)} chỗ")
        s, e, p = hits[0]
        if p.count("<m:oMath>") != 1:
            raise Loi(f"công thức ({tag}) có {p.count('<m:oMath>')} khối oMath")
        p2 = re.sub(r"<m:oMath>.*</m:oMath>", lambda _: new_omath, p, flags=re.S)
        self.put(s, e, p2)
        self.log.append(f"công thức {label}")

    def formula_char(self, label, reg, tag, old_xml, new_xml):
        hits = [(s, e, p) for s, e, p in self.paras(reg)
                if "<m:oMathPara>" in p and f"<m:t>({tag})</m:t>" in p]
        if len(hits) != 1:
            raise Loi(f"công thức ({tag}): {len(hits)} chỗ")
        s, e, p = hits[0]
        if p.count(old_xml) != 1:
            raise Loi(f"công thức ({tag}): '{old_xml}' có {p.count(old_xml)} chỗ")
        self.put(s, e, p.replace(old_xml, new_xml))
        self.log.append(f"công thức {label}")

    # --- bảng
    def table(self, reg, starts):
        a, b = self.region(reg)
        hits = [m for m in re.finditer(r"<w:tbl>.*?</w:tbl>", self.x[a:b], re.S)
                if "".join(T_RE.findall(m.group(0))).startswith(starts)]
        if len(hits) != 1:
            raise Loi(f"bảng '{starts}': {len(hits)} chỗ")
        m = hits[0]
        return a + m.start(), a + m.end(), m.group(0)

    @staticmethod
    def set_cells(row, texts):
        cells = list(re.finditer(r"<w:tc>.*?</w:tc>", row, re.S))
        if len(cells) != len(texts):
            raise Loi(f"hàng có {len(cells)} ô, cần {len(texts)}")
        out, pos = [], 0
        for c, text in zip(cells, texts):
            out.append(row[pos:c.start()])
            cell = c.group(0)
            if text is not None:
                pm = list(P_RE.finditer(cell))
                if len(pm) != 1:
                    raise Loi("ô có nhiều hơn một đoạn")
                head, ppr, body, tail = split_para(pm[0].group(0))
                rpr = next((it[1] for it in merged_items(body) if it[0] == "run"), "")
                cell = cell[:pm[0].start()] + head + ppr + make_run(rpr, text) + tail + cell[pm[0].end():]
            out.append(cell)
            pos = c.end()
        out.append(row[pos:])
        return "".join(out)

    def table_rows(self, label, reg, starts, row_starts, new_texts):
        s, e, t = self.table(reg, starts)
        rows = list(re.finditer(r"<w:tr[ >].*?</w:tr>", t, re.S))
        hit = [r for r in rows if "".join(T_RE.findall(r.group(0))).startswith(row_starts)]
        if len(hit) != 1:
            raise Loi(f"bảng '{starts}', hàng '{row_starts}': {len(hit)} chỗ")
        r = hit[0]
        t2 = t[:r.start()] + self.set_cells(r.group(0), new_texts) + t[r.end():]
        self.put(s, e, t2)
        self.log.append(f"bảng      {label}")

    def table_insert_after_header(self, label, reg, starts, rows_texts):
        s, e, t = self.table(reg, starts)
        rows = list(re.finditer(r"<w:tr[ >].*?</w:tr>", t, re.S))
        model = re.sub(r' w14:(?:paraId|textId)="[^"]*"', "", rows[1].group(0))
        new = "".join(self.set_cells(model, texts) for texts in rows_texts)
        t2 = t[:rows[0].end()] + new + t[rows[0].end():]
        self.put(s, e, t2)
        self.log.append(f"bảng      {label}")


# ----------------------------------------------------------------------------- nội dung sửa (theo đề xuất đã duyệt)


def sua_chuong_1(d):
    d.replace("C1a mở chương 1", "c1", "các đóng góp dự kiến và cấu trúc", "các đóng góp và cấu trúc",
              starts="Chương này trình bày bối cảnh thực tiễn")
    d.replace("C1b mở chương 1", "c1",
              "mà người dùng các công cụ kiểu Kanban hiện vẫn phải thực hiện gần như hoàn toàn thủ công.",
              "mà các công cụ kiểu Kanban hiện mới hỗ trợ ở mức hạn chế.",
              starts="Chương này trình bày bối cảnh thực tiễn")
    d.replace("C2 mục 1.1.1", "c1",
              "Hai bước đứng trước giai đoạn đó, gồm lập kế hoạch ban đầu và phân công người thực hiện, vẫn phụ thuộc gần "
              "như hoàn toàn vào sức lao động và trí nhớ của người quản lý.",
              "Với hai bước đứng trước giai đoạn đó, gồm lập kế hoạch ban đầu và phân công người thực hiện, một số công cụ "
              "gần đây đã bổ sung tính năng AI như tạo bảng từ một đoạn mô tả hay tự động gán việc cho người đang có ít việc "
              "nhất (mục 2.1.2). Tuy vậy, tài liệu công khai của các công cụ này không mô tả cách truy vết kết quả về văn bản "
              "gốc hay cách đánh giá chất lượng, việc gán người chưa xét đến chuyên môn, và chưa có kết quả đánh giá nào được "
              "công bố cho dữ liệu tiếng Việt; vì vậy hai bước này về cơ bản vẫn dựa vào kinh nghiệm và trí nhớ của người "
              "quản lý.",
              starts="Các công cụ quản lý công việc trực tuyến")
    d.replace("C3 mục 1.1.4 lý do 1", "c1", "nhưng lại ít được hỗ trợ nhất trong",
              "nhưng mới được hỗ trợ ở mức hạn chế và thiếu khả năng giải thích trong",
              starts="Thứ nhất, về nhu cầu thực tiễn")
    d.replace("D1 mục 1.1.4 lý do 3", "c1", "công việc lặp lại, bảng công khai và nhật ký hoạt động.",
              "công việc lặp lại, bảng công khai, nhật ký hoạt động và trợ lý ảo nhận lệnh bằng tiếng Việt.",
              starts="Thứ ba, về tính khả thi")
    d.rewrite("A8 MT2", "c1", [
        "– MT2: Xây dựng cơ chế chấm điểm mức phù hợp của từng thành viên đối với một công việc mới dựa trên các công "
        "việc lịch sử tương tự, trong đó các thành phần được tính và hiển thị riêng: kinh nghiệm với loại việc tương tự, "
        "độ ổn định khi thực hiện, khả năng tiếp nhận thêm việc và hồ sơ năng lực tự khai; mỗi đề xuất kèm chỉ báo mức đủ "
        "dữ liệu và các thẻ lịch sử làm bằng chứng. Trên cơ sở đó, xây dựng chức năng chia các việc chưa có người nhận "
        "trong một danh sách có tính đến tải công việc."], starts="– MT2:")
    d.replace("A9 mục 1.3.1", "c1",
              "ước lượng co về giá trị tiên nghiệm khi dữ liệu thưa, xếp hạng có tính đến tải công việc và học từ phản hồi "
              "lựa chọn của người dùng.",
              "ước lượng khi dữ liệu thưa, sử dụng hồ sơ năng lực tự khai cho thành viên mới, xếp hạng và chia việc có tính "
              "đến tải công việc, và học từ phản hồi lựa chọn của người dùng.",
              starts="Đối tượng nghiên cứu của khóa luận gồm hai nhóm")
    d.rewrite("B1 mục 1.3.2 mô hình", "c1", [
        "Về mô hình, khóa luận sử dụng mô hình gemini-3.5-flash-lite của Google, gọi qua giao diện lập trình tương thích "
        "chuẩn OpenAI, làm LLM cho module sinh bảng. Khóa luận không tinh chỉnh (fine-tune) LLM và không huấn luyện một mô "
        "hình nhận dạng thực thể có tên riêng cho bài toán sinh bảng; lý do của lựa chọn này được phân tích ở mục 2.2.2. "
        "Module phân công không gọi LLM: nội dung công việc được biểu diễn bằng TF-IDF trên các âm tiết và cụm hai âm tiết "
        "liền kề; biểu diễn nhúng (embedding) chỉ được phân tích về mặt lý thuyết ở mục 2.5.2 và để lại làm hướng phát "
        "triển."], starts="Về mô hình, khóa luận sử dụng Gemini")
    d.rewrite("B2 mục 1.3.2 dữ liệu", "c1", [
        "Về dữ liệu đánh giá, module sinh bảng được đánh giá trên 25 mô tả dự án có nhãn vàng do tác giả xây dựng, mỗi cấu "
        "hình chạy ba lần. Module phân công được đánh giá trên dữ liệu mô phỏng có kiểm soát: bộ sinh dữ liệu biết trước "
        "năng lực ẩn của từng thành viên nhưng bộ chấm điểm không nhìn thấy năng lực đó; kết quả được tổng hợp trên 20 bộ dữ "
        "liệu sinh từ các hạt giống ngẫu nhiên khác nhau, mỗi bộ gồm sáu thành viên. Khóa luận chưa đánh giá module phân "
        "công trên mô tả công việc do người dùng thật viết; đây là hạn chế chính về tính khái quát và được thảo luận ở "
        "Chương 6."], starts="Về dữ liệu đánh giá, module sinh bảng")
    d.replace("D2 mục 1.3.3", "c1", "chỉ được đề cập như hướng phát triển.",
              "chỉ được đề cập như hướng phát triển. Trợ lý ảo của TaskFlow, cho phép tra cứu và thao tác trên bảng bằng lệnh "
              "tiếng Việt, là chức năng phụ trợ của nền tảng: thiết kế của nó được trình bày ở Chương 3 nhưng khóa luận không "
              "đặt câu hỏi nghiên cứu riêng và không xem nó là đóng góp.",
              starts="Khóa luận không nhằm tự động giao việc")
    d.rewrite("B3 mục 1.4.3", "c1", [
        "Mỗi câu hỏi nghiên cứu được trả lời bằng thực nghiệm có đối chứng. Với module sinh bảng, khóa luận so sánh các "
        "nhánh: B0 chỉ dùng luật, B1 chỉ dùng LLM, B1v2 là biến thể lời nhắc của B1 để kiểm tra độ nhạy, và B2 là kiến trúc "
        "lai. Mỗi cấu hình được chạy ba lần trên cùng bộ dữ liệu để đo cả chất lượng lẫn độ ổn định."],
        starts="Mỗi câu hỏi nghiên cứu được trả lời bằng thực nghiệm có đối chứng")
    d.table_rows("B4 Bảng 1.1 RQ-C", "c1", "Câu hỏiThành phần liên quan", "RQ-C", [
        None, "Truy hồi lịch sử, chấm điểm theo thành phần, chỉ báo mức đủ dữ liệu",
        "Top-1, Top-3, MRR, độ hối tiếc (regret) so với lựa chọn tối ưu", None])
    d.table_rows("B4 Bảng 1.1 RQ-D", "c1", "Câu hỏiThành phần liên quan", "RQ-D", [
        None, "Thành phần khả năng tiếp nhận, chia việc theo đợt, học trọng số theo nhóm, hồ sơ tự khai",
        "Xác suất đúng hạn kỳ vọng, hệ số Gini, tỉ lệ việc của người nhận nhiều nhất, phân tích loại bỏ, đường hội tụ "
        "trọng số", None])
    d.rewrite("A10 mục 1.5 đóng góp 2", "c1", [
        "Đóng góp thứ hai về phương pháp là một cơ chế gợi ý người thực hiện có khả năng giải thích dựa trên lịch sử công "
        "việc. Cơ chế này truy hồi các công việc lịch sử có nội dung tương tự thay vì gộp toàn bộ lịch sử thành một hồ sơ "
        "duy nhất; ước lượng kinh nghiệm và độ ổn định trong đúng ngữ cảnh đó, trong đó độ ổn định được co về mức trung bình "
        "của nhóm khi dữ liệu cá nhân còn ít; tính và hiển thị riêng từng thành phần cùng chỉ báo mức đủ dữ liệu thay vì chỉ "
        "một con số chung; điều chỉnh trọng số theo lựa chọn của nhóm; và trả về các thẻ lịch sử làm bằng chứng cho mỗi đề "
        "xuất. Cơ chế được mở rộng sang chia việc cho cả một danh sách, và có thêm thành phần hồ sơ năng lực tự khai cho "
        "thành viên mới; trên dữ liệu mô phỏng, thành phần hồ sơ chưa cho thấy lợi ích rõ rệt, kết quả này được báo cáo đầy "
        "đủ ở Chương 6."], starts="Đóng góp thứ hai về phương pháp")
    d.replace("D3 mục 1.5 đoạn cuối", "c1", "bảng, danh sách, thẻ, lịch hay thông báo",
              "bảng, danh sách, thẻ, lịch, thông báo hay trợ lý ảo", starts="Cần phân biệt rõ đóng góp nghiên cứu")


def sua_chuong_2(d):
    d.rewrite("C4 mục 2.1.2", "c2", [
        "Tổng quan tài liệu của Ahmad và cộng sự ghi nhận các lợi ích của Kanban như cải thiện khả năng quan sát tiến độ và "
        "giao tiếp trong nhóm, nhưng đồng thời cho thấy việc áp dụng Kanban vẫn đòi hỏi nhiều công sức tổ chức từ phía con "
        "người [2]. Gần đây, các công cụ phổ biến đã bắt đầu đưa AI vào chính hai bước mà khóa luận quan tâm. Trello cho "
        "phép tạo một bảng gồm danh sách, thẻ, checklist, hạn hoàn thành và nhãn từ một câu mô tả ngắn; theo tài liệu hướng "
        "dẫn, bảng được tạo ngay sau khi người dùng gửi mô tả và được chỉnh sửa sau đó như một bảng thông thường [[R13]]. "
        "Jira có chức năng gợi ý tách một hạng mục lớn thành các việc nhỏ hơn [[R14]], và luật tự động hóa của Jira có thể "
        "gán việc mới theo vòng tròn hoặc cho thành viên đang có ít việc mở nhất [[R15]]. Các tính năng này cho thấy nhu "
        "cầu tự động hóa hai bước là có thật, nhưng còn để ngỏ ba vấn đề. Thứ nhất, tài liệu công khai không mô tả cách "
        "đánh giá chất lượng hay cách truy vết mỗi thẻ về căn cứ của nó trong văn bản đầu vào. Thứ hai, chưa có kết quả "
        "đánh giá nào được công bố cho văn bản tiếng Việt, đặc biệt với các cách diễn đạt thời gian. Thứ ba, việc gán người "
        "dựa trên số việc đang mở, không dựa trên chuyên môn và không kèm bằng chứng hay mức độ chắc chắn. Đây là các điểm "
        "mà khóa luận tập trung giải quyết."], starts="Tổng quan tài liệu của Ahmad và cộng sự ghi nhận")

    # A1 - mục 2.4.3
    d.rewrite("A1 mục 2.4.3 đoạn 2", "c2", [
        "Hệ quả rút ra cho khóa luận là mức phù hợp chuyên môn và khả năng tiếp nhận việc trả lời hai câu hỏi khác nhau. "
        "Câu hỏi thứ nhất là người này có kinh nghiệm và thực hiện ổn định với loại việc này hay không; câu hỏi thứ hai là "
        "hiện tại người này có đủ dư địa để nhận thêm việc hay không. Nếu chỉ hiển thị một con số “độ phù hợp” chung, người "
        "quản lý sẽ không phân biệt được “không phù hợp” với “rất phù hợp nhưng đang quá tải”, hai tình huống đòi hỏi hành "
        "động khác nhau. Một cách tiếp cận đơn giản và dễ giải thích là tính riêng từng thành phần ",
        M(xi("x", "k"), o("∈"), o("[0, 1]")),
        " rồi kết hợp chúng thành điểm xếp hạng bằng tổ hợp tuyến tính có trọng số:"],
        contains="Hệ quả lý thuyết rút ra cho khóa luận")
    d.formula("(2.1)", "c2", "2.1", display(
        "2.1", v("U"), o("="), nsum(v("k"), xi("w", "k") + xi("x", "k")), o(","), v("  "), xi("w", "k"), o("≥"), v("0"),
        o(","), v("  "), nsum(v("k"), xi("w", "k")), o("="), v("1")))
    d.rewrite("A1 mục 2.4.3 đoạn 3", "c2", [
        "trong đó trọng số ", M(xi("w", "k")),
        " thể hiện mức ưu tiên của nhóm giữa chuyên môn và cân bằng tải. Điều cốt yếu là ", M(v("U")),
        " chỉ là điểm dùng để xếp hạng các ứng viên cho một công việc cụ thể, không phải thước đo năng lực: giao diện cần "
        "hiển thị riêng giá trị của từng thành phần và cảnh báo khi người được đề xuất đang quá tải. Ngoài ra, khi phải giao "
        "nhiều công việc cùng lúc, việc chọn người xếp đầu cho từng công việc một cách độc lập sẽ dồn việc cho cùng một "
        "người, đúng hiện tượng mà CosTriage chỉ ra [3]; vì vậy tải của người vừa nhận việc cần được cập nhật trước khi xét "
        "công việc tiếp theo. Cách TaskFlow chọn các thành phần, đưa chúng về cùng thang trước khi cộng và chia việc theo "
        "đợt được trình bày ở Chương 4."],
        contains="thể hiện mức ưu tiên của nhóm cho chuyên môn so với cân bằng tải")

    # A2 - mục 2.4.5
    d.rewrite("A2 mục 2.4.5", "c2", [
        "Về nguyên tắc, hệ thống không nên gán điểm 0 cho thành viên mới, vì như vậy người mới sẽ không bao giờ được đề xuất "
        "và không bao giờ tích lũy được lịch sử; nhưng cũng không nên để họ được xếp cao chỉ vì thiếu dữ liệu. Có ba cách xử "
        "lý thường gặp: bỏ các thành phần dựa trên lịch sử và xếp hạng theo các thành phần còn lại; thay giá trị còn thiếu "
        "bằng một giá trị tiên nghiệm, chẳng hạn mức trung bình của nhóm; hoặc bổ sung thông tin phụ nằm ngoài lịch sử tương "
        "tác. Cách thứ ba cùng tinh thần với hướng khai thác thuộc tính mà Qian và cộng sự đề xuất cho tình huống khởi đầu "
        "lạnh [30]; trong bài toán phân công, thông tin phụ tự nhiên nhất là hồ sơ năng lực do thành viên tự khai, gồm kỹ "
        "năng, công việc đã làm và CV. Hồ sơ tự khai có nhược điểm là chưa được kiểm chứng và có thể bị khai quá. Dù chọn "
        "cách nào, hệ thống cũng cần gắn cờ “chưa có lịch sử” để người quản lý biết đề xuất dựa trên rất ít bằng chứng. Ưu "
        "nhược điểm của hai cách đầu được phân tích ở mục 2.6.3."],
        starts="Về nguyên tắc, một hệ thống đáng tin cậy không nên gán điểm 0")

    # B5 - mục 2.5.2
    d.rewrite("B5 mục 2.5.2", "c2", [
        "Do mỗi cách có ưu điểm riêng, biểu diễn nhúng không phải là sự thay thế hiển nhiên cho TF-IDF. Khóa luận chọn "
        "TF-IDF cho module phân công vì ba lý do: kết quả giải thích được bằng các từ chung giữa hai công việc, không phụ "
        "thuộc dịch vụ bên ngoài, và tái lập được hoàn toàn, điều kiện cần cho các thực nghiệm lặp lại trên nhiều bộ dữ "
        "liệu. Thay TF-IDF bằng biểu diễn nhúng trong khi giữ nguyên toàn bộ phần chấm điểm phía sau là một phân tích loại "
        "bỏ có giá trị, vì nó cho biết lợi ích đến từ công thức xếp hạng hay từ cách biểu diễn văn bản; phân tích này chưa "
        "được thực hiện trong khóa luận và được nêu như một hướng phát triển ở Chương 6."],
        starts="Do mỗi cách có ưu điểm riêng, khóa luận không xem")

    # A3 - mục 2.6.2
    d.replace("A3 tiêu đề 2.6.2", "c2", "Bằng chứng hiệu dụng và ước lượng co", "Lượng bằng chứng và ước lượng co",
              exact="2.6.2. Bằng chứng hiệu dụng và ước lượng co về giá trị tiên nghiệm")
    d.rewrite("A3 đoạn 'Đại lượng này'", "c2", [
        "Đại lượng này cho biết các công việc lịch sử giống công việc mới đến mức nào, nhưng không cho biết ước lượng đó dựa "
        "trên bao nhiêu bằng chứng. Lượng bằng chứng có thể đo theo hai cách: tổng trọng số thời gian ", M(v("e")),
        ", hiểu là “số công việc hiệu dụng” sau khi đã tính đến độ cũ; hoặc tổng có trọng số theo cả thời gian lẫn độ "
        "tương đồng ", M(v("E")),
        ", theo đó một công việc chỉ được tính là bằng chứng đầy đủ khi nó vừa gần đây vừa giống công việc mới:"],
        starts="Đại lượng này cho biết các công việc lịch sử")
    d.formula("(2.6)", "c2", "2.6", display(
        "2.6", v("e"), o("="), nsum(v("i"), xi("d", "i")), o(","), v("  "), v("E"), o("="),
        nsum(v("i"), xi("d", "i") + o("⋅") + xi("s", "i"))))
    d.rewrite("A3 đoạn 'Hai cách đo'", "c2", [
        "Hai cách đo khác nhau rõ nhất khi các công việc truy hồi được chỉ giống công việc mới rất ít: năm công việc gần đây "
        "với độ tương đồng 0,06 cho ", M(v("e"), o("≈"), v("5")), " nhưng ", M(v("E"), o("≈"), v("0,3")),
        ". Đại lượng ", M(v("e")), " phù hợp khi độ tương đồng đã được phản ánh riêng trong mức độ khớp ", M(o("fit")),
        ", còn ", M(v("E")),
        " phù hợp khi mỗi quan sát cần một trọng số riêng phản ánh mức liên quan của nó, như trong ước lượng co dưới đây."],
        starts="thay vì chỉ tổng các trọng số thời gian")
    d.rewrite("A3 đoạn 'Khi đã có mức độ khớp'", "c2", [
        "Khi đã có mức độ khớp và lượng bằng chứng, có hai cách kết hợp chúng, tương ứng với hai cách hiểu khác nhau về tình "
        "trạng thiếu dữ liệu. Cách thứ nhất nhân mức độ khớp với một hàm bão hòa của lượng bằng chứng dạng ",
        M(frac(v("e"), v("e") + o("+") + xi("m", "e"))),
        ": khi bằng chứng ít, kết quả bị kéo về 0; khi bằng chứng nhiều, kết quả tiến dần tới ", M(o("fit")),
        ". Hàm dạng ", M(frac(v("x"), v("x") + o("+") + v("k"))),
        " được dùng rộng rãi để làm bão hòa đóng góp của một đại lượng đếm, chẳng hạn thành phần tần suất từ trong hàm xếp "
        "hạng BM25 [32]. Cách hiểu đi kèm là “thiếu bằng chứng nghĩa là ít kinh nghiệm”. Cách thứ hai là ước lượng co, "
        "trình bày ngay dưới đây, với cách hiểu “thiếu bằng chứng nghĩa là chưa biết, nên lấy mức chung của nhóm”."],
        starts="Khi đã có mức độ khớp và lượng bằng chứng")
    d.rewrite("A3 đoạn 'Ước lượng co'", "c2", [
        "Ước lượng co (shrinkage) dựa trên ý tưởng, được Efron và Morris trình bày trong bối cảnh ước lượng Stein, rằng khi "
        "dữ liệu của một đối tượng ít, ước lượng riêng của đối tượng đó nên được kéo về phía giá trị trung bình chung của cả "
        "tập; khi dữ liệu nhiều, ước lượng riêng được giữ nguyên [38]. Áp dụng cho độ ổn định khi thực hiện công việc, với ",
        M(xi("v", "i"), o("="), xi("d", "i"), o("⋅"), xi("s", "i")),
        " là trọng số bằng chứng của công việc lịch sử ", M(v("i")), ", ", M(xi("o", "i"), o("∈"), o("[0, 1]")),
        " là kết quả thực hiện (ví dụ hoàn thành đúng hạn, không bị mở lại), ", M(v("μ")),
        " là giá trị trung bình của nhóm và ", M(v("m")), " là độ mạnh của tiên nghiệm, ta có:"],
        starts="Cách tiếp cận có cơ sở thống kê hơn là ước lượng co")
    d.rewrite("A3 đoạn 'Công thức (2.7)'", "c2", [
        "Công thức (2.7) chính là kỳ vọng hậu nghiệm của mô hình Beta – nhị thức với tiên nghiệm tương đương ", M(v("m")),
        " quan sát có giá trị trung bình ", M(v("μ")), ". Khi bằng chứng dồi dào, ", M(v("R")),
        " tiến về tỉ lệ thực hiện tốt của chính thành viên đó; khi gần như không có bằng chứng, ", M(v("R")), " tiến về ",
        M(v("μ")),
        ", nên một người mới chỉ hoàn thành đúng hạn một công việc không bị xem là ổn định tuyệt đối. Kết hợp với hàm bão "
        "hòa cho kinh nghiệm, và thêm một chỉ báo riêng để người dùng biết ước lượng dựa trên bao nhiêu dữ liệu, ta có:"],
        starts="Công thức (2.7) chính là kỳ vọng hậu nghiệm")
    d.formula("(2.8)", "c2", "2.8", display(
        "2.8", o("Exp"), o("="), o("fit"), o("⋅"), frac(v("e"), v("e") + o("+") + xi("m", "e")), o(","), v("  "), v("c"),
        o("="), frac(v("e"), v("e") + o("+") + xi("m", "c"))))
    d.rewrite("A3 đoạn sau (2.8)", "c2", [
        "trong đó ", M(xi("m", "e")), " và ", M(xi("m", "c")),
        " là các hằng số dương. Khi bằng chứng dồi dào, ", M(o("Exp"), o("→"), o("fit")), " và ", M(v("c"), o("→"), v("1")),
        "; khi gần như không có bằng chứng, cả hai tiến về 0. Hệ số ", M(v("c")),
        " không phải là xác suất mà là chỉ báo mức đủ dữ liệu; nó có thể được chia thành vài mức để hiển thị trực tiếp cho "
        "người dùng, đúng với nguyên tắc “thiếu dữ liệu thì nói là thiếu, không suy diễn”. Giá trị cụ thể của các tham số "
        "được trình bày ở Chương 4."],
        starts="Khi bằng chứng dồi dào,")

    # A4 - mục 2.6.3
    d.replace("A4 tiêu đề 2.6.3", "c2", "Hệ quả của cách xử lý thành phần thiếu dữ liệu",
              "Xử lý thành phần thiếu dữ liệu trong điểm tổng hợp",
              exact="2.6.3. Hệ quả của cách xử lý thành phần thiếu dữ liệu")
    d.rewrite("A4 đoạn sau (2.9)", "c2", [
        "với ", M(scr("A")),
        " là tập các thành phần có dữ liệu. Cách làm này bảo đảm thiếu dữ liệu không kéo điểm xuống, nhưng điểm của người "
        "thiếu dữ liệu khi đó chỉ do các thành phần còn lại quyết định: một thành viên chưa có lịch sử mà đang rảnh có thể "
        "được xếp cao chỉ nhờ khả năng tiếp nhận. Cách xử lý thứ hai là thay giá trị thiếu bằng giá trị trung tính, chẳng "
        "hạn mức trung bình của nhóm ứng viên, để người thiếu dữ liệu không được lợi cũng không bị thiệt so với mức chung. "
        "Hai cách phản ánh hai lựa chọn khác nhau về việc có nên tạo cơ hội cho người mới hay không, và không cách nào ưu "
        "việt tuyệt đối. TaskFlow dùng cách thứ nhất cho ba thành phần dựa trên lịch sử và cách thứ hai cho thành phần hồ "
        "sơ tự khai, nhằm tránh tình trạng không khai hồ sơ lại có lợi hơn khai mà không khớp; hệ quả đo được của lựa chọn "
        "này được thảo luận ở Chương 6."],
        contains="là tập các thành phần có dữ liệu. Cách làm này nhằm tránh")

    # A5 - mục 2.6.4
    d.replace("A5 tiêu đề 2.6.4", "c2", "Độ tin cậy và sự hiệu chỉnh", "Mức đủ dữ liệu và sự hiệu chỉnh",
              exact="2.6.4. Độ tin cậy và sự hiệu chỉnh")
    d.rewrite("A5 mục 2.6.4", "c2", [
        "Một chỉ số về độ chắc chắn chỉ có giá trị khi được hiệu chỉnh (calibrated), tức các đề xuất được đánh dấu là chắc "
        "chắn hơn thực sự đúng thường xuyên hơn. Guo và cộng sự định nghĩa một mô hình được hiệu chỉnh hoàn hảo là mô hình "
        "mà xác suất dự đoán trùng với tần suất đúng thực tế, và đề xuất đánh giá bằng cách chia dự đoán thành các nhóm theo "
        "độ tin cậy rồi so sánh độ chính xác của từng nhóm [39]. Chỉ báo ", M(v("c")),
        " trong công thức (2.8) không phải là xác suất đúng mà chỉ phản ánh lượng dữ liệu đứng sau một ước lượng, nên khóa "
        "luận không diễn giải nó như xác suất và không tuyên bố nó đã được hiệu chỉnh. Việc kiểm tra xem các đề xuất có mức "
        "dữ liệu cao có thực sự chính xác hơn hay không là một hướng đánh giá chưa được thực hiện và được nêu trong phần hạn "
        "chế ở Chương 6."],
        starts="Một chỉ số độ tin cậy chỉ có giá trị")

    # A6 - mục 2.7.2
    d.formula_char("(2.10) ≤ thành <", "c2", "2.10", "<m:t>≤</m:t>", "<m:t>&lt;</m:t>")
    d.replace("A6 câu sau (2.10)", "c2",
              "sau mỗi lần cập nhật, trọng số có thể được chiếu về miền không âm và chuẩn hóa tổng bằng 1 để giữ khả năng "
              "diễn giải.",
              "sau mỗi lần cập nhật, trọng số được chiếu về tập trọng số hợp lệ, trong đó mỗi trọng số nằm trong một khoảng "
              "cho trước và tổng bằng 1, để giữ khả năng diễn giải.",
              contains="trọng số có thể được chiếu về miền không âm")

    # B6, B7 - mục 2.8
    d.replace("B6 mục 2.8.2", "c2",
              "bởi tỉ lệ hoàn thành đúng hạn trong mô phỏng, tốc độ hội tụ của trọng số khi học trực tuyến và kết quả theo "
              "nhóm độ tin cậy như đã nêu ở mục 2.6.4.",
              "bởi tỉ lệ hoàn thành đúng hạn trong mô phỏng và tốc độ hội tụ của trọng số khi học trực tuyến.",
              contains="kết quả theo nhóm độ tin cậy như đã nêu ở mục 2.6.4")
    d.replace("B7 mục 2.8.3 đoạn 1", "c2", ", cùng với việc thay biểu diễn TF-IDF bằng biểu diễn nhúng,", ",",
              starts="Một kết quả chỉ có ý nghĩa khi được so sánh")
    d.replace("B7 mục 2.8.3 đoạn 2", "c2",
              "Cách giảm thiểu là bổ sung một tập nhỏ mô tả công việc do người khác viết độc lập mà không được xem bộ từ vựng "
              "của bộ sinh, để kiểm tra khả năng khái quát của thành phần so khớp văn bản.",
              "Khóa luận giảm nhẹ mối đe dọa này bằng ba biện pháp: bộ sinh được thiết kế cố ý lệch khỏi giả định của bộ chấm "
              "điểm, chẳng hạn dùng từ đồng nghĩa, viết tắt và lỗi chính tả trong mô tả, giao sai người ở một phần lịch sử, "
              "thay đổi kỹ năng theo thời gian và cho kết quả thực hiện mang tính ngẫu nhiên; kết quả được kiểm tra lại khi "
              "thay đổi từng nguồn lệch này; và dữ liệu đánh giá được cố định bằng mã băm trước khi chạy các so sánh chính. "
              "Tuy vậy, các biện pháp này không thay thế được việc kiểm tra trên mô tả công việc do người thật viết. Đây là "
              "hạn chế lớn nhất của phần đánh giá module phân công và được thảo luận ở Chương 6.",
              starts="Đối với dữ liệu mô phỏng, mối đe dọa lớn nhất")

    # C5, C6 - mục 2.9
    d.replace("C5 câu dẫn Bảng 2.4", "c2", "các nghiên cứu liên quan chính", "các nghiên cứu và công cụ liên quan chính",
              starts="Bảng 2.4 tổng hợp")
    d.table_insert_after_header("C5 Bảng 2.4 thêm 3 dòng", "c2", "Nghiên cứuBài toán", [
        ["Trello, tạo bảng bằng AI [[R13]]", "Sinh bảng Kanban từ mô tả", "LLM, sản phẩm đóng",
         "Cùng bài toán; khóa luận bổ sung tầng luật cho thời gian, truy vết dòng nguồn, bước xem trước bắt buộc và đánh "
         "giá có đường cơ sở"],
        ["Jira, gợi ý tách việc [[R14]]", "Tách hạng mục lớn thành việc con", "LLM, sản phẩm đóng",
         "Khóa luận sinh cấu trúc từ văn bản tự do thay vì từ một hạng mục có sẵn"],
        ["Jira, luật gán việc tự động [[R15]]", "Gán người thực hiện", "Luật: vòng tròn hoặc người ít việc mở nhất",
         "Kế thừa việc tính đến tải; khóa luận kết hợp thêm kinh nghiệm và độ ổn định, kèm bằng chứng và mức đủ dữ liệu"],
    ])
    # bổ sung khi soát bản v3 (cùng loại lệch với A1): mã không có bước "xếp hạng lại", lớp 2 là vòng lặp tham lam
    d.table_rows("C5 Bảng 2.4 dòng S-DABT", "c2", "Nghiên cứuBài toán", "S-DABT", [
        None, None, None,
        "Kế thừa việc tính đến tải; khóa luận chia việc theo đợt bằng vòng lặp tham lam có cộng dồn tải thay vì tối ưu "
        "toàn cục"])
    d.rewrite("C6 mục 2.9 khoảng trống", "c2", [
        "Từ tổng hợp trên, có thể xác định ba khoảng trống mà khóa luận hướng tới. Thứ nhất, các nghiên cứu về trích xuất "
        "thông tin bằng LLM chủ yếu đánh giá trên tiếng Anh và trên các tác vụ NER hoặc trích xuất quan hệ tiêu chuẩn, còn "
        "các công cụ thương mại tuy đã sinh được bảng từ mô tả nhưng không công bố cách đánh giá; chưa có nhiều công trình "
        "đánh giá bài toán chuyển mô tả dự án tiếng Việt thành cấu trúc công việc phân cấp, với trọng tâm là biểu thức thời "
        "gian, khả năng truy vết và độ ổn định của đầu ra. Thứ hai, các nghiên cứu phân công xử lý lỗi thường tập trung vào "
        "độ chính xác xếp hạng trên dữ liệu lớn của các dự án mã nguồn mở, ít quan tâm đến việc biểu diễn độ bất định khi "
        "dữ liệu thưa, xử lý thành viên mới một cách nhất quán và cung cấp bằng chứng giải thích cho từng đề xuất, vốn là "
        "những yêu cầu thiết yếu đối với các nhóm nhỏ. Thứ ba, các công cụ thương mại đã tích hợp cả hai bước nhưng dưới "
        "dạng hộp đen, còn các nghiên cứu thường xét từng bước riêng lẻ; hai cơ chế này hiếm khi được tích hợp, giải thích "
        "được và đánh giá công khai trong cùng một hệ thống quản lý công việc hoạt động thực tế theo nguyên tắc con người "
        "trong vòng lặp."], starts="Từ tổng hợp trên, có thể xác định ba khoảng trống")

    # A7 - tiểu kết chương 2
    d.replace("A7 tiểu kết chương 2", "c2",
              "Đối với module phân công, chương đã xác lập các nguyên tắc: truy hồi láng giềng gần nhất để có bằng chứng, "
              "suy giảm theo thời gian, dùng bằng chứng hiệu dụng và ước lượng co để biểu diễn độ bất định, tách mức phù hợp "
              "chuyên môn khỏi khả năng tiếp nhận, và phân biệt phản hồi ưu tiên của nhóm với kết quả thực hiện.",
              "Đối với module phân công, chương đã xác lập các nguyên tắc: truy hồi láng giềng gần nhất để có bằng chứng; suy "
              "giảm theo thời gian; đo lượng bằng chứng và dùng hàm bão hòa hoặc ước lượng co tùy theo ý nghĩa của tình trạng "
              "thiếu dữ liệu; tính và hiển thị riêng mức phù hợp chuyên môn với khả năng tiếp nhận; cập nhật tải khi chia "
              "nhiều việc cùng lúc; dùng hồ sơ tự khai làm thông tin phụ cho tình huống khởi đầu lạnh; và phân biệt phản hồi "
              "ưu tiên của nhóm với kết quả thực hiện.",
              starts="Chương 2 đã trình bày các cơ sở lý thuyết")


# ----------------------------------------------------------------------------- tài liệu tham khảo

NEW_REFS = [
    ("Atlassian, “AI-generated boards,” ", "Trello Support",
     ". [Online]. Available: https://support.atlassian.com/trello/docs/ai-generated-boards/ (truy cập tháng 10/2026)."),
    ("J. Valliani, “Get out of tickets and into your work faster with AI in Jira,” ", "Atlassian Blog",
     ", 13/9/2024. [Online]. Available: https://www.atlassian.com/blog/artificial-intelligence/ai-jira-issues "
     "(truy cập tháng 10/2026)."),
    ("Atlassian, “Smart assign Jira issues — Load balancing, round-robin and more,” ", "Automation for Jira Documentation",
     ", 2022. [Online]. Available: https://confluence.atlassian.com/automation074/"
     "smart-assign-jira-issues-load-balancing-round-robin-and-more-1141481228.html (truy cập tháng 10/2026)."),
]
FIRST_NEW, N_NEW = 13, len(NEW_REFS)


def shift(n):
    return n + N_NEW if n >= FIRST_NEW else n


def danh_so_lai(d):
    # chương 1 chỉ được trích tới [12], chương 3 không trích: nếu sai thì phải xem lại cách đánh số
    for reg in ("c1", "c3"):
        for _, _, p in d.paras(reg):
            for n in CITE_RE.findall(wtext(p)):
                if int(n) >= FIRST_NEW:
                    raise Loi(f"vùng {reg} có trích dẫn [{n}] >= {FIRST_NEW}")
    changed = 0
    for reg in ("c2", "tl"):
        a, b = d.region(reg)
        seg = d.x[a:b]
        out, pos = [], 0
        for m in P_RE.finditer(seg):
            p = m.group(0)
            want = len(CITE_RE.findall(wtext(p)))
            if not want:
                continue
            head, ppr, body, tail = split_para(p)
            items = merged_items(body)
            got = sum(len(CITE_RE.findall(it[2])) for it in items if it[0] == "run")
            if got != want:
                raise Loi(f"đoạn có trích dẫn bị tách qua run khác định dạng: '{wtext(p)[:60]}'")
            items = [("run", it[1], CITE_RE.sub(lambda c: f"[{shift(int(c.group(1)))}]", it[2])) if it[0] == "run" else it
                     for it in items]
            out.append(seg[pos:m.start()])
            out.append(head + ppr + join_items(items) + tail)
            pos = m.end()
            changed += 1
        out.append(seg[pos:])
        d.x = d.x[:a] + "".join(out) + d.x[b:]
    d.log.append(f"đánh số   lại trích dẫn >= [{FIRST_NEW}] trong {changed} đoạn (chương 2 + danh mục tài liệu)")

    # thay chỗ giữ chỗ [[R13]]... bằng số thật
    for k in range(N_NEW):
        ph = f"[[R{FIRST_NEW + k}]]"
        n = d.x.count(ph)
        if n != 2:
            raise Loi(f"chỗ giữ chỗ {ph} có {n} lần (cần 2: mục 2.1.2 và Bảng 2.4)")
        d.x = d.x.replace(ph, f"[{FIRST_NEW + k}]")

    # chèn ba tài liệu mới sau [12]
    s, e, p = d.find("tl", starts=f"[{FIRST_NEW - 1}]")
    head, ppr, _, tail = split_para(p)
    head = re.sub(r' w14:(?:paraId|textId)="[^"]*"', "", head)
    new = []
    for k, (before, site, after) in enumerate(NEW_REFS):
        new.append(head + ppr + make_run("", f"[{FIRST_NEW + k}]") + "<w:r><w:tab/></w:r>" + make_run("", before)
                   + make_run("<w:rPr><w:i/></w:rPr>", site) + make_run("", after) + tail)
    d.x = d.x[:e] + "".join(new) + d.x[e:]
    d.log.append(f"tài liệu  thêm [{FIRST_NEW}]-[{FIRST_NEW + N_NEW - 1}]")
    # kiểm: danh mục tài liệu đánh số liên tục
    nums = [int(m.group(1)) for _, _, p in d.paras("tl") for m in [re.match(r"\[(\d+)\]", wtext(p))] if m]
    if nums != list(range(1, len(nums) + 1)):
        raise Loi(f"danh mục tài liệu không liên tục: {nums}")
    d.log.append(f"tài liệu  tổng {len(nums)} mục, đánh số liên tục 1..{len(nums)}")


# ----------------------------------------------------------------------------- danh mục bảng/hình, Hình 1.1


def dat_lai_so_trang_danh_muc(d):
    a, b = d.region("dm")
    seg = d.x[a:b]
    caps = []

    def fix(m):
        p = m.group(0)
        t = run_text(split_para(p)[2])  # giữ cả ký tự tab trước số trang
        mm = re.match(r"^((?:Bảng|Hình) \d+\.\d+: .*)\t(\d+|" + ELLIPSIS + r")$", t)
        if not mm:
            return p
        caps.append(mm.group(1))
        # số trang nằm ngay sau tab, cùng run hoặc ở run kế tiếp (mục do tao_chuong3.py sinh)
        p2, n = re.subn(r"(<w:tab/>(?:</w:r><w:r(?: [^>]*)?>(?:<w:rPr>(?:(?!</w:rPr>).)*</w:rPr>)?)?)"
                        r"<w:t(?: [^>]*)?>(?:\d+|" + ELLIPSIS + r")</w:t>", r"\1<w:t>" + ELLIPSIS + "</w:t>", p, flags=re.S)
        if n != 1:
            raise Loi(f"mục danh mục không đặt lại được số trang: '{t[:50]}'")
        return p2

    seg2 = P_RE.sub(fix, seg)
    d.x = d.x[:a] + seg2 + d.x[b:]
    if len(caps) < 80:
        raise Loi(f"chỉ thấy {len(caps)} mục danh mục bảng/hình")
    with open(CAPTION_OUT, "w", encoding="utf-8") as f:
        json.dump({"captions": caps}, f, ensure_ascii=False, indent=1)
    d.log.append(f"danh mục  đặt lại số trang {len(caps)} mục -> {os.path.basename(CAPTION_OUT)}")


def png_size(data):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise Loi("Hình 1.1 mới không phải PNG")
    return struct.unpack(">II", data[16:24])


def thay_hinh_1_1(d, rels_xml):
    i = d.x.rfind("Hình 1.1:")
    j = d.x.rfind("<w:drawing>", 0, i)
    k = d.x.find("</w:drawing>", j) + len("</w:drawing>")
    drawing = d.x[j:k]
    rid = re.search(r'r:embed="(rId\d+)"', drawing).group(1)
    if d.x.count(f'r:embed="{rid}"') != 1:
        raise Loi(f"{rid} của Hình 1.1 được dùng ở nhiều chỗ")
    target = re.search(rf'Id="{rid}"[^>]*Target="([^"]+)"', rels_xml).group(1)
    if rels_xml.count(f'Target="{target}"') != 1:
        raise Loi(f"tệp ảnh {target} được nhiều quan hệ dùng chung")
    data = open(HINH_1_1, "rb").read()
    w, h = png_size(data)
    cx = int(re.search(r'<wp:extent cx="(\d+)"', drawing).group(1))
    cy = round(cx * h / w)
    drawing2 = re.sub(r'(<wp:extent cx="\d+" cy=")\d+(")', rf"\g<1>{cy}\2", drawing)
    drawing2 = re.sub(r'(<a:ext cx="\d+" cy=")\d+(")', rf"\g<1>{cy}\2", drawing2)
    drawing2 = drawing2.replace('descr="fig1_1.png"', 'descr="h11_vi_tri_hai_co_che.png"')
    d.x = d.x[:j] + drawing2 + d.x[k:]
    d.log.append(f"hình      Hình 1.1 -> {os.path.basename(HINH_1_1)} ({w}x{h}), cao {cy / 360000:.2f} cm")
    return "word/" + target, data


# ----------------------------------------------------------------------------- chạy


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    src, dst = sys.argv[1], sys.argv[2]
    if os.path.abspath(src) == os.path.abspath(dst):
        raise SystemExit("Tệp ra phải khác tệp vào")
    zin = zipfile.ZipFile(src)
    d = Doc(zin.read("word/document.xml").decode("utf-8"))
    rels = zin.read("word/_rels/document.xml.rels").decode("utf-8")
    try:
        sua_chuong_1(d)
        sua_chuong_2(d)
        danh_so_lai(d)
        dat_lai_so_trang_danh_muc(d)
        img_name, img_data = thay_hinh_1_1(d, rels)
        import xml.etree.ElementTree as ET
        ET.fromstring(d.x.encode("utf-8"))  # còn là XML hợp lệ
    except Loi as ex:
        raise SystemExit(f"DỪNG, không ghi tệp: {ex}")
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename == "word/document.xml":
                zout.writestr(item, d.x.encode("utf-8"))
            elif item.filename == img_name:
                zout.writestr(item, img_data)
            else:
                zout.writestr(item, zin.read(item.filename))
    for line in d.log:
        print(line)
    print(f"Đã ghi {dst}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    main()
