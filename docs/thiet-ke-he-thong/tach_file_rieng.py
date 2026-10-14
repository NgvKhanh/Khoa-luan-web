# -*- coding: utf-8 -*-
"""
Tách các HÌNH thiết kế của Chương 3 thành 5 tệp Word riêng (cùng định dạng khóa luận); mỗi tệp chỉ gồm tiêu đề
và các hình kèm dòng chú thích, không có đoạn mô tả hay bảng:
  TaskFlow_Use_case.docx            hình của mục 3.2 (use case tổng quát + phân rã)
  TaskFlow_Bieu_do_hoat_dong.docx   mục 3.3
  TaskFlow_Kien_truc.docx           mục 3.4
  TaskFlow_Thiet_ke_CSDL.docx       mục 3.5
  TaskFlow_Bieu_do_trinh_tu.docx    mục 3.6
Nội dung lấy NGUYÊN từ tao_chuong3.py (không viết lại), số hình / số bảng giữ đúng như trong Chương 3.

Chạy:  python tach_file_rieng.py [tệp_mẫu.docx] [thư_mục_ra]
  - mặc định mẫu: C:/Users/Admin/Downloads/Khoa_luan_NguyenVanKhanh_11236129_Chuong1-2.docx (chỉ lấy kiểu chữ, lề, chân trang)
  - mặc định ra:  ../bao-cao/rieng/
"""
import importlib.util
import os
import re
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = sys.argv[1] if len(sys.argv) > 1 else "C:/Users/Admin/Downloads/Khoa_luan_NguyenVanKhanh_11236129_Chuong1-2.docx"
OUT_DIR = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "..", "bao-cao", "rieng")

# Nạp tao_chuong3.py như một module (không chạy main) để dùng chung nội dung và các hàm dựng XML
_argv = sys.argv
sys.argv = [os.path.join(HERE, "tao_chuong3.py")]
_spec = importlib.util.spec_from_file_location("tao_chuong3", os.path.join(HERE, "tao_chuong3.py"))
tc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(tc)
sys.argv = _argv

FILES = [
    ("TaskFlow_Use_case.docx", "BIỂU ĐỒ USE CASE CỦA HỆ THỐNG TASKFLOW", [("3.2.", "3.3.")], False),
    ("TaskFlow_Bieu_do_hoat_dong.docx", "BIỂU ĐỒ HOẠT ĐỘNG CỦA HỆ THỐNG TASKFLOW", [("3.3.", "3.4.")], False),
    ("TaskFlow_Kien_truc.docx", "KIẾN TRÚC TỔNG THỂ CỦA HỆ THỐNG TASKFLOW", [("3.4.", "3.5.")], False),
    ("TaskFlow_Thiet_ke_CSDL.docx", "THIẾT KẾ CƠ SỞ DỮ LIỆU CỦA HỆ THỐNG TASKFLOW", [("3.5.", "3.6.")], False),
    ("TaskFlow_Bieu_do_trinh_tu.docx", "BIỂU ĐỒ TRÌNH TỰ CỦA HỆ THỐNG TASKFLOW", [("3.6.", "3.7.")], False),
]


def numbering():
    """Đánh số hình / bảng trên TOÀN chương để số trong tệp riêng trùng với Chương 3."""
    fig_no, tab_no = {}, {}
    for b in tc.C:
        if b[0] == "fig":
            fig_no[b[1]] = f"Hình 3.{len(fig_no) + 1}"
        elif b[0] in ("tbl", "spec"):
            tab_no[b[1]] = f"Bảng 3.{len(tab_no) + 1}"
    return fig_no, tab_no


def heading_index(prefix):
    for i, b in enumerate(tc.C):
        if b[0] in ("h2", "h3") and b[1].startswith(prefix):
            return i
    raise SystemExit(f"Không thấy đề mục bắt đầu bằng {prefix}")


def blocks_xml(blocks, fig_no, tab_no):
    def refs(t):
        def rep(m):
            table = fig_no if m.group(1) == "H" else tab_no
            if m.group(2) not in table:
                raise SystemExit(f"Tham chiếu không tồn tại: {m.group(0)}")
            return table[m.group(2)]
        return re.sub(r"\{([HB]):([a-z0-9_]+)\}", rep, t)

    out = []
    for b in blocks:
        k = b[0]
        if k in ("h1", "h2", "h3"):
            out.append(tc.x_heading(int(k[1]), b[1]))
        elif k == "p":
            out.append(tc.x_para(refs(b[1])))
        elif k == "li":
            out.append(tc.x_li(refs(b[1])))
        elif k == "fig":
            out.append(tc.x_figure(b[2], f"{fig_no[b[1]]}: {b[3]}"))
        elif k == "tbl":
            _, key, cap, header, rows, widths = b
            centers = (0,) if key in ("tacnhan", "chucnang", "phichucnang") else ()
            if key == "matran":
                centers = (1, 2, 3, 4, 5)
            out.append(tc.x_table_caption(f"{tab_no[key]}: {cap}"))
            out.append(tc.x_table(header, rows, widths, centers))
        elif k == "spec":
            _, key, cap, rows = b
            out.append(tc.x_table_caption(f"{tab_no[key]}: {cap}"))
            out.append(tc.x_spec_table(rows))
    return "".join(out)


PAGE_BREAK = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def main():
    zin = zipfile.ZipFile(TEMPLATE)
    names = zin.namelist()
    base = {n: zin.read(n) for n in names}
    doc = base["word/document.xml"].decode("utf-8")
    root_open = re.search(r"<w:document[^>]*>", doc).group(0)
    prolog = doc[: doc.find(root_open)]
    rels0 = base["word/_rels/document.xml.rels"].decode("utf-8")
    header_id = re.search(r'Id="([^"]+)"[^>]*Target="header2\.xml"', rels0).group(1)
    footer_id = re.search(r'Id="([^"]+)"[^>]*Target="footer2\.xml"', rels0).group(1)
    sect = (f'<w:sectPr><w:headerReference w:type="default" r:id="{header_id}"/>'
            f'<w:footerReference w:type="default" r:id="{footer_id}"/>'
            '<w:pgSz w:w="11907" w:h="16840" w:code="9"/>'
            '<w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1984" w:header="720" w:footer="720" w:gutter="0"/>'
            '<w:pgNumType w:start="1"/><w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>')
    fig_no, tab_no = numbering()
    os.makedirs(OUT_DIR, exist_ok=True)

    for fname, title, ranges, with_appendix in FILES:
        tc.MEDIA = tc.Media()  # mỗi tệp một bộ ảnh riêng
        blocks = []
        for start, end in ranges:
            blocks += tc.C[heading_index(start):heading_index(end)]
        # Theo yêu cầu (06/10): tệp riêng CHỈ chứa hình (kèm dòng chú thích "Hình 3.x: ..."), không mô tả, không bảng
        blocks = [b for b in blocks if b[0] == "fig"]
        body = tc.x_heading(1, title) + blocks_xml(blocks, fig_no, tab_no)
        document = f"{prolog}{root_open}<w:body>{body}{sect}</w:body></w:document>"

        files = dict(base)
        files["word/document.xml"] = document.encode("utf-8")
        rels = rels0.replace("</Relationships>", "".join(
            f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="{name}"/>'
            for rid, name, _ in tc.MEDIA.items) + "</Relationships>")
        files["word/_rels/document.xml.rels"] = rels.encode("utf-8")
        ct = files["[Content_Types].xml"].decode("utf-8")
        if 'Extension="png"' not in ct:
            files["[Content_Types].xml"] = ct.replace("</Types>", '<Default Extension="png" ContentType="image/png"/></Types>').encode("utf-8")

        path = os.path.join(OUT_DIR, fname)
        try:
            open(path, "ab").close()  # tệp đang mở trong Word -> bị khoá, không ghi đè được
        except PermissionError:
            path = path.replace(".docx", "_chi_hinh.docx")
            print(f"  {fname} đang mở trong Word -> ghi sang {os.path.basename(path)}")
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zout:
            for n in names:
                zout.writestr(zin.getinfo(n), files[n])
            for rid, name, src in tc.MEDIA.items:
                zout.write(src, "word/" + name)
        nfig = sum(1 for b in blocks if b[0] == "fig")
        print(f"{fname}: {nfig} hình")


if __name__ == "__main__":
    main()
