#!/usr/bin/env python3
"""content/sections/<id>.json 형식 검사.

  python validate.py            # 전체
  python validate.py 1.1 8.4    # 일부

ERROR 가 하나라도 있으면 종료코드 1. WARN 은 "너무 길다" 같은 권고.
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
CONTENT = os.path.join(ROOT, "content")
BLOCK_TYPES = {"list", "steps", "table", "qa", "callout", "figure"}
EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿⭐⭕️]")


def page_ranges():
    with io.open(os.path.join(CONTENT, "toc.json"), encoding="utf-8") as f:
        toc = json.load(f)
    out = {}
    for part in toc["parts"]:
        for ch in part["chapters"]:
            for sec in ch["sections"]:
                pages = set(range(sec["pages"][0], sec["pages"][1] + 1))
                if "divider" in ch:
                    pages.add(ch["divider"])
                out[sec["id"]] = pages
    return out


def check(sec_id, pages):
    errs, warns = [], []
    path = os.path.join(CONTENT, "sections", sec_id + ".json")
    if not os.path.exists(path):
        return ["파일 없음: " + path], warns
    try:
        with io.open(path, encoding="utf-8") as f:
            d = json.load(f)
    except Exception as e:  # noqa: BLE001
        return ["JSON 파싱 실패: %s" % e], warns

    def text(v, where, limit):
        if not isinstance(v, str) or not v.strip():
            errs.append("%s: 비어 있지 않은 문자열이어야 함" % where)
            return
        if v.count("**") % 2:
            errs.append("%s: ** 짝이 맞지 않음" % where)
        if EMOJI.search(v):
            errs.append("%s: 이모지 금지" % where)
        if "<" in v and re.search(r"</?[a-zA-Z]", v):
            errs.append("%s: HTML 태그 금지" % where)
        if len(v) > limit:
            warns.append("%s: %d자 (권장 %d자 이내) → 더 짧게" % (where, len(v), limit))

    extra = set(d) - {"id", "summary", "regulations", "survey", "blocks"}
    if extra:
        errs.append("알 수 없는 키: %s" % sorted(extra))
    if d.get("id") != sec_id:
        errs.append('id 는 "%s" 이어야 함' % sec_id)
    text(d.get("summary"), "summary", 90)
    regs = d.get("regulations", [])
    if not isinstance(regs, list):
        errs.append("regulations: 배열이어야 함")
    else:
        for i, r in enumerate(regs):
            text(r, "regulations[%d]" % i, 40)
    sv = d.get("survey", {})
    if not isinstance(sv, dict) or set(sv) - {"items", "methods"}:
        errs.append("survey: {items, methods} 객체여야 함")
    else:
        for k in ("items", "methods"):
            for i, v in enumerate(sv.get(k, [])):
                text(v, "survey.%s[%d]" % (k, i), 110)

    blocks = d.get("blocks")
    if not isinstance(blocks, list) or not blocks:
        errs.append("blocks: 1개 이상 필요")
        blocks = []
    if len(blocks) > 10:
        warns.append("blocks: %d개 (권장 10개 이내)" % len(blocks))
    nfig = 0
    for bi, b in enumerate(blocks):
        w = "blocks[%d]" % bi
        if not isinstance(b, dict) or b.get("type") not in BLOCK_TYPES:
            errs.append("%s: type 은 %s 중 하나" % (w, sorted(BLOCK_TYPES)))
            continue
        t = b["type"]
        allowed = {"type", "heading"} | {
            "list": {"items"}, "steps": {"items"}, "table": {"head", "rows"},
            "qa": {"items"}, "callout": {"text", "tone"}, "figure": {"page", "caption"}}[t]
        if set(b) - allowed:
            errs.append("%s(%s): 허용되지 않는 키 %s" % (w, t, sorted(set(b) - allowed)))
        if t not in ("callout", "figure"):
            text(b.get("heading"), w + ".heading", 40)
        elif "heading" in b:
            text(b["heading"], w + ".heading", 40)
        if t in ("list", "steps"):
            items = b.get("items")
            if not isinstance(items, list) or not items:
                errs.append(w + ".items: 1개 이상 필요")
                continue
            if len(items) > 8:
                warns.append("%s.items: %d개 (권장 8개 이내)" % (w, len(items)))
            for ii, it in enumerate(items):
                iw = "%s.items[%d]" % (w, ii)
                if isinstance(it, str):
                    text(it, iw, 100)
                elif isinstance(it, dict) and not (set(it) - {"text", "sub"}):
                    text(it.get("text"), iw + ".text", 100)
                    sub = it.get("sub", [])
                    if not isinstance(sub, list):
                        errs.append(iw + ".sub: 배열이어야 함")
                        continue
                    if len(sub) > 5:
                        warns.append("%s.sub: %d개 (권장 5개 이내)" % (iw, len(sub)))
                    for si, s in enumerate(sub):
                        text(s, "%s.sub[%d]" % (iw, si), 100)
                else:
                    errs.append(iw + ': 문자열 또는 {"text","sub"}')
        elif t == "table":
            head, rows = b.get("head", []), b.get("rows")
            if not isinstance(rows, list) or not rows:
                errs.append(w + ".rows: 1행 이상 필요")
                continue
            ncol = len(head) if head else len(rows[0])
            if ncol > 5:
                warns.append("%s: %d열 (권장 5열 이내)" % (w, ncol))
            if len(rows) > 12:
                warns.append("%s: %d행 (권장 12행 이내)" % (w, len(rows)))
            for ci, c in enumerate(head):
                text(c, "%s.head[%d]" % (w, ci), 30)
            for ri, r in enumerate(rows):
                if not isinstance(r, list) or len(r) != ncol:
                    errs.append("%s.rows[%d]: 열 수가 %d 이어야 함" % (w, ri, ncol))
                    continue
                for ci, c in enumerate(r):
                    if not isinstance(c, str):
                        errs.append("%s.rows[%d][%d]: 문자열이어야 함" % (w, ri, ci))
                    elif c.strip():
                        text(c, "%s.rows[%d][%d]" % (w, ri, ci), 120)
        elif t == "qa":
            items = b.get("items")
            if not isinstance(items, list) or not items:
                errs.append(w + ".items: 1개 이상 필요")
                continue
            for ii, it in enumerate(items):
                if not isinstance(it, dict) or set(it) != {"q", "a"}:
                    errs.append('%s.items[%d]: {"q","a"} 객체여야 함' % (w, ii))
                    continue
                text(it["q"], "%s.items[%d].q" % (w, ii), 90)
                text(it["a"], "%s.items[%d].a" % (w, ii), 220)
        elif t == "callout":
            text(b.get("text"), w + ".text", 160)
            if b.get("tone", "") not in ("", "warn", "info"):
                errs.append(w + '.tone: "warn" | "info" | 생략')
        elif t == "figure":
            nfig += 1
            if b.get("page") not in pages:
                errs.append("%s.page: 이 기준의 슬라이드 쪽(%d~%d)이어야 함" % (w, min(pages), max(pages)))
            text(b.get("caption"), w + ".caption", 60)
    if nfig > 3:
        warns.append("figure %d개 (권장 3개 이내)" % nfig)
    return errs, warns


def main():
    ranges = page_ranges()
    ids = sys.argv[1:] or list(ranges)
    bad = 0
    for sec_id in ids:
        if sec_id not in ranges:
            print("[%s] ERROR 목차(toc.json)에 없는 id" % sec_id)
            bad += 1
            continue
        errs, warns = check(sec_id, ranges[sec_id])
        for e in errs:
            print("[%s] ERROR %s" % (sec_id, e))
        for wn in warns:
            print("[%s] WARN  %s" % (sec_id, wn))
        if not errs and not warns:
            print("[%s] OK" % sec_id)
        bad += bool(errs)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
