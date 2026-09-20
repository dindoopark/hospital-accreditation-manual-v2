/* 서비스워커 등록 + 홈 화면 추가 안내 배너 + 새 버전 알림.
   file:// 로 열었을 때는 아무 것도 하지 않습니다 (브라우저가 막음). */
(function () {
  const isHttp = location.protocol === 'http:' || location.protocol === 'https:';
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 사생활 보호 모드 등 */ } },
  };

  function banner({ text, btnText, onClick, href, key }) {
    if (document.querySelector('.pwa-hint')) return;
    const el = document.createElement('div');
    el.className = 'pwa-hint';
    el.innerHTML = `
      <div class="pwa-hint-text">${text}</div>
      ${href ? `<a class="pwa-hint-btn" href="${href}">${btnText}</a>`
             : `<button type="button" class="pwa-hint-btn">${btnText}</button>`}
      <button type="button" class="pwa-hint-x" aria-label="닫기">&times;</button>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    const close = () => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 300); };
    el.querySelector('.pwa-hint-x').addEventListener('click', () => { if (key) store.set(key, '1'); close(); });
    if (onClick) el.querySelector('.pwa-hint-btn').addEventListener('click', () => { close(); onClick(); });
    return close;
  }

  if (!isHttp) return;

  // ===== 서비스워커 =====
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              banner({
                text: '새 내용이 있습니다.',
                btnText: '지금 새로고침',
                onClick: () => { sw.postMessage('SKIP_WAITING'); location.reload(); },
              });
            }
          });
        });
      }).catch(() => { /* 등록 실패해도 사이트는 그대로 동작 */ });
    });
  }

  // ===== 홈 화면 추가 안내 =====
  if (standalone || store.get('pwa-hint-off') === '1') return;

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Android·데스크톱 Chrome: 브라우저가 설치를 지원할 때만
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    banner({
      text: '<b>홈 화면에 추가</b>하면 앱처럼 바로 열 수 있습니다.',
      btnText: '추가',
      key: 'pwa-hint-off',
      onClick: () => { e.prompt(); },
    });
  });

  // iOS Safari 는 beforeinstallprompt 가 없어 안내 페이지로 보냄
  if (isIOS) {
    setTimeout(() => banner({
      text: '<b>홈 화면에 추가</b>하면 앱처럼 바로 열 수 있습니다.',
      btnText: '방법 보기',
      href: './install.html',
      key: 'pwa-hint-off',
    }), 2500);
  }
})();
