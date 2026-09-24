/* PIN 잠금 화면 — 주소를 우연히 알게 된 사람이 바로 보지 못하게 막는 가벼운 잠금입니다.
   파일 자체는 암호화되지 않으므로 보안 장치는 아닙니다.

   index.html 의 <head> 에서 다른 스크립트보다 먼저 읽습니다.
     <script src="lock.js" data-site="…" data-title="…" data-accent="#…" data-hash="…"></script>

   PIN 바꾸기: 사이트를 열고 브라우저 개발자도구 콘솔에서 PinLock.hash('새PIN6자리') 를 실행한 뒤
   나온 값을 index.html 의 data-hash 에 넣습니다. 바꾸면 이미 열어 둔 기기도 새 PIN 을 다시 묻습니다. */
(function () {
  var script = document.currentScript;
  var cfg = script ? script.dataset : {};
  var SITE = cfg.site || location.pathname;
  var TITLE = cfg.title || document.title;
  var ACCENT = cfg.accent || '#111111';
  var HASH = cfg.hash || '';
  var LEN = 6, MAX_TRY = 5, WAIT_MS = 30000;
  var KEY = 'pin-lock:' + SITE;

  // 짧은 비암호 해시 (cyrb53). 화면 소스에 PIN 이 그대로 보이지 않게 하는 용도.
  function hash(pin) {
    var str = 'pin-lock:' + pin, h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  window.PinLock = { hash: hash };

  function read(store) { try { return window[store].getItem(KEY); } catch (e) { return null; } }
  function write(store, v) { try { if (v) window[store].setItem(KEY, v); else window[store].removeItem(KEY); } catch (e) { /* 사생활 보호 모드 등 */ } }

  if (!HASH || read('localStorage') === HASH || read('sessionStorage') === HASH) return;

  var root = document.documentElement;
  root.classList.add('pin-locked');

  var style = document.createElement('style');
  style.textContent = [
    'html.pin-locked, html.pin-locked body { overflow: hidden !important; }',
    'html.pin-locked body { background: #fbfbfa; }',
    'html.pin-locked body > *:not(#pin-lock) { visibility: hidden !important; }',
    '#pin-lock { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 2147483000; overflow-y: auto;',
    '  display: flex; flex-direction: column; align-items: center; background: #fbfbfa; color: #2f3437;',
    '  padding: max(28px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom));',
    '  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", "Malgun Gothic", sans-serif;',
    '  -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; -webkit-text-size-adjust: 100%; }',
    '#pin-lock .pl-box { width: 100%; max-width: 340px; margin: auto 0; display: flex; flex-direction: column; align-items: center; }',
    '#pin-lock .pl-mark { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; }',
    '#pin-lock .pl-mark svg { width: 26px; height: 26px; }',
    '#pin-lock h1 { font-size: 19px; line-height: 1.3; color: #111; margin: 14px 0 4px; letter-spacing: -.02em; }',
    '#pin-lock .pl-sub { font-size: 13.5px; line-height: 1.5; color: #787774; margin: 0 0 22px; text-align: center; }',
    '#pin-lock .pl-dots { display: flex; gap: 14px; margin-bottom: 10px; }',
    '#pin-lock .pl-dot { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid #cfcfcc; transition: background .12s, border-color .12s; }',
    '#pin-lock .pl-dot.on { background: #111; border-color: #111; }',
    '#pin-lock .pl-dots.ok .pl-dot { background: #346538; border-color: #346538; }',
    '#pin-lock .pl-dots.shake { animation: pl-shake .38s; }',
    '@keyframes pl-shake { 20%, 60% { transform: translateX(-9px); } 40%, 80% { transform: translateX(9px); } }',
    '#pin-lock .pl-msg { min-height: 20px; font-size: 13px; line-height: 1.5; color: #c4322c; margin-bottom: 14px; text-align: center; }',
    '#pin-lock .pl-pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; width: 100%; }',
    '#pin-lock .pl-key { height: 64px; border-radius: 16px; border: 1px solid #eaeaea; background: #fff; color: #111;',
    '  font-family: inherit; font-size: 26px; font-weight: 500; line-height: 1; cursor: pointer; touch-action: manipulation; padding: 0;',
    '  transition: background .08s, transform .08s; }',
    '#pin-lock .pl-key:active { background: #efefed; transform: scale(.96); }',
    '#pin-lock .pl-key.fn { font-size: 14px; font-weight: 600; color: #787774; background: transparent; border-color: transparent; }',
    '#pin-lock .pl-key:disabled { opacity: .35; cursor: default; }',
    '#pin-lock .pl-key svg { width: 28px; height: 22px; vertical-align: middle; pointer-events: none; }',
    '#pin-lock .pl-remember { margin-top: 18px; display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer; }',
    '#pin-lock .pl-remember input { width: 18px; height: 18px; margin: 0; }',
    '#pin-lock .pl-foot { margin-top: 14px; font-size: 11.5px; line-height: 1.5; color: #787774; text-align: center; }',
    '@media (forced-colors: active) { #pin-lock .pl-dot.on, #pin-lock .pl-dots.ok .pl-dot { background: CanvasText; } }',
    '@media (prefers-reduced-motion: reduce) { #pin-lock .pl-dots.shake { animation: none; } #pin-lock .pl-key { transition: none; } }'
  ].join('\n');
  (document.head || root).appendChild(style);

  var input = '', fails = 0, waitUntil = 0, done = false;
  var el, dots, msg, pad, remember;

  var LOCK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  var BACK_ICON = '<svg viewBox="0 0 28 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h16a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 25 20H9L1.5 11Z"/><path d="m13 7 8 8M21 7l-8 8"/></svg>';

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function mount() {
    if (el || done || !document.body) return;
    el = document.createElement('div');
    el.id = 'pin-lock';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'pin-lock-title');
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];
    el.innerHTML =
      '<div class="pl-box">' +
        '<div class="pl-mark" style="background:' + esc(ACCENT) + '" aria-hidden="true">' + LOCK_ICON + '</div>' +
        '<h1 id="pin-lock-title">' + esc(TITLE) + '</h1>' +
        '<p class="pl-sub">원내 교육자료입니다. PIN ' + LEN + '자리를 누르세요.</p>' +
        '<div class="pl-dots" aria-hidden="true">' + new Array(LEN + 1).join('<span class="pl-dot"></span>') + '</div>' +
        '<div class="pl-msg" role="status" aria-live="polite"></div>' +
        '<div class="pl-pad">' + keys.map(function (k) {
          if (k === 'clear') return '<button type="button" class="pl-key fn" data-k="clear">전체 지움</button>';
          if (k === 'back') return '<button type="button" class="pl-key fn" data-k="back" aria-label="한 자리 지움">' + BACK_ICON + '</button>';
          return '<button type="button" class="pl-key" data-k="' + k + '">' + k + '</button>';
        }).join('') + '</div>' +
        '<label class="pl-remember"><input type="checkbox" checked /> 이 기기에서 다시 묻지 않기</label>' +
        '<div class="pl-foot">공용 PC에서는 체크를 해제하세요.</div>' +
      '</div>';
    document.body.insertBefore(el, document.body.firstChild);
    dots = el.querySelector('.pl-dots');
    msg = el.querySelector('.pl-msg');
    pad = el.querySelector('.pl-pad');
    remember = el.querySelector('.pl-remember input');
    remember.style.accentColor = ACCENT;
    // 마우스로 누른 키에 포커스가 남으면 Enter·Space 가 그 키를 한 번 더 누르게 되므로 포커스를 옮기지 않는다.
    pad.addEventListener('mousedown', function (e) { e.preventDefault(); });
    pad.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.pl-key') : null;
      if (b && !b.disabled) press(b.getAttribute('data-k'));
    });
  }

  function paint() {
    var list = dots.children;
    for (var i = 0; i < list.length; i++) list[i].classList.toggle('on', i < input.length);
  }

  function press(k) {
    if (done || !el || Date.now() < waitUntil) return;
    if (k === 'back') input = input.slice(0, -1);
    else if (k === 'clear') input = '';
    else if (input.length < LEN) input += k;
    paint();
    if (input.length === LEN) check();
  }

  function check() {
    if (hash(input) === HASH) return unlock();
    fails++;
    input = '';
    paint();
    dots.classList.remove('shake');
    void dots.offsetWidth; // 애니메이션 다시 시작
    dots.classList.add('shake');
    if (navigator.vibrate) navigator.vibrate(120);
    if (fails >= MAX_TRY) { fails = 0; waitUntil = Date.now() + WAIT_MS; cooldown(); }
    else msg.textContent = 'PIN이 맞지 않습니다. (' + (MAX_TRY - fails) + '회 남음)';
  }

  function cooldown() {
    var left = Math.ceil((waitUntil - Date.now()) / 1000);
    var keys = pad.querySelectorAll('.pl-key');
    for (var i = 0; i < keys.length; i++) keys[i].disabled = left > 0;
    if (left > 0) { msg.textContent = left + '초 후 다시 시도하세요.'; setTimeout(cooldown, 250); }
    else msg.textContent = '';
  }

  function unlock() {
    done = true;
    write(remember.checked ? 'localStorage' : 'sessionStorage', HASH);
    write(remember.checked ? 'sessionStorage' : 'localStorage', null);
    msg.textContent = '';
    dots.classList.add('ok');
    window.removeEventListener('keydown', onKey, true);
    setTimeout(function () {
      root.classList.remove('pin-locked');
      if (el.parentNode) el.parentNode.removeChild(el);
      style.parentNode.removeChild(style);
    }, 250);
  }

  // 잠겨 있는 동안 키 입력은 모두 여기서 받고, 뒤쪽 화면(검색 단축키 등)으로 넘기지 않는다.
  function onKey(e) {
    if (done || e.ctrlKey || e.metaKey || e.altKey) return;
    e.stopImmediatePropagation();
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
    else if (e.key === 'Escape') { e.preventDefault(); press('clear'); }
  }
  window.addEventListener('keydown', onKey, true);

  // 본문이 그려지기 전에 잠금 화면을 먼저 붙인다.
  if (document.body) mount();
  else if (window.MutationObserver) {
    var mo = new MutationObserver(function () { if (document.body) { mo.disconnect(); mount(); } });
    mo.observe(root, { childList: true });
  }
  document.addEventListener('DOMContentLoaded', mount);
})();
