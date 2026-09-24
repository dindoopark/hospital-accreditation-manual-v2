/* 오프라인 캐시 서비스워커.
   본문(data.js)이나 화면을 고쳤으면 아래 VERSION 을 올려야 기존 사용자에게 새 내용이 전달됩니다. */
const VERSION = 'v1';
// 화면 파일(html·js·css, 잠금 화면 등)만 바뀌었을 때 올립니다. 이미 본 슬라이드 캐시는 그대로 둡니다.
const SHELL_REV = 3;
const SHELL_CACHE = `shell-${VERSION}-${SHELL_REV}`;
const ASSET_CACHE = `asset-${VERSION}`;

// 앱 셸: 설치 시 미리 받아 둔다 (슬라이드 이미지는 용량이 커서 본 것만 캐시)
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data.js',
  './pwa.js',
  './lock.js',
  './install.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // 하나가 실패해도 설치 자체는 진행되도록 개별 처리. 단 첫 화면과 잠금 화면은 꼭 있어야 하므로
    // 이것들을 못 받으면 설치를 멈추고 기존 버전을 계속 쓴다 (다음 접속 때 다시 시도).
    // cache: 'reload' — 브라우저 HTTP 캐시(최대 10분)에 남은 옛 파일 대신 서버의 새 파일을 받는다.
    const required = ['./', './index.html', './lock.js'];
    await Promise.all(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
      if (required.includes(url)) throw err;
    })));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = [SHELL_CACHE, ASSET_CACHE];
    const names = await caches.keys();
    const shellChanged = names.some((n) => n.startsWith('shell-') && n !== SHELL_CACHE);
    await Promise.all(names.filter((n) => !keep.includes(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
    // 화면 파일이 바뀐 업데이트면 열려 있는 창을 새로고침해 옛 화면(옛 잠금 코드)이 남지 않게 한다.
    if (shellChanged) {
      const wins = await self.clients.matchAll({ type: 'window' });
      wins.forEach((c) => { if (c.navigate) c.navigate(c.url).catch(() => {}); });
    }
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

// 슬라이드·아이콘: 한 번 받으면 그대로 (cache-first)
async function cacheFirst(req) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

// 앱 셸: 캐시를 먼저 보여주고 뒤에서 갱신 (stale-while-revalidate)
async function staleWhileRevalidate(req) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (/\/(slides|icons)\//.test(url.pathname)) {
    e.respondWith(cacheFirst(req).catch(() => caches.match(req)));
  } else {
    e.respondWith(staleWhileRevalidate(req).catch(() => caches.match('./index.html')));
  }
});
