#!/usr/bin/env python3
"""content/ → docs/data.js 생성기.

  python build.py                 # content/toc.json + content/sections/*.json → docs/data.js
  python build.py --slides 원본.pdf # 슬라이드 이미지(docs/slides/*.webp)까지 다시 생성 (pymupdf, pillow 필요)

content/toc.json            목차(대구분 → 장 → 기준)와 각 기준의 원본 슬라이드 쪽 범위
content/sections/<id>.json  기준별 본문(요약 · 조사항목 · 블록)
content/transcripts/pNNN.md 슬라이드 판독 원문(검색 색인용)
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
CONTENT = os.path.join(ROOT, "content")
DOCS = os.path.join(ROOT, "docs")


def load_json(path):
    with io.open(path, encoding="utf-8") as f:
        return json.load(f)


def transcript_text(page):
    path = os.path.join(CONTENT, "transcripts", "p%03d.md" % page)
    if not os.path.exists(path):
        return ""
    with io.open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    out = []
    for ln in lines:
        if ln.startswith("# p") or ln.startswith("- kind:") or ln.startswith("- redBorder:"):
            continue
        if re.fullmatch(r"[\s|:\-]*", ln):
            continue
        ln = re.sub(r"\[그림:[^\]]*\]", " ", ln)
        ln = re.sub(r"[#*|`>\[\]]+", " ", ln)
        out.append(ln.strip())
    return re.sub(r"\s+", " ", " ".join(out)).strip()


def build_data():
    toc = load_json(os.path.join(CONTENT, "toc.json"))
    missing = []
    for part in toc["parts"]:
        for ch in part["chapters"]:
            for sec in ch["sections"]:
                first, last = sec.pop("pages")
                slides = [p for p in range(first, last + 1) if p not in set(sec.pop("skip", []))]
                slides = sec.pop("extra_before", []) + slides
                path = os.path.join(CONTENT, "sections", sec["id"] + ".json")
                if os.path.exists(path):
                    body = load_json(path)
                    for key in ("summary", "regulations", "survey", "blocks"):
                        if key in body:
                            sec[key] = body[key]
                else:
                    missing.append(sec["id"])
                sec["slides"] = slides
                sec["search"] = " ".join(filter(None, (transcript_text(p) for p in slides)))
    out = os.path.join(DOCS, "data.js")
    with io.open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("window.MANUAL = ")
        json.dump(toc, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    n = sum(len(c["sections"]) for p in toc["parts"] for c in p["chapters"])
    print("data.js: %d sections, %.0f KB" % (n, os.path.getsize(out) / 1024))
    if missing:
        print("본문 없음:", ", ".join(missing))


# 슬라이드 캡처에 그대로 노출된 환자 식별정보 가림 (쪽 → [(x0, y0, x1, y1)] 0~1 비율 좌표)
MASKS = {
    191: [(0.095, 0.095, 0.165, 0.142), (0.222, 0.095, 0.302, 0.142)],  # 병원생활안내문: 등록번호, 성명
    117: [(0.349, 0.4575, 0.425, 0.4705), (0.342, 0.4705, 0.418, 0.487)],  # 부록 3: 직원 개인 휴대전화 번호 2건 (당직폰은 유지)
}


def apply_masks(im, page):
    from PIL import ImageDraw
    w, h = im.size
    draw = ImageDraw.Draw(im)
    for x0, y0, x1, y1 in MASKS.get(page, []):
        draw.rectangle([x0 * w, y0 * h, x1 * w, y1 * h], fill=(225, 225, 225))
    return im


def build_slides(pdf):
    import pymupdf
    from PIL import Image
    full = os.path.join(DOCS, "slides")
    thumb = os.path.join(full, "thumb")
    os.makedirs(thumb, exist_ok=True)
    doc = pymupdf.open(pdf)
    for i, pg in enumerate(doc, 1):
        pix = pg.get_pixmap(matrix=pymupdf.Matrix(1.65, 1.65))
        im = apply_masks(Image.frombytes("RGB", (pix.width, pix.height), pix.samples), i)
        w, h = im.size
        im.resize((1400, round(h * 1400 / w)), Image.LANCZOS).save(
            os.path.join(full, "p%03d.webp" % i), "WEBP", quality=68, method=6)
        im.resize((440, round(h * 440 / w)), Image.LANCZOS).save(
            os.path.join(thumb, "p%03d.webp" % i), "WEBP", quality=55, method=6)
    print("slides: %d pages" % len(doc))


def build_icons():
    """docs/icons/icon.svg 와 같은 모양의 PNG 아이콘 생성 (홈 화면 추가용)."""
    from PIL import Image, ImageDraw
    out = os.path.join(DOCS, "icons")
    os.makedirs(out, exist_ok=True)
    bg, fg = (17, 17, 17), (255, 255, 255)
    check = [(164 / 512.0, 266 / 512.0), (230 / 512.0, 332 / 512.0), (350 / 512.0, 190 / 512.0)]

    def draw(size, radius_ratio, scale=4):
        s = size * scale
        im = Image.new("RGB", (s, s), (255, 255, 255))
        d = ImageDraw.Draw(im)
        if radius_ratio:
            d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * radius_ratio), fill=bg)
        else:
            d.rectangle([0, 0, s, s], fill=bg)
        pts = [(x * s, y * s) for x, y in check]
        w = int(s * 44 / 512.0)
        d.line(pts, fill=fg, width=w, joint="curve")
        for x, y in pts:  # 선 끝을 둥글게
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=fg)
        return im.resize((size, size), Image.LANCZOS)

    for name, size, radius in [
        ("icon-192.png", 192, 112 / 512.0), ("icon-512.png", 512, 112 / 512.0),
        ("icon-maskable-192.png", 192, 0), ("icon-maskable-512.png", 512, 0),
        ("apple-touch-icon.png", 180, 0), ("favicon-32.png", 32, 0.18), ("favicon-16.png", 16, 0.18),
    ]:
        draw(size, radius).save(os.path.join(out, name), "PNG", optimize=True)
    print("icons: 7 files")


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "--icons":
        build_icons()
    elif len(args) >= 2 and args[0] == "--slides":
        build_slides(args[1])
        build_data()
    else:
        build_data()
