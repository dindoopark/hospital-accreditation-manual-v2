# 의료기관평가인증 매뉴얼

인증 교육 슬라이드(`인증교육.pdf`, 352쪽)를 핵심만 정리한 정적 HTML 매뉴얼.
첫 화면은 **1. 개요 · 2. 필수인증항목 · 3. 그 외 항목** 세 가지.

## 보기

- `docs/index.html` 더블클릭 (인터넷 연결·설치 불필요)
- 또는 `cd docs && python -m http.server 8000` → http://localhost:8000
- GitHub Pages 로 올릴 때는 `docs/` 폴더를 배포 대상으로 지정

## 구조

```
docs/
├── index.html · styles.css · app.js   화면 (검색, 라우팅, 슬라이드 보기)
├── data.js                            본문 데이터 (build.py 가 자동 생성 — 직접 고치지 말 것)
└── slides/                            원본 슬라이드 이미지 (WebP, thumb/ 는 미리보기)
content/
├── toc.json                           목차: 대구분 → 장 → 기준, 기준별 슬라이드 쪽 범위, 필수 여부
├── sections/<기준번호>.json            기준별 본문 (요약 · 관련 지침 · 조사항목 · 블록)
└── transcripts/pNNN.md                슬라이드 판독 원문 (검색 색인용)
build.py      content/ → docs/data.js
validate.py   sections/*.json 형식 검사
검토메모.md    원본 슬라이드에서 발견한 오탈자 · 모순 · 확인 필요 사항
```

## 내용 고치기

1. `content/sections/1.1.json` 처럼 해당 기준 파일을 수정
2. `python validate.py 1.1` 로 형식 확인
3. `python build.py` → `docs/data.js` 갱신

본문 블록 종류: `list`(목록) · `steps`(순서 절차) · `table`(표) · `qa`(질문/답) · `callout`(강조 상자) · `figure`(슬라이드 크게 보기).
문자열 안에서는 `**굵게**` 만 사용.

## 원본 PDF 가 바뀌었을 때

```bash
pip install pymupdf pillow
python build.py --slides 인증교육.pdf    # docs/slides/ 재생성 + data.js 갱신
```

쪽 번호가 달라졌다면 `content/toc.json` 의 `pages` 와 각 본문의 `figure.page` 도 함께 맞춘다.
