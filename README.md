# 의료기관평가인증 매뉴얼

인증 교육 슬라이드(`인증교육.pdf`, 352쪽)를 핵심만 정리한 정적 HTML 매뉴얼.
첫 화면은 **1. 개요 · 2. 필수인증항목 · 3. 그 외 항목** 세 가지.

## 보기

- **웹**: https://dindoopark.github.io/hospital-accreditation-manual-v2/
  (검색엔진 수집은 막아 두었습니다. 열 때마다 PIN 6자리를 묻습니다)
- **휴대폰**: 위 주소를 연 뒤 홈 화면에 추가 (안내 페이지: `install.html`). 한 번 본 내용은 인터넷이 끊겨도 열립니다.
- **USB·PC**: `docs/index.html` 더블클릭 (인터넷 연결·설치 불필요)

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
3. `push.cmd` 더블클릭 → `docs/data.js` 갱신 + GitHub 반영 (1~2분 뒤 웹에 적용)

`push.cmd` 없이 직접 할 때는 `python build.py` 로 `docs/data.js` 만 갱신하면 됩니다.

본문 블록 종류: `list`(목록) · `steps`(순서 절차) · `table`(표) · `qa`(질문/답) · `callout`(강조 상자) · `figure`(슬라이드 크게 보기).
문자열 안에서는 `**굵게**` 만 사용.

## 원본 PDF 가 바뀌었을 때

```bash
pip install pymupdf pillow
python build.py --slides 인증교육.pdf    # docs/slides/ 재생성 + data.js 갱신
```

쪽 번호가 달라졌다면 `content/toc.json` 의 `pages` 와 각 본문의 `figure.page` 도 함께 맞춘다.

## 홈 화면 추가(PWA)

`manifest.webmanifest` · `sw.js` · `pwa.js` · `install.html` · `icons/` 가 담당합니다.
아이콘을 다시 만들려면 `python build.py --icons` (원본 모양은 `docs/icons/icon.svg`).

내용을 바꾼 뒤 이미 설치한 사람에게 「지금 새로고침」 안내를 띄우려면
`docs/sw.js` 맨 위 `VERSION` 을 올리세요 (`'v1'` → `'v2'`).
올리지 않아도 다음 접속 때 새 내용으로 바뀌기는 합니다.
화면 파일(`lock.js`·`app.js` 등)만 바꿨다면 `VERSION` 대신 바로 아래 `SHELL_REV` 를 올리세요.
이미 본 슬라이드의 오프라인 캐시를 지우지 않고 새 화면만 전달합니다.

## PIN 잠금 화면

`docs/lock.js` 가 첫 화면 앞에 숫자 키패드 잠금을 띄웁니다. 주소를 우연히 알게 된 사람이 바로 보지 못하게 하는
가벼운 잠금이며, 파일 자체를 암호화하지는 않습니다 (슬라이드 이미지·`data.js` 주소를 직접 열면 보입니다).

- 사이트를 열 때마다 PIN 을 묻습니다 (기기에 기억하지 않음).
- 켜 둔 채 10분 동안 아무 조작이 없으면 다시 잠기고, PIN 을 넣으면 보던 화면으로 돌아갑니다.
  시간은 `docs/index.html` 의 `data-idle-min` 으로 바꿉니다 (분 단위).
- PIN 바꾸기: 사이트를 열고 개발자도구 콘솔에서 `PinLock.hash('새PIN6자리')` 실행 → 나온 값을
  `docs/index.html` 의 `data-hash` 에 넣습니다.
- PIN·시간·잠금 화면을 바꾼 뒤에는 `docs/sw.js` 의 `SHELL_REV` 를 1 올리면 설치한 휴대폰에 바로 전달됩니다.
- 잠금을 없애려면 `docs/index.html` 의 `<script src="lock.js" …>` 한 줄을 지웁니다.

## git 저장소 위치

이 폴더가 있는 드라이브는 점(`.`)으로 시작하는 파일을 만들 수 없어 `.git` 을 여기 둘 수 없습니다.
그래서 저장소 폴더만 `C:/Users/PC/repos/hospital-accreditation-manual-v2.git` 에 따로 두고
작업 파일은 이 폴더를 그대로 씁니다. `push.cmd` 가 이 연결을 처리하므로 평소에는 신경 쓸 일이 없습니다.

직접 git 명령을 쓸 때는 두 위치를 함께 지정합니다.

```bash
git --git-dir="C:/Users/PC/repos/hospital-accreditation-manual-v2.git" --work-tree="." status
```

제외 규칙은 `.gitignore` 대신 그 저장소 폴더의 `info/exclude` 에 있습니다.
