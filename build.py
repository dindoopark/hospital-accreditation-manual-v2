#!/usr/bin/env python3
"""content/ → docs/data.js 생성기.

  python build.py                 # content/toc.json + content/sections/*.json → docs/data.js
  python build.py --slides 원본.pdf # 슬라이드 이미지(docs/slides/*.webp)까지 다시 생성 (pymupdf, pillow 필요)
  python build.py --slides-v2 ver2.pdf  # Ver.2 교육자료 슬라이드(docs/slides/v2/*.webp) 생성

content/toc.json            목차(대구분 → 장 → 기준)와 각 기준의 원본 슬라이드 쪽 범위
content/sections/<id>.json  기준별 본문(요약 · 조사항목 · 블록)
content/transcripts/pNNN.md 슬라이드 판독 원문(검색 색인용)
content/transcripts_v2/pNNN.md  Ver.2 교육자료(2026.9, 병동·중환자실) 슬라이드 판독 원문
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


def transcript_text(page, folder="transcripts"):
    path = os.path.join(CONTENT, folder, "p%03d.md" % page)
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
                slides2 = sec.pop("v2", [])  # Ver.2 교육자료 쪽 번호 목록
                path = os.path.join(CONTENT, "sections", sec["id"] + ".json")
                if os.path.exists(path):
                    body = load_json(path)
                    for key in ("summary", "regulations", "survey", "blocks"):
                        if key in body:
                            sec[key] = body[key]
                else:
                    missing.append(sec["id"])
                sec["slides"] = slides
                if slides2:
                    sec["slides2"] = slides2
                texts = [transcript_text(p, "transcripts_v2") for p in slides2] + [transcript_text(p) for p in slides]
                sec["search"] = " ".join(filter(None, texts))
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
    # 2026.9.30 추가: Ver.2 대조 중 발견한 환자·직원 식별정보 (이미 올린 docs/slides 이미지에도 같은 좌표로 가림 적용)
    17: [(0.218, 0.161, 0.273, 0.198), (0.236, 0.186, 0.307, 0.228), (0.281, 0.210, 0.428, 0.253), (0.216, 0.728, 0.251, 0.756)],  # BESTCare 캡처: 환자 성·주민번호 앞자리·진단명, 동명이인 이름 일부 (Ver.2 p15 와 같은 화면)
    32: [(0.851, 0.671, 0.866, 0.696), (0.878, 0.678, 0.904, 0.705)],  # 환자확인팔찌 사진: 성·나이·생년 잔여 글자 (수술부위 표기는 유지) (Ver.2 p26 와 같은 화면)
    39: [(0.699, 0.740, 0.736, 0.771), (0.848, 0.776, 0.893, 0.877)],  # 환자카드 이름, 환자확인팔찌 생년월일 (Ver.2 p29 와 같은 화면)
    124: [(0.511, 0.540, 0.538, 0.566)],  # 직무기술서 캡처: 로그인 직원 실명 (Ver.2 p10 와 같은 화면)
    127: [(0.067, 0.628, 0.104, 0.804)],  # 개인별교육현황: 직원번호 (Ver.2 p11 와 같은 화면)
    172: [(0.588, 0.797, 0.616, 0.820)],  # 정상작동 확인 라벨 점검자 이름 (Ver.2 p117 와 같은 화면)
    179: [(0.220, 0.325, 0.263, 0.362)],  # 그룹웨어 게시자 이름 (Ver.2 p120 와 같은 화면)
    212: [(0.104, 0.655, 0.171, 0.689), (0.214, 0.655, 0.281, 0.689), (0.478, 0.905, 0.600, 1.000)],  # 환자영양관리: 환자번호·이름 잔여, 영양사ID (Ver.2 p42 와 같은 화면)
    240: [(0.075, 0.747, 0.164, 0.778), (0.583, 0.652, 0.616, 0.680), (0.502, 0.714, 0.533, 0.740), (0.492, 0.927, 0.519, 0.951)],  # 환자영양관리: 환자번호·이름, 타과의뢰 의사 이름 3곳 (Ver.2 p49 와 같은 화면)
    241: [(0.186, 0.848, 0.252, 0.986), (0.763, 0.482, 0.786, 0.522), (0.381, 0.324, 0.402, 0.366)],  # NST환자관리: 환자 7명 등록번호·이름, 영양사ID, 환자번호 잔여 (Ver.2 p50 와 같은 화면)
    283: [(0.090, 0.389, 0.122, 0.542)],  # 온도점검표 확인자 서명 (Ver.2 p68 와 같은 화면)
    296: [(0.886, 0.918, 0.939, 0.945)],  # 약품정보조회 상태표시줄 ID/PW 문자열 (Ver.2 p74 와 같은 화면)
    308: [(0.354, 0.773, 0.388, 0.800)],  # 간호기록 캡처: 의료진 이름 (Ver.2 p78 와 같은 화면)
}


def apply_masks(im, boxes):
    from PIL import ImageDraw
    w, h = im.size
    draw = ImageDraw.Draw(im)
    for x0, y0, x1, y1 in boxes:
        draw.rectangle([x0 * w, y0 * h, x1 * w, y1 * h], fill=(225, 225, 225))
    return im


# Ver.2 교육자료 가림 영역 (형식은 MASKS 와 같음)
MASKS_V2 = {
    10: [(0.512, 0.522, 0.539, 0.547)],  # 직무기술서 캡처: 로그인 직원 실명
    11: [(0.068, 0.607, 0.105, 0.777)],  # 개인별교육현황: 직원번호
    15: [(0.220, 0.190, 0.276, 0.226), (0.238, 0.214, 0.309, 0.255), (0.284, 0.237, 0.431, 0.279), (0.218, 0.738, 0.253, 0.766)],  # BESTCare 캡처: 환자 성·주민번호 앞자리·진단명, 동명이인 이름 일부
    26: [(0.853, 0.648, 0.867, 0.673), (0.879, 0.655, 0.905, 0.681)],  # 환자확인팔찌 사진: 성·나이·생년 잔여 글자 (수술부위 표기는 유지)
    29: [(0.699, 0.751, 0.736, 0.780), (0.848, 0.786, 0.894, 0.884)],  # 환자카드 이름, 환자확인팔찌 생년월일
    42: [(0.106, 0.631, 0.172, 0.664), (0.215, 0.631, 0.281, 0.664), (0.476, 0.880, 0.594, 0.980)],  # 환자영양관리: 환자번호·이름 잔여, 영양사ID
    49: [(0.064, 0.749, 0.155, 0.779), (0.587, 0.654, 0.620, 0.682), (0.503, 0.716, 0.535, 0.742), (0.493, 0.928, 0.521, 0.952)],  # 환자영양관리: 환자번호·이름, 타과의뢰 의사 이름 3곳
    50: [(0.177, 0.849, 0.246, 0.988), (0.773, 0.483, 0.797, 0.524), (0.379, 0.326, 0.401, 0.369)],  # NST환자관리: 환자 7명 등록번호·이름, 영양사ID, 환자번호 잔여
    68: [(0.093, 0.381, 0.125, 0.529)],  # 온도점검표 확인자 서명
    74: [(0.896, 0.918, 0.951, 0.944)],  # 약품정보조회 상태표시줄 ID/PW 문자열
    78: [(0.356, 0.776, 0.389, 0.802)],  # 간호기록 캡처: 의료진 이름
    117: [(0.593, 0.797, 0.622, 0.821)],  # 정상작동 확인 라벨 점검자 이름
    120: [(0.224, 0.312, 0.267, 0.348)],  # 그룹웨어 게시자 이름
}


def build_slides(pdf, sub="", masks=None):
    import pymupdf
    from PIL import Image
    masks = MASKS if masks is None else masks
    full = os.path.join(DOCS, "slides", sub) if sub else os.path.join(DOCS, "slides")
    thumb = os.path.join(full, "thumb")
    os.makedirs(thumb, exist_ok=True)
    doc = pymupdf.open(pdf)
    for i, pg in enumerate(doc, 1):
        pix = pg.get_pixmap(matrix=pymupdf.Matrix(1.65, 1.65))
        im = apply_masks(Image.frombytes("RGB", (pix.width, pix.height), pix.samples), masks.get(i, []))
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
    elif len(args) >= 2 and args[0] == "--slides-v2":
        build_slides(args[1], "v2", MASKS_V2)
        build_data()
    else:
        build_data()
