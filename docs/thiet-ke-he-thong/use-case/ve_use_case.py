# -*- coding: utf-8 -*-
"""
Vẽ biểu đồ use case của TaskFlow: 1 biểu đồ tổng quát + 15 biểu đồ phân rã.

Chạy (từ thư mục này):
    python ve_use_case.py        -> svg/*.svg, drawio/*.drawio, spec.json, USE_CASE.md
    node chup_png.js             -> png/*.png (Chrome headless, tỉ lệ 2x)

Cần: Python 3 + Pillow (để đo độ rộng chữ Arial cho việc xuống dòng).
Muốn sửa nội dung: sửa phần "NỘI DUNG CÁC BIỂU ĐỒ" ở cuối file rồi chạy lại 2 lệnh trên.
Muốn sửa hình bằng tay: mở drawio/*.drawio bằng draw.io (app.diagrams.net hoặc bản desktop).

Ánh xạ tác nhân -> vai trò trong code (backend/prisma/schema.prisma, board.service.ts, workspace.service.ts):
    Người xem bảng      = BoardRole.VIEWER (assertBoardView)
    Thành viên bảng     = BoardRole.MEMBER trở lên, hoặc thành viên không gian với bảng WORKSPACE (assertBoardAccess)
    Quản trị viên bảng  = BoardRole.ADMIN/OWNER, hoặc OWNER/ADMIN của không gian chứa bảng (canManageBoard)
    Chủ sở hữu bảng     = Board.ownerId (assertBoardOwner)
    Thành viên / Quản trị viên / Chủ sở hữu không gian = WorkspaceRole MEMBER / ADMIN / OWNER
"""
import json
import math
import os
from xml.sax.saxutils import escape

from PIL import ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_FAMILY = "Arial, Helvetica, sans-serif"
FONT_PATH = "C:/Windows/Fonts/arial.ttf"
FS = 13            # cỡ chữ tên use case / tác nhân (px)
FS_SMALL = 11      # cỡ chữ «include» / «extend» / «system»
LINE_H = 16        # khoảng cách dòng
UC_TEXT_W = 172    # độ rộng tối đa của chữ trong hình elip
ACTOR_TEXT_W = 112

_font = ImageFont.truetype(FONT_PATH, FS)
_font_small = ImageFont.truetype(FONT_PATH, FS_SMALL)
_font_bold = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 14)


def text_w(s, font=_font):
    return font.getlength(s)


def _greedy(words, max_w, font):
    lines, cur = [], ""
    for word in words:
        trial = (cur + " " + word).strip()
        if not cur or text_w(trial, font) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    lines.append(cur)
    return lines


def wrap(text, max_w, font=_font):
    """Xuống dòng theo từ, chia CÂN các dòng (tránh dòng cuối chỉ còn 1 chữ); '\\n' là xuống dòng cứng."""
    lines = []
    for para in text.split("\n"):
        words = para.split(" ")
        base = _greedy(words, max_w, font)
        n = len(base)
        best = base
        if n > 1:
            # thu hẹp dần bề rộng mà vẫn giữ nguyên số dòng -> các dòng đều nhau hơn
            w = max_w
            while w > 40:
                w -= 4
                trial = _greedy(words, w, font)
                if len(trial) > n:
                    break
                best = trial
        lines += best
    return lines


# ============================ MÔ HÌNH ============================

class Actor:
    def __init__(self, aid, name, side, row, kind, dx, desc):
        self.id, self.name, self.side, self.row, self.kind, self.dx, self.desc = aid, name, side, row, kind, dx, desc
        self.x = self.y = 0.0
        if kind == "human":
            self.lines = wrap(name, ACTOR_TEXT_W)
        else:
            self.lines = wrap(name, 118)

    # Hình chữ nhật dùng để cắt đường nối (chỉ phần hình người / hộp, không gồm nhãn)
    def body_rect(self):
        if self.kind == "human":
            return (self.x - 17, self.y - 31, self.x + 17, self.y + 31)
        w, h = self.box_size()
        return (self.x - w / 2, self.y - h / 2, self.x + w / 2, self.y + h / 2)

    def box_size(self):
        w = max(max(text_w(l) for l in self.lines), text_w("«hệ thống ngoài»", _font_small)) + 24
        h = 22 + len(self.lines) * LINE_H + 8
        return max(w, 110), h

    # Hình chữ nhật bao cả nhãn (dùng cho quan hệ tổng quát hoá giữa tác nhân)
    def full_rect(self):
        if self.kind == "human":
            lw = max(text_w(l) for l in self.lines)
            half = max(17, lw / 2)
            return (self.x - half, self.y - 31, self.x + half, self.y + 31 + 6 + len(self.lines) * LINE_H)
        return self.body_rect()


class UseCase:
    def __init__(self, uid, name, col, row, code, desc):
        self.id, self.col, self.row, self.code, self.desc = uid, col, row, code, desc
        self.name = name.replace("\n", " ")   # tên đầy đủ (Word, draw.io)
        self.lines = wrap(name, UC_TEXT_W)     # các dòng chữ trong elip (giữ điểm ngắt dòng cứng)
        tw = max(text_w(l) for l in self.lines)
        th = len(self.lines) * LINE_H
        self.b = th / 2 + 14
        k = (th / 2) / self.b
        self.a = max(92.0, (tw / 2 + 4) / math.sqrt(1 - k * k))
        self.x = self.y = 0.0


class Diagram:
    def __init__(self, key, code, title, caption, intro, row_h=74, col_w=290, actor_gap=165, system="Hệ thống TaskFlow"):
        self.key, self.code, self.title, self.caption, self.intro = key, code, title, caption, intro
        self.row_h, self.col_w, self.actor_gap, self.system = row_h, col_w, actor_gap, system
        self.actors, self.ucs, self.edges, self.notes = {}, {}, [], []

    def actor(self, aid, name, side="L", row=0.0, kind="human", dx=0, desc=""):
        self.actors[aid] = Actor(aid, name, side, row, kind, dx, desc)

    def uc(self, uid, name, col=0, row=0.0, code="", desc="", by=()):
        self.ucs[uid] = UseCase(uid, name, col, row, code, desc)
        for a in by:
            self.assoc(a, uid)

    def assoc(self, a, u):
        self.edges.append(("assoc", a, u))

    def inc(self, base, included):
        self.edges.append(("include", base, included))

    def ext(self, extension, base):
        self.edges.append(("extend", extension, base))

    def gen(self, child, parent):
        self.edges.append(("gen", child, parent))

    def note(self, text):
        self.notes.append(text)

    # ---------------- bố cục ----------------
    def layout(self):
        col_a = {}
        for u in self.ucs.values():
            col_a[u.col] = max(col_a.get(u.col, 0), u.a)
        for u in self.ucs.values():
            u.a = col_a[u.col]          # cùng cột thì cùng bề rộng -> đầu mút thẳng hàng
            u.x = u.col * self.col_w
            u.y = u.row * self.row_h
        minx = min(u.x - u.a for u in self.ucs.values())
        maxx = max(u.x + u.a for u in self.ucs.values())
        miny = min(u.y - u.b for u in self.ucs.values())
        maxy = max(u.y + u.b for u in self.ucs.values())
        title_w = text_w(self.system, _font_bold)
        if maxx - minx < title_w + 40:
            extra = (title_w + 40 - (maxx - minx)) / 2
            minx -= extra
            maxx += extra
        self.boundary = [minx - 34, miny - 48, maxx + 34, maxy + 30]
        bx0, by0, bx1, by1 = self.boundary
        for a in self.actors.values():
            a.y = a.row * self.row_h
            if a.side == "L":
                a.x = bx0 - self.actor_gap + a.dx
            else:
                a.x = bx1 + self.actor_gap + a.dx
        # dịch toạ độ về dương + lề
        xs, ys = [bx0, bx1], [by0, by1]
        for a in self.actors.values():
            r = a.full_rect()
            xs += [r[0] - 4, r[2] + 4]
            ys += [r[1], r[3]]
            if a.kind == "human":
                lw = max(text_w(l) for l in a.lines)
                xs += [a.x - lw / 2 - 4, a.x + lw / 2 + 4]
        m = 22
        ox, oy = -min(xs) + m, -min(ys) + m
        for u in self.ucs.values():
            u.x += ox
            u.y += oy
        for a in self.actors.values():
            a.x += ox
            a.y += oy
        self.boundary = [bx0 + ox, by0 + oy, bx1 + ox, by1 + oy]
        self.W = math.ceil(max(xs) + ox + m)
        self.H = math.ceil(max(ys) + oy + m)


# ============================ HÌNH HỌC ============================

def clip_ellipse(u, tx, ty):
    dx, dy = tx - u.x, ty - u.y
    if dx == 0 and dy == 0:
        return u.x, u.y
    t = 1 / math.sqrt((dx / u.a) ** 2 + (dy / u.b) ** 2)
    return u.x + dx * t, u.y + dy * t


def clip_rect(r, cx, cy, tx, ty):
    x0, y0, x1, y1 = r
    dx, dy = tx - cx, ty - cy
    ts = []
    if dx:
        ts += [(x0 - cx) / dx, (x1 - cx) / dx]
    if dy:
        ts += [(y0 - cy) / dy, (y1 - cy) / dy]
    best = 1.0
    for t in ts:
        if t > 0:
            px, py = cx + dx * t, cy + dy * t
            if x0 - 0.01 <= px <= x1 + 0.01 and y0 - 0.01 <= py <= y1 + 0.01:
                best = min(best, t)
    return cx + dx * best, cy + dy * best


def center(d, nid):
    if nid in d.ucs:
        u = d.ucs[nid]
        return u.x, u.y
    r = d.actors[nid].body_rect()
    return (r[0] + r[2]) / 2, (r[1] + r[3]) / 2


def endpoint(d, nid, toward, full=False):
    tx, ty = toward
    if nid in d.ucs:
        return clip_ellipse(d.ucs[nid], tx, ty)
    a = d.actors[nid]
    r = a.full_rect() if full else a.body_rect()
    cx, cy = (r[0] + r[2]) / 2, (r[1] + r[3]) / 2
    return clip_rect(r, cx, cy, tx, ty)


def assoc_points(d, a_id, u_id):
    """Đường tác nhân - use case: neo vào đầu mút trái/phải của elip (phía có tác nhân), nhờ vậy
    các đường toả ra từ một tác nhân không bao giờ cắt ngang qua elip khác cùng cột."""
    u = d.ucs[u_id]
    ax, ay = center(d, a_id)
    tip = (u.x - u.a, u.y) if ax < u.x else (u.x + u.a, u.y)
    a = d.actors[a_id]
    if a.kind == "human":
        # xuất phát từ đầu bàn tay phía use case -> các đường toả ra không đè lên nhãn tên tác nhân
        x1, y1 = (a.x + 17, a.y - 5) if ax < u.x else (a.x - 17, a.y - 5)
    else:
        x1, y1 = endpoint(d, a_id, tip)
    return x1, y1, tip[0], tip[1]


# ============================ XUẤT SVG ============================

UC_FILL, UC_STROKE = "#F2F7FC", "#1F4E79"
LINE = "#333333"


def svg_text_lines(x, y_center, lines, size=FS, weight="normal", style="normal", anchor="middle"):
    n = len(lines)
    y0 = y_center - (n - 1) * LINE_H / 2
    out = []
    for i, l in enumerate(lines):
        out.append(
            f'<text x="{x:.1f}" y="{y0 + i * LINE_H:.1f}" font-size="{size}" font-weight="{weight}" '
            f'font-style="{style}" text-anchor="{anchor}" dominant-baseline="central">{escape(l)}</text>'
        )
    return "".join(out)


def arrow_open(x, y, ang, size=11):
    a1, a2 = ang + math.radians(152), ang - math.radians(152)
    return (f'<polyline points="{x + size * math.cos(a1):.1f},{y + size * math.sin(a1):.1f} {x:.1f},{y:.1f} '
            f'{x + size * math.cos(a2):.1f},{y + size * math.sin(a2):.1f}" fill="none" stroke="{LINE}" stroke-width="1.2"/>')


def arrow_triangle(x, y, ang, size=15):
    a1, a2 = ang + math.radians(150), ang - math.radians(150)
    return (f'<polygon points="{x:.1f},{y:.1f} {x + size * math.cos(a1):.1f},{y + size * math.sin(a1):.1f} '
            f'{x + size * math.cos(a2):.1f},{y + size * math.sin(a2):.1f}" fill="#FFFFFF" stroke="{LINE}" stroke-width="1.2"/>')


def draw_actor(a):
    out = []
    if a.kind == "human":
        x, y = a.x, a.y
        out.append(f'<circle cx="{x:.1f}" cy="{y - 22:.1f}" r="9" fill="#FFFFFF" stroke="#000" stroke-width="1.5"/>')
        out.append(f'<line x1="{x:.1f}" y1="{y - 13:.1f}" x2="{x:.1f}" y2="{y + 11:.1f}" stroke="#000" stroke-width="1.5"/>')
        out.append(f'<line x1="{x - 16:.1f}" y1="{y - 5:.1f}" x2="{x + 16:.1f}" y2="{y - 5:.1f}" stroke="#000" stroke-width="1.5"/>')
        out.append(f'<line x1="{x:.1f}" y1="{y + 11:.1f}" x2="{x - 13:.1f}" y2="{y + 31:.1f}" stroke="#000" stroke-width="1.5"/>')
        out.append(f'<line x1="{x:.1f}" y1="{y + 11:.1f}" x2="{x + 13:.1f}" y2="{y + 31:.1f}" stroke="#000" stroke-width="1.5"/>')
        ly = y + 31 + 6 + LINE_H / 2 + (len(a.lines) - 1) * LINE_H / 2
        lw = max(text_w(l) for l in a.lines) + 6
        out.append(f'<rect x="{x - lw / 2:.1f}" y="{y + 35:.1f}" width="{lw:.1f}" height="{len(a.lines) * LINE_H + 4:.1f}" fill="#FFFFFF"/>')
        out.append(svg_text_lines(x, ly, a.lines))
    else:
        r = a.body_rect()
        out.append(f'<rect x="{r[0]:.1f}" y="{r[1]:.1f}" width="{r[2] - r[0]:.1f}" height="{r[3] - r[1]:.1f}" '
                   f'fill="#FFFFFF" stroke="#000" stroke-width="1.3"/>')
        out.append(f'<text x="{a.x:.1f}" y="{r[1] + 14:.1f}" font-size="{FS_SMALL}" text-anchor="middle" '
                   f'dominant-baseline="central">«hệ thống ngoài»</text>')
        ly = r[1] + 24 + LINE_H / 2 + (len(a.lines) - 1) * LINE_H / 2
        out.append(svg_text_lines(a.x, ly, a.lines, weight="bold"))
    return "".join(out)


def to_svg(d):
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{d.W}" height="{d.H}" viewBox="0 0 {d.W} {d.H}" '
           f'font-family="{FONT_FAMILY}">',
           f'<rect width="{d.W}" height="{d.H}" fill="#FFFFFF"/>']
    bx0, by0, bx1, by1 = d.boundary
    out.append(f'<rect x="{bx0:.1f}" y="{by0:.1f}" width="{bx1 - bx0:.1f}" height="{by1 - by0:.1f}" '
               f'fill="none" stroke="#000" stroke-width="1.4"/>')
    out.append(f'<text x="{(bx0 + bx1) / 2:.1f}" y="{by0 + 22:.1f}" font-size="14" font-weight="bold" '
               f'text-anchor="middle" dominant-baseline="central">{escape(d.system)}</text>')
    labels = []
    for kind, s, t in d.edges:
        full = kind == "gen" and s in d.actors and t in d.actors
        sc, tc = center(d, s), center(d, t)
        x1, y1 = endpoint(d, s, tc, full)
        x2, y2 = endpoint(d, t, sc, full)
        ang = math.atan2(y2 - y1, x2 - x1)
        if kind == "assoc":
            x1, y1, x2, y2 = assoc_points(d, s, t)
            out.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{LINE}" stroke-width="1.2"/>')
        elif kind in ("include", "extend"):
            out.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{LINE}" '
                       f'stroke-width="1.2" stroke-dasharray="6 4"/>')
            out.append(arrow_open(x2, y2, ang))
            labels.append(((x1 + x2) / 2, (y1 + y2) / 2, "«include»" if kind == "include" else "«extend»"))
        elif kind == "gen":
            bx, by = x2 - 15 * math.cos(ang) * 0.87, y2 - 15 * math.sin(ang) * 0.87
            out.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{bx:.1f}" y2="{by:.1f}" stroke="{LINE}" stroke-width="1.2"/>')
            out.append(arrow_triangle(x2, y2, ang))
    for u in d.ucs.values():
        out.append(f'<ellipse cx="{u.x:.1f}" cy="{u.y:.1f}" rx="{u.a:.1f}" ry="{u.b:.1f}" fill="{UC_FILL}" '
                   f'stroke="{UC_STROKE}" stroke-width="1.4"/>')
        out.append(svg_text_lines(u.x, u.y, u.lines))
    for a in d.actors.values():
        out.append(draw_actor(a))
    for x, y, t in labels:
        w = text_w(t, _font_small) + 6
        out.append(f'<rect x="{x - w / 2:.1f}" y="{y - 8:.1f}" width="{w:.1f}" height="16" fill="#FFFFFF" opacity="0.92"/>')
        out.append(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{FS_SMALL}" text-anchor="middle" '
                   f'dominant-baseline="central">{escape(t)}</text>')
    out.append("</svg>")
    return "\n".join(out)


# ============================ XUẤT DRAW.IO ============================

def to_drawio(d):
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    bx0, by0, bx1, by1 = d.boundary
    cells.append(
        f'<mxCell id="sys" value="{escape(d.system)}" style="rounded=0;whiteSpace=wrap;html=1;fillColor=none;'
        f'verticalAlign=top;fontStyle=1;fontSize=14;fontFamily=Arial;spacingTop=6;" vertex="1" parent="1">'
        f'<mxGeometry x="{bx0:.0f}" y="{by0:.0f}" width="{bx1 - bx0:.0f}" height="{by1 - by0:.0f}" as="geometry"/></mxCell>')
    for u in d.ucs.values():
        cells.append(
            f'<mxCell id="{u.id}" value="{escape(u.name)}" style="ellipse;whiteSpace=wrap;html=1;fillColor={UC_FILL};'
            f'strokeColor={UC_STROKE};fontFamily=Arial;fontSize={FS};spacing=8;" vertex="1" parent="1">'
            f'<mxGeometry x="{u.x - u.a:.0f}" y="{u.y - u.b:.0f}" width="{2 * u.a:.0f}" height="{2 * u.b:.0f}" as="geometry"/></mxCell>')
    for a in d.actors.values():
        if a.kind == "human":
            cells.append(
                f'<mxCell id="{a.id}" value="{escape(a.name)}" style="shape=umlActor;verticalLabelPosition=bottom;'
                f'verticalAlign=top;html=1;outlineConnect=0;fontFamily=Arial;fontSize={FS};whiteSpace=wrap;" vertex="1" parent="1">'
                f'<mxGeometry x="{a.x - 15:.0f}" y="{a.y - 31:.0f}" width="30" height="62" as="geometry"/></mxCell>')
        else:
            r = a.body_rect()
            val = escape(f"«hệ thống ngoài»<br><b>{escape(a.name)}</b>")
            cells.append(
                f'<mxCell id="{a.id}" value="{val}" style="rounded=0;whiteSpace=wrap;html=1;fontFamily=Arial;fontSize={FS};"'
                f' vertex="1" parent="1"><mxGeometry x="{r[0]:.0f}" y="{r[1]:.0f}" width="{r[2] - r[0]:.0f}" '
                f'height="{r[3] - r[1]:.0f}" as="geometry"/></mxCell>')
    styles = {
        "assoc": ("", "endArrow=none;html=1;"),
        "include": ("«include»", "endArrow=open;endSize=10;dashed=1;html=1;fontFamily=Arial;fontSize=11;"),
        "extend": ("«extend»", "endArrow=open;endSize=10;dashed=1;html=1;fontFamily=Arial;fontSize=11;"),
        "gen": ("", "endArrow=block;endFill=0;endSize=14;html=1;"),
    }
    for i, (kind, s, t) in enumerate(d.edges):
        val, st = styles[kind]
        if kind == "assoc":
            side = 0 if d.actors[s].x < d.ucs[t].x else 1
            st += f"entryX={side};entryY=0.5;entryDx=0;entryDy=0;"
        cells.append(
            f'<mxCell id="e{i}" value="{escape(val)}" style="{st}" edge="1" parent="1" source="{s}" target="{t}">'
            f'<mxGeometry relative="1" as="geometry"/></mxCell>')
    body = "".join(cells)
    return (f'<mxfile host="app.diagrams.net"><diagram name="{escape(d.title)}" id="{d.key}">'
            f'<mxGraphModel dx="{d.W}" dy="{d.H}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" '
            f'fold="1" page="1" pageScale="1" pageWidth="{d.W}" pageHeight="{d.H}" math="0" shadow="0">'
            f'<root>{body}</root></mxGraphModel></diagram></mxfile>')


# ============================ SPEC CHO WORD ============================

def to_spec(d):
    def actor_names(uid):
        names = []
        for kind, s, t in d.edges:
            if kind == "assoc" and t == uid:
                names.append(d.actors[s].name)
        return names

    def relation_text(uid):
        includes = [d.ucs[t].code for k, s, t in d.edges if k == "include" and s == uid]
        included_by = [d.ucs[s].code for k, s, t in d.edges if k == "include" and t == uid]
        extends = [d.ucs[t].code for k, s, t in d.edges if k == "extend" and s == uid]
        rel = []
        if includes:
            rel.append("«include» " + ", ".join(includes))
        if extends:
            rel.append("«extend» " + ", ".join(extends))
        if included_by:
            rel.append("được " + ", ".join(included_by) + " bao hàm («include»)")
        return "; ".join(rel)

    ucs = sorted(d.ucs.values(), key=lambda u: [int(p) for p in u.code.replace("UC", "").split(".")])
    return {
        "key": d.key,
        "code": d.code,
        "title": d.title,
        "caption": d.caption,
        "intro": d.intro,
        "notes": d.notes,
        "png": f"png/{d.key}.png",
        "width": d.W,
        "height": d.H,
        "actors": [{"name": a.name, "kind": a.kind, "desc": a.desc} for a in d.actors.values()],
        "useCases": [
            {"code": u.code, "name": u.name, "actors": actor_names(u.id), "relation": relation_text(u.id), "desc": u.desc}
            for u in ucs
        ],
    }


# ============================ NỘI DUNG CÁC BIỂU ĐỒ ============================

DIAGRAMS = []


def diagram(*args, **kw):
    d = Diagram(*args, **kw)
    DIAGRAMS.append(d)
    return d


# ---------- Biểu đồ use case tổng quát ----------
# Chỉ hai tác nhân: Khách và Người dùng (mọi tài khoản đã đăng nhập). Vai trò trong không gian / bảng (Người xem,
# Thành viên, Quản trị viên, Chủ sở hữu) chỉ phân biệt ở các biểu đồ phân rã -> không cần mũi tên giữa các tác nhân.
# Các dịch vụ ngoài (Google, email, Unsplash, Gemini) và bộ lập lịch coi là bên trong hệ thống ở mức tổng quát.
d = diagram("uc00_tong_quat", "", "Biểu đồ use case tổng quát", "Biểu đồ use case tổng quát của hệ thống TaskFlow",
            "Biểu đồ use case tổng quát thể hiện toàn bộ nhóm chức năng của hệ thống TaskFlow và hai tác nhân chính: Khách "
            "(chưa đăng nhập) và Người dùng (đã đăng nhập). Ở mức tổng quát, mọi người dùng đã đăng nhập được gộp chung "
            "thành tác nhân Người dùng; quyền cụ thể theo vai trò trong không gian làm việc và trong bảng (Người xem, Thành "
            "viên, Quản trị viên, Chủ sở hữu) được thể hiện ở các biểu đồ phân rã. Các dịch vụ bên ngoài mà hệ thống dùng "
            "(Google, dịch vụ email, Unsplash, dịch vụ AI) và bộ lập lịch chạy ngầm được xem là một phần của hệ thống nên "
            "không vẽ thành tác nhân. Mỗi use case tổng quát được phân rã chi tiết ở các mục tiếp theo.",
            row_h=64, actor_gap=230)
d.actor("kh", "Khách", "L", 0.5)
d.actor("nd", "Người dùng", "L", 8.6)
d.uc("u01", "Xác thực tài khoản", 0, 0, "UC01", "Đăng ký, đăng nhập (email/mật khẩu hoặc Google), xác minh email, quên và đặt lại mật khẩu, đăng xuất.", by=["kh"])
d.uc("u06", "Xem bảng công khai", 0, 1, "UC02", "Xem bảng ở chế độ công khai, chỉ đọc, không cần đăng nhập.", by=["kh"])
d.uc("u02", "Quản lý tài khoản cá nhân", 0, 2, "UC03", "Xem/cập nhật hồ sơ, ảnh đại diện, đổi mật khẩu, chọn giao diện sáng/tối.", by=["nd"])
d.uc("u03", "Quản lý không gian làm việc", 0, 3, "UC04", "Tạo không gian, quản lý thành viên và vai trò, xem tổng quan công việc của không gian.", by=["nd"])
d.uc("u04", "Quản lý bảng", 0, 4, "UC05", "Tạo, xem, lọc, thống kê, đổi hình nền, lưu trữ, xoá bảng; cấu hình nhãn, trường tùy chỉnh, mẫu thẻ, luật tự động và lịch tạo thẻ định kỳ.", by=["nd"])
d.uc("u05", "Chia sẻ và phân quyền bảng", 0, 5, "UC06", "Mời thành viên, liên kết mời, duyệt yêu cầu tham gia, đổi vai trò, chế độ hiển thị.", by=["nd"])
d.uc("u07", "Quản lý danh sách công việc", 0, 6, "UC07", "Thêm, đổi tên, gắn trạng thái, sắp xếp, sao chép, lưu trữ danh sách (cột).", by=["nd"])
d.uc("u08", "Quản lý thẻ công việc", 0, 7, "UC08", "Thêm, sửa, di chuyển, đổi trạng thái, lưu trữ thẻ; giao thành viên, gắn nhãn, checklist, đính kèm tệp, bình luận và nhắc tên.", by=["nd"])
d.uc("u11", "Tra cứu và\ntheo dõi công việc", 0, 8, "UC09", "Tìm kiếm nhanh/nâng cao, xem công việc của tôi, lịch công việc, bảng điều khiển cá nhân.", by=["nd"])
d.uc("u12", "Quản lý thông báo", 0, 9, "UC10", "Nhận thông báo thời gian thực, đánh dấu đã đọc, cấu hình kênh nhận; nhắc hạn và email tổng hợp.", by=["nd"])
d.uc("u13", "Sinh bảng tự động bằng AI", 0, 10, "UC11", "Từ mô tả dự án (văn bản, DOCX, PDF) sinh kế hoạch bảng, cho chỉnh sửa rồi tạo bảng.", by=["nd"])
d.uc("u14", "Gợi ý phân công công việc", 0, 11, "UC12", "Gợi ý người phụ trách phù hợp cho thẻ và lập kế hoạch chia việc cho cả danh sách.", by=["nd"])
d.uc("u15", "Hỏi đáp với trợ lý ảo", 0, 12, "UC13", "Hỏi đáp bằng ngôn ngữ tự nhiên về tình hình công việc trong phạm vi được phép.", by=["nd"])
d.note("Người dùng đã đăng nhập cũng xem được bảng công khai; Khách chỉ xem được bảng có chế độ hiển thị Công khai.")
d.note("Không phải Người dùng nào cũng thực hiện được mọi thao tác trong một use case: ví dụ chỉ Quản trị viên bảng được "
       "duyệt yêu cầu tham gia, chỉ Chủ sở hữu bảng được xoá bảng. Phân quyền chi tiết xem ở biểu đồ phân rã của từng use case.")

# ---------- UC01 Xác thực tài khoản ----------
d = diagram("uc01_xac_thuc", "UC01", "Phân rã use case Xác thực tài khoản", "Biểu đồ use case phân rã: Xác thực tài khoản",
            "Nhóm chức năng giúp Khách tạo tài khoản và đăng nhập vào hệ thống, đồng thời giúp Người dùng bảo vệ tài khoản "
            "(xác minh email, đặt lại mật khẩu). Xác thực dùng JWT lưu trong cookie httpOnly.")
d.actor("kh", "Khách", "L", 2, desc="")
d.actor("nd", "Người dùng", "L", 5.5)
d.actor("gg", "Google", "R", 0, kind="system")
d.actor("em", "Dịch vụ email", "R", 3, kind="system")
d.uc("dn", "Đăng nhập", 0, 0, "UC01.1", "Đăng nhập bằng email và mật khẩu; thành công thì hệ thống cấp JWT lưu trong cookie httpOnly. Có giới hạn số lần thử.", by=["kh"])
d.uc("gg_dn", "Đăng nhập bằng Google", 1, 0, "UC01.2", "Xác thực qua tài khoản Google; nếu email chưa có tài khoản thì hệ thống tự tạo tài khoản và không gian cá nhân.", by=["gg"])
d.ext("gg_dn", "dn")
d.uc("dk", "Đăng ký tài khoản", 0, 1, "UC01.3", "Nhập họ tên, email, mật khẩu (tối thiểu 6 ký tự); hệ thống tạo tài khoản, tạo sẵn không gian làm việc cá nhân và gửi email xác minh.", by=["kh", "em"])
d.uc("xm", "Xác minh email", 0, 2, "UC01.4", "Mở liên kết trong email để xác minh địa chỉ; mã xác minh chỉ dùng một lần và có thời hạn. Chưa xác minh vẫn dùng được hệ thống (chỉ hiện banner nhắc).", by=["kh"])
d.uc("qmk", "Quên mật khẩu", 0, 3, "UC01.5", "Nhập email để nhận liên kết đặt lại mật khẩu; hệ thống không tiết lộ email đó có tồn tại hay không.", by=["kh", "em"])
d.uc("dlmk", "Đặt lại mật khẩu", 0, 4, "UC01.6", "Đặt mật khẩu mới qua liên kết trong email; mọi phiên đăng nhập cũ bị thu hồi.", by=["kh"])
d.uc("gl", "Gửi lại email xác minh", 0, 5, "UC01.7", "Người dùng chưa xác minh yêu cầu gửi lại email xác minh từ banner nhắc.", by=["nd", "em"])
d.uc("dx", "Đăng xuất", 0, 6, "UC01.8", "Xoá cookie phiên và ngắt kết nối thời gian thực.", by=["nd"])

# ---------- UC02 Xem bảng công khai ----------
d = diagram("uc02_cong_khai", "UC02", "Phân rã use case Xem bảng công khai", "Biểu đồ use case phân rã: Xem bảng công khai",
            "Bảng ở chế độ Công khai có thể được xem qua đường dẫn mà không cần đăng nhập, ở chế độ chỉ đọc tuyệt đối "
            "(không kéo-thả, không bình luận); email thành viên được ẩn.")
d.actor("kh", "Khách", "L", 1)
d.uc("xem", "Xem bảng công khai", 0, 0, "UC02.1", "Xem các danh sách và thẻ của bảng công khai.", by=["kh"])
d.uc("the", "Xem chi tiết thẻ công khai", 0, 1, "UC02.2", "Xem nhãn, ngày, thành viên, mô tả, checklist, bình luận của thẻ ở chế độ chỉ đọc.", by=["kh"])
d.uc("tep", "Tải tệp đính kèm", 0, 2, "UC02.3", "Tải tệp đính kèm của thẻ thuộc bảng công khai.", by=["kh"])
d.note("Người dùng đã đăng nhập cũng thực hiện được các use case này.")

# ---------- UC03 Quản lý tài khoản cá nhân ----------
d = diagram("uc03_tai_khoan", "UC03", "Phân rã use case Quản lý tài khoản cá nhân",
            "Biểu đồ use case phân rã: Quản lý tài khoản cá nhân",
            "Người dùng xem và cập nhật thông tin cá nhân của mình. Hồ sơ năng lực phục vụ gợi ý phân công được trình bày ở UC12.")
d.actor("nd", "Người dùng", "L", 1.5)
d.uc("xem", "Xem hồ sơ cá nhân", 0, 0, "UC03.1", "Xem tên, email, ảnh đại diện, số bảng, số bảng yêu thích và ngày tham gia.", by=["nd"])
d.uc("cn", "Cập nhật thông tin cá nhân", 0, 1, "UC03.2", "Sửa tên hiển thị; email chỉ đọc.", by=["nd"])
d.uc("anh", "Thay đổi ảnh đại diện", 1, 1, "UC03.3", "Tải ảnh lên làm ảnh đại diện hoặc gỡ ảnh hiện tại.")
d.ext("anh", "cn")
d.uc("dmk", "Đổi mật khẩu", 0, 2, "UC03.4", "Nhập mật khẩu hiện tại và mật khẩu mới; hệ thống thu hồi các phiên và kết nối thời gian thực cũ (tokenVersion).", by=["nd"])
d.uc("gd", "Tuỳ chỉnh giao diện sáng/tối", 0, 3, "UC03.5", "Chọn chế độ Sáng, Tối hoặc Theo hệ thống.", by=["nd"])

# ---------- UC04 Quản lý không gian làm việc ----------
d = diagram("uc04_khong_gian", "UC04", "Phân rã use case Quản lý không gian làm việc",
            "Biểu đồ use case phân rã: Quản lý không gian làm việc",
            "Mỗi bảng thuộc đúng một không gian làm việc; mỗi người dùng có sẵn một không gian cá nhân. Quyền trong không gian "
            "chia theo ba vai trò Chủ sở hữu, Quản trị viên, Thành viên.")
d.actor("nd", "Người dùng", "L", 0)
d.actor("tvk", "Thành viên không gian", "L", 2.6)
d.actor("qtk", "Quản trị viên không gian", "L", 6.4)
d.actor("csk", "Chủ sở hữu không gian", "L", 9.6)
d.gen("tvk", "nd")
d.gen("qtk", "tvk")
d.gen("csk", "qtk")
d.actor("em", "Dịch vụ email", "R", 6, kind="system")
d.uc("tao", "Tạo không gian làm việc", 0, 0, "UC04.1", "Tạo không gian mới; người tạo trở thành Chủ sở hữu.", by=["nd"])
d.uc("xem", "Xem và chuyển đổi không gian", 0, 1, "UC04.2", "Xem danh sách không gian mình tham gia và chuyển nhanh giữa các không gian.", by=["tvk"])
d.uc("tq", "Xem tổng quan không gian", 0, 2, "UC04.3", "Xem số liệu thẻ (tổng, quá hạn, chưa giao, đã xong), lọc theo người phụ trách/trạng thái và các bảng trong không gian.", by=["tvk"])
d.uc("dstv", "Xem danh sách thành viên", 0, 3, "UC04.4", "Xem các thành viên và vai trò của họ trong không gian.", by=["tvk"])
d.uc("roi", "Rời khỏi không gian", 0, 4, "UC04.5", "Tự rời khỏi không gian (Chủ sở hữu không rời được).", by=["tvk"])
d.uc("ten", "Đổi tên không gian", 0, 5, "UC04.6", "Đổi tên không gian làm việc.", by=["qtk"])
d.uc("them", "Thêm thành viên vào không gian", 0, 6, "UC04.7", "Thêm người dùng đã có tài khoản theo email và chọn vai trò.", by=["qtk"])
d.uc("moi", "Mời qua email người\nchưa có tài khoản", 1, 6, "UC04.8", "Nếu email chưa có tài khoản, hệ thống gửi email mời đăng ký.", by=["em"])
d.ext("moi", "them")
d.uc("vt", "Thay đổi vai trò thành viên", 0, 7, "UC04.9", "Đổi giữa Quản trị viên và Thành viên (không đổi được vai trò của Chủ sở hữu).", by=["qtk"])
d.uc("xoa_tv", "Xoá thành viên khỏi không gian", 0, 8, "UC04.10", "Xoá một thành viên (không xoá được Chủ sở hữu).", by=["qtk"])
d.uc("cqsh", "Chuyển quyền sở hữu\nkhông gian", 0, 9, "UC04.11", "Chuyển vai trò Chủ sở hữu cho một thành viên khác (không áp dụng cho không gian cá nhân).", by=["csk"])
d.uc("xoa", "Xoá không gian làm việc", 0, 10, "UC04.12", "Xoá không gian (không xoá được không gian cá nhân).", by=["csk"])

# ---------- UC05 Quản lý bảng (phần 1) ----------
d = diagram("uc05a_bang", "UC05", "Phân rã use case Quản lý bảng (phần 1: thao tác trên bảng)",
            "Biểu đồ use case phân rã: Quản lý bảng (phần 1 - thao tác trên bảng)",
            "Bảng là nơi tổ chức công việc theo các danh sách (cột) và thẻ. Quyền trên bảng phụ thuộc vai trò: Người xem bảng "
            "chỉ xem, Thành viên bảng được sửa nội dung, Chủ sở hữu bảng được lưu trữ và xoá bảng.",
            row_h=70)
d.actor("nd", "Người dùng", "L", 0.5)
d.actor("nxb", "Người xem bảng", "L", 5.1)
d.actor("tvb", "Thành viên bảng", "L", 10.3)
d.actor("csb", "Chủ sở hữu bảng", "L", 13.5)
d.gen("nxb", "nd")
d.gen("tvb", "nxb")
d.gen("csb", "tvb")
d.actor("us", "Unsplash", "R", 9, kind="system")
d.uc("tao", "Tạo bảng mới", 0, 0, "UC05.1", "Đặt tên, chọn không gian làm việc và hình nền (màu hoặc ảnh Unsplash); người tạo là Chủ sở hữu bảng.", by=["nd"])
d.uc("mau", "Tạo bảng từ mẫu", 1, 0, "UC05.2", "Dùng mẫu có sẵn của hệ thống hoặc mẫu tự lưu để dựng sẵn các cột và thẻ.")
d.ext("mau", "tao")
d.uc("ds", "Xem danh sách bảng", 0, 1, "UC05.3", "Xem các bảng theo nhóm: yêu thích, từng không gian làm việc, bảng đã lưu trữ.", by=["nd"])
d.uc("xem", "Xem nội dung bảng", 0, 2, "UC05.4", "Xem các danh sách và thẻ của bảng; cập nhật thời gian thực khi người khác thay đổi.", by=["nxb"])
d.uc("cd", "Chuyển chế độ xem\nKanban / bảng biểu", 1, 2, "UC05.5", "Chuyển giữa dạng cột Kanban và dạng bảng biểu có sắp xếp theo cột.")
d.ext("cd", "xem")
d.uc("loc", "Lọc thẻ trên bảng", 0, 3, "UC05.6", "Lọc theo từ khoá, thành viên, nhãn, trạng thái, hạn (quá hạn, ngày mai, trong tuần).", by=["nxb"])
d.uc("tk", "Xem thống kê bảng", 0, 4, "UC05.7", "Xem tổng số thẻ, số hoàn thành, quá hạn, tiến độ từng danh sách, thống kê theo trạng thái và theo thành viên.", by=["nxb"])
d.uc("hd", "Xem nhật ký hoạt động bảng", 0, 5, "UC05.8", "Xem lịch sử thao tác trên bảng (ai, làm gì, khi nào).", by=["nxb"])
d.uc("td", "Theo dõi bảng", 0, 6, "UC05.9", "Bật/tắt theo dõi để nhận thông báo về thay đổi trong bảng.", by=["nxb"])
d.uc("xuat", "Xuất bảng ra tệp JSON", 0, 7, "UC05.10", "Tải toàn bộ dữ liệu bảng về máy dưới dạng tệp JSON.", by=["nxb"])
d.uc("ten", "Cập nhật tên bảng", 0, 8, "UC05.11", "Sửa tên bảng trực tiếp trên thanh tiêu đề.", by=["tvb"])
d.uc("nen", "Thay đổi hình nền bảng", 0, 9, "UC05.12", "Đổi màu nền, tải ảnh nền lên hoặc gỡ ảnh nền.", by=["tvb"])
d.uc("unsplash", "Chọn ảnh nền từ Unsplash", 1, 9, "UC05.13", "Tìm và chọn ảnh từ thư viện Unsplash (ghi nhận lượt tải theo yêu cầu của Unsplash).", by=["us"])
d.ext("unsplash", "nen")
d.uc("sao", "Đánh dấu sao bảng", 0, 10, "UC05.14", "Đưa bảng vào mục Yêu thích để truy cập nhanh.", by=["tvb"])
d.uc("luumau", "Lưu bảng thành mẫu", 0, 11, "UC05.15", "Lưu cấu trúc cột và thẻ của bảng thành mẫu dùng lại trong không gian.", by=["tvb"])
d.uc("lt", "Quản lý mục đã lưu trữ", 0, 12, "UC05.16", "Xem thẻ và danh sách đã lưu trữ; khôi phục hoặc xoá vĩnh viễn.", by=["tvb"])
d.uc("ltb", "Lưu trữ / khôi phục bảng", 0, 13, "UC05.17", "Ẩn bảng khỏi danh sách đang dùng hoặc khôi phục lại.", by=["csb"])
d.uc("xoa", "Xoá bảng", 0, 14, "UC05.18", "Xoá bảng (có hộp thoại xác nhận riêng); thành viên đang mở bảng được điều hướng ra ngoài.", by=["csb"])
d.note("Thành viên bảng gồm vai trò MEMBER, ADMIN của bảng và thành viên không gian khi bảng ở chế độ hiển thị Không gian làm việc.")
d.note("Chủ sở hữu bảng đồng thời là Quản trị viên bảng (xem UC06). Nhóm chức năng này không có use case riêng của Quản trị viên bảng nên biểu đồ vẽ tắt Chủ sở hữu bảng kế thừa Thành viên bảng.")

# ---------- UC05 Quản lý bảng (phần 2: cấu hình và tự động hoá) ----------
d = diagram("uc05b_cau_hinh_tu_dong_hoa", "UC05", "Phân rã use case Quản lý bảng (phần 2: cấu hình và tự động hoá)",
            "Biểu đồ use case phân rã: Quản lý bảng (phần 2 - cấu hình và tự động hoá)",
            "Phần 2 của Quản lý bảng. Thành viên bảng định nghĩa các thành phần dùng chung của bảng (nhãn, trường tùy chỉnh, mẫu thẻ) và các quy tắc "
            "tự động. Bộ lập lịch của máy chủ chạy định kỳ để tạo thẻ theo lịch đã đặt.")
d.actor("tvb", "Thành viên bảng", "L", 2)
d.actor("bll", "Bộ lập lịch", "L", 5.6, kind="system")
d.uc("nhan", "Quản lý nhãn của bảng", 0, 0, "UC05.19", "Thêm, sửa tên/màu, xoá nhãn (bảng 10 màu dùng chung).", by=["tvb"])
d.uc("tr", "Quản lý trường tùy chỉnh", 0, 1, "UC05.20", "Thêm, đổi tên, xoá trường kiểu Văn bản, Số, Ngày, Hộp kiểm, Danh sách thả xuống.", by=["tvb"])
d.uc("lc", "Quản lý lựa chọn của\ntrường thả xuống", 1, 1, "UC05.21", "Thêm, sửa, xoá các lựa chọn của trường kiểu danh sách thả xuống.")
d.ext("lc", "tr")
d.uc("mau", "Quản lý mẫu thẻ", 0, 2, "UC05.22", "Tạo và xoá mẫu thẻ của bảng.", by=["tvb"])
d.uc("luat", "Quản lý luật tự động hoá", 0, 3, "UC05.23", "Tạo luật: điều kiện (thẻ được tạo / thẻ được chuyển vào danh sách X) và tối đa 5 hành động (đánh dấu xong, gắn nhãn, giao thành viên); sửa, xoá luật.", by=["tvb"])
d.uc("bat", "Bật / tắt luật tự động", 1, 3, "UC05.24", "Tạm ngưng hoặc kích hoạt lại một luật.")
d.ext("bat", "luat")
d.uc("lich", "Quản lý lịch tạo thẻ định kỳ", 0, 4, "UC05.25", "Đặt lịch cho một danh sách: tần suất ngày/tuần/tháng, giờ tạo, mẫu thẻ, ngày dừng; xoá lịch.", by=["tvb"])
d.uc("dung", "Tạm dừng / tiếp tục\nlịch định kỳ", 1, 4, "UC05.26", "Tạm dừng hoặc tiếp tục một lịch tạo thẻ.")
d.ext("dung", "lich")
d.uc("tudong", "Tự động tạo thẻ theo lịch", 0, 5.6, "UC05.27", "Đến giờ, hệ thống tạo thẻ mới vào danh sách theo lịch (dùng mẫu thẻ nếu có).", by=["bll"])

# ---------- UC06 Chia sẻ và phân quyền bảng ----------
d = diagram("uc06_chia_se", "UC06", "Phân rã use case Chia sẻ và phân quyền bảng",
            "Biểu đồ use case phân rã: Chia sẻ và phân quyền bảng",
            "Bảng có bốn vai trò: Chủ sở hữu, Quản trị viên, Thành viên, Người xem. Quản trị viên bảng gồm vai trò ADMIN, "
            "Chủ sở hữu bảng và Chủ sở hữu/Quản trị viên của không gian chứa bảng.")
d.actor("nd", "Người dùng", "L", 0.5)
d.actor("tvb", "Thành viên bảng", "L", 2.8)
d.actor("qtb", "Quản trị viên bảng", "L", 6.6)
d.actor("csb", "Chủ sở hữu bảng", "L", 10)
d.gen("tvb", "nd")
d.gen("qtb", "tvb")
d.gen("csb", "qtb")
d.actor("em", "Dịch vụ email", "R", 4, kind="system")
d.uc("xtm", "Xem trước lời mời tham gia bảng", 0, 0, "UC06.1", "Mở liên kết mời để xem tên và hình nền bảng trước khi tham gia.", by=["nd"])
d.uc("yc", "Gửi yêu cầu tham gia bảng", 0, 1, "UC06.2", "Gửi yêu cầu tham gia; Quản trị viên bảng nhận thông báo thời gian thực để duyệt.", by=["nd"])
d.uc("tv", "Xem thành viên và\nngười đang trực tuyến", 0, 2, "UC06.3", "Xem danh sách thành viên, vai trò và ai đang mở bảng.", by=["tvb"])
d.uc("roi", "Rời khỏi bảng", 0, 3, "UC06.4", "Tự rời khỏi bảng (Chủ sở hữu không rời được).", by=["tvb"])
d.uc("moi", "Mời thành viên vào bảng", 0, 4, "UC06.5", "Mời theo email và chọn vai trò (Quản trị viên, Thành viên, Người xem).", by=["qtb"])
d.uc("moi_em", "Gửi lời mời qua email", 1, 4, "UC06.6", "Nếu email chưa có tài khoản, hệ thống gửi email kèm liên kết tham gia.", by=["em"])
d.ext("moi_em", "moi")
d.uc("lk", "Quản lý liên kết mời", 0, 5, "UC06.7", "Tạo, sao chép hoặc vô hiệu hoá liên kết mời tham gia bảng.", by=["qtb"])
d.uc("duyet", "Duyệt / từ chối yêu cầu tham gia", 0, 6, "UC06.8", "Chấp nhận hoặc từ chối các yêu cầu tham gia đang chờ.", by=["qtb"])
d.uc("vt", "Thay đổi vai trò thành viên", 0, 7, "UC06.9", "Đổi vai trò của thành viên trong bảng.", by=["qtb"])
d.uc("xoa", "Xoá thành viên khỏi bảng", 0, 8, "UC06.10", "Xoá thành viên; người bị xoá mất quyền truy cập ngay, kể cả kết nối thời gian thực.", by=["qtb"])
d.uc("ht", "Thay đổi chế độ hiển thị bảng", 0, 9, "UC06.11", "Chọn Riêng tư, Không gian làm việc hoặc Công khai (chỉ đọc).", by=["qtb"])
d.uc("cqsh", "Chuyển quyền sở hữu bảng", 0, 10, "UC06.12", "Chuyển vai trò Chủ sở hữu cho một thành viên khác của bảng.", by=["csb"])
d.note("Biểu đồ lược bỏ Người xem bảng: Thành viên bảng kế thừa Người xem bảng (xem UC05), Người xem bảng kế thừa Người dùng. Người xem bảng cũng xem được thành viên và tự rời khỏi bảng.")

# ---------- UC07 Quản lý danh sách công việc ----------
d = diagram("uc07_danh_sach", "UC07", "Phân rã use case Quản lý danh sách công việc",
            "Biểu đồ use case phân rã: Quản lý danh sách công việc",
            "Danh sách là một cột trên bảng Kanban. Mỗi danh sách có thể gắn một trạng thái công việc (Chưa làm, Đang làm, "
            "Chờ duyệt, Hoàn thành, Bị chặn); thẻ nằm trong cột nào sẽ mang trạng thái của cột đó.")
d.actor("nxb", "Người xem bảng", "L", 0)
d.actor("tvb", "Thành viên bảng", "L", 7)
d.gen("tvb", "nxb")
d.uc("td", "Theo dõi danh sách", 0, 0, "UC07.1", "Bật/tắt theo dõi để nhận thông báo về thẻ trong danh sách.", by=["nxb"])
d.uc("them", "Thêm danh sách", 0, 1, "UC07.2", "Thêm cột mới vào cuối bảng; hệ thống đoán trạng thái theo tên cột nếu người dùng không chọn.", by=["tvb"])
d.uc("ten", "Đổi tên danh sách", 0, 2, "UC07.3", "Sửa tên cột.", by=["tvb"])
d.uc("tt", "Gắn trạng thái cho danh sách", 0, 3, "UC07.4", "Chọn trạng thái cho cột hoặc để cột tự do.", by=["tvb"])
d.uc("dongbo", "Đồng bộ trạng thái\nthẻ theo cột", 1, 3.5, "UC07.5", "Cập nhật trạng thái của mọi thẻ trong cột theo trạng thái của cột.")
d.inc("tt", "dongbo")
d.uc("vitri", "Thay đổi vị trí danh sách", 0, 4, "UC07.6", "Kéo-thả cột hoặc chuyển cột lên đầu/cuối bảng.", by=["tvb"])
d.uc("chuyen", "Chuyển toàn bộ thẻ\nsang danh sách khác", 0, 5, "UC07.7", "Chuyển tất cả thẻ của cột sang cột khác trong bảng.", by=["tvb"])
d.inc("chuyen", "dongbo")
d.uc("sao", "Sao chép danh sách", 0, 6, "UC07.8", "Tạo bản sao của cột cùng các thẻ trong cột.", by=["tvb"])
d.uc("sx", "Sắp xếp thẻ trong danh sách", 0, 7, "UC07.9", "Sắp xếp theo ngày tạo (mới/cũ), theo tên hoặc đưa thẻ đã xong xuống cuối.", by=["tvb"])
d.uc("xoahet", "Xoá tất cả thẻ\ntrong danh sách", 0, 8, "UC07.10", "Xoá mọi thẻ trong cột (có xác nhận).", by=["tvb"])
d.uc("lt", "Lưu trữ danh sách", 0, 9, "UC07.11", "Ẩn cột khỏi bảng; khôi phục hoặc xoá vĩnh viễn ở mục lưu trữ (UC05.16).", by=["tvb"])

# ---------- UC08 Quản lý thẻ công việc (phần 1) ----------
d = diagram("uc08a_the", "UC08", "Phân rã use case Quản lý thẻ công việc (phần 1: thao tác trên thẻ)",
            "Biểu đồ use case phân rã: Quản lý thẻ công việc (phần 1 - thao tác trên thẻ)",
            "Thẻ là một công việc cụ thể, gồm tiêu đề, mô tả, ngày bắt đầu, hạn hoàn thành, trạng thái và ảnh bìa. Trạng "
            "thái thẻ và cột chứa thẻ được giữ đồng bộ hai chiều.")
d.actor("nxb", "Người xem bảng", "L", 1)
d.actor("tvb", "Thành viên bảng", "L", 8)
d.gen("tvb", "nxb")
d.uc("xem", "Xem chi tiết thẻ", 0, 0, "UC08.1", "Mở cửa sổ chi tiết thẻ: thông tin, checklist, tệp, bình luận và lịch sử hoạt động.", by=["nxb"])
d.uc("td", "Theo dõi thẻ", 0, 1, "UC08.2", "Bật/tắt theo dõi để nhận thông báo khi thẻ thay đổi.", by=["nxb"])
d.uc("nh", "Đặt nhắc hạn cho thẻ", 0, 2, "UC08.3", "Chọn các mốc nhắc trước hạn (riêng cho từng người).", by=["nxb"])
d.uc("them", "Thêm thẻ mới", 0, 3, "UC08.4", "Thêm thẻ vào cuối một danh sách; thẻ nhận trạng thái của danh sách.", by=["tvb"])
d.uc("tumau", "Tạo thẻ từ mẫu thẻ", 1, 2.4, "UC08.5", "Tạo thẻ theo mẫu thẻ đã lưu (kèm mô tả, checklist).")
d.ext("tumau", "them")
d.uc("dc", "Di chuyển thẻ", 0, 4, "UC08.6", "Kéo-thả thẻ trong/giữa các cột, hoặc chuyển sang bảng khác.", by=["tvb"])
d.uc("luat", "Thực thi luật tự động hoá", 1, 3.5, "UC08.7", "Khi có luật khớp (thẻ được tạo / được chuyển vào cột X), hệ thống tự đánh dấu xong, gắn nhãn hoặc giao thành viên.")
d.ext("luat", "them")
d.ext("luat", "dc")
d.uc("tt", "Thay đổi trạng thái thẻ", 0, 5, "UC08.8", "Đổi trạng thái hoặc đánh dấu hoàn thành; thẻ tự chuyển sang cột mang trạng thái đó (nếu có).", by=["tvb"])
d.uc("dongbo", "Đồng bộ trạng thái\nthẻ với cột", 1, 4.6, "UC08.9", "Giữ trạng thái thẻ khớp với trạng thái của cột chứa thẻ.")
d.inc("dc", "dongbo")
d.inc("tt", "dongbo")
d.uc("sua", "Cập nhật thông tin thẻ", 0, 6, "UC08.10", "Sửa tiêu đề, mô tả (Markdown), ngày bắt đầu, hạn hoàn thành, ảnh bìa.", by=["tvb"])
d.uc("sao", "Sao chép thẻ", 0, 7, "UC08.11", "Tạo bản sao của thẻ trong danh sách được chọn.", by=["tvb"])
d.uc("luumau", "Lưu thẻ thành mẫu", 0, 8, "UC08.12", "Lưu thẻ làm mẫu thẻ dùng lại trong bảng.", by=["tvb"])
d.uc("lt", "Lưu trữ thẻ", 0, 9, "UC08.13", "Ẩn thẻ khỏi bảng; khôi phục hoặc xoá vĩnh viễn ở mục lưu trữ.", by=["tvb"])
d.uc("xoa", "Xoá thẻ", 0, 10, "UC08.14", "Xoá thẻ khỏi bảng.", by=["tvb"])

# ---------- UC08 Quản lý thẻ công việc (phần 2: cộng tác trên thẻ) ----------
d = diagram("uc08b_cong_tac", "UC08", "Phân rã use case Quản lý thẻ công việc (phần 2: cộng tác trên thẻ)",
            "Biểu đồ use case phân rã: Quản lý thẻ công việc (phần 2 - cộng tác trên thẻ)",
            "Phần 2 của Quản lý thẻ công việc. Các thao tác cộng tác diễn ra trong cửa sổ chi tiết thẻ. Mọi thay đổi được ghi vào lịch sử hoạt động và đồng "
            "bộ thời gian thực tới những người đang mở bảng.")
d.actor("tvb", "Thành viên bảng", "L", 4.6)
d.uc("tv", "Quản lý thành viên của thẻ", 0, 0, "UC08.15", "Giao hoặc gỡ người phụ trách (một thẻ có thể có nhiều người); người được giao nhận thông báo.", by=["tvb"])
d.uc("nhan", "Gắn / gỡ nhãn cho thẻ", 0, 1, "UC08.16", "Chọn nhãn màu của bảng cho thẻ; có thể tạo nhãn mới ngay tại đây.", by=["tvb"])
d.uc("tr", "Nhập giá trị trường tùy chỉnh", 0, 2, "UC08.17", "Nhập giá trị cho các trường do bảng định nghĩa (văn bản, số, ngày, hộp kiểm, danh sách thả xuống).", by=["tvb"])
d.uc("cl", "Quản lý checklist", 0, 3, "UC08.18", "Thêm/xoá checklist, thêm/sửa/xoá/đánh dấu mục, kéo-thả sắp xếp mục; xem phần trăm hoàn thành.", by=["tvb"])
d.uc("giao_muc", "Giao người và đặt hạn\ncho mục checklist", 1, 2.5, "UC08.19", "Chỉ định người thực hiện và hạn riêng cho từng mục.")
d.ext("giao_muc", "cl")
d.uc("muc_the", "Chuyển mục checklist\nthành thẻ", 1, 3.5, "UC08.20", "Tách một mục checklist thành thẻ mới trong cùng danh sách.")
d.ext("muc_the", "cl")
d.uc("tep", "Quản lý tệp đính kèm", 0, 4, "UC08.21", "Tải tệp lên thẻ, xem trước ảnh, tải về, xoá tệp; quyền tải tệp được kiểm tra theo quyền xem bảng.", by=["tvb"])
d.uc("bia", "Đặt ảnh đính kèm\nlàm ảnh bìa", 1, 4.5, "UC08.22", "Chọn một ảnh đính kèm làm ảnh bìa của thẻ.")
d.ext("bia", "tep")
d.uc("bl", "Bình luận trên thẻ", 0, 5, "UC08.23", "Viết bình luận; thành viên của thẻ và người đang theo dõi thẻ/danh sách/bảng nhận thông báo.", by=["tvb"])
d.uc("mention", "Nhắc tên thành viên\n(@mention)", 1, 5.5, "UC08.24", "Gõ @ để chọn thành viên; người được nhắc nhận thông báo.")
d.ext("mention", "bl")
d.uc("traloi", "Trả lời bình luận", 0, 6, "UC08.25", "Trả lời một bình luận (luồng một cấp); tác giả bình luận gốc nhận thông báo. Xoá bình luận gốc vẫn giữ các trả lời.", by=["tvb"])
d.uc("sua_bl", "Sửa / xoá bình luận\ncủa mình", 0, 7, "UC08.26", "Chỉ tác giả được sửa hoặc xoá bình luận của mình.", by=["tvb"])

# ---------- UC09 Tra cứu và theo dõi công việc ----------
d = diagram("uc09_tra_cuu", "UC09", "Phân rã use case Tra cứu và theo dõi công việc",
            "Biểu đồ use case phân rã: Tra cứu và theo dõi công việc",
            "Các chức năng giúp người dùng nắm được công việc của mình trên mọi bảng mà họ có quyền xem.")
d.actor("nd", "Người dùng", "L", 3.2)
d.uc("nhanh", "Tìm kiếm nhanh", 0, 0, "UC09.1", "Gõ từ khoá trên thanh tiêu đề để tìm bảng và thẻ (phím tắt /).", by=["nd"])
d.uc("nc", "Tìm kiếm nâng cao", 0, 1, "UC09.2", "Lọc thẻ xuyên bảng theo từ khoá, người phụ trách, trạng thái, nhãn, quá hạn, khoảng ngày hết hạn; có phân trang.", by=["nd"])
d.uc("bl", "Quản lý bộ lọc đã lưu", 1, 1, "UC09.3", "Lưu bộ lọc hiện tại, áp dụng lại hoặc xoá bộ lọc đã lưu.")
d.ext("bl", "nc")
d.uc("cuatoi", "Xem công việc của tôi", 0, 2, "UC09.4", "Xem các thẻ được giao cho mình, nhóm theo hạn (quá hạn, hôm nay, trong tuần, sau này, không có hạn).", by=["nd"])
d.uc("lich", "Xem lịch công việc", 0, 3, "UC09.5", "Xem thẻ và mục checklist có hạn theo tháng hoặc tuần.", by=["nd"])
d.uc("keo", "Đổi hạn bằng kéo-thả trên lịch", 1, 3, "UC09.6", "Kéo thẻ sang ngày khác để đổi hạn (cần quyền sửa bảng chứa thẻ).")
d.ext("keo", "lich")
d.uc("dash", "Xem bảng điều khiển cá nhân", 0, 4, "UC09.7", "Xem số bảng, số thẻ được giao, quá hạn, đến hạn trong tuần, mục cần chú ý, truy cập nhanh.", by=["nd"])
d.uc("hd", "Xem nhật ký\nhoạt động của tôi", 0, 5, "UC09.8", "Xem các thao tác mình đã thực hiện, có liên kết tới bảng liên quan.", by=["nd"])

# ---------- UC10 Quản lý thông báo ----------
d = diagram("uc10_thong_bao", "UC10", "Phân rã use case Quản lý thông báo", "Biểu đồ use case phân rã: Quản lý thông báo",
            "Thông báo được tạo khi có sự kiện liên quan tới người dùng (được giao thẻ, được nhắc tên, bình luận, thay đổi "
            "thành viên, yêu cầu tham gia...). Bộ lập lịch của máy chủ chạy định kỳ để gửi nhắc hạn và email tổng hợp.")
d.actor("nd", "Người dùng", "L", 2.2)
d.actor("bll", "Bộ lập lịch", "L", 5.7, kind="system")
d.actor("em", "Dịch vụ email", "R", 5.5, kind="system")
d.uc("xem", "Xem danh sách thông báo", 0, 0, "UC10.1", "Mở chuông thông báo xem danh sách, có thể chỉ hiện thông báo chưa đọc.", by=["nd"])
d.uc("doc", "Đánh dấu thông báo đã đọc", 0, 1, "UC10.2", "Đánh dấu một thông báo hoặc tất cả là đã đọc.", by=["nd"])
d.uc("mo", "Mở nội dung liên quan", 0, 2, "UC10.3", "Bấm vào thông báo để đi tới đúng thẻ, bảng hoặc không gian liên quan.", by=["nd"])
d.uc("rt", "Nhận thông báo thời gian thực", 0, 3, "UC10.4", "Thông báo mới được đẩy ngay qua Socket.IO, số chưa đọc cập nhật tức thì.", by=["nd"])
d.uc("ch", "Cấu hình tuỳ chọn nhận thông báo", 0, 4, "UC10.5", "Bật/tắt từng nhóm thông báo trong ứng dụng, email nhắc hạn và email tổng hợp hằng ngày.", by=["nd"])
d.uc("nhac", "Gửi nhắc hạn công việc", 0, 5.2, "UC10.6", "Đến mốc nhắc trước hạn, hệ thống tạo thông báo và gửi email nhắc (nếu người dùng bật).", by=["bll", "em"])
d.uc("tonghop", "Gửi email tổng hợp\nhằng ngày", 0, 6.2, "UC10.7", "Mỗi 24 giờ gom các thông báo trong ngày gửi thành một email cho người đã bật tuỳ chọn.", by=["bll", "em"])

# ---------- UC11 Sinh bảng tự động bằng AI ----------
d = diagram("uc11_ai_sinh_bang", "UC11", "Phân rã use case Sinh bảng tự động bằng AI",
            "Biểu đồ use case phân rã: Sinh bảng tự động bằng AI",
            "Người dùng mô tả dự án, hệ thống đề xuất kế hoạch gồm các danh sách và thẻ (kèm hạn). Bộ luật luôn chạy; mô hình "
            "ngôn ngữ lớn chỉ được gọi khi đã cấu hình, nếu lỗi thì kế hoạch vẫn được tạo bằng bộ luật.")
d.actor("nd", "Người dùng", "L", 2)
d.actor("gm", "Dịch vụ AI (Gemini)", "R", 3, kind="system")
d.uc("nhap", "Nhập mô tả dự án", 0, 0, "UC11.1", "Nhập văn bản mô tả dự án, chọn không gian làm việc và khoảng thời gian thực hiện.", by=["nd"])
d.uc("tai", "Tải lên tài liệu\nmô tả (DOCX/PDF)", 0, 1, "UC11.2", "Tải tệp DOCX hoặc PDF thay cho việc gõ mô tả; hệ thống dùng thẳng nội dung tệp, người dùng không cần gõ lại.", by=["nd"])
d.uc("trich", "Trích xuất văn bản từ tài liệu", 1, 1, "UC11.3", "Máy chủ đọc phần chữ trong tệp (tối đa 20 000 ký tự) và dùng làm đầu vào cho bước sinh kế hoạch.")
d.inc("tai", "trich")
d.uc("sinh", "Sinh kế hoạch bảng", 0, 2, "UC11.4", "Hệ thống phân tích mô tả và đề xuất danh sách, thẻ, ngày hạn kèm các cảnh báo cần kiểm tra.", by=["nd"])
d.uc("luat", "Phân tích mô tả bằng bộ luật", 1, 2, "UC11.5", "Nhận diện tiêu đề, gạch đầu dòng, ngày tháng, tên thành viên để dựng kế hoạch.")
d.inc("sinh", "luat")
d.uc("llm", "Sinh kế hoạch bằng\nmô hình ngôn ngữ lớn", 1, 3.1, "UC11.6", "Khi đã cấu hình khoá API, gọi Gemini để hiểu mô tả dạng văn xuôi; kết quả được kiểm tra theo lược đồ JSON.", by=["gm"])
d.ext("llm", "sinh")
d.uc("sua", "Xem và chỉnh sửa kế hoạch", 0, 3, "UC11.7", "Sửa tên danh sách, thẻ, ngày; bỏ chọn thẻ không cần; xem các cảnh báo.", by=["nd"])
d.uc("ad", "Áp dụng kế hoạch\nđể tạo bảng", 0, 4, "UC11.8", "Tạo bảng mới gồm các danh sách và thẻ đã chọn; mỗi kế hoạch chỉ áp dụng được một lần.", by=["nd"])

# ---------- UC12 Gợi ý phân công công việc ----------
d = diagram("uc12_phan_cong", "UC12", "Phân rã use case Gợi ý phân công công việc",
            "Biểu đồ use case phân rã: Gợi ý phân công công việc",
            "Hệ thống xếp hạng người phù hợp để nhận thẻ dựa trên bốn thành phần: kinh nghiệm (độ tương đồng nội dung thẻ cũ), "
            "độ tin cậy (tỉ lệ đúng hạn), khả dụng (khối lượng đang làm) và hồ sơ tự khai. Trọng số được học từ lựa chọn thực tế "
            "của người dùng. Gợi ý chỉ là đề xuất, việc giao thẻ luôn do con người quyết định.",
            row_h=72)
d.actor("tvb", "Thành viên bảng", "L", 1.5)
d.actor("nd", "Người dùng", "L", 5.8)
d.actor("tvk", "Thành viên không gian", "L", 7.8)
d.actor("qtk", "Quản trị viên không gian", "L", 9.8)
d.actor("qtb", "Quản trị viên bảng", "R", 4)
d.gen("tvb", "nd")
d.gen("tvk", "nd")
d.gen("qtk", "tvk")
d.uc("goiy", "Xem gợi ý người\nphụ trách cho thẻ", 0, 0, "UC12.1", "Xem danh sách người phù hợp nhất kèm điểm từng thành phần, cảnh báo (quá tải, tạm nghỉ) và bằng chứng.", by=["tvb"])
d.uc("kh", "Lập kế hoạch phân\ncông cho danh sách", 0, 1, "UC12.2", "Chia các thẻ chưa có người nhận của một danh sách cho các thành viên (chỉ xem trước).", by=["tvb"])
d.uc("diem", "Tính điểm và\nxếp hạng ứng viên", 1, 0.5, "UC12.3", "Tính bốn thành phần điểm cho từng ứng viên rồi tổng hợp theo trọng số của không gian.")
d.inc("goiy", "diem")
d.inc("kh", "diem")
d.uc("giao", "Giao thẻ theo gợi ý", 0, 2, "UC12.4", "Chọn một người trong danh sách gợi ý để giao thẻ.", by=["tvb"])
d.uc("ad", "Áp dụng kế hoạch phân công", 0, 3, "UC12.5", "Đổi người hoặc bỏ chọn từng thẻ rồi áp dụng; hệ thống giao các thẻ đã chọn.", by=["tvb"])
d.uc("hoc", "Ghi nhận lựa chọn\nđể học trọng số", 1, 2, "UC12.6", "Lưu người thực sự được chọn; khi đủ số lượt phản hồi, hệ thống điều chỉnh trọng số của không gian.")
d.inc("giao", "hoc")
d.uc("xemcv", "Xem CV của thành viên", 0, 4, "UC12.7", "Chủ hoặc quản trị viên của một bảng có người đó (hoặc của không gian chứa bảng) tải CV để tham khảo khi giao việc; chỉ xem được khi chủ CV bật dùng hồ sơ cho gợi ý.", by=["qtb"])
d.uc("hs", "Khai báo hồ sơ năng lực", 0, 5, "UC12.8", "Tự khai kỹ năng, công việc đã làm; bật/tắt việc dùng hồ sơ cho gợi ý.", by=["nd"])
d.uc("cv", "Tải lên CV", 0, 6, "UC12.9", "Tải CV dạng PDF/DOCX (tối đa 5 MB) để gợi ý dùng thẳng nội dung tệp; có thể thay hoặc xoá CV.", by=["nd"])
d.uc("trich", "Trích xuất văn bản từ CV", 1, 6, "UC12.10", "Máy chủ đọc chữ trong CV (không gọi AI) và lưu lại để so khớp khi gợi ý; muốn đổi nội dung thì thay tệp CV.")
d.inc("cv", "trich")
d.uc("hslv", "Cập nhật hồ sơ làm việc", 0, 7, "UC12.11", "Đặt số thẻ làm song song tối đa (1-30) và thời gian tạm nghỉ của chính mình trong không gian.", by=["tvk"])
d.uc("xtrs", "Xem trọng số phân công", 0, 8, "UC12.12", "Xem trọng số đang dùng, lịch sử thay đổi và số liệu phản hồi.", by=["tvk"])
d.uc("dctrs", "Điều chỉnh\ntrọng số phân công", 0, 9, "UC12.13", "Đặt bốn trọng số (mỗi số trong khoảng 0,05-0,70, tổng bằng 1).", by=["qtk"])
d.uc("reset", "Đặt lại trọng số mặc định", 0, 10, "UC12.14", "Đưa trọng số về mặc định và đặt lại bộ đếm phản hồi.", by=["qtk"])
d.note("Quản trị viên bảng cũng là Thành viên bảng (xem UC06); tác nhân này được đặt bên phải để các đường nối không cắt nhau.")

# ---------- UC13 Hỏi đáp với trợ lý ảo ----------
d = diagram("uc13_tro_ly", "UC13", "Phân rã use case Hỏi đáp với trợ lý ảo", "Biểu đồ use case phân rã: Hỏi đáp với trợ lý ảo",
            "Trợ lý ảo trả lời câu hỏi bằng tiếng Việt về tình hình công việc (thẻ quá hạn, tiến độ, khối lượng của thành viên, "
            "danh mục bảng/không gian, lịch sử thay đổi...). Đây là chức năng tiện ích của sản phẩm, không thuộc hai cơ chế "
            "nghiên cứu của khóa luận. Câu trả lời chỉ dùng dữ liệu trong phạm vi người dùng có quyền xem.")
d.actor("nd", "Người dùng", "L", 1.5)
d.actor("gm", "Dịch vụ AI (Gemini)", "R", 0.6, kind="system")
d.uc("pv", "Xác định phạm vi hỏi đáp", 0, 0, "UC13.1", "Phạm vi mặc định theo trang đang mở (công việc của tôi, một không gian hoặc một bảng); có thể nêu rõ tên bảng hay không gian ngay trong câu hỏi.", by=["nd"])
d.uc("hoi", "Đặt câu hỏi về công việc", 0, 1, "UC13.2", "Gõ câu hỏi bằng ngôn ngữ tự nhiên; có thể hỏi tiếp dựa trên ngữ cảnh câu trước.", by=["nd"])
d.uc("hieu", "Hiểu câu hỏi và\nlập kế hoạch truy vấn", 1, 0.6, "UC13.3", "Mô hình ngôn ngữ xác định ý định, khoảng thời gian, đối tượng được hỏi và chọn công cụ truy vấn phù hợp.", by=["gm"])
d.inc("hoi", "hieu")
d.uc("truyvan", "Truy vấn dữ liệu\ntrong phạm vi", 1, 1.9, "UC13.4", "Các công cụ truy vấn do máy chủ thực thi đếm, liệt kê, thống kê thẻ và nhật ký; quyền được kiểm tra lại ở mỗi lượt.")
d.inc("hoi", "truyvan")
d.uc("chon", "Trả lời câu hỏi làm rõ", 0, 2, "UC13.5", "Khi câu hỏi mơ hồ (trùng tên người, chưa rõ không gian), người dùng chọn một phương án.", by=["nd"])
d.inc("chon", "truyvan")
d.uc("them", "Xem thêm kết quả", 0, 3, "UC13.6", "Xem trang tiếp theo của danh sách kết quả.", by=["nd"])
d.inc("them", "truyvan")


def main():
    os.makedirs(os.path.join(HERE, "svg"), exist_ok=True)
    os.makedirs(os.path.join(HERE, "drawio"), exist_ok=True)
    codes = set()
    for dg in DIAGRAMS:
        dg.layout()
        for u in dg.ucs.values():
            if not u.code:
                raise SystemExit(f"{dg.key}: use case {u.id} thiếu mã")
            if (dg.key, u.code) in codes:
                raise SystemExit(f"{dg.key}: trùng mã {u.code}")
            codes.add((dg.key, u.code))
        for kind, s, t in dg.edges:
            for nid in (s, t):
                if nid not in dg.ucs and nid not in dg.actors:
                    raise SystemExit(f"{dg.key}: quan hệ {kind} trỏ tới phần tử không tồn tại: {nid}")
        with open(os.path.join(HERE, "svg", dg.key + ".svg"), "w", encoding="utf-8") as f:
            f.write(to_svg(dg))
        with open(os.path.join(HERE, "drawio", dg.key + ".drawio"), "w", encoding="utf-8") as f:
            f.write(to_drawio(dg))
        print(f"{dg.key}: {dg.W}x{dg.H}, {len(dg.ucs)} use case, {len(dg.actors)} tác nhân")
    specs = [to_spec(dg) for dg in DIAGRAMS]
    with open(os.path.join(HERE, "spec.json"), "w", encoding="utf-8") as f:
        json.dump(specs, f, ensure_ascii=False, indent=1)
    with open(os.path.join(HERE, "USE_CASE.md"), "w", encoding="utf-8") as f:
        f.write(to_markdown(specs))


# ============================ TÀI LIỆU MÔ TẢ (MARKDOWN) ============================

# (tên, loại, mô tả, ánh xạ trong mã nguồn)
ACTORS = [
    ("Khách", "Chính", "Người truy cập chưa đăng nhập.", "Không có JWT hợp lệ"),
    ("Người dùng", "Chính", "Người đã đăng nhập; mọi tác nhân bên dưới đều là Người dùng.", "User đã xác thực (requireAuth)"),
    ("Thành viên không gian", "Chính", "Người thuộc một không gian làm việc.", "WorkspaceRole.MEMBER trở lên"),
    ("Quản trị viên không gian", "Chính", "Quản lý thành viên, tên và trọng số phân công của không gian.", "WorkspaceRole.ADMIN, OWNER (assertWorkspaceManage)"),
    ("Chủ sở hữu không gian", "Chính", "Người tạo hoặc được chuyển quyền sở hữu không gian.", "WorkspaceRole.OWNER"),
    ("Người xem bảng", "Chính", "Thành viên bảng chỉ có quyền xem.", "BoardRole.VIEWER (assertBoardView)"),
    ("Thành viên bảng", "Chính", "Được thêm/sửa danh sách, thẻ và cấu hình bảng.",
     "BoardRole.MEMBER trở lên, hoặc thành viên không gian khi bảng ở chế độ Không gian làm việc (assertBoardAccess)"),
    ("Quản trị viên bảng", "Chính", "Quản lý thành viên, lời mời, yêu cầu tham gia, chế độ hiển thị.",
     "BoardRole.ADMIN/OWNER, hoặc OWNER/ADMIN của không gian chứa bảng (canManageBoard)"),
    ("Chủ sở hữu bảng", "Chính", "Người tạo hoặc được chuyển quyền sở hữu bảng.", "Board.ownerId (assertBoardOwner)"),
    ("Google", "Phụ (hệ thống ngoài)", "Xác thực người dùng khi đăng nhập bằng Google.", "Google Identity, google-auth-library"),
    ("Dịch vụ email", "Phụ (hệ thống ngoài)", "Gửi email xác minh, đặt lại mật khẩu, lời mời, nhắc hạn, tổng hợp.", "Máy chủ SMTP qua Nodemailer (Ethereal khi chạy thử)"),
    ("Unsplash", "Phụ (hệ thống ngoài)", "Cung cấp ảnh nền cho bảng.", "Unsplash API (modules/unsplash)"),
    ("Dịch vụ AI (Gemini)", "Phụ (hệ thống ngoài)", "Mô hình ngôn ngữ lớn dùng cho sinh bảng và trợ lý ảo; không bắt buộc.", "modules/ai/ai.llm.ts, modules/chat/chat.llm.ts"),
    ("Bộ lập lịch", "Phụ (tiến trình hệ thống)", "Tiến trình chạy định kỳ trong máy chủ.",
     "reminder.scheduler.ts, recurringSchedule.scheduler.ts, digest.scheduler.ts"),
]


def _md_cell(text):
    return text.replace("|", "\\|")


def to_markdown(specs):
    out = []
    w = out.append
    w("# Biểu đồ use case - TaskFlow\n")
    w("> Bản nháp cho mục **Thiết kế hệ thống** của báo cáo. Tệp này được SINH TỰ ĐỘNG bởi `ve_use_case.py`; muốn sửa "
      "thì sửa phần nội dung trong script rồi chạy lại `python ve_use_case.py` và `node chup_png.js`. Hình để chèn vào Word "
      "nằm ở `png/` (độ phân giải gấp đôi); bản sửa tay được nằm ở `drawio/` (mở bằng draw.io). Số hình/bảng ở đây "
      "đánh tạm, cần đánh lại theo chương của báo cáo.\n")
    w("## 1. Tác nhân của hệ thống\n")
    w("Hệ thống không có vai trò quản trị viên toàn hệ thống: quyền quản trị gắn với từng không gian làm việc và từng bảng. "
      "Vì vậy các tác nhân chính được xác định theo vai trò của người dùng trong không gian hoặc bảng đang thao tác.\n")
    w("| STT | Tác nhân | Loại | Mô tả | Ánh xạ trong mã nguồn |")
    w("|---|---|---|---|---|")
    for i, (n, k, desc, code) in enumerate(ACTORS, 1):
        w(f"| {i} | {n} | {k} | {_md_cell(desc)} | {_md_cell(code)} |")
    w("")
    w("Quan hệ tổng quát hoá giữa các tác nhân chính:\n")
    w("- Thành viên không gian → Người dùng; Quản trị viên không gian → Thành viên không gian; Chủ sở hữu không gian → Quản trị viên không gian.")
    w("- Người xem bảng → Người dùng; Thành viên bảng → Người xem bảng; Quản trị viên bảng → Thành viên bảng; Chủ sở hữu bảng → Quản trị viên bảng.")
    w("- Tác nhân con kế thừa toàn bộ use case của tác nhân cha.\n")
    w("## 2. Quy ước ký hiệu\n")
    w("- **Đường liền** giữa tác nhân và use case: tác nhân tham gia use case.")
    w("- **Mũi tên nét đứt «include»** (từ use case cơ sở tới use case được bao hàm): use case cơ sở *luôn* thực hiện use case được bao hàm.")
    w("- **Mũi tên nét đứt «extend»** (từ use case mở rộng tới use case cơ sở): use case mở rộng *chỉ* xảy ra khi thoả điều kiện.")
    w("- **Mũi tên tam giác rỗng** giữa hai tác nhân: quan hệ tổng quát hoá (tác nhân con kế thừa tác nhân cha).")
    w("- **Hộp «hệ thống ngoài»**: tác nhân phụ là hệ thống bên ngoài hoặc tiến trình tự động.\n")

    fig = 0
    for i, sp in enumerate(specs):
        fig += 1
        if i == 0:
            w("## 3. Biểu đồ use case tổng quát\n")
        else:
            if i == 1:
                w("## 4. Biểu đồ use case phân rã\n")
            w(f"### 4.{i}. {sp['code']} - {sp['title'].replace('Phân rã use case ', '')}\n")
        w(sp["intro"] + "\n")
        w(f"![{sp['caption']}]({sp['png']})\n")
        w(f"*Hình {fig}. {sp['caption']}*\n")
        w(f"*Bảng {fig}. Danh sách use case - {sp['caption'].split(': ', 1)[-1] if i else 'tổng quát'}*\n")
        w("| Mã | Use case | Tác nhân / quan hệ | Mô tả |")
        w("|---|---|---|---|")
        for u in sp["useCases"]:
            who = ", ".join(u["actors"])
            if u["relation"]:
                who = (who + "; " if who else "") + u["relation"]
            w(f"| {u['code']} | {_md_cell(u['name'])} | {_md_cell(who)} | {_md_cell(u['desc'])} |")
        w("")
        for n in sp["notes"]:
            w(f"> {n}\n")
    return "\n".join(out)


if __name__ == "__main__":
    main()
