# -*- coding: utf-8 -*-
"""
Vẽ các biểu đồ cho Chương 3 (ngoài use case): biểu đồ hoạt động, biểu đồ trình tự, sơ đồ kiến trúc, sơ đồ thực thể - liên kết.

Chạy (từ thư mục này):   python ve_bieu_do.py      -> svg/*.svg và png/*.png (PNG chụp bằng Chrome headless, tỉ lệ 2x)
Cần: Python 3 + Pillow (đo chữ Arial), Chrome hoặc Edge (đặt CHROME_PATH nếu nằm chỗ khác).
Nội dung từng biểu đồ nằm ở phần "NỘI DUNG" cuối tệp; bám theo mã nguồn backend/src (đường dẫn ghi ở chú thích từng biểu đồ).
"""
import math
import os
import subprocess
from xml.sax.saxutils import escape

from PIL import ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_FAMILY = "Arial, Helvetica, sans-serif"
FS = 13
LH = 16
F = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", FS)
FB = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", FS)
FS_S = 11
F_S = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", FS_S)
F12 = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 12)
INK = "#222222"
FILL = "#F2F7FC"
STROKE = "#1F4E79"
HEAD = "#DCE8F5"


def tw(s, font=F):
    return font.getlength(s)


def wrap(text, max_w, font=F):
    out = []
    for para in text.split("\n"):
        cur = ""
        for w in para.split(" "):
            t = (cur + " " + w).strip()
            if not cur or tw(t, font) <= max_w:
                cur = t
            else:
                out.append(cur)
                cur = w
        out.append(cur)
    return out


class Svg:
    def __init__(self):
        self.parts = []

    def add(self, s):
        self.parts.append(s)

    def rect(self, x, y, w, h, fill="#FFFFFF", stroke=INK, sw=1.2, rx=0, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" '
                 f'stroke="{stroke}" stroke-width="{sw}"{d}/>')

    def line(self, x1, y1, x2, y2, sw=1.2, dash=None, color=INK):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" stroke-width="{sw}"{d}/>')

    def poly(self, pts, sw=1.2, dash=None, fill="none", color=INK, close=False):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        tag = "polygon" if close else "polyline"
        p = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        self.add(f'<{tag} points="{p}" fill="{fill}" stroke="{color}" stroke-width="{sw}"{d}/>')

    def text(self, x, y, s, size=FS, weight="normal", anchor="middle", italic=False, color=INK):
        st = ' font-style="italic"' if italic else ""
        self.add(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" '
                 f'dominant-baseline="central" fill="{color}"{st}>{escape(s)}</text>')

    def lines(self, x, yc, lines, size=FS, weight="normal", anchor="middle", italic=False, lh=LH):
        y0 = yc - (len(lines) - 1) * lh / 2
        for i, l in enumerate(lines):
            self.text(x, y0 + i * lh, l, size, weight, anchor, italic)

    def label_box(self, x, y, lines, size=FS_S, anchor="middle", lh=14):
        font = F_S if size == FS_S else F
        w = max(tw(l, font) for l in lines) + 6
        h = len(lines) * lh + 2
        x0 = x - w / 2 if anchor == "middle" else (x - 3 if anchor == "start" else x - w + 3)
        self.rect(x0, y - h / 2, w, h, fill="#FFFFFF", stroke="none", sw=0)
        self.lines(x, y, lines, size=size, anchor=anchor, lh=lh)

    def arrow(self, x, y, ang, kind="open", size=10):
        a1, a2 = ang + math.radians(155), ang - math.radians(155)
        p1 = (x + size * math.cos(a1), y + size * math.sin(a1))
        p2 = (x + size * math.cos(a2), y + size * math.sin(a2))
        if kind == "open":
            self.poly([p1, (x, y), p2])
        elif kind == "filled":
            self.poly([p1, (x, y), p2], fill=INK, close=True)
        else:  # hollow
            self.poly([p1, (x, y), p2], fill="#FFFFFF", close=True)

    def render(self, w, h):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
                f'font-family="{FONT_FAMILY}"><rect width="{w}" height="{h}" fill="#FFFFFF"/>' + "".join(self.parts) + "</svg>")


# =============================== BIỂU ĐỒ HOẠT ĐỘNG ===============================

class Activity:
    """Biểu đồ hoạt động có làn (swimlane). Nút đặt theo (làn, hàng, dx); đường nối gấp khúc vuông góc."""

    def __init__(self, key, lanes, lane_w, row_h=60, header_h=34):
        self.key, self.lanes, self.lane_w, self.row_h, self.header_h = key, lanes, lane_w, row_h, header_h
        self.nodes, self.edges = {}, []

    # ---- toạ độ ----
    def X(self, lane, dx=0):
        return 10 + sum(self.lane_w[:lane]) + self.lane_w[lane] / 2 + dx

    def Y(self, row):
        return 10 + self.header_h + 34 + row * self.row_h

    # ---- nút ----
    def _node(self, nid, kind, lane, row, dx=0, text="", w=None):
        n = {"kind": kind, "lane": lane, "row": row, "dx": dx, "text": text}
        if kind == "action":
            maxw = w or min(self.lane_w[lane] - 36, 230)
            n["lines"] = wrap(text, maxw)
            n["w"] = max(tw(l) for l in n["lines"]) + 26
            n["h"] = len(n["lines"]) * LH + 16
        elif kind == "decision":
            # chữ nằm gọn trong hình thoi: (a/w) + (b/h) <= 1 với a, b là bề rộng / cao khối chữ
            n["lines"] = wrap(text, w or 120, F12) if text else []
            if text:
                a_ = max(tw(l, F12) for l in n["lines"])
                b_ = len(n["lines"]) * 15
                n["h"] = b_ + 34
                n["w"] = a_ / (1 - b_ / n["h"]) + 12
            else:
                n["w"] = n["h"] = 34
        elif kind in ("start", "end"):
            n["w"] = n["h"] = 24 if kind == "start" else 28
        elif kind == "bar":
            n["w"], n["h"] = (w or 180), 6
        n["x"], n["y"] = self.X(lane, dx), self.Y(row)
        self.nodes[nid] = n

    def start(self, nid, lane, row, dx=0):
        self._node(nid, "start", lane, row, dx)

    def end(self, nid, lane, row, dx=0):
        self._node(nid, "end", lane, row, dx)

    def action(self, nid, text, lane, row, dx=0, w=None):
        self._node(nid, "action", lane, row, dx, text, w)

    def decision(self, nid, lane, row, text="", dx=0, w=None):
        self._node(nid, "decision", lane, row, dx, text, w)

    def bar(self, nid, lane, row, dx=0, w=None):
        self._node(nid, "bar", lane, row, dx, "", w)

    def flow(self, a, b, exit="bottom", enter="top", guard=None, via=(), gpos=None):
        self.edges.append({"a": a, "b": b, "exit": exit, "enter": enter, "guard": guard, "via": list(via), "gpos": gpos})

    def port(self, nid, side):
        n = self.nodes[nid]
        x, y, w, h = n["x"], n["y"], n["w"], n["h"]
        return {"top": (x, y - h / 2), "bottom": (x, y + h / 2), "left": (x - w / 2, y), "right": (x + w / 2, y)}[side]

    @staticmethod
    def _axis(side):
        return "v" if side in ("top", "bottom") else "h"

    @staticmethod
    def _connect(a, da, b, db):
        if abs(a[0] - b[0]) < 0.5 or abs(a[1] - b[1]) < 0.5:
            return [b], ("v" if abs(a[0] - b[0]) < 0.5 else "h")
        if db is None or db != da:
            c = (a[0], b[1]) if da == "v" else (b[0], a[1])
            return [c, b], ("h" if da == "v" else "v")
        if da == "v":
            ym = b[1] - 16 if b[1] > a[1] else (a[1] + b[1]) / 2
            return [(a[0], ym), (b[0], ym), b], "v"
        xm = (a[0] + b[0]) / 2
        return [(xm, a[1]), (xm, b[1]), b], "h"

    def route(self, e):
        p1, p2 = self.port(e["a"], e["exit"]), self.port(e["b"], e["enter"])
        pts, d = [p1], self._axis(e["exit"])
        for v in e["via"]:
            seg, d = self._connect(pts[-1], d, v, None)
            pts += seg
        seg, _ = self._connect(pts[-1], d, p2, self._axis(e["enter"]))
        pts += seg
        return pts

    def size(self):
        W = 20 + sum(self.lane_w)
        H = max(n["y"] + n["h"] / 2 for n in self.nodes.values()) + 34
        return int(W), int(H)

    def svg(self):
        W, H = self.size()
        s = Svg()
        x0, y0 = 10, 10
        s.rect(x0, y0, W - 20, H - 20, fill="#FFFFFF", stroke=INK, sw=1.4)
        s.rect(x0, y0, W - 20, self.header_h, fill=HEAD, stroke=INK, sw=1.4)
        x = x0
        for i, (name, w) in enumerate(zip(self.lanes, self.lane_w)):
            s.text(x + w / 2, y0 + self.header_h / 2, name, weight="bold")
            if i > 0:
                s.line(x, y0, x, H - 10, sw=1.4)
            x += w
        for e in self.edges:
            pts = self.route(e)
            s.poly(pts)
            (xa, ya), (xb, yb) = pts[-2], pts[-1]
            s.arrow(xb, yb, math.atan2(yb - ya, xb - xa), "open", 9)
            if e["guard"]:
                (sx, sy), (nx, ny) = pts[0], pts[1]
                if e["gpos"]:
                    gx, gy, anc = e["gpos"]
                elif abs(sx - nx) < 0.5:  # đoạn đầu đi dọc
                    gx, gy, anc = sx + 6, sy + 13, "start"
                else:
                    gx, gy, anc = (sx + (14 if nx > sx else -14)), sy - 10, ("start" if nx > sx else "end")
                s.label_box(gx, gy, [e["guard"]], anchor=anc)
        for nid, n in self.nodes.items():
            x, y, w, h = n["x"], n["y"], n["w"], n["h"]
            k = n["kind"]
            if k == "start":
                s.add(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="11" fill="{INK}"/>')
            elif k == "end":
                s.add(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="13" fill="#FFFFFF" stroke="{INK}" stroke-width="1.5"/>')
                s.add(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="8" fill="{INK}"/>')
            elif k == "action":
                s.rect(x - w / 2, y - h / 2, w, h, fill=FILL, stroke=STROKE, sw=1.4, rx=12)
                s.lines(x, y, n["lines"])
            elif k == "decision":
                s.poly([(x, y - h / 2), (x + w / 2, y), (x, y + h / 2), (x - w / 2, y)], fill="#FFF8E5", color=INK, sw=1.3, close=True)
                if n["lines"]:
                    s.lines(x, y, n["lines"], size=12, lh=15)
            elif k == "bar":
                s.rect(x - w / 2, y - h / 2, w, h, fill=INK, stroke=INK)
        return s.render(W, H)


# =============================== BIỂU ĐỒ TRÌNH TỰ ===============================

class Sequence:
    """Biểu đồ trình tự: thông điệp đồng bộ (mũi tên đặc), trả về (nét đứt), bất đồng bộ (mũi tên mở), tự gọi;
    khung alt / opt / loop; thanh kích hoạt tính tự động (mở khi nhận thông điệp đồng bộ, đóng khi trả về)."""

    def __init__(self, key, label_w=135, self_w=110):
        self.key, self.label_w, self.self_w = key, label_w, self_w
        self.parts, self.events = [], []

    def p(self, pid, name, kind="box"):
        lines = name.split("\n")
        if kind == "actor":
            w, h = max(max(tw(l) for l in lines) + 10, 60), 62 + len(lines) * LH
        else:
            w, h = max(max(tw(l, FB) for l in lines) + 20, 84), len(lines) * LH + 22 + (10 if kind == "db" else 0)
        self.parts.append({"id": pid, "lines": lines, "kind": kind, "w": w, "h": h})

    def msg(self, a, b, text, kind="sync"):
        self.events.append(("msg", a, b, text, kind))

    def ret(self, a, b, text):
        self.events.append(("msg", a, b, text, "ret"))

    def async_(self, a, b, text):
        self.events.append(("msg", a, b, text, "async"))

    def self_(self, a, text):
        self.events.append(("self", a, text))

    def frag(self, op, guard, parts=None):
        self.events.append(("frag", op, guard, parts))

    def els(self, guard):
        self.events.append(("else", guard))

    def end(self):
        self.events.append(("end",))

    def _idx(self, pid):
        return next(i for i, p in enumerate(self.parts) if p["id"] == pid)

    def layout(self):
        n = len(self.parts)
        gaps = [18.0] * max(n - 1, 1)
        cons = []
        num = 0
        for ev in self.events:
            if ev[0] == "msg":
                num += 1
                i, j = sorted((self._idx(ev[1]), self._idx(ev[2])))
                lines = wrap(f"{num}: {ev[3]}", self.label_w, F12)
                cons.append((i, j, max(tw(l, F12) for l in lines) + 26))
            elif ev[0] == "self":
                num += 1
                i = self._idx(ev[1])
                lines = wrap(f"{num}: {ev[2]}", self.self_w, F12)
                if i < n - 1:
                    cons.append((i, i + 1, max(tw(l, F12) for l in lines) + 52))

        # Khung alt/opt/loop phủ cột đầu tiên nhô ra trái 54px: chừa đủ lề để khung không bị cắt
        first = self.parts[0]["id"]
        x0 = 20 + self.parts[0]["w"] / 2
        if any(ev[0] == "frag" and (not ev[3] or ev[3][0] == first) for ev in self.events):
            x0 = max(x0, 64)

        def centers():
            xs, x = [], x0
            for k in range(n):
                xs.append(x)
                if k < n - 1:
                    x += self.parts[k]["w"] / 2 + gaps[k] + self.parts[k + 1]["w"] / 2
            return xs

        # Ràng buộc hẹp (ít khe) xử lý trước; tính lại toạ độ sau MỖI lần giãn để không cộng dồn thừa.
        cons.sort(key=lambda c: (c[1] - c[0], -c[2]))
        for _ in range(3):
            for i, j, need in cons:
                xs = centers()
                have = xs[j] - xs[i]
                if have < need - 0.5:
                    add = (need - have) / (j - i)
                    for k in range(i, j):
                        gaps[k] += add
        self.xs = centers()
        self.head_h = max(p["h"] for p in self.parts)

    def svg(self):
        self.layout()
        s = Svg()
        xs, n = self.xs, len(self.parts)
        top = 14
        y = top + self.head_h + 26
        last_self_x = self.xs[-1] + self.parts[-1]["w"] / 2
        acts = {p["id"]: [] for p in self.parts}  # ngăn xếp y bắt đầu
        segs = []  # (pid, depth, y1, y2)
        frag_stack = []
        draw_later = []
        num = 0

        def open_act(pid, yy):
            acts[pid].append(yy)

        def close_act(pid, yy):
            if acts[pid]:
                y1 = acts[pid].pop()
                segs.append((pid, len(acts[pid]), y1, yy))

        def ax(pid, toward_right):
            i = self._idx(pid)
            d = len(acts[pid])
            if d == 0:
                return xs[i]
            off = 5 + (d - 1) * 5
            return xs[i] + (off if toward_right else -5 + (d - 1) * 5)

        for ev in self.events:
            if ev[0] == "msg":
                num += 1
                _, a, b, text, kind = ev
                ia, ib = self._idx(a), self._idx(b)
                lines = wrap(f"{num}: {text}", self.label_w, F12)
                y += (len(lines) - 1) * 14 + 22
                right = ib > ia
                if kind == "sync" and self.parts[ia]["kind"] != "actor" and not acts[a]:
                    open_act(a, y - 4)
                x1 = ax(a, right)
                if kind == "sync" and self.parts[ib]["kind"] != "actor":
                    open_act(b, y)
                if kind == "ret":
                    close_act(a, y)
                    x1 = xs[ia] + (5 if right else -5) if acts[a] else xs[ia]
                x2 = ax(b, not right)
                if kind == "ret" and self.parts[ib]["kind"] == "actor":
                    x2 = xs[ib]
                draw_later.append(("arrow", x1, x2, y, kind, lines))
                y += 10
            elif ev[0] == "self":
                num += 1
                _, a, text = ev
                ia = self._idx(a)
                lines = wrap(f"{num}: {text}", self.self_w, F12)
                y += 16
                temp = not acts[a] and self.parts[ia]["kind"] != "actor"
                if temp:  # tự gọi khi đang rảnh: kích hoạt tạm, đóng ngay sau lời gọi
                    open_act(a, y - 6)
                x1 = ax(a, True)
                open_act(a, y + 14)
                draw_later.append(("self", x1, y, lines))
                yy = y + 14 + max(len(lines) * 14, 14) + 6
                close_act(a, yy)
                if temp:
                    close_act(a, yy + 4)
                last_self_x = max(last_self_x, x1 + 44 + max(tw(l, F12) for l in lines))
                y = yy + 4
            elif ev[0] == "frag":
                _, op, guard, parts = ev
                y += 12
                frag_stack.append({"op": op, "guard": guard, "parts": parts, "y0": y, "elses": [],
                                   "snap": {k: len(v) for k, v in acts.items()}, "nums": num, "depth": len(frag_stack)})
                y += 20
            elif ev[0] == "else":
                f = frag_stack[-1]
                y += 10
                f["elses"].append((y, ev[1]))
                for pid, depth in f["snap"].items():
                    while len(acts[pid]) < depth:
                        open_act(pid, y)
                y += 16
            elif ev[0] == "end":
                f = frag_stack.pop()
                y += 12
                draw_later.append(("frag", f, y))
                y += 4
        y_end = y + 24
        for pid, st in acts.items():
            while st:
                close_act(pid, y_end - 10)
        W = int(max(xs[-1] + self.parts[-1]["w"] / 2, last_self_x) + 24)
        H = int(y_end + 10)

        # khung (vẽ trước để nằm dưới); nhãn điều kiện của khung vẽ SAU đường đời để không bị đè
        guards = []
        for item in draw_later:
            if item[0] != "frag":
                continue
            f, yb = item[1], item[2]
            if f["parts"]:
                i0, i1 = self._idx(f["parts"][0]), self._idx(f["parts"][1])
            else:
                i0, i1 = 0, n - 1
            inset = f["depth"] * 8
            fx0 = xs[i0] - 54 + inset
            fx1 = xs[i1] + 54 - inset
            if i1 == n - 1:
                fx1 = max(fx1, W - 14 - inset)
            s.rect(fx0, f["y0"], fx1 - fx0, yb - f["y0"], fill="none", stroke="#555555", sw=1.1)
            lw = tw(f["op"], FB) + 14
            s.poly([(fx0, f["y0"]), (fx0 + lw, f["y0"]), (fx0 + lw, f["y0"] + 12), (fx0 + lw - 8, f["y0"] + 20), (fx0, f["y0"] + 20)],
                   fill="#EEEEEE", color="#555555", sw=1.1, close=True)
            s.text(fx0 + 6, f["y0"] + 10, f["op"], weight="bold", anchor="start")
            guards.append((fx0 + lw + 8, f["y0"] + 10, f["guard"]))
            for (ye, g) in f["elses"]:
                s.line(fx0, ye, fx1, ye, sw=1.1, dash="6 4", color="#555555")
                guards.append((fx0 + 8, ye + 10, g))

        # đầu cột + đường đời
        for i, p in enumerate(self.parts):
            x = xs[i]
            if p["kind"] == "actor":
                cy = top + 22
                s.add(f'<circle cx="{x:.1f}" cy="{cy - 8:.1f}" r="8" fill="#FFFFFF" stroke="#000" stroke-width="1.5"/>')
                s.line(x, cy, x, cy + 20, sw=1.5, color="#000")
                s.line(x - 14, cy + 7, x + 14, cy + 7, sw=1.5, color="#000")
                s.line(x, cy + 20, x - 11, cy + 36, sw=1.5, color="#000")
                s.line(x, cy + 20, x + 11, cy + 36, sw=1.5, color="#000")
                s.lines(x, cy + 46 + (len(p["lines"]) - 1) * LH / 2, p["lines"])
                yl = top + self.head_h
            else:
                bx, by = x - p["w"] / 2, top + self.head_h - p["h"]
                if p["kind"] == "db":
                    s.add(f'<path d="M{bx:.1f},{by + 8:.1f} v{p["h"] - 16:.1f} a{p["w"] / 2:.1f},8 0 0 0 {p["w"]:.1f},0 '
                          f'v{-(p["h"] - 16):.1f}" fill="{FILL}" stroke="{STROKE}" stroke-width="1.4"/>')
                    s.add(f'<ellipse cx="{x:.1f}" cy="{by + 8:.1f}" rx="{p["w"] / 2:.1f}" ry="8" fill="{FILL}" stroke="{STROKE}" stroke-width="1.4"/>')
                    s.lines(x, by + p["h"] / 2 + 4, p["lines"], weight="bold")
                else:
                    s.rect(bx, by, p["w"], p["h"], fill=FILL, stroke=STROKE, sw=1.4)
                    s.lines(x, by + p["h"] / 2, p["lines"], weight="bold")
                yl = top + self.head_h
            s.line(x, yl + 2, x, H - 12, sw=1, dash="5 4", color="#777777")
        # thanh kích hoạt
        for pid, depth, y1, y2 in segs:
            x = xs[self._idx(pid)] - 5 + depth * 5
            s.rect(x, y1, 10, max(y2 - y1, 8), fill="#FFFFFF", stroke=INK, sw=1.1)
        for gx, gy, g in guards:
            s.rect(gx - 3, gy - 8, tw(g, F12) + 6, 16, fill="#FFFFFF", stroke="none", sw=0)
            s.text(gx, gy, g, size=12, anchor="start", italic=True)
        # thông điệp
        for item in draw_later:
            if item[0] == "arrow":
                _, x1, x2, yy, kind, lines = item
                s.line(x1, yy, x2, yy, sw=1.2, dash="6 4" if kind == "ret" else None)
                ang = 0 if x2 > x1 else math.pi
                s.arrow(x2, yy, ang, "filled" if kind == "sync" else "open", 9)
                xm = (x1 + x2) / 2
                s.lines(xm, yy - 9 - (len(lines) - 1) * 14 / 2, lines, size=12, lh=14)
            elif item[0] == "self":
                _, x1, yy, lines = item
                x2 = x1 + 34
                s.poly([(x1, yy), (x2, yy), (x2, yy + 18), (x1 + 6, yy + 18)])
                s.arrow(x1 + 6, yy + 18, math.pi, "filled", 8)
                s.lines(x2 + 6, yy + 8 + (len(lines) - 1) * 14 / 2, lines, size=12, anchor="start", lh=14)
        return s.render(W, H)


# =============================== SƠ ĐỒ KHỐI (kiến trúc, ERD) ===============================

class Board2D:
    """Bản vẽ tự do: hộp, hộp có danh sách thuộc tính (thực thể), đường nối gấp khúc có nhãn."""

    def __init__(self, key, W, H):
        self.key, self.W, self.H = key, W, H
        self.s = Svg()
        self.boxes = {}

    def group(self, x, y, w, h, title, fill="#FAFAFA", dash=None):
        self.s.rect(x, y, w, h, fill=fill, stroke="#666666", sw=1.2, rx=8, dash=dash)
        self.s.text(x + 12, y + 16, title, weight="bold", anchor="start")

    def box(self, bid, x, y, w, h, title, items=(), fill=FILL, stroke=STROKE, bold=True, size=FS):
        self.s.rect(x, y, w, h, fill=fill, stroke=stroke, sw=1.3, rx=6)
        tl = wrap(title, w - 16, FB if bold else F)
        if items:
            self.s.lines(x + w / 2, y + 14 + (len(tl) - 1) * LH / 2, tl, weight="bold" if bold else "normal")
            yy = y + 16 + len(tl) * LH + 4
            for it in items:
                for l in wrap(it, w - 26, F_S):
                    self.s.text(x + 14, yy, l, size=FS_S, anchor="start")
                    yy += 14
        else:
            self.s.lines(x + w / 2, y + h / 2, tl, weight="bold" if bold else "normal")
        self.boxes[bid] = (x, y, w, h)

    def entity(self, bid, x, y, title, attrs, w=200, ref=False):
        h = 26 + len(attrs) * 17 + 6
        self.s.rect(x, y, w, h, fill="#FFFFFF", stroke=STROKE, sw=1.3)
        self.s.rect(x, y, w, 26, fill=("#E7E7E7" if ref else HEAD), stroke=STROKE, sw=1.3)
        self.s.text(x + w / 2, y + 13, title, weight="bold")
        yy = y + 26 + 12
        for a in attrs:
            key = ""
            if a.startswith("PK,FK "):
                key, a = "PK,FK", a[6:]
            elif a.startswith("PK "):
                key, a = "PK", a[3:]
            elif a.startswith("FK "):
                key, a = "FK", a[3:]
            if key:
                self.s.text(x + 8, yy, key, size=10, weight="bold", anchor="start", color="#1F4E79")
            self.s.text(x + 46, yy, a, size=12, anchor="start", weight="bold" if key.startswith("PK") else "normal")
            yy += 17
        self.boxes[bid] = (x, y, w, h)

    def side(self, bid, s, t=0.5):
        x, y, w, h = self.boxes[bid]
        return {"top": (x + w * t, y), "bottom": (x + w * t, y + h), "left": (x, y + h * t), "right": (x + w, y + h * t)}[s]

    def link(self, a, sa, b, sb, ta=0.5, tb=0.5, via=(), label=None, lpos=None, arrow="open", dash=None, both=False,
             card=None):
        p1, p2 = self.side(a, sa, ta), self.side(b, sb, tb)
        pts = [p1]
        d = "v" if sa in ("top", "bottom") else "h"
        for v in list(via) + [p2]:
            last = pts[-1]
            if abs(last[0] - v[0]) > 0.5 and abs(last[1] - v[1]) > 0.5:
                corner = (last[0], v[1]) if d == "v" else (v[0], last[1])
                pts.append(corner)
                d = "h" if d == "v" else "v"
            pts.append(v)
            if abs(pts[-2][0] - v[0]) < 0.5:
                d = "v"
            elif abs(pts[-2][1] - v[1]) < 0.5:
                d = "h"
        self.s.poly(pts, dash=dash, sw=1.3)
        if arrow:
            (xa, ya), (xb, yb) = pts[-2], pts[-1]
            self.s.arrow(xb, yb, math.atan2(yb - ya, xb - xa), arrow, 10)
            if both:
                (xa, ya), (xb, yb) = pts[1], pts[0]
                self.s.arrow(xb, yb, math.atan2(yb - ya, xb - xa), arrow, 10)
        if label:
            lx, ly = lpos if lpos else ((pts[0][0] + pts[-1][0]) / 2, (pts[0][1] + pts[-1][1]) / 2)
            self.s.label_box(lx, ly, label.split("\n"))
        if card:  # bản số ở hai đầu: ("1", "n")
            for (pt, nxt, c) in ((pts[0], pts[1], card[0]), (pts[-1], pts[-2], card[1])):
                dx, dy = nxt[0] - pt[0], nxt[1] - pt[1]
                L = math.hypot(dx, dy) or 1
                ux, uy = dx / L, dy / L
                ox, oy = pt[0] + ux * 11 - uy * 9, pt[1] + uy * 11 + ux * 9
                self.s.text(ox, oy, c, size=12, weight="bold", color="#1F4E79")

    def note(self, x, y, text, size=FS_S, anchor="start", italic=True):
        for i, l in enumerate(text.split("\n")):
            self.s.text(x, y + i * 14, l, size=size, anchor=anchor, italic=italic, color="#444444")

    def svg(self):
        return self.s.render(self.W, self.H)


# =============================== NỘI DUNG ===============================

OUT = []  # (key, svg)

# ---------- HĐ1: Đăng nhập (UC01.1, UC01.2) - auth.service.ts loginUser / loginWithGoogle, auth.controller.ts ----------
a = Activity("hd1_dang_nhap", ["Khách", "Hệ thống"], [380, 440])
a.start("s", 0, 0)
a.action("mo", "Mở trang đăng nhập", 0, 1)
a.decision("cach", 0, 2.2, "Cách đăng nhập?")
a.action("nhap", "Nhập email và mật khẩu", 0, 3.6, dx=-92, w=140)
a.action("gg", "Chọn tài khoản Google", 0, 3.6, dx=92, w=140)
a.action("kt", "Giới hạn số lần thử, kiểm tra định dạng dữ liệu", 1, 4.9, dx=-108, w=170)
a.action("xm", "Xác minh mã định danh (ID token) với Google", 1, 4.9, dx=108, w=170)
a.decision("dung", 1, 6.4, "Đúng email và mật khẩu?", dx=-108, w=110)
a.decision("co", 1, 6.4, "Email đã có tài khoản?", dx=108, w=110)
a.action("loi", "Thông báo \"Email hoặc mật khẩu không đúng\"", 0, 6.4, dx=-92, w=150)
a.action("tao", "Tạo tài khoản và không gian làm việc cá nhân", 1, 7.9, dx=108, w=170)
a.decision("gop", 1, 9.0)
a.action("jwt", "Ký JWT (userId, tokenVersion), đặt vào cookie httpOnly hạn 7 ngày", 1, 10.1, w=240)
a.action("vao", "Chuyển về trang đang xem trước đó hoặc trang chủ", 0, 11.4, w=200)
a.end("e", 0, 12.5)
a.flow("s", "mo")
a.flow("mo", "cach")
a.flow("cach", "nhap", exit="left", guard="[Email, mật khẩu]", gpos=(a.X(0, -60), a.Y(2.2) - 12, "end"))
a.flow("cach", "gg", exit="right", guard="[Google]", gpos=(a.X(0, 60), a.Y(2.2) - 12, "start"))
a.flow("nhap", "kt", via=[(a.X(0, -92), a.Y(4.25)), (a.X(1, -108), a.Y(4.25))])
a.flow("gg", "xm", via=[(a.X(0, 92), a.Y(4.1)), (a.X(1, 108), a.Y(4.1))])
a.flow("kt", "dung")
a.flow("xm", "co")
a.flow("dung", "loi", exit="left", enter="right", guard="[Sai]")
a.flow("loi", "nhap", exit="left", enter="left", via=[(a.X(0, -178), a.Y(6.4)), (a.X(0, -178), a.Y(3.6))])
a.flow("dung", "gop", exit="bottom", enter="left", guard="[Đúng]")
a.flow("co", "tao", guard="[Chưa có]")
a.flow("co", "gop", exit="left", enter="top", guard="[Đã có]", gpos=(a.X(1, 40), a.Y(6.4) - 12, "end"))
a.flow("tao", "gop", exit="bottom", enter="right")
a.flow("gop", "jwt")
a.flow("jwt", "vao")
a.flow("vao", "e")
OUT.append((a.key, a.svg()))

# ---------- HĐ2: Di chuyển thẻ (UC08.6, UC08.7, UC08.9) - useBoardDnd.ts, card.service.ts moveCard ----------
a = Activity("hd2_di_chuyen_the", ["Thành viên bảng", "Hệ thống"], [330, 520])
a.start("s", 0, 0)
a.action("keo", "Kéo thẻ và thả vào vị trí mới (cùng hoặc khác danh sách)", 0, 1.1, w=200)
a.action("tam", "Hiển thị ngay vị trí mới trên giao diện, lưu ảnh chụp để hoàn tác", 1, 1.1, w=230)
a.action("quyen", "Kiểm tra quyền sửa thẻ, quyền sửa bảng chứa danh sách đích", 1, 2.4, w=260)
a.decision("cq", 1, 3.7, "Có quyền?")
a.action("hoan", "Hoàn tác vị trí, báo lỗi", 0, 3.7, w=170)
a.action("gd", "Trong một giao dịch: cập nhật danh sách và vị trí của thẻ, đánh lại vị trí các thẻ ở danh sách nguồn và đích", 1, 5.1, w=330)
a.decision("khac", 1, 6.5, "Sang danh sách khác?", w=150)
a.decision("tt", 1, 7.9, "Danh sách đích có gắn trạng thái?", dx=-60, w=150)
a.action("doi", "Đổi trạng thái thẻ theo danh sách đích", 1, 9.3, dx=-60, w=210)
a.decision("g1", 1, 10.4, dx=-60)
a.action("log", "Ghi nhật ký hoạt động, gửi thông báo cho người phụ trách và người theo dõi thẻ", 1, 11.5, dx=-60, w=280)
a.action("luat", "Chạy các luật tự động \"thẻ được chuyển vào danh sách\" đang bật", 1, 12.8, dx=-60, w=280)
a.decision("g2", 1, 14.0)
a.action("emit", "Phát sự kiện board:lists-changed tới phòng của bảng", 1, 15.0, w=300)
a.action("khac2", "Màn hình của các thành viên khác đang mở bảng tự tải lại danh sách và thẻ", 0, 16.3, w=220)
a.end("e", 0, 17.5)
a.flow("s", "keo")
a.flow("keo", "tam", exit="right", enter="left")
a.flow("tam", "quyen")
a.flow("quyen", "cq")
a.flow("cq", "hoan", exit="left", enter="right", guard="[Không]")
a.flow("hoan", "e", exit="bottom", enter="left", via=[(a.X(0, -120), a.Y(4.4)), (a.X(0, -120), a.Y(17.5))])
a.flow("cq", "gd", guard="[Có]")
a.flow("gd", "khac")
a.flow("khac", "tt", exit="bottom", enter="top", guard="[Có]", gpos=(a.X(1, -40), a.Y(6.5) + 40, "end"))
a.flow("khac", "g2", exit="right", enter="right", guard="[Không, chỉ đổi thứ tự]",
       via=[(a.X(1, 215), a.Y(6.5)), (a.X(1, 215), a.Y(14.0))], gpos=(a.X(1, 90), a.Y(6.5) - 12, "start"))
a.flow("tt", "doi", guard="[Có]")
a.flow("tt", "g1", exit="right", enter="right", guard="[Không]", via=[(a.X(1, 110), a.Y(7.9)), (a.X(1, 110), a.Y(10.4))])
a.flow("doi", "g1")
a.flow("g1", "log")
a.flow("log", "luat")
a.flow("luat", "g2", exit="bottom", enter="left")
a.flow("g2", "emit")
a.flow("emit", "khac2", exit="bottom", enter="right", via=[(a.X(1), a.Y(16.3))])
a.flow("khac2", "e")
OUT.append((a.key, a.svg()))

# ---------- HĐ3: Sinh bảng tự động bằng AI (UC11) - ai.service.ts generatePlan, ai.apply.ts applyPlan ----------
a = Activity("hd3_sinh_bang_ai", ["Người dùng", "Hệ thống", "Dịch vụ AI (Gemini)"], [300, 460, 210], row_h=58)
a.start("s", 0, 0)
a.action("mo", "Chọn không gian làm việc, khoảng thời gian dự án", 0, 1.1, w=200)
a.decision("nguon", 0, 2.4, "Nguồn mô tả?")
a.action("go", "Gõ mô tả dự án", 0, 3.7, dx=-75, w=110)
a.action("tep", "Chọn tệp DOCX hoặc PDF", 0, 3.7, dx=72, w=110)
a.action("trich", "Trích xuất chữ trong tệp", 1, 3.7, w=200)
a.decision("g0", 1, 4.8)
a.action("kt", "Kiểm tra quyền trong không gian; cắt mô tả theo giới hạn độ dài", 1, 5.9, w=280)
a.action("luat", "Tầng luật: tách dòng, nhận diện tiêu đề, gạch đầu dòng, biểu thức thời gian, tên thành viên", 1, 7.2, w=300)
a.decision("cauhinh", 1, 8.6, "Đã cấu hình LLM?")
a.action("llm", "Sinh bản nháp kế hoạch theo lược đồ JSON", 2, 8.6, w=170)
a.decision("hople", 1, 9.9, "Bản nháp hợp lệ?", dx=110)
a.action("canh", "Ghi cảnh báo, chỉ dùng kết quả tầng luật", 1, 11.2, dx=-110, w=180)
a.decision("g1", 1, 12.3)
a.action("build", "Hợp nhất kết quả, lập lịch ngày, kiểm tra bất biến của BoardPlan", 1, 13.4, w=290)
a.action("luu", "Lưu lượt chạy (AiRun), trả kế hoạch kèm cảnh báo", 1, 14.6, w=290)
a.action("xem", "Xem trước, chỉnh sửa tên, ngày, bỏ chọn thẻ", 0, 14.6, w=200)
a.decision("dongy", 0, 15.9, "Tạo bảng?")
a.action("apply", "Kiểm tra lại kế hoạch và quyền; trong một giao dịch: đánh dấu lượt chạy đã áp dụng, tạo bảng, danh sách, thẻ, nhãn", 1, 17.3, w=320)
a.action("mobang", "Mở bảng vừa tạo", 0, 18.7, w=160)
a.end("e", 0, 19.8)
a.end("huy", 0, 17.3, dx=-110)
a.flow("s", "mo")
a.flow("mo", "nguon")
a.flow("nguon", "go", exit="left", guard="[Gõ văn bản]", gpos=(a.X(0, -48), a.Y(2.4) - 14, "end"))
a.flow("nguon", "tep", exit="right", guard="[Tải tệp]", gpos=(a.X(0, 48), a.Y(2.4) - 14, "start"))
a.flow("tep", "trich", exit="right", enter="left")
a.flow("go", "g0", exit="bottom", enter="left")
a.flow("trich", "g0")
a.flow("g0", "kt")
a.flow("kt", "luat")
a.flow("luat", "cauhinh")
a.flow("cauhinh", "llm", exit="right", enter="left", guard="[Có]")
a.flow("llm", "hople", exit="bottom", enter="right", via=[(a.X(2), a.Y(9.9))])
a.flow("cauhinh", "canh", exit="left", enter="top", guard="[Chưa]")
a.flow("hople", "canh", exit="left", enter="right", guard="[Không]", via=[(a.X(1, 20), a.Y(9.9)), (a.X(1, 20), a.Y(11.2))],
       gpos=(a.X(1, 40), a.Y(9.9) - 13, "end"))
a.flow("hople", "g1", exit="bottom", enter="right", guard="[Có]")
a.flow("canh", "g1", exit="bottom", enter="left")
a.flow("g1", "build")
a.flow("build", "luu")
a.flow("luu", "xem", exit="left", enter="right")
a.flow("xem", "dongy")
a.flow("dongy", "huy", exit="left", enter="top", guard="[Không]")
a.flow("dongy", "apply", exit="bottom", enter="left", guard="[Có]", via=[(a.X(0), a.Y(17.3))])
a.flow("apply", "mobang", exit="bottom", enter="right", via=[(a.X(1), a.Y(18.7))])
a.flow("mobang", "e")
OUT.append((a.key, a.svg()))

# ---------- HĐ4: Gợi ý và giao việc (UC12.1, UC12.4, UC12.6) - assign.service.ts suggestForCard, recordOutcome ----------
a = Activity("hd4_goi_y_giao_viec", ["Thành viên bảng", "Hệ thống"], [320, 520], row_h=58)
a.start("s", 0, 0)
a.action("mo", "Mở chi tiết thẻ, xem gợi ý người phụ trách", 0, 1.1, w=200)
a.action("quyen", "Kiểm tra quyền sửa thẻ (người xem bảng bị chặn)", 1, 1.1, w=260)
a.action("uv", "Lấy danh sách ứng viên: những người có thể nhận thẻ trong bảng", 1, 2.3, w=300)
a.action("doc", "Đọc lịch sử thẻ đã hoàn thành, hồ sơ làm việc, hồ sơ tự khai, trọng số của không gian", 1, 3.6, w=320)
a.action("tinh", "Tính bốn thành phần: kinh nghiệm (TF-IDF, thẻ tương tự), độ tin cậy, khả dụng, hồ sơ tự khai; kèm độ chắc chắn", 1, 5.0, w=330)
a.action("xh", "Xếp hạng theo trọng số; gắn cảnh báo quá tải hoặc tạm nghỉ và các thẻ làm bằng chứng", 1, 6.4, w=330)
a.action("run", "Lưu lượt gợi ý (AssignRun)", 1, 7.6, w=220)
a.action("xem", "Xem xếp hạng, điểm thành phần và bằng chứng", 0, 7.6, w=200)
a.decision("chon", 0, 9.0, "Chọn người từ gợi ý?", w=120)
a.action("giao", "Giao thẻ cho người được chọn, gửi thông báo cho họ", 1, 10.4, w=280)
a.action("ghi", "Ghi người được chọn vào lượt gợi ý", 1, 11.6, w=260)
a.decision("hoc", 1, 13.0, "Đủ điều kiện học? (đủ lượt phản hồi, chọn khác người xếp đầu)", w=200)
a.action("capnhat", "Cập nhật trọng số theo cặp, chiếu về miền hợp lệ, lưu lịch sử trọng số", 1, 14.6, dx=-90, w=230)
a.decision("g", 1, 15.8)
a.end("e", 1, 16.8)
a.end("e2", 0, 10.4)
a.flow("s", "mo")
a.flow("mo", "quyen", exit="right", enter="left")
a.flow("quyen", "uv")
a.flow("uv", "doc")
a.flow("doc", "tinh")
a.flow("tinh", "xh")
a.flow("xh", "run")
a.flow("run", "xem", exit="left", enter="right")
a.flow("xem", "chon")
a.flow("chon", "e2", guard="[Không]")
a.flow("chon", "giao", exit="right", enter="top", guard="[Có]")
a.flow("giao", "ghi")
a.flow("ghi", "hoc")
a.flow("hoc", "capnhat", exit="bottom", enter="top", guard="[Có]", via=[(a.X(1), a.Y(13.95)), (a.X(1, -90), a.Y(13.95))])
a.flow("hoc", "g", exit="right", enter="right", guard="[Không]", via=[(a.X(1, 175), a.Y(13.0)), (a.X(1, 175), a.Y(15.8))])
a.flow("capnhat", "g", exit="bottom", enter="left")
a.flow("g", "e")
OUT.append((a.key, a.svg()))

# ---------- TT1a: Đăng nhập - auth.routes.ts, auth.service.ts loginUser, auth.controller.ts ----------
q = Sequence("tt1a_dang_nhap")
q.p("u", "Người dùng", "actor")
q.p("fe", "Giao diện\n(React)")
q.p("api", "API Express\n(router, middleware)")
q.p("svc", "AuthService")
q.p("db", "CSDL\nPostgreSQL", "db")
q.msg("u", "fe", "Nhập email, mật khẩu, bấm Đăng nhập")
q.msg("fe", "api", "POST /api/auth/login {email, password}")
q.self_("api", "Giới hạn số lần thử, kiểm tra dữ liệu (Zod)")
q.msg("api", "svc", "loginUser(email, password)")
q.msg("svc", "db", "Tìm người dùng theo email")
q.ret("db", "svc", "User (passwordHash, tokenVersion)")
q.frag("alt", "[Không có tài khoản hoặc sai mật khẩu]")
q.ret("svc", "api", "Lỗi 401")
q.ret("api", "fe", "401 Email hoặc mật khẩu không đúng")
q.msg("fe", "u", "Hiển thị lỗi", "async")
q.els("[Thông tin đúng]")
q.self_("svc", "So khớp mật khẩu (bcrypt), ký JWT {userId, tokenVersion}")
q.ret("svc", "api", "user, token")
q.ret("api", "fe", "200 + Set-Cookie: token (httpOnly)")
q.msg("fe", "u", "Chuyển về trang trước đó", "async")
q.end()
OUT.append((q.key, q.svg()))

# ---------- TT1b: Gọi API cần đăng nhập - auth.middleware.ts requireAuth, board.service.ts listMyBoards ----------
q = Sequence("tt1b_goi_api_xac_thuc")
q.p("fe", "Giao diện\n(React)")
q.p("api", "API Express\n(requireAuth)")
q.p("svc", "BoardService")
q.p("db", "CSDL\nPostgreSQL", "db")
q.msg("fe", "api", "GET /api/boards (trình duyệt tự gửi cookie)")
q.self_("api", "Xác minh chữ ký và hạn của JWT")
q.msg("api", "db", "Tìm User theo userId")
q.ret("db", "api", "User (tokenVersion hiện tại)")
q.frag("alt", "[JWT sai, hết hạn hoặc tokenVersion đã đổi]")
q.ret("api", "fe", "401 Vui lòng đăng nhập lại")
q.els("[Hợp lệ]")
q.msg("api", "svc", "listMyBoards(userId)")
q.msg("svc", "db", "Truy vấn các bảng người dùng được phép xem")
q.ret("db", "svc", "Danh sách bảng")
q.ret("svc", "api", "Danh sách bảng")
q.ret("api", "fe", "200 JSON")
q.end()
OUT.append((q.key, q.svg()))

# ---------- TT2: Di chuyển thẻ và đồng bộ thời gian thực - card.service.ts moveCard, realtime/socket.ts ----------
q = Sequence("tt2_di_chuyen_the")
q.p("u", "Thành viên A", "actor")
q.p("fe", "Giao diện\ncủa A")
q.p("srv", "Máy chủ (API,\nCardService, Socket.IO)")
q.p("db", "CSDL\nPostgreSQL", "db")
q.p("fb", "Giao diện\ncủa B")
q.msg("u", "fe", "Kéo thả thẻ sang danh sách khác")
q.self_("fe", "Cập nhật tạm vị trí, lưu ảnh chụp để hoàn tác")
q.msg("fe", "srv", "PATCH /api/cards/:id/move {listId, position}")
q.msg("srv", "db", "Kiểm tra quyền sửa thẻ và bảng đích")
q.ret("db", "srv", "Kết quả kiểm tra")
q.frag("alt", "[Không có quyền]")
q.ret("srv", "fe", "403")
q.self_("fe", "Hoàn tác vị trí, báo lỗi")
q.els("[Có quyền]")
q.msg("srv", "db", "Giao dịch: cập nhật listId, vị trí; đổi trạng thái theo cột")
q.ret("db", "srv", "Đã ghi")
q.msg("srv", "db", "Ghi Activity, Notification")
q.ret("db", "srv", "Đã ghi")
q.self_("srv", "Chạy luật tự động CARD_MOVED_TO_LIST")
q.async_("srv", "fb", "Sự kiện board:lists-changed (phòng của bảng)")
q.self_("fb", "Chờ 400 ms rồi tải lại danh sách và thẻ")
q.ret("srv", "fe", "200 OK")
q.end()
OUT.append((q.key, q.svg()))

# ---------- TT3a: Sinh kế hoạch bảng - ai.routes.ts, ai.document.ts, ai.service.ts generatePlan, ai.llm.ts ----------
q = Sequence("tt3a_sinh_ke_hoach")
q.p("u", "Người dùng", "actor")
q.p("fe", "Giao diện\n(hộp thoại AI)")
q.p("srv", "Máy chủ\n(API, AiService)")
q.p("llm", "Gemini API")
q.p("db", "CSDL\nPostgreSQL", "db")
q.msg("u", "fe", "Nhập mô tả hoặc chọn tệp; chọn không gian, thời gian")
q.frag("opt", "[Tải tệp DOCX/PDF]")
q.msg("fe", "srv", "POST /api/ai/documents/extract (tệp)")
q.self_("srv", "Đọc chữ trong tệp (mammoth, pdf-parse)")
q.ret("srv", "fe", "200 {text}")
q.end()
q.msg("fe", "srv", "POST /api/ai/board-plans {workspaceId, text, ...}")
q.msg("srv", "db", "Kiểm tra quyền trong không gian")
q.ret("db", "srv", "Hợp lệ")
q.self_("srv", "Tầng luật: tách dòng, ngày tháng, thành viên")
q.frag("alt", "[Đã cấu hình LLM]")
q.msg("srv", "llm", "Lời nhắc + lược đồ JSON")
q.ret("llm", "srv", "Bản nháp JSON")
q.self_("srv", "Kiểm tra hình dạng (Zod); sửa nhẹ hoặc bỏ bản nháp")
q.els("[Chưa cấu hình hoặc gọi lỗi]")
q.self_("srv", "Ghi cảnh báo, dùng kết quả tầng luật")
q.end()
q.self_("srv", "buildPlan: hợp nhất, lập lịch, kiểm tra BoardPlan")
q.msg("srv", "db", "Lưu AiRun")
q.ret("db", "srv", "runId")
q.ret("srv", "fe", "200 {runId, plan, warnings}")
q.msg("fe", "u", "Hiển thị bản xem trước để chỉnh sửa", "async")
OUT.append((q.key, q.svg()))

# ---------- TT3b: Áp dụng kế hoạch bảng - ai.routes.ts (validateBody applyPlanSchema), ai.apply.ts applyPlan ----------
q = Sequence("tt3b_ap_dung_ke_hoach")
q.p("u", "Người dùng", "actor")
q.p("fe", "Giao diện\n(hộp thoại AI)")
q.p("srv", "Máy chủ\n(API, AiService)")
q.p("db", "CSDL\nPostgreSQL", "db")
q.msg("u", "fe", "Chỉnh sửa kế hoạch, bấm Tạo bảng")
q.msg("fe", "srv", "POST /api/ai/board-plans/:runId/apply {plan}")
q.self_("srv", "Kiểm tra lại BoardPlan (Zod)")
q.msg("srv", "db", "Tìm AiRun của người gọi; kiểm tra quyền trong không gian")
q.ret("db", "srv", "AiRun")
q.frag("alt", "[Không tìm thấy hoặc đã áp dụng]")
q.ret("srv", "fe", "404 hoặc 409")
q.els("[Hợp lệ]")
q.msg("srv", "db", "Giao dịch: đánh dấu đã áp dụng; tạo Board, List, Card, Label")
q.ret("db", "srv", "Bảng mới")
q.msg("srv", "db", "Ghi Activity ai.board.create")
q.ret("srv", "fe", "201 {board}")
q.msg("fe", "u", "Mở bảng vừa tạo", "async")
q.end()
OUT.append((q.key, q.svg()))

# ---------- TT4a: Xem gợi ý người phụ trách - assign.service.ts suggestForCard ----------
q = Sequence("tt4a_xem_goi_y")
q.p("u", "Thành viên bảng", "actor")
q.p("fe", "Giao diện\n(chi tiết thẻ)")
q.p("srv", "Máy chủ\n(API, AssignService)")
q.p("db", "CSDL\nPostgreSQL", "db")
q.msg("u", "fe", "Mở thẻ, xem gợi ý người phụ trách")
q.msg("fe", "srv", "GET /api/cards/:id/assignment-suggestions")
q.msg("srv", "db", "Kiểm tra quyền sửa thẻ; đọc ứng viên")
q.ret("db", "srv", "Ứng viên")
q.msg("srv", "db", "Đọc lịch sử thẻ, hồ sơ, trọng số của không gian")
q.ret("db", "srv", "Dữ liệu chấm điểm")
q.self_("srv", "Truy hồi thẻ tương tự (TF-IDF); tính kinh nghiệm, độ tin cậy, khả dụng, hồ sơ")
q.self_("srv", "Xếp hạng theo trọng số; gắn bằng chứng, cảnh báo")
q.msg("srv", "db", "Lưu AssignRun")
q.ret("db", "srv", "runId")
q.ret("srv", "fe", "200 {runId, candidates}")
q.msg("fe", "u", "Hiển thị xếp hạng, điểm thành phần, bằng chứng", "async")
OUT.append((q.key, q.svg()))

# ---------- TT4b: Giao thẻ theo gợi ý và học trọng số - cardExtras.service.ts addCardMember, assign.service.ts recordOutcome ----------
q = Sequence("tt4b_giao_va_hoc")
q.p("u", "Thành viên bảng", "actor")
q.p("fe", "Giao diện\n(chi tiết thẻ)")
q.p("srv", "Máy chủ (API,\nCard/AssignService)")
q.p("db", "CSDL\nPostgreSQL", "db")
q.msg("u", "fe", "Chọn một người trong danh sách gợi ý")
q.msg("fe", "srv", "POST /api/cards/:id/members {userId}")
q.msg("srv", "db", "Tạo CardMember, Activity, Notification")
q.ret("db", "srv", "Đã ghi")
q.ret("srv", "fe", "201")
q.msg("fe", "srv", "POST /api/assignment/runs/:runId/outcome {chosenUserId}")
q.msg("srv", "db", "Kiểm tra lượt gợi ý và người đã được giao; ghi chosenUserId, decidedAt")
q.ret("db", "srv", "Đã ghi")
q.frag("opt", "[Đủ lượt phản hồi, người được chọn khác người xếp đầu]")
q.self_("srv", "Cập nhật trọng số theo cặp, chiếu về miền hợp lệ")
q.msg("srv", "db", "Lưu trọng số mới và lịch sử trọng số")
q.ret("db", "srv", "Đã ghi")
q.end()
q.ret("srv", "fe", "200")
q.msg("fe", "u", "Cập nhật người phụ trách trên thẻ", "async")
OUT.append((q.key, q.svg()))

# =============== BỔ SUNG 06/10: mỗi nhóm use case có ít nhất một cặp biểu đồ hoạt động + trình tự ===============

# ---------- HĐ5: Đăng ký và xác minh email (UC01.3, UC01.4) - auth.service.ts registerUser / verifyEmail, authToken.service.ts ----------
a = Activity("hd5_dang_ky", ["Khách", "Hệ thống", "Dịch vụ email"], [290, 410, 150])
a.start("s", 0, 0)
a.action("nhap", "Nhập họ tên, email, mật khẩu (tối thiểu 6 ký tự)", 0, 1.1, w=200)
a.action("kt", "Giới hạn số lần đăng ký; kiểm tra dữ liệu và email chưa được dùng", 1, 1.1, w=260)
a.decision("hl", 1, 2.4, "Hợp lệ?")
a.action("loi", "Báo lỗi: dữ liệu sai hoặc email đã được sử dụng", 0, 2.4, w=190)
a.action("tao", "Băm mật khẩu (bcrypt); tạo tài khoản và không gian làm việc cá nhân", 1, 3.7, w=290)
a.action("ma", "Tạo mã xác minh dùng một lần (chỉ lưu SHA-256, hạn 24 giờ)", 1, 4.9, w=290)
a.action("mail", "Gửi email chứa liên kết xác minh", 2, 4.9)
a.action("jwt", "Ký JWT, đặt cookie httpOnly (đăng nhập luôn); lỗi gửi email không chặn việc đăng ký", 1, 6.3, w=290)
a.action("vao", "Vào trang chủ; banner nhắc xác minh email", 0, 7.6, w=190)
a.action("mo", "Mở liên kết xác minh trong email", 0, 8.8, w=190)
a.action("tieu", "Trong một giao dịch: đánh dấu mã đã dùng, chỉ khi mã đúng, chưa dùng, còn hạn", 1, 8.8, w=290)
a.decision("ok", 1, 10.1, "Mã hợp lệ?")
a.action("het", "Báo liên kết không hợp lệ hoặc hết hạn; có thể gửi lại email từ banner", 0, 10.1, w=200)
a.end("e1", 0, 11.3)
a.action("xm", "Ghi thời điểm xác minh email", 1, 11.4, w=260)
a.action("xong", "Thấy thông báo xác minh thành công, banner nhắc biến mất", 0, 12.7, w=200)
a.end("e", 0, 13.8)
a.flow("s", "nhap")
a.flow("nhap", "kt", exit="right", enter="left")
a.flow("kt", "hl")
a.flow("hl", "loi", exit="left", enter="right", guard="[Không]")
a.flow("loi", "nhap", exit="left", enter="left", via=[(a.X(0, -130), a.Y(2.4)), (a.X(0, -130), a.Y(1.1))])
a.flow("hl", "tao", guard="[Có]")
a.flow("tao", "ma")
a.flow("ma", "mail", exit="right", enter="left")
a.flow("mail", "jwt", exit="bottom", enter="right")
a.flow("jwt", "vao", exit="bottom", enter="right")
a.flow("vao", "mo")
a.flow("mo", "tieu", exit="right", enter="left")
a.flow("tieu", "ok")
a.flow("ok", "het", exit="left", enter="right", guard="[Không]")
a.flow("het", "e1")
a.flow("ok", "xm", guard="[Có]")
a.flow("xm", "xong", exit="bottom", enter="right")
a.flow("xong", "e")
OUT.append((a.key, a.svg()))

# ---------- HĐ6: Quên và đặt lại mật khẩu (UC01.5, UC01.6) - auth.service.ts requestPasswordReset / resetPassword ----------
a = Activity("hd6_quen_mat_khau", ["Khách", "Hệ thống", "Dịch vụ email"], [290, 410, 150])
a.start("s", 0, 0)
a.action("nhap", "Bấm Quên mật khẩu, nhập email", 0, 1.1, w=190)
a.action("kt", "Giới hạn số lần thử; kiểm tra định dạng email", 1, 1.1, w=260)
a.decision("co", 1, 2.4, "Email có tài khoản?", w=130)
a.action("ma", "Tạo mã đặt lại dùng một lần (chỉ lưu SHA-256, hạn 1 giờ)", 1, 3.7, w=250)
a.action("mail", "Gửi email chứa liên kết đặt lại mật khẩu", 2, 3.7)
a.decision("g", 1, 5.0)
a.action("tb", "Luôn trả cùng một thông báo, không cho biết email có tồn tại hay không", 1, 6.1, w=290)
a.action("mo", "Mở liên kết trong email, nhập mật khẩu mới hai lần", 0, 7.4, w=190)
a.action("bam", "Kiểm tra dữ liệu, băm mật khẩu mới; kiểm tra mã: đúng, chưa dùng, còn hạn", 1, 7.4, w=290)
a.decision("hl", 1, 8.7, "Mã hợp lệ?")
a.action("het", "Báo liên kết không hợp lệ hoặc đã hết hạn", 0, 8.7, w=190)
a.end("e1", 0, 9.9)
a.action("gd", "Trong một giao dịch: đánh dấu mã đã dùng, đổi mật khẩu, ghi nhận email đã xác minh, tăng tokenVersion", 1, 10.1, w=300)
a.action("ngat", "Ngắt mọi kết nối Socket.IO của tài khoản; mọi JWT cấp trước đó hết hiệu lực", 1, 11.5, w=300)
a.action("dn", "Đăng nhập lại bằng mật khẩu mới", 0, 12.8, w=190)
a.end("e", 0, 13.9)
a.flow("s", "nhap")
a.flow("nhap", "kt", exit="right", enter="left")
a.flow("kt", "co")
a.flow("co", "ma", guard="[Có]")
a.flow("co", "g", exit="left", enter="left", guard="[Không]", via=[(a.X(1, -170), a.Y(2.4)), (a.X(1, -170), a.Y(5.0))],
       gpos=(a.X(1, -80), a.Y(2.4) - 13, "end"))
a.flow("ma", "mail", exit="right", enter="left")
a.flow("mail", "g", exit="bottom", enter="right")
a.flow("g", "tb")
a.flow("tb", "mo", exit="bottom", enter="top", via=[(a.X(1), a.Y(6.75)), (a.X(0), a.Y(6.75))])
a.flow("mo", "bam", exit="right", enter="left")
a.flow("bam", "hl")
a.flow("hl", "het", exit="left", enter="right", guard="[Không]")
a.flow("het", "e1")
a.flow("hl", "gd", guard="[Có]")
a.flow("gd", "ngat")
a.flow("ngat", "dn", exit="bottom", enter="right")
a.flow("dn", "e")
OUT.append((a.key, a.svg()))

# ---------- HĐ7: Xem bảng công khai (UC02.1, UC02.2, UC02.3) - publicBoard.routes.ts, publicBoard.service.ts ----------
a = Activity("hd7_xem_bang_cong_khai", ["Khách", "Hệ thống"], [330, 460])
a.start("s", 0, 0)
a.action("mo", "Mở đường dẫn của bảng công khai (không cần đăng nhập)", 0, 1.1, w=220)
a.action("tim", "Giới hạn tần suất truy cập; tìm bảng có chế độ Công khai, chưa xoá, chưa lưu trữ", 1, 1.1, w=300)
a.decision("thay", 1, 2.5, "Tìm thấy?")
a.action("khong", "Thấy thông báo không tìm thấy bảng, kèm liên kết đăng nhập", 0, 2.5, w=210)
a.end("e1", 0, 3.7)
a.action("tra", "Trả tên, nền bảng, các danh sách và thẻ đang hoạt động; người dùng chỉ kèm tên và ảnh đại diện, không kèm email", 1, 3.9, w=320)
a.action("xem", "Xem bảng ở chế độ chỉ đọc", 0, 5.2, w=200)
a.decision("chon", 0, 6.4, "Mở một thẻ?")
a.action("kt", "Kiểm tra thẻ và danh sách chứa thẻ còn hoạt động, bảng vẫn ở chế độ Công khai", 1, 7.7, w=300)
a.action("ct", "Trả chi tiết thẻ: nhãn, ngày, thành viên, checklist, bình luận, tệp đính kèm (chỉ đọc)", 1, 9.0, w=320)
a.action("xct", "Xem chi tiết thẻ; tải tệp đính kèm nếu cần", 0, 10.3, w=200)
a.decision("g", 0, 11.4)
a.end("e", 0, 12.4)
a.flow("s", "mo")
a.flow("mo", "tim", exit="right", enter="left")
a.flow("tim", "thay")
a.flow("thay", "khong", exit="left", enter="right", guard="[Không]")
a.flow("khong", "e1")
a.flow("thay", "tra", guard="[Có]")
a.flow("tra", "xem", exit="bottom", enter="right")
a.flow("xem", "chon")
a.flow("chon", "kt", exit="right", enter="top", guard="[Có]")
a.flow("chon", "g", exit="left", enter="left", guard="[Không]", via=[(a.X(0, -140), a.Y(6.4)), (a.X(0, -140), a.Y(11.4))],
       gpos=(a.X(0, -60), a.Y(6.4) - 13, "end"))
a.flow("kt", "ct")
a.flow("ct", "xct", exit="bottom", enter="right")
a.flow("xct", "g")
a.flow("g", "e")
OUT.append((a.key, a.svg()))

# ---------- HĐ8: Đổi mật khẩu (UC03.4) - auth.service.ts changeUserPassword, auth.controller.ts, frontend lib/api/auth.ts ----------
a = Activity("hd8_doi_mat_khau", ["Người dùng", "Hệ thống"], [340, 470])
a.start("s", 0, 0)
a.action("nhap", "Nhập mật khẩu hiện tại và mật khẩu mới (6–72 ký tự)", 0, 1.1, w=210)
a.action("kt", "Xác thực phiên (JWT, tokenVersion); kiểm tra dữ liệu", 1, 1.1, w=260)
a.decision("cmk", 1, 2.4, "Có mật khẩu?")
a.action("gg", "Báo tài khoản Google chưa có mật khẩu, hướng dẫn dùng Quên mật khẩu", 0, 2.4, w=210)
a.end("e1", 0, 3.6)
a.action("so", "So khớp mật khẩu hiện tại (bcrypt)", 1, 3.7, w=260)
a.decision("dung", 1, 4.9, "Đúng?")
a.action("sai", "Báo mật khẩu hiện tại không đúng", 0, 4.9, w=200)
a.action("cn", "Lưu mật khẩu mới đã băm và tăng tokenVersion trong cùng một lần cập nhật", 1, 6.2, w=300)
a.action("ngat", "Ngắt mọi kết nối Socket.IO đang mở của tài khoản", 1, 7.4, w=300)
a.action("ck", "Ký JWT mới theo tokenVersion mới, đặt lại cookie cho phiên hiện tại", 1, 8.6, w=300)
a.bar("f", 1, 9.6, w=220)
a.action("tiep", "Giao diện kết nối lại Socket.IO bằng cookie mới; tiếp tục làm việc", 0, 10.8, w=210)
a.action("khac", "Từ chối (401) yêu cầu mang JWT cũ từ thiết bị khác; người dùng ở đó phải đăng nhập lại", 1, 10.8, w=300)
a.bar("j", 1, 12.0, w=220)
a.end("e", 1, 13.0)
a.flow("s", "nhap")
a.flow("nhap", "kt", exit="right", enter="left")
a.flow("kt", "cmk")
a.flow("cmk", "gg", exit="left", enter="right", guard="[Không]")
a.flow("gg", "e1")
a.flow("cmk", "so", guard="[Có]")
a.flow("so", "dung")
a.flow("dung", "sai", exit="left", enter="right", guard="[Sai]")
a.flow("sai", "nhap", exit="left", enter="left", via=[(a.X(0, -152), a.Y(4.9)), (a.X(0, -152), a.Y(1.1))])
a.flow("dung", "cn", guard="[Đúng]")
a.flow("cn", "ngat")
a.flow("ngat", "ck")
a.flow("ck", "f")
a.flow("f", "tiep", exit="left", enter="top")
a.flow("f", "khac")
a.flow("tiep", "j", exit="bottom", enter="left")
a.flow("khac", "j")
a.flow("j", "e")
OUT.append((a.key, a.svg()))

# ---------- HĐ9: Tạo không gian và thêm thành viên (UC04.1, UC04.7, UC04.8) - workspace.service.ts, workspaceMember.service.ts ----------
a = Activity("hd9_khong_gian", ["Quản trị viên không gian", "Hệ thống"], [330, 480])
a.start("s", 0, 0)
a.action("tao", "Tạo không gian làm việc mới, nhập tên", 0, 1.1, w=200)
a.action("luu", "Tạo không gian; thêm người tạo với vai trò Chủ sở hữu", 1, 1.1, w=290)
a.action("moi", "Mở cài đặt không gian; nhập email, chọn vai trò Quản trị viên hoặc Thành viên", 0, 2.5, w=220)
a.action("quyen", "Kiểm tra người gọi là Chủ sở hữu hoặc Quản trị viên của không gian; tìm tài khoản theo email", 1, 3.9, w=320)
a.decision("tk", 1, 5.3, "Có tài khoản đã xác minh email?", w=120)
a.action("email", "Gửi email mời đăng ký; chưa cấp quyền", 1, 6.8, dx=-120, w=180)
a.action("them", "Thêm (hoặc khôi phục) thành viên với vai trò đã chọn", 1, 6.8, dx=110, w=200)
a.action("tb", "Gửi thông báo cho người được thêm; phát workspace:changed tới các thành viên", 1, 8.1, dx=110, w=200)
a.decision("g", 1, 9.4)
a.action("xem", "Thấy kết quả: đã thêm thành viên hoặc đã gửi lời mời", 0, 10.6, w=210)
a.end("e", 0, 11.7)
a.flow("s", "tao")
a.flow("tao", "luu", exit="right", enter="left")
a.flow("luu", "moi", exit="bottom", enter="right")
a.flow("moi", "quyen", exit="bottom", enter="left")
a.flow("quyen", "tk")
a.flow("tk", "email", exit="left", enter="top", guard="[Chưa]")
a.flow("tk", "them", exit="right", enter="top", guard="[Có]")
a.flow("them", "tb")
a.flow("email", "g", exit="bottom", enter="left")
a.flow("tb", "g", exit="bottom", enter="right")
a.flow("g", "xem", exit="bottom", enter="right")
a.flow("xem", "e")
OUT.append((a.key, a.svg()))

# ---------- HĐ10: Tạo bảng (UC05.1, UC05.2) - board.service.ts createBoard / createBoardFromTemplate, CreateBoardDialog.tsx ----------
a = Activity("hd10_tao_bang", ["Người dùng", "Hệ thống"], [370, 470])
a.start("s", 0, 0)
a.decision("cach", 0, 1.1, "Cách tạo?")
a.action("trong", "Mở hộp thoại tạo bảng; nhập tên, chọn không gian và nền (màu hoặc ảnh Unsplash)", 0, 2.7, dx=-92, w=150)
a.action("mau", "Chọn một mẫu (của hệ thống hoặc đã lưu) và không gian", 0, 2.7, dx=95, w=135)
a.decision("g0", 0, 4.2)
a.action("kt", "Kiểm tra người tạo là thành viên của không gian", 1, 5.1, w=280)
a.decision("tv", 1, 6.3, "Là thành viên?")
a.action("loi", "Báo lỗi không có quyền trong không gian", 0, 6.3, w=200)
a.end("e1", 0, 7.5)
a.decision("tumau", 1, 7.6, "Từ mẫu?")
a.action("tbt", "Tạo bảng với tên và nền đã chọn", 1, 9.0, dx=-110, w=180)
a.action("tbm", "Tạo bảng kèm các danh sách (có trạng thái) và thẻ của mẫu", 1, 9.0, dx=110, w=190)
a.decision("g", 1, 10.3)
a.action("cs", "Người tạo là Chủ sở hữu bảng; chế độ hiển thị mặc định là Riêng tư", 1, 11.4, w=320)
a.action("mo", "Mở bảng vừa tạo", 0, 12.7, w=200)
a.end("e", 0, 13.8)
a.flow("s", "cach")
a.flow("cach", "trong", exit="left", enter="top", guard="[Bảng trống]", gpos=(a.X(0, -45), a.Y(1.1) - 13, "end"))
a.flow("cach", "mau", exit="right", enter="top", guard="[Từ mẫu]", gpos=(a.X(0, 45), a.Y(1.1) - 13, "start"))
a.flow("trong", "g0", exit="bottom", enter="left")
a.flow("mau", "g0", exit="bottom", enter="right")
a.flow("g0", "kt", exit="bottom", enter="left")
a.flow("kt", "tv")
a.flow("tv", "loi", exit="left", enter="right", guard="[Không]")
a.flow("loi", "e1")
a.flow("tv", "tumau", guard="[Có]")
a.flow("tumau", "tbt", exit="left", enter="top", guard="[Không]")
a.flow("tumau", "tbm", exit="right", enter="top", guard="[Có]")
a.flow("tbt", "g", exit="bottom", enter="left")
a.flow("tbm", "g", exit="bottom", enter="right")
a.flow("g", "cs")
a.flow("cs", "mo", exit="bottom", enter="right")
a.flow("mo", "e")
OUT.append((a.key, a.svg()))

# ---------- HĐ11: Thiết lập và thực thi luật tự động (UC05.23, UC05.24) - automation.service.ts create / runAutomationsForCard ----------
a = Activity("hd11_luat_tu_dong", ["Thành viên bảng", "Hệ thống"], [330, 480], row_h=58)
a.start("s", 0, 0)
a.action("dk", "Mở Tự động hoá; đặt tên luật, chọn điều kiện: thẻ được tạo, hoặc thẻ được chuyển vào một danh sách", 0, 1.2, w=230)
a.action("hd", "Chọn 1–5 hành động: đánh dấu xong, gắn nhãn, giao thành viên; bấm Lưu", 0, 2.7, w=230)
a.action("kt", "Kiểm tra quyền sửa bảng; danh sách, nhãn, thành viên được chọn phải thuộc bảng", 1, 2.7, w=300)
a.decision("hl", 1, 4.0, "Hợp lệ?")
a.action("loi", "Báo lỗi, sửa lại luật", 0, 4.0, w=180)
a.action("luu", "Lưu luật (mặc định đang bật) và các hành động theo thứ tự", 1, 5.3, w=300)
a.action("thay", "Thấy luật trong danh sách; có thể tạm tắt hoặc bật lại", 0, 6.5, w=220)
a.end("e1", 0, 7.6)
a.start("s2", 1, 7.6)
a.action("sk", "Một thẻ được tạo trong bảng, hoặc được chuyển sang danh sách khác", 1, 8.6, w=300)
a.action("tim", "Tìm các luật đang bật của bảng khớp loại sự kiện và danh sách", 1, 9.8, w=300)
a.decision("con", 1, 11.1, "Còn luật chưa chạy?", dx=-50, w=130)
a.action("chay", "Chạy lần lượt các hành động (đánh dấu xong, gắn nhãn, giao thành viên kèm thông báo); lỗi của một luật chỉ ghi nhật ký, không làm hỏng thao tác chính", 1, 12.7, dx=-50, w=250)
a.action("phat", "Phát board:lists-changed; màn hình của các thành viên tải lại bảng", 1, 14.3, dx=40, w=260)
a.end("e2", 1, 15.4, dx=40)
a.flow("s", "dk")
a.flow("dk", "hd")
a.flow("hd", "kt", exit="right", enter="left")
a.flow("kt", "hl")
a.flow("hl", "loi", exit="left", enter="right", guard="[Không]")
a.flow("loi", "hd", exit="left", enter="left", via=[(a.X(0, -148), a.Y(4.0)), (a.X(0, -148), a.Y(2.7))])
a.flow("hl", "luu", guard="[Có]")
a.flow("luu", "thay", exit="bottom", enter="right")
a.flow("thay", "e1")
a.flow("s2", "sk")
a.flow("sk", "tim")
a.flow("tim", "con", exit="bottom", enter="top")
a.flow("con", "chay", guard="[Có]")
a.flow("chay", "con", exit="left", enter="left", via=[(a.X(1, -222), a.Y(12.7)), (a.X(1, -222), a.Y(11.1))])
a.flow("con", "phat", exit="right", enter="right", guard="[Không]", via=[(a.X(1, 210), a.Y(11.1)), (a.X(1, 210), a.Y(14.3))],
       gpos=(a.X(1, 30), a.Y(11.1) - 13, "start"))
a.flow("phat", "e2")
OUT.append((a.key, a.svg()))

# ---------- HĐ12: Tham gia bảng bằng liên kết mời (UC06.7, UC06.1, UC06.2, UC06.8) - boardShare.service.ts ----------
a = Activity("hd12_tham_gia_bang", ["Người dùng", "Hệ thống", "Quản trị viên bảng"], [270, 360, 240], row_h=58)
a.start("s", 2, 0)
a.action("tao", "Tạo liên kết mời, gửi cho người muốn mời", 2, 1.1, w=190)
a.action("sinh", "Sinh mã mời ngẫu nhiên, duy nhất, gắn với bảng", 1, 1.1, w=250)
a.action("mo", "Mở liên kết mời (đăng nhập nếu chưa)", 0, 2.5, w=200)
a.action("tim", "Tìm bảng theo mã mời; xem người mở đã là thành viên, đang chờ duyệt hay chưa", 1, 2.5, w=300)
a.decision("hl", 1, 3.9, "Mã hợp lệ?")
a.action("khl", "Báo liên kết không hợp lệ hoặc đã bị thu hồi", 0, 3.9, w=200)
a.end("e1", 0, 5.0)
a.decision("tt", 1, 5.4, "Đã tham gia hoặc đang chờ?", w=120)
a.action("da", "Mở bảng nếu đã là thành viên, hoặc thấy yêu cầu đang chờ duyệt", 0, 6.5, w=200)
a.end("e2", 0, 7.6)
a.action("xt", "Trả tên và nền bảng để xem trước", 1, 6.8, w=250)
a.action("gui", "Xem trước bảng; bấm Gửi yêu cầu tham gia", 0, 8.6, w=200)
a.action("luu", "Lưu yêu cầu (đang chờ); thông báo cho các quản trị viên bảng; phát board:join-requests-changed", 1, 9.9, w=300)
a.action("nhan", "Nhận thông báo, mở danh sách yêu cầu tham gia", 2, 9.9, w=190)
a.decision("duyet", 2, 11.2, "Duyệt?")
a.action("chap", "Trong một giao dịch: đánh dấu đã duyệt, thêm người yêu cầu với vai trò Thành viên", 1, 12.7, dx=-75, w=180)
a.action("tc", "Đánh dấu đã từ chối", 1, 12.7, dx=105, w=120)
a.decision("g", 1, 14.1)
a.action("tb", "Thông báo kết quả cho người yêu cầu; cập nhật danh sách yêu cầu và thành viên theo thời gian thực", 1, 15.3, w=300)
a.action("kq", "Nhận thông báo; nếu được duyệt thì vào bảng với vai trò Thành viên", 0, 16.6, w=200)
a.end("e", 0, 17.7)
a.flow("s", "tao")
a.flow("tao", "sinh", exit="left", enter="right")
a.flow("sinh", "mo", exit="bottom", enter="top", via=[(a.X(1), a.Y(1.8)), (a.X(0), a.Y(1.8))])
a.flow("mo", "tim", exit="right", enter="left")
a.flow("tim", "hl")
a.flow("hl", "khl", exit="left", enter="right", guard="[Không]")
a.flow("khl", "e1")
a.flow("hl", "tt", guard="[Có]")
a.flow("tt", "da", exit="left", enter="top", guard="[Có]")
a.flow("da", "e2")
a.flow("tt", "xt", guard="[Chưa]")
a.flow("xt", "gui", exit="bottom", enter="right")
a.flow("gui", "luu", exit="bottom", enter="left")
a.flow("luu", "nhan", exit="right", enter="left")
a.flow("nhan", "duyet")
a.flow("duyet", "chap", exit="left", enter="top", guard="[Chấp nhận]")
a.flow("duyet", "tc", exit="bottom", enter="right", guard="[Từ chối]")
a.flow("chap", "g", exit="bottom", enter="left")
a.flow("tc", "g", exit="bottom", enter="right")
a.flow("g", "tb")
a.flow("tb", "kq", exit="bottom", enter="right")
a.flow("kq", "e")
OUT.append((a.key, a.svg()))

# ---------- HĐ13: Thêm và sắp xếp danh sách (UC07.2, UC07.4, UC07.6) - list.service.ts createList / updateList, cardStatus.ts guessListStatus ----------
a = Activity("hd13_danh_sach", ["Thành viên bảng", "Hệ thống"], [350, 480], row_h=58)
a.start("s", 0, 0)
a.decision("tt", 0, 1.1, "Thao tác?")
a.action("them", "Nhập tên danh sách mới; có thể chọn trạng thái", 0, 2.6, dx=-80, w=145)
a.action("keo", "Kéo danh sách tới vị trí mới; giao diện đổi thứ tự ngay", 0, 2.6, dx=85, w=135)
a.decision("g0", 0, 4)
a.action("kt", "Kiểm tra quyền sửa bảng", 1, 4.8, w=220)
a.decision("cq", 1, 6, "Có quyền?")
a.action("loi", "Báo lỗi; nếu đang kéo thì tải lại thứ tự từ máy chủ", 0, 6, w=200)
a.end("e1", 0, 7.2)
a.decision("loai", 1, 7.3, "Thêm mới?")
a.decision("cotr", 1, 8.6, "Đã chọn trạng thái?", dx=-110, w=130)
a.action("doan", "Đoán trạng thái theo tên (vd. “Đang xử lý” → Đang làm); không khớp thì để cột tự do", 1, 10.1, dx=-110, w=175)
a.decision("g1", 1, 11.5, dx=-110)
a.action("tao", "Tạo danh sách ở cuối bảng", 1, 12.6, dx=-110, w=180)
a.action("vt", "Trong một giao dịch: đặt danh sách vào vị trí mới, đánh lại vị trí mọi danh sách", 1, 8.6, dx=115, w=190)
a.decision("g2", 1, 13.8)
a.action("phat", "Phát board:lists-changed tới phòng của bảng", 1, 14.9, w=280)
a.action("khac", "Màn hình của các thành viên khác tự tải lại danh sách và thẻ", 0, 16.1, w=210)
a.end("e", 0, 17.2)
a.flow("s", "tt")
a.flow("tt", "them", exit="left", enter="top", guard="[Thêm]", gpos=(a.X(0, -45), a.Y(1.1) - 13, "end"))
a.flow("tt", "keo", exit="right", enter="top", guard="[Đổi vị trí]", gpos=(a.X(0, 45), a.Y(1.1) - 13, "start"))
a.flow("them", "g0", exit="bottom", enter="left")
a.flow("keo", "g0", exit="bottom", enter="right")
a.flow("g0", "kt", exit="bottom", enter="left")
a.flow("kt", "cq")
a.flow("cq", "loi", exit="left", enter="right", guard="[Không]")
a.flow("loi", "e1")
a.flow("cq", "loai", guard="[Có]")
a.flow("loai", "cotr", exit="left", enter="top", guard="[Có]")
a.flow("loai", "vt", exit="right", enter="top", guard="[Không]")
a.flow("cotr", "doan", guard="[Chưa]")
a.flow("cotr", "g1", exit="left", enter="left", guard="[Rồi]", via=[(a.X(1, -228), a.Y(8.6)), (a.X(1, -228), a.Y(11.5))],
       gpos=(a.X(1, -185), a.Y(8.6) - 13, "end"))
a.flow("doan", "g1")
a.flow("g1", "tao")
a.flow("tao", "g2", exit="bottom", enter="left")
a.flow("vt", "g2", exit="bottom", enter="right")
a.flow("g2", "phat")
a.flow("phat", "khac", exit="bottom", enter="right")
a.flow("khac", "e")
OUT.append((a.key, a.svg()))

# ---------- HĐ14: Bình luận trên thẻ (UC08.23, UC08.24, UC08.25) - cardExtras.service.ts addComment, notification.service.ts ----------
a = Activity("hd14_binh_luan", ["Thành viên bảng", "Hệ thống"], [350, 480], row_h=58)
a.start("s", 0, 0)
a.decision("loai", 0, 1.1, "Trả lời?")
a.action("moi", "Viết bình luận; gõ @ để nhắc tên thành viên", 0, 2.6, dx=-80, w=145)
a.action("tl", "Bấm Trả lời dưới một bình luận, viết nội dung", 0, 2.6, dx=85, w=135)
a.decision("g0", 0, 4)
a.action("kt", "Kiểm tra quyền sửa thẻ (Người xem bảng không bình luận được)", 1, 4.8, w=290)
a.decision("cq", 1, 6.1, "Có quyền?")
a.action("loi", "Báo lỗi không có quyền", 0, 6.1, w=190)
a.end("e1", 0, 7.2)
a.decision("ptl", 1, 7.4, "Là trả lời?")
a.decision("con", 1, 8.7, "Còn tồn tại?", dx=-115)
a.action("mat", "Báo bình luận được trả lời không còn tồn tại", 0, 8.7, w=190)
a.end("e2", 0, 9.8)
a.action("goc", "Gắn vào bình luận gốc của luồng (luồng một cấp)", 1, 10, dx=-115, w=180)
a.decision("g1", 1, 11.3)
a.action("luu", "Lưu bình luận, ghi nhật ký hoạt động", 1, 12.4, w=280)
a.action("nn", "Xác định người nhận, mỗi người một thông báo theo ưu tiên: được nhắc tên, được trả lời, rồi thành viên và người theo dõi thẻ còn quyền xem bảng", 1, 13.7, w=330)
a.action("tb", "Lưu thông báo, đẩy notification:new cho người đang bật thông báo trong ứng dụng; phát board:lists-changed", 1, 15.1, w=330)
a.action("hien", "Bình luận hiện ngay trên màn hình của mọi người đang mở thẻ", 0, 16.3, w=210)
a.end("e", 0, 17.4)
a.flow("s", "loai")
a.flow("loai", "moi", exit="left", enter="top", guard="[Không]", gpos=(a.X(0, -45), a.Y(1.1) - 13, "end"))
a.flow("loai", "tl", exit="right", enter="top", guard="[Có]", gpos=(a.X(0, 45), a.Y(1.1) - 13, "start"))
a.flow("moi", "g0", exit="bottom", enter="left")
a.flow("tl", "g0", exit="bottom", enter="right")
a.flow("g0", "kt", exit="bottom", enter="left")
a.flow("kt", "cq")
a.flow("cq", "loi", exit="left", enter="right", guard="[Không]")
a.flow("loi", "e1")
a.flow("cq", "ptl", guard="[Có]")
a.flow("ptl", "con", exit="left", enter="top", guard="[Có]")
a.flow("ptl", "g1", guard="[Không]")
a.flow("con", "mat", exit="left", enter="right", guard="[Không]")
a.flow("mat", "e2")
a.flow("con", "goc", guard="[Có]")
a.flow("goc", "g1", exit="bottom", enter="left")
a.flow("g1", "luu")
a.flow("luu", "nn")
a.flow("nn", "tb")
a.flow("tb", "hien", exit="bottom", enter="right")
a.flow("hien", "e")
OUT.append((a.key, a.svg()))

# ---------- HĐ15: Tìm kiếm nâng cao (UC09.2, UC09.3) - search.service.ts searchCardsAdvanced / createSavedFilter ----------
a = Activity("hd15_tim_kiem", ["Người dùng", "Hệ thống"], [360, 470])
a.start("s", 0, 0)
a.action("mo", "Mở trang Tìm kiếm", 0, 1, w=200)
a.decision("loc", 0, 2.2, "Bộ lọc đã lưu?")
a.action("nhap", "Nhập từ khoá; chọn người phụ trách, nhãn, trạng thái, quá hạn, khoảng ngày hết hạn", 0, 3.8, dx=-90, w=150)
a.action("chon", "Chọn một bộ lọc đã lưu", 0, 3.8, dx=100, w=120)
a.decision("g0", 0, 5.3)
a.action("kt", "Kiểm tra tham số (Zod)", 1, 6.1, w=250)
a.action("pham", "Chỉ xét các bảng người dùng được xem: là chủ bảng, thành viên bảng, bảng mức Không gian làm việc trong không gian của mình, bảng Công khai", 1, 7.4, w=330)
a.action("ghep", "Ghép điều kiện (lọc quá hạn luôn kèm chưa xong); đếm tổng, lấy một trang 20 thẻ sắp theo hạn", 1, 8.9, w=330)
a.action("xem", "Xem kết quả, chuyển trang", 0, 10.2, w=200)
a.decision("luu", 0, 11.4, "Lưu bộ lọc?")
a.action("dat", "Đặt tên bộ lọc", 0, 12.7, w=150)
a.action("ghi", "Lưu bộ lọc theo tên (trùng tên thì ghi đè điều kiện)", 1, 12.7, w=280)
a.decision("g1", 0, 14)
a.action("mothe", "Mở thẻ cần xem trên bảng chứa thẻ", 0, 15.1, w=200)
a.end("e", 0, 16.2)
a.flow("s", "mo")
a.flow("mo", "loc")
a.flow("loc", "nhap", exit="left", enter="top", guard="[Không]", gpos=(a.X(0, -60), a.Y(2.2) - 13, "end"))
a.flow("loc", "chon", exit="right", enter="top", guard="[Có]", gpos=(a.X(0, 60), a.Y(2.2) - 13, "start"))
a.flow("nhap", "g0", exit="bottom", enter="left")
a.flow("chon", "g0", exit="bottom", enter="right")
a.flow("g0", "kt", exit="bottom", enter="left")
a.flow("kt", "pham")
a.flow("pham", "ghep")
a.flow("ghep", "xem", exit="bottom", enter="right")
a.flow("xem", "luu")
a.flow("luu", "dat", guard="[Có]")
a.flow("luu", "g1", exit="left", enter="left", guard="[Không]", via=[(a.X(0, -150), a.Y(11.4)), (a.X(0, -150), a.Y(14))],
       gpos=(a.X(0, -55), a.Y(11.4) - 13, "end"))
a.flow("dat", "ghi", exit="right", enter="left")
a.flow("ghi", "g1", exit="bottom", enter="right")
a.flow("g1", "mothe")
a.flow("mothe", "e")
OUT.append((a.key, a.svg()))

# ---------- HĐ16: Nhắc hạn và nhận thông báo (UC08.3, UC10.6, UC10.4, UC10.3) - cardReminder.service.ts, reminder.scheduler.ts ----------
a = Activity("hd16_nhac_han", ["Người dùng", "Hệ thống", "Bộ lập lịch nhắc hạn"], [270, 300, 300], row_h=58)
a.start("s", 0, 0)
a.action("chon", "Mở thẻ có hạn; chọn mốc nhắc 10 phút, 1 giờ hoặc 1 ngày trước hạn", 0, 1.2, w=210)
a.action("luu", "Kiểm tra quyền xem thẻ và thẻ có hạn; lưu nhắc hạn riêng của người dùng", 1, 1.2, w=250)
a.action("quet", "Mỗi phút: tìm các nhắc hạn chưa gửi đã tới mốc (thẻ chưa xong, chưa xoá, chưa lưu trữ)", 2, 2.7, w=250)
a.decision("quyen", 2, 4.1, "Còn quyền xem bảng?", w=130)
a.action("xoa", "Xoá nhắc hạn, không gửi", 1, 4.1, w=200)
a.end("e1", 1, 5.2)
a.action("gd", "Trong một giao dịch: đánh dấu đã gửi (chỉ khi hạn chưa đổi), tạo thông báo nếu bật nhận trong ứng dụng", 2, 5.6, w=250)
a.action("day", "Đẩy notification:new tới phòng user:<id>", 2, 7.0, w=250)
a.decision("email", 2, 8.2, "Bật email nhắc hạn?", w=130)
a.action("gui", "Gửi email nhắc hạn (lỗi chỉ ghi nhật ký)", 2, 9.5, dx=-30, w=200)
a.decision("g", 2, 10.7, dx=-30)
a.action("chuong", "Thấy số thông báo chưa đọc tăng; bấm vào thông báo nhắc hạn", 0, 12.1, w=210)
a.action("doc", "Đánh dấu thông báo đã đọc", 1, 12.1, w=220)
a.action("mo", "Mở đúng bảng và thẻ liên quan", 0, 13.4, w=210)
a.end("e", 0, 14.5)
a.flow("s", "chon")
a.flow("chon", "luu", exit="right", enter="left")
a.flow("luu", "quet", exit="bottom", enter="left")
a.flow("quet", "quyen")
a.flow("quyen", "xoa", exit="left", enter="right", guard="[Không]")
a.flow("xoa", "e1")
a.flow("quyen", "gd", guard="[Có]")
a.flow("gd", "day")
a.flow("day", "email")
a.flow("email", "gui", exit="bottom", enter="top", guard="[Có]", via=[(a.X(2), a.Y(8.85)), (a.X(2, -30), a.Y(8.85))])
a.flow("email", "g", exit="right", enter="right", guard="[Không]", via=[(a.X(2, 130), a.Y(8.2)), (a.X(2, 130), a.Y(10.7))])
a.flow("gui", "g")
a.flow("g", "chuong", exit="bottom", enter="top", via=[(a.X(2, -30), a.Y(11.35)), (a.X(0), a.Y(11.35))])
a.flow("chuong", "doc", exit="right", enter="left")
a.flow("doc", "mo", exit="bottom", enter="right")
a.flow("mo", "e")
OUT.append((a.key, a.svg()))

# ---------- HĐ17: Hỏi đáp với trợ lý ảo (UC13.1-UC13.5) - chat/v2: chat.v2.routes.ts, chat.v2.service.ts, chat.v2.orchestrator.ts ----------
a = Activity("hd17_tro_ly_ao", ["Người dùng", "Hệ thống", "Dịch vụ AI (Gemini)"], [240, 420, 200], row_h=58)
a.start("s", 0, 0)
a.action("mo", "Mở trợ lý ảo; phạm vi mặc định theo trang đang mở", 0, 1.1, w=190)
a.action("hoi", "Gõ câu hỏi bằng ngôn ngữ tự nhiên", 0, 2.4, w=190)
a.action("kt", "Giới hạn tần suất, mỗi người một câu tại một thời điểm; kiểm tra quyền với phạm vi", 1, 2.4, w=300)
a.decision("llm", 1, 3.8, "Đã cấu hình LLM?", w=130)
a.decision("m", 1, 5.1)
a.action("chon", "Chọn công cụ truy vấn và tham số; hoặc kết thúc, hỏi lại", 2, 5.1, w=150)
a.decision("buoc", 2, 6.5, "Gọi công cụ?")
a.action("chay", "Kiểm tra tham số (Zod), giới hạn phạm vi; chạy truy vấn chỉ đọc có kiểm tra quyền", 1, 6.5, dx=20, w=180)
a.action("coban", "Chế độ cơ bản: hiểu câu hỏi bằng luật, truy vấn tương ứng", 1, 8.0, dx=-120, w=140)
a.action("ket", "Ghép các khối kết quả có nguồn, hoặc câu hỏi làm rõ", 1, 8.0, dx=85, w=170)
a.decision("g", 1, 9.3)
a.action("luu", "Lưu lượt hỏi đáp vào lịch sử hội thoại", 1, 10.4, w=260)
a.action("xem", "Xem câu trả lời và các khối kết quả; chọn phương án nếu được hỏi lại; xem thêm trang", 0, 11.7, w=200)
a.end("e", 0, 12.9)
a.flow("s", "mo")
a.flow("mo", "hoi")
a.flow("hoi", "kt", exit="right", enter="left")
a.flow("kt", "llm")
a.flow("llm", "m", guard="[Có]")
a.flow("llm", "coban", exit="left", enter="top", guard="[Chưa]")
a.flow("m", "chon", exit="right", enter="left")
a.flow("chon", "buoc")
a.flow("buoc", "chay", exit="left", enter="right", guard="[Có]")
a.flow("chay", "m", exit="top", enter="bottom", via=[(a.X(1, 20), a.Y(5.75)), (a.X(1), a.Y(5.75))])
a.flow("buoc", "ket", exit="bottom", enter="right", guard="[Không]")
a.flow("coban", "g", exit="bottom", enter="left")
a.flow("ket", "g", exit="bottom", enter="right")
a.flow("g", "luu")
a.flow("luu", "xem", exit="bottom", enter="right")
a.flow("xem", "e")
OUT.append((a.key, a.svg()))

# ---------- TT5a: Đăng ký tài khoản - auth.routes.ts, auth.service.ts registerUser, authToken.service.ts ----------
q = Sequence("tt5a_dang_ky")
q.p("u", "Khách", "actor")
q.p("fe", "Giao diện\n(React)")
q.p("srv", "Máy chủ\n(API, AuthService)")
q.p("db", "CSDL\nPostgreSQL", "db")
q.p("mail", "Dịch vụ email\n(SMTP)")
q.msg("u", "fe", "Nhập họ tên, email, mật khẩu; bấm Đăng ký")
q.msg("fe", "srv", "POST /api/auth/register {name, email, password}")
q.self_("srv", "Giới hạn tần suất, kiểm tra dữ liệu (Zod)")
q.msg("srv", "db", "Tìm người dùng theo email")
q.ret("db", "srv", "Kết quả")
q.frag("alt", "[Email đã được sử dụng]")
q.ret("srv", "fe", "409 Email này đã được sử dụng")
q.els("[Email chưa được dùng]")
q.self_("srv", "Băm mật khẩu (bcrypt)")
q.msg("srv", "db", "Tạo User; tạo Workspace cá nhân (OWNER)")
q.ret("db", "srv", "user")
q.msg("srv", "db", "Lưu AuthToken EMAIL_VERIFY (SHA-256, hạn 24 giờ)")
q.ret("db", "srv", "Đã ghi")
q.msg("srv", "mail", "Gửi email chứa liên kết xác minh")
q.ret("mail", "srv", "Kết quả gửi (lỗi chỉ ghi nhật ký)")
q.ret("srv", "fe", "201 + Set-Cookie: token (httpOnly)")
q.msg("fe", "u", "Vào trang chủ, hiện banner nhắc xác minh", "async")
q.end()
OUT.append((q.key, q.svg()))

# ---------- TT5b: Xác minh email - auth.service.ts verifyEmail, authToken.service.ts consumeAuthToken, VerifyEmailPage.tsx ----------
q = Sequence("tt5b_xac_minh_email")
q.p("u", "Người dùng", "actor")
q.p("fe", "Giao diện\n(trang xác minh)")
q.p("srv", "Máy chủ\n(API, AuthService)")
q.p("db", "CSDL\nPostgreSQL", "db")
q.msg("u", "fe", "Mở liên kết /verify-email?token=… trong email")
q.msg("fe", "srv", "POST /api/auth/verify-email {token}")
q.self_("srv", "Băm mã nhận được (SHA-256)")
q.msg("srv", "db", "Giao dịch: đánh dấu mã đã dùng (chỉ khi chưa dùng, còn hạn); ghi emailVerifiedAt")
q.ret("db", "srv", "Kết quả")
q.frag("alt", "[Mã sai, đã dùng hoặc hết hạn]")
q.ret("srv", "fe", "400 Liên kết không hợp lệ hoặc đã hết hạn")
q.msg("fe", "u", "Báo lỗi; có thể gửi lại email từ banner", "async")
q.els("[Hợp lệ]")
q.ret("srv", "fe", "200 {user}")
q.msg("fe", "u", "Báo xác minh thành công, ẩn banner nhắc", "async")
q.end()
OUT.append((q.key, q.svg()))

# ---------- TT6: Quên và đặt lại mật khẩu - auth.service.ts requestPasswordReset / resetPassword ----------
q = Sequence("tt6_quen_mat_khau")
q.p("u", "Khách", "actor")
q.p("fe", "Giao diện\n(React)")
q.p("srv", "Máy chủ (API,\nAuthService, Socket.IO)")
q.p("db", "CSDL\nPostgreSQL", "db")
q.p("mail", "Dịch vụ email\n(SMTP)")
q.msg("u", "fe", "Nhập email, bấm Gửi liên kết")
q.msg("fe", "srv", "POST /api/auth/forgot-password {email}")
q.msg("srv", "db", "Tìm người dùng theo email")
q.ret("db", "srv", "Kết quả")
q.frag("opt", "[Email có tài khoản]")
q.msg("srv", "db", "Lưu AuthToken PASSWORD_RESET (SHA-256, hạn 1 giờ)")
q.ret("db", "srv", "Đã ghi")
q.msg("srv", "mail", "Gửi email chứa liên kết /reset-password?token=…")
q.ret("mail", "srv", "Kết quả gửi")
q.end()
q.ret("srv", "fe", "200 Cùng một thông báo cho mọi trường hợp")
q.msg("u", "fe", "Mở liên kết, nhập mật khẩu mới")
q.msg("fe", "srv", "POST /api/auth/reset-password {token, newPassword}")
q.self_("srv", "Băm mật khẩu mới (bcrypt)")
q.msg("srv", "db", "Giao dịch: đánh dấu mã đã dùng; đổi mật khẩu, emailVerifiedAt, tokenVersion + 1")
q.ret("db", "srv", "Kết quả")
q.frag("alt", "[Mã sai, đã dùng hoặc hết hạn]")
q.ret("srv", "fe", "400 (giao dịch được hoàn tác)")
q.els("[Hợp lệ]")
q.self_("srv", "Ngắt mọi kết nối Socket.IO của tài khoản")
q.ret("srv", "fe", "200")
q.msg("fe", "u", "Báo thành công, mời đăng nhập lại", "async")
q.end()
OUT.append((q.key, q.svg()))

# ---------- TT7: Xem bảng công khai - publicBoard.routes.ts, publicBoard.service.ts, PublicBoardPage.tsx ----------
q = Sequence("tt7_xem_bang_cong_khai")
q.p("u", "Khách", "actor")
q.p("fe", "Giao diện\n(trang công khai)")
q.p("srv", "Máy chủ (API,\nPublicBoardService)")
q.p("db", "CSDL\nPostgreSQL", "db")
q.msg("u", "fe", "Mở /public/boards/:boardId")
q.msg("fe", "srv", "GET /api/public/boards/:boardId và …/lists (song song)")
q.self_("srv", "Giới hạn tần suất (không cần đăng nhập)")
q.msg("srv", "db", "Tìm bảng PUBLIC, chưa xoá, chưa lưu trữ")
q.ret("db", "srv", "Bảng")
q.frag("alt", "[Không tìm thấy]")
q.ret("srv", "fe", "404")
q.msg("fe", "u", "Báo không tìm thấy, gợi ý đăng nhập", "async")
q.els("[Bảng công khai]")
q.msg("srv", "db", "Đọc danh sách và thẻ đang hoạt động (người dùng: id, tên, ảnh)")
q.ret("db", "srv", "Danh sách, thẻ")
q.ret("srv", "fe", "200 {board}, 200 {lists}")
q.msg("fe", "u", "Hiển thị bảng chỉ đọc", "async")
q.end()
q.frag("opt", "[Khách mở một thẻ]")
q.msg("u", "fe", "Bấm vào thẻ")
q.msg("fe", "srv", "GET /api/public/cards/:cardId")
q.msg("srv", "db", "Kiểm tra thẻ, danh sách còn hoạt động và bảng vẫn PUBLIC; đọc chi tiết")
q.ret("db", "srv", "Chi tiết thẻ")
q.ret("srv", "fe", "200 (bình luận đã xoá chỉ hiện là đã xoá)")
q.msg("fe", "u", "Hiển thị chi tiết thẻ chỉ đọc", "async")
q.end()
OUT.append((q.key, q.svg()))

# ---------- TT8: Đổi mật khẩu - auth.controller.ts changePassword, auth.service.ts changeUserPassword ----------
q = Sequence("tt8_doi_mat_khau")
q.p("u", "Người dùng", "actor")
q.p("fe", "Giao diện\n(React)")
q.p("srv", "Máy chủ (API,\nAuthService, Socket.IO)")
q.p("db", "CSDL\nPostgreSQL", "db")
q.p("kh", "Phiên trên\nthiết bị khác")
q.msg("u", "fe", "Nhập mật khẩu hiện tại và mật khẩu mới")
q.msg("fe", "srv", "PATCH /api/auth/password {currentPassword, newPassword}")
q.self_("srv", "requireAuth: xác minh JWT, tokenVersion; kiểm tra dữ liệu")
q.msg("srv", "db", "Đọc User (passwordHash)")
q.ret("db", "srv", "User")
q.frag("alt", "[Chưa có mật khẩu (tài khoản Google) hoặc sai mật khẩu hiện tại]")
q.ret("srv", "fe", "400 kèm lý do")
q.els("[Đúng mật khẩu hiện tại]")
q.msg("srv", "db", "Cập nhật passwordHash mới, tokenVersion + 1")
q.ret("db", "srv", "tokenVersion mới")
q.async_("srv", "kh", "Ngắt kết nối Socket.IO (mọi thiết bị của tài khoản)")
q.self_("srv", "Ký JWT mới theo tokenVersion mới")
q.ret("srv", "fe", "200 + Set-Cookie: token mới")
q.self_("fe", "Kết nối lại Socket.IO bằng cookie mới")
q.msg("fe", "u", "Báo đổi mật khẩu thành công", "async")
q.end()
q.msg("kh", "srv", "Yêu cầu API kế tiếp (cookie chứa JWT cũ)")
q.msg("srv", "db", "Đọc tokenVersion hiện tại")
q.ret("db", "srv", "tokenVersion đã tăng")
q.ret("srv", "kh", "401 Vui lòng đăng nhập lại")
OUT.append((q.key, q.svg()))

# ---------- TT9: Tạo không gian và thêm thành viên - workspace.service.ts createWorkspace, workspaceMember.service.ts addWorkspaceMember ----------
q = Sequence("tt9_khong_gian")
q.p("u", "Quản trị viên\nkhông gian", "actor")
q.p("fe", "Giao diện\n(React)")
q.p("srv", "Máy chủ (API,\nWorkspaceService)")
q.p("db", "CSDL\nPostgreSQL", "db")
q.p("mail", "Dịch vụ email\n(SMTP)")
q.p("nb", "Giao diện của\nngười được thêm")
q.msg("u", "fe", "Tạo không gian, nhập tên")
q.msg("fe", "srv", "POST /api/workspaces {name}")
q.msg("srv", "db", "Tạo Workspace + WorkspaceMember (OWNER)")
q.ret("db", "srv", "workspace")
q.ret("srv", "fe", "201 {workspace}")
q.msg("u", "fe", "Nhập email, chọn vai trò, bấm Thêm")
q.msg("fe", "srv", "POST /api/workspaces/:id/members {email, role}")
q.msg("srv", "db", "Kiểm tra người gọi là OWNER/ADMIN; tìm User theo email")
q.ret("db", "srv", "Kết quả")
q.frag("alt", "[Chưa có tài khoản hoặc chưa xác minh email]")
q.msg("srv", "mail", "Gửi email mời đăng ký")
q.ret("mail", "srv", "Đã gửi")
q.ret("srv", "fe", "200 {invitedEmail}")
q.els("[Đã có tài khoản đã xác minh]")
q.msg("srv", "db", "Tạo hoặc khôi phục WorkspaceMember; tạo Notification")
q.ret("db", "srv", "member")
q.async_("srv", "nb", "notification:new, workspace:changed (phòng user:<id>)")
q.ret("srv", "fe", "201 {member}")
q.end()
q.msg("fe", "u", "Cập nhật danh sách thành viên hoặc báo đã gửi lời mời", "async")
OUT.append((q.key, q.svg()))

# ---------- TT10: Tạo bảng - CreateBoardDialog.tsx, unsplash.service.ts, board.service.ts createBoard ----------
q = Sequence("tt10_tao_bang")
q.p("u", "Người dùng", "actor")
q.p("fe", "Giao diện\n(hộp thoại tạo bảng)")
q.p("srv", "Máy chủ (API,\nBoardService)")
q.p("db", "CSDL\nPostgreSQL", "db")
q.p("us", "Unsplash API")
q.msg("u", "fe", "Mở hộp thoại tạo bảng")
q.msg("fe", "srv", "GET /api/unsplash?query=&page=1")
q.msg("srv", "us", "Tìm ảnh (khoá API giữ ở máy chủ)")
q.ret("us", "srv", "Danh sách ảnh")
q.ret("srv", "fe", "200 Ảnh nền gợi ý")
q.msg("u", "fe", "Nhập tên, chọn không gian và nền")
q.msg("fe", "srv", "POST /api/boards {name, workspaceId, color | backgroundImage}")
q.msg("srv", "db", "Kiểm tra người gọi là thành viên không gian")
q.ret("db", "srv", "Kết quả")
q.frag("alt", "[Không phải thành viên]")
q.ret("srv", "fe", "403")
q.els("[Hợp lệ]")
q.msg("srv", "db", "Tạo Board (PRIVATE) và BoardMember (OWNER)")
q.ret("db", "srv", "board")
q.ret("srv", "fe", "201 {board}")
q.frag("opt", "[Nền là ảnh Unsplash]")
q.async_("fe", "srv", "POST /api/unsplash/track-download")
q.async_("srv", "us", "Báo lượt dùng ảnh")
q.end()
q.msg("fe", "u", "Mở bảng vừa tạo", "async")
q.end()
OUT.append((q.key, q.svg()))

# ---------- TT11: Thiết lập và thực thi luật tự động - automation.service.ts, card.service.ts createCard ----------
q = Sequence("tt11_luat_tu_dong")
q.p("u", "Thành viên bảng", "actor")
q.p("fe", "Giao diện\n(React)")
q.p("srv", "Máy chủ (API, Card-\nvà AutomationService)")
q.p("db", "CSDL\nPostgreSQL", "db")
q.msg("u", "fe", "Tạo luật: điều kiện, danh sách, hành động")
q.msg("fe", "srv", "POST /api/boards/:boardId/automation-rules")
q.self_("srv", "Kiểm tra dữ liệu (Zod): 1–5 hành động")
q.msg("srv", "db", "Kiểm tra quyền sửa bảng; danh sách, nhãn, thành viên thuộc bảng")
q.ret("db", "srv", "Hợp lệ")
q.msg("srv", "db", "Lưu AutomationRule và các AutomationAction")
q.ret("db", "srv", "rule")
q.ret("srv", "fe", "201 {rule}")
q.msg("u", "fe", "Thêm thẻ vào danh sách")
q.msg("fe", "srv", "POST /api/lists/:listId/cards {title}")
q.msg("srv", "db", "Kiểm tra quyền; tạo Card; ghi Activity")
q.ret("db", "srv", "card")
q.msg("srv", "db", "Tìm luật đang bật khớp CARD_CREATED và danh sách")
q.ret("db", "srv", "Các luật")
q.frag("loop", "[Mỗi luật, mỗi hành động]")
q.msg("srv", "db", "Đánh dấu xong / gắn nhãn / giao thành viên (+ Notification)")
q.ret("db", "srv", "Đã ghi (lỗi chỉ ghi nhật ký)")
q.end()
q.self_("srv", "Phát board:lists-changed")
q.ret("srv", "fe", "201 {card} (đọc lại sau khi luật chạy)")
q.msg("fe", "u", "Hiển thị thẻ đã áp dụng luật", "async")
OUT.append((q.key, q.svg()))

# ---------- TT12: Tham gia bảng bằng liên kết mời - board.routes.ts, boardShare.service.ts ----------
q = Sequence("tt12_tham_gia_bang")
q.p("u", "Người dùng", "actor")
q.p("fe", "Giao diện\nngười dùng")
q.p("srv", "Máy chủ (API,\nBoardShareService)")
q.p("db", "CSDL\nPostgreSQL", "db")
q.p("fq", "Giao diện quản\ntrị viên bảng")
q.p("qt", "Quản trị viên\nbảng", "actor")
q.msg("u", "fe", "Mở liên kết /join/:token")
q.msg("fe", "srv", "GET /api/boards/join/:token")
q.msg("srv", "db", "Tìm bảng theo mã mời; tìm thành viên, yêu cầu đang chờ")
q.ret("db", "srv", "Kết quả")
q.ret("srv", "fe", "200 {board, status} hoặc 404")
q.msg("u", "fe", "Bấm Gửi yêu cầu tham gia")
q.msg("fe", "srv", "POST /api/boards/join/:token")
q.msg("srv", "db", "Lưu BoardJoinRequest (PENDING); Notification cho quản trị viên")
q.ret("db", "srv", "Đã ghi")
q.async_("srv", "fq", "notification:new; board:join-requests-changed")
q.ret("srv", "fe", "200")
q.msg("qt", "fq", "Mở yêu cầu tham gia, bấm Chấp nhận")
q.msg("fq", "srv", "POST …/join-requests/:requestId/approve")
q.msg("srv", "db", "Kiểm tra quyền quản lý bảng; giao dịch: APPROVED + BoardMember (MEMBER)")
q.ret("db", "srv", "member")
q.async_("srv", "fe", "notification:new (đã được duyệt)")
q.async_("srv", "fq", "board:members-changed")
q.ret("srv", "fq", "200 {member}")
q.msg("fe", "u", "Thông báo được duyệt, mở bảng", "async")
OUT.append((q.key, q.svg()))

# ---------- TT13: Thêm và sắp xếp danh sách - list.service.ts createList / updateList, useBoardDnd.ts ----------
q = Sequence("tt13_danh_sach")
q.p("u", "Thành viên A", "actor")
q.p("fe", "Giao diện\ncủa A")
q.p("srv", "Máy chủ (API,\nListService, Socket.IO)")
q.p("db", "CSDL\nPostgreSQL", "db")
q.p("fb", "Giao diện\ncủa B")
q.msg("u", "fe", "Nhập tên danh sách mới")
q.msg("fe", "srv", "POST /api/boards/:boardId/lists {name, status?}")
q.msg("srv", "db", "Kiểm tra quyền sửa bảng; đọc vị trí cuối")
q.ret("db", "srv", "Kết quả")
q.frag("opt", "[Không gửi trạng thái]")
q.self_("srv", "Đoán trạng thái theo tên danh sách")
q.end()
q.msg("srv", "db", "Tạo List (vị trí cuối, trạng thái)")
q.ret("db", "srv", "list")
q.async_("srv", "fb", "board:lists-changed")
q.ret("srv", "fe", "201 {list}")
q.msg("u", "fe", "Kéo danh sách sang vị trí mới")
q.self_("fe", "Đổi tạm thứ tự trên màn hình")
q.msg("fe", "srv", "PATCH /api/lists/:listId {position}")
q.msg("srv", "db", "Giao dịch: đánh lại vị trí mọi danh sách của bảng")
q.ret("db", "srv", "Đã ghi")
q.async_("srv", "fb", "board:lists-changed")
q.ret("srv", "fe", "200")
q.self_("fb", "Chờ 400 ms rồi tải lại danh sách và thẻ")
OUT.append((q.key, q.svg()))

# ---------- TT14: Bình luận trên thẻ - cardExtras.service.ts addComment, notification.service.ts notify / cardMemberIds ----------
q = Sequence("tt14_binh_luan")
q.p("u", "Thành viên A", "actor")
q.p("fe", "Giao diện\ncủa A")
q.p("srv", "Máy chủ (API, Card-\nExtrasService, Socket.IO)")
q.p("db", "CSDL\nPostgreSQL", "db")
q.p("fb", "Giao diện của\nngười nhận")
q.msg("u", "fe", "Viết bình luận (có @tên) hoặc trả lời")
q.msg("fe", "srv", "POST /api/cards/:cardId/comments {text, parentId?}")
q.msg("srv", "db", "Kiểm tra quyền sửa thẻ")
q.ret("db", "srv", "Thẻ")
q.frag("opt", "[Có parentId]")
q.msg("srv", "db", "Tìm bình luận được trả lời (cùng thẻ, chưa xoá)")
q.ret("db", "srv", "Bình luận gốc của luồng")
q.end()
q.msg("srv", "db", "Lưu Comment (parentId = gốc); ghi Activity")
q.ret("db", "srv", "comment")
q.msg("srv", "db", "Đọc người được nhắc tên, thành viên và người theo dõi thẻ")
q.ret("db", "srv", "Người nhận")
q.self_("srv", "Mỗi người một thông báo: nhắc tên > trả lời > bình luận mới")
q.msg("srv", "db", "Lưu Notification")
q.ret("db", "srv", "Đã ghi")
q.async_("srv", "fb", "notification:new (phòng user:<id>)")
q.async_("srv", "fb", "board:lists-changed (phòng board:<id>)")
q.ret("srv", "fe", "201 {comment}")
q.msg("fe", "u", "Hiển thị bình luận trong luồng", "async")
OUT.append((q.key, q.svg()))

# ---------- TT15: Tìm kiếm nâng cao - search.routes.ts, search.service.ts searchCardsAdvanced / createSavedFilter ----------
q = Sequence("tt15_tim_kiem")
q.p("u", "Người dùng", "actor")
q.p("fe", "Giao diện\n(trang tìm kiếm)")
q.p("srv", "Máy chủ\n(API, SearchService)")
q.p("db", "CSDL\nPostgreSQL", "db")
q.msg("u", "fe", "Nhập từ khoá, chọn điều kiện lọc")
q.msg("fe", "srv", "GET /api/search/cards?q=…&statuses=…&page=1")
q.self_("srv", "Kiểm tra tham số (Zod)")
q.msg("srv", "db", "Đọc các không gian người dùng là thành viên")
q.ret("db", "srv", "workspaceIds")
q.self_("srv", "Ghép điều kiện: bảng được xem + bộ lọc")
q.msg("srv", "db", "Đếm tổng và lấy 20 thẻ (chạy song song)")
q.ret("db", "srv", "total, items")
q.ret("srv", "fe", "200 {items, total, hasMore}")
q.msg("fe", "u", "Hiển thị kết quả, phân trang", "async")
q.frag("opt", "[Lưu bộ lọc]")
q.msg("u", "fe", "Đặt tên, bấm Lưu bộ lọc")
q.msg("fe", "srv", "POST /api/search/filters {name, params}")
q.msg("srv", "db", "Upsert SavedFilter theo (userId, name)")
q.ret("db", "srv", "filter")
q.ret("srv", "fe", "201 {filter}")
q.end()
OUT.append((q.key, q.svg()))

# ---------- TT16: Nhắc hạn và nhận thông báo - cardReminder.service.ts, reminder.scheduler.ts, NotificationBell.tsx ----------
q = Sequence("tt16_nhac_han")
q.p("u", "Người dùng", "actor")
q.p("fe", "Giao diện\n(React)")
q.p("srv", "Máy chủ\n(API)")
q.p("sch", "Bộ lập lịch\nnhắc hạn")
q.p("db", "CSDL\nPostgreSQL", "db")
q.p("mail", "Dịch vụ email\n(SMTP)")
q.msg("u", "fe", "Chọn mốc nhắc trước hạn")
q.msg("fe", "srv", "POST /api/cards/:cardId/reminders {offsetMinutes}")
q.msg("srv", "db", "Kiểm tra quyền xem thẻ, thẻ có hạn; lưu CardReminder")
q.ret("db", "srv", "Đã ghi")
q.ret("srv", "fe", "201")
q.frag("loop", "[Mỗi 60 giây, với mỗi nhắc hạn đã tới mốc]")
q.msg("sch", "db", "Tìm CardReminder chưa gửi đã tới mốc")
q.ret("db", "sch", "Danh sách nhắc hạn")
q.msg("sch", "db", "Kiểm tra quyền xem bảng; đọc tuỳ chọn thông báo")
q.ret("db", "sch", "Kết quả")
q.msg("sch", "db", "Giao dịch: đánh dấu sentAt (chỉ khi hạn chưa đổi) + tạo Notification")
q.ret("db", "sch", "Đã ghi")
q.async_("sch", "fe", "notification:new (Socket.IO, phòng user:<id>)")
q.frag("opt", "[Bật email nhắc hạn]")
q.msg("sch", "mail", "Gửi email nhắc hạn")
q.ret("mail", "sch", "Kết quả gửi")
q.end()
q.end()
q.msg("fe", "srv", "GET /api/notifications/unread-count")
q.ret("srv", "fe", "200 {count}")
q.msg("u", "fe", "Bấm vào thông báo nhắc hạn")
q.msg("fe", "srv", "POST /api/notifications/:id/read")
q.msg("srv", "db", "Đánh dấu đã đọc")
q.ret("db", "srv", "Đã ghi")
q.ret("srv", "fe", "200")
q.msg("fe", "u", "Mở bảng và thẻ liên quan", "async")
OUT.append((q.key, q.svg()))

# ---------- TT17: Hỏi đáp với trợ lý ảo - chat.v2.routes.ts, chat.v2.service.ts, chat.v2.orchestrator.ts, chat.v2.history.ts ----------
q = Sequence("tt17_tro_ly_ao")
q.p("u", "Người dùng", "actor")
q.p("fe", "Giao diện\n(trợ lý ảo)")
q.p("srv", "Máy chủ (API,\nChatService v2)")
q.p("llm", "Gemini API")
q.p("db", "CSDL\nPostgreSQL", "db")
q.msg("u", "fe", "Gõ câu hỏi")
q.msg("fe", "srv", "POST /api/chat/v2/messages {message, scope, conversationId}")
q.self_("srv", "Giới hạn tần suất; mỗi người một câu; kiểm tra quyền với phạm vi")
q.frag("alt", "[Đã cấu hình LLM]")
q.frag("loop", "[Tối đa 4 vòng, 8 lần gọi công cụ, 30 giây]")
q.msg("srv", "llm", "Câu hỏi, phạm vi, danh sách công cụ, kết quả trước")
q.ret("llm", "srv", "Lời gọi công cụ, hoặc finish / clarify")
q.self_("srv", "Kiểm tra tham số (Zod), giới hạn phạm vi")
q.msg("srv", "db", "Truy vấn chỉ đọc (thẻ, thống kê, nhật ký, danh mục) có kiểm tra quyền")
q.ret("db", "srv", "Kết quả")
q.end()
q.els("[Chưa cấu hình hoặc AI lỗi]")
q.self_("srv", "Chế độ cơ bản: hiểu câu hỏi bằng luật, truy vấn tương ứng")
q.end()
q.msg("srv", "db", "Lưu lượt hỏi đáp (ChatConversation, ChatTurn)")
q.ret("db", "srv", "Đã ghi")
q.ret("srv", "fe", "200 {answer: text, blocks, clarify?}")
q.msg("fe", "u", "Hiển thị câu trả lời và các khối kết quả", "async")
OUT.append((q.key, q.svg()))

# ---------- KT: Kiến trúc tổng thể (bản hẹp để in khổ A4) ----------
b = Board2D("kt_kien_truc", 775, 770)
b.group(20, 20, 720, 140, "Trình duyệt người dùng")
b.box("spa", 40, 48, 680, 98, "Ứng dụng trang đơn (SPA): React 19, TypeScript, Vite, Tailwind CSS", [
    "Trang và thành phần giao diện: bảng Kanban (kéo-thả @dnd-kit), chi tiết thẻ, lịch, tìm kiếm, hồ sơ, hộp thoại AI, trợ lý ảo",
    "Context: AuthContext, BoardsContext, WorkspacesContext, AssistantContext, ThemeContext",
    "Lớp gọi API (Axios, gửi kèm cookie) và kết nối Socket.IO dùng chung (singleton)",
])
b.group(20, 220, 720, 330, "Máy chủ ứng dụng: Node.js, Express, TypeScript (chạy trong Docker)")
b.box("mw", 40, 250, 680, 48, "Middleware: CORS, đọc cookie, requireAuth (JWT + tokenVersion), kiểm tra dữ liệu (Zod), giới hạn tần suất, kiểm soát tệp tải lên", bold=False)
b.box("route", 40, 312, 170, 64, "Router + Controller (REST /api/...)")
b.box("svc", 230, 312, 490, 64, "Tầng nghiệp vụ (service): kiểm tra quyền (assertBoardView / Access / Manage / Owner) trước mọi thao tác")
b.box("mods", 40, 390, 430, 146, "Các module nghiệp vụ", [
    "auth, workspace, board (thành viên, chia sẻ, công khai), list, card, label,",
    "customField, automation, search, activity, notification, watch, unsplash",
    "ai: sinh bảng (tầng luật + LLM + BoardPlan)",
    "assign, declaredProfile: gợi ý phân công",
    "chat: trợ lý ảo",
], fill="#FFFFFF")
b.box("rt", 490, 390, 230, 66, "Realtime hub Socket.IO (phòng user:*, board:*)")
b.box("sch", 490, 470, 230, 66, "Bộ lập lịch: nhắc hạn, thẻ định kỳ, email tổng hợp")
b.group(20, 600, 350, 150, "Lưu trữ")
b.box("pg", 40, 628, 310, 52, "PostgreSQL 16 (Docker), truy cập qua Prisma ORM")
b.box("fs", 40, 690, 310, 46, "Thư mục tệp tải lên (ảnh nền, ảnh đại diện, đính kèm, CV)", bold=False)
b.group(390, 600, 350, 150, "Dịch vụ bên ngoài", fill="#FFFDF5")
b.boxes["ext"] = (390, 600, 350, 150)
b.box("gem", 410, 630, 150, 50, "Gemini API (LLM)")
b.box("smtp", 570, 630, 150, 50, "Máy chủ SMTP (Nodemailer)")
b.box("ggl", 410, 688, 150, 50, "Google Identity (đăng nhập)")
b.box("uns", 570, 688, 150, 50, "Unsplash API (ảnh nền)")
b.link("spa", "bottom", "mw", "top", ta=0.4, tb=0.4, label="HTTPS: REST/JSON,\ncookie httpOnly chứa JWT", lpos=(312, 190), both=True)
b.link("spa", "bottom", "rt", "right", ta=0.9, tb=0.5, via=[(652, 190), (756, 190), (756, 423)], label="WebSocket\n(Socket.IO)",
       lpos=(652, 190), both=True)
b.link("mw", "bottom", "route", "top", ta=0.125, tb=0.5)
b.link("route", "right", "svc", "left")
b.link("svc", "bottom", "mods", "top", ta=0.31, tb=0.795)
b.link("mods", "right", "rt", "left", ta=0.226, tb=0.5)
b.link("sch", "left", "mods", "right", ta=0.5, tb=0.77)
b.link("mods", "bottom", "pg", "top", ta=0.4, tb=0.555, label="Prisma Client", lpos=(272, 574))
b.link("mods", "bottom", "fs", "right", ta=0.85, tb=0.5, via=[(405.5, 713)])
b.link("svc", "right", "ext", "top", ta=0.5, tb=0.5, via=[(745, 344), (745, 575), (565, 575)])
OUT.append((b.key, b.svg()))

# ---------- ERD1a: người dùng, không gian làm việc và bảng (schema.prisma) ----------
e = Board2D("erd1a_nguoi_dung_bang", 720, 640)
e.entity("user", 20, 170, "User", ["PK id", "email (duy nhất)", "passwordHash", "name", "avatarUrl", "googleId", "emailVerifiedAt",
                                     "tokenVersion", "deletedAt"])
e.entity("wm", 260, 20, "WorkspaceMember", ["PK id", "FK workspaceId", "FK userId", "role", "deletedAt"])
e.entity("bm", 260, 170, "BoardMember", ["PK id", "FK boardId", "FK userId", "role", "deletedAt"])
e.entity("jr", 260, 330, "BoardJoinRequest", ["PK id", "FK boardId", "FK userId", "status"])
e.entity("noti", 260, 470, "Notification", ["PK id", "FK userId", "FK actorId", "type", "boardId, cardId", "isRead"])
e.entity("ws", 500, 20, "Workspace", ["PK id", "FK ownerId", "name", "isPersonal", "deletedAt"])
e.entity("board", 500, 170, "Board", ["PK id", "FK ownerId", "FK workspaceId", "name", "visibility", "inviteToken", "archivedAt",
                                       "deletedAt"])
C = ("1", "n")
e.link("user", "top", "wm", "left", ta=0.2, tb=0.5, arrow=None, card=C)
e.link("user", "right", "bm", "left", ta=0.162, tb=0.256, arrow=None, card=C)
e.link("user", "right", "jr", "left", ta=0.919, tb=0.1, arrow=None, card=C)
e.link("user", "bottom", "noti", "left", ta=0.5, tb=0.5, arrow=None, card=C)
e.link("ws", "left", "wm", "right", arrow=None, card=C)
e.link("ws", "bottom", "board", "top", arrow=None, card=C)
e.link("board", "left", "bm", "right", ta=0.476, tb=0.684, arrow=None, card=C)
e.link("board", "bottom", "jr", "right", ta=0.3, tb=0.5, arrow=None, card=C)
e.note(20, 625, "Workspace.ownerId, Board.ownerId và Notification.actorId cũng là khoá ngoại tới User (lược đường nối).")
OUT.append((e.key, e.svg()))

# ---------- ERD1b: danh sách, thẻ và nội dung của thẻ (schema.prisma) ----------
e = Board2D("erd1b_the_cong_viec", 720, 775)
e.entity("board", 20, 20, "Board", ["PK id", "FK workspaceId"], ref=True)
e.entity("label", 260, 20, "Label", ["PK id", "FK boardId", "name", "color"])
e.entity("cl", 500, 20, "CardLabel", ["PK,FK cardId", "PK,FK labelId"])
e.entity("list", 20, 160, "List", ["PK id", "FK boardId", "name", "position", "status", "archivedAt"])
e.entity("card", 260, 160, "Card", ["PK id", "FK listId", "title", "description", "status", "isDone", "completedAt",
                                     "startDate, dueDate", "position", "archivedAt"])
e.entity("cm", 500, 150, "CardMember", ["PK id", "FK cardId", "FK userId", "FK assignedById", "createdAt"])
e.entity("user", 500, 310, "User", ["PK id", "name"], ref=True)
e.entity("chk", 500, 430, "Checklist", ["PK id", "FK cardId", "title", "position"])
e.entity("item", 500, 575, "ChecklistItem", ["PK id", "FK checklistId", "content", "isDone", "FK assigneeId", "dueDate"])
e.entity("act", 20, 380, "Activity", ["PK id", "FK boardId", "FK cardId", "FK userId", "type", "data (JSON)", "createdAt"])
e.entity("cmt", 20, 580, "Comment", ["PK id", "FK cardId", "FK userId", "FK parentId", "text", "deletedAt"])
e.entity("att", 260, 420, "Attachment", ["PK id", "FK cardId", "FK uploaderId", "name, url", "mime, size"])
C = ("1", "n")
e.link("board", "right", "label", "left", ta=0.5, tb=0.33, arrow=None, card=C)
e.link("label", "right", "cl", "left", ta=0.33, tb=0.5, arrow=None, card=C)
e.link("cl", "bottom", "card", "top", ta=0.1, tb=0.9, via=[(520, 120), (440, 120)], arrow=None, card=C)
e.link("board", "bottom", "list", "top", arrow=None, card=C)
e.link("board", "left", "act", "left", ta=0.5, tb=0.497, via=[(8, 53), (8, 455)], arrow=None, card=C)
e.link("list", "right", "card", "left", ta=0.299, tb=0.198, arrow=None, card=C)
e.link("card", "right", "cm", "left", ta=0.248, tb=0.513, arrow=None, card=C)
e.link("user", "top", "cm", "bottom", arrow=None, card=C)
e.link("card", "left", "act", "top", ta=0.92, tb=0.5, arrow=None, card=C)
e.link("card", "bottom", "att", "top", ta=0.5, tb=0.5, arrow=None, card=C)
e.link("card", "left", "cmt", "right", ta=0.97, tb=0.448, via=[(240, 355.94), (240, 640)], arrow=None, card=C)
e.link("cmt", "right", "cmt", "bottom", ta=0.7, tb=0.5, via=[(232, 673.8), (232, 735), (120, 735)], arrow=None, card=C)
e.link("card", "right", "chk", "left", ta=0.9, tb=0.4, via=[(480, 341.8), (480, 470)], arrow=None, card=C)
e.link("chk", "bottom", "item", "top", arrow=None, card=C)
e.note(20, 762, "Activity.userId, Comment.userId, Attachment.uploaderId, ChecklistItem.assigneeId cũng tham chiếu User (lược đường nối).")
OUT.append((e.key, e.svg()))

# ---------- ERD2: dữ liệu của module AI và gợi ý phân công (schema.prisma) ----------
e = Board2D("erd2_ai_phan_cong", 760, 870)
e.entity("user", 20, 60, "User", ["PK id", "name", "email"], w=180, ref=True)
e.entity("ws", 20, 330, "Workspace", ["PK id", "name"], w=180, ref=True)
e.entity("board", 20, 560, "Board", ["PK id", "FK workspaceId"], w=180, ref=True)
e.entity("card", 20, 700, "Card", ["PK id", "FK listId", "title, description", "dueDate, completedAt"], w=180, ref=True)
e.entity("uap", 240, 20, "UserAssignProfile", ["PK,FK userId", "useForAssign", "skillsText", "workItems (JSON)", "cvText",
                                               "cvFileName, cvStoredName"], w=230)
e.entity("mwp", 240, 200, "MemberWorkProfile", ["PK id", "FK userId", "FK workspaceId", "maxParallelCards", "pausedUntil"], w=230)
e.entity("waw", 240, 360, "WorkspaceAssignWeights", ["PK,FK workspaceId", "wExperience", "wReliability", "wAvailability",
                                                     "wDeclared", "feedbackCount"], w=230)
e.entity("awh", 510, 360, "AssignWeightHistory", ["PK id", "FK workspaceId", "4 trọng số", "feedbackCount", "runId", "createdAt"], w=230)
e.entity("ar", 240, 560, "AssignRun", ["PK id", "FK workspaceId", "FK boardId", "FK cardId", "algorithmVersion", "weights (JSON)",
                                        "candidates (JSON)", "topUserId, chosenUserId", "accepted, learned", "decidedAt, latencyMs"], w=230)
e.entity("ai", 510, 20, "AiRun", ["PK id", "FK userId", "FK workspaceId", "FK boardId", "inputKind, inputText", "mode, llmUsed",
                                   "provider, model, latencyMs", "llmFailReason", "plan, appliedPlan (JSON)", "cardCount, warnings",
                                   "accepted, editCount, appliedAt"], w=230)
C = ("1", "n")
e.link("user", "right", "uap", "left", ta=0.25, tb=0.453, arrow=None, card=("1", "0..1"))
e.link("user", "right", "mwp", "left", ta=0.75, tb=0.256, via=[(218, 122.25), (218, 230)], arrow=None, card=C)
e.link("user", "top", "ai", "top", ta=0.5, tb=0.5, via=[(110, 8), (625, 8)], arrow=None, card=C)
e.link("ws", "right", "mwp", "left", ta=0.3, tb=0.769, via=[(226, 349.8), (226, 290)], arrow=None, card=C)
e.link("ws", "right", "waw", "left", ta=0.75, tb=0.1455, arrow=None, card=("1", "0..1"))
e.link("ws", "right", "ar", "left", ta=0.95, tb=0.099, via=[(232, 392.7), (232, 580)], arrow=None, card=C)
e.link("waw", "right", "awh", "left", arrow=None, card=C)
e.link("board", "right", "ar", "left", ta=0.909, tb=0.297, arrow=None, card=C)
e.link("card", "right", "ar", "left", ta=0.5, tb=0.94, arrow=None, card=C)
e.note(20, 830, "AiRun còn tham chiếu Workspace và Board (FK workspaceId, boardId) nhưng lược đường nối để sơ đồ dễ đọc.\n"
                "AiRun và AssignRun vừa phục vụ chức năng, vừa là nhật ký thực nghiệm cho Chương 6.")
OUT.append((e.key, e.svg()))

# ---------- H1.1 (chương 1): vị trí của hai cơ chế hỗ trợ quyết định trong TaskFlow ----------
# Nhánh cơ chế 2 theo mã thật: assign.score.ts (chấm từng thành phần), assign.plan.ts (chia việc theo đợt),
# assign.learn.ts (học trọng số từ lựa chọn) - không có bước "xếp hạng lại theo tải".
YEL = "#FFF6D9"
b = Board2D("h11_vi_tri_hai_co_che", 920, 540)
b.group(20, 20, 880, 140, "Cơ chế 1: Sinh bảng từ mô tả dự án", fill="#F3F7FC")
b.box("mota", 40, 52, 130, 86, "Mô tả dự án tiếng Việt")
b.box("luat", 195, 52, 290, 38, "Tầng luật: thời gian, lập lịch, bất biến", bold=False)
b.box("llm", 195, 100, 290, 38, "Tầng LLM ràng buộc lược đồ (Gemini + Zod)", bold=False)
b.box("hn", 510, 52, 160, 86, "Hợp nhất thành BoardPlan (kèm sourceLine)")
b.box("xt", 695, 52, 185, 86, "Xem trước và xác nhận", fill=YEL)
b.link("mota", "right", "luat", "left", ta=19 / 86)
b.link("mota", "right", "llm", "left", ta=67 / 86)
b.link("luat", "right", "hn", "left", tb=19 / 86)
b.link("llm", "right", "hn", "left", tb=67 / 86)
b.link("hn", "right", "xt", "left")
b.box("nt", 200, 200, 520, 72, "Nền tảng TaskFlow (môi trường thực nghiệm)", [
    "Không gian làm việc → bảng → danh sách → thẻ; lịch sử thẻ, người thực hiện, hạn, nhật ký hoạt động",
    "Phân quyền, cập nhật thời gian thực, thông báo, tự động hóa, trợ lý ảo",
], fill="#F4F4F4", stroke="#666666")
b.link("xt", "bottom", "nt", "top", tb=360 / 520, via=[(787.5, 175), (560, 175)], label="ghi bảng (một giao dịch)",
       lpos=(674, 175))
b.group(20, 320, 880, 200, "Cơ chế 2: Gợi ý người thực hiện", fill="#F3FAF3")
b.box("the", 40, 356, 130, 88, "Thẻ mới", ["hoặc các thẻ chưa có người trong một danh sách"])
b.box("th", 200, 356, 150, 88, "Truy hồi K công việc tương tự", ["và đối chiếu hồ sơ tự khai"])
b.box("cham", 370, 356, 190, 88, "Chấm từng thành phần", ["kinh nghiệm, độ ổn định,", "khả năng tiếp nhận, hồ sơ;",
                                                         "mức đủ dữ liệu, bằng chứng"])
b.box("xh", 580, 356, 170, 88, "Xếp hạng theo trọng số của nhóm", ["chia việc theo đợt, cộng dồn tải"])
b.box("ql", 770, 356, 110, 88, "Người quản lý quyết định", fill=YEL)
b.box("hoc", 580, 466, 170, 40, "Học trọng số từ lựa chọn", bold=False)
b.link("the", "right", "th", "left")
b.link("th", "right", "cham", "left")
b.link("cham", "right", "xh", "left")
b.link("xh", "right", "ql", "left")
b.link("ql", "bottom", "hoc", "right", via=[(825, 486)])
b.link("hoc", "top", "xh", "bottom")
b.link("nt", "bottom", "th", "top", ta=75 / 520, dash="6,4", label="dữ liệu lịch sử", lpos=(275, 303))
b.link("ql", "top", "nt", "right", via=[(825, 236)], label="giao người; lựa chọn và\nkết quả được ghi nhận", lpos=(825, 292))
OUT.append((b.key, b.svg()))


def chrome():
    for p in [os.environ.get("CHROME_PATH"), "C:/Program Files/Google/Chrome/Application/chrome.exe",
              "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
              "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"]:
        if p and os.path.exists(p):
            return p
    raise SystemExit("Không tìm thấy Chrome/Edge - đặt biến CHROME_PATH")


def main():
    import sys
    os.makedirs(os.path.join(HERE, "svg"), exist_ok=True)
    os.makedirs(os.path.join(HERE, "png"), exist_ok=True)
    exe = chrome()
    # Tham số (tuỳ chọn): chỉ vẽ các biểu đồ có tên bắt đầu bằng một trong các tiền tố, vd: python ve_bieu_do.py hd5 tt5
    only = sys.argv[1:]
    for key, svg in OUT:
        if only and not any(key.startswith(p + "_") or key == p for p in only):
            continue
        path = os.path.join(HERE, "svg", key + ".svg")
        with open(path, "w", encoding="utf-8") as f:
            f.write(svg)
        import re
        m = re.match(r'<svg[^>]*width="(\d+)" height="(\d+)"', svg)
        w, h = int(m.group(1)), int(m.group(2))
        png = os.path.join(HERE, "png", key + ".png")
        subprocess.run([exe, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
                        f"--window-size={w},{h}", "--screenshot=" + png, "file:///" + path.replace("\\", "/")],
                       check=True, capture_output=True, timeout=90)
        print(f"{key}: {w}x{h}")


if __name__ == "__main__":
    main()
