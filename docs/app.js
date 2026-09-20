(function () {
  const M = window.MANUAL || { title: '', parts: [] };
  const $ = (sel) => document.querySelector(sel);
  const main = $('#main');
  const searchInput = $('#searchInput');
  const searchResults = $('#searchResults');
  const clearBtn = $('#clearBtn');
  const homeBtn = $('#homeBtn');
  const lightbox = $('#lightbox');
  const lightboxImg = $('#lightboxImg');
  const lightboxCount = $('#lightboxCount');

  // ===== Flatten sections for lookup / paging / search =====
  const flat = [];
  M.parts.forEach((part) => part.chapters.forEach((ch) => ch.sections.forEach((sec) => {
    flat.push({ part, ch, sec });
  })));
  const byId = new Map(flat.map((f) => [f.sec.id, f]));
  const TAG = { overview: 'yellow', required: 'blue', others: 'green' };

  // ===== Helpers =====
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  // inline markup: **bold** only
  function inline(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  }
  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  const pad = (n) => String(n).padStart(3, '0');
  const slideSrc = (p) => `slides/p${pad(p)}.webp`;
  const thumbSrc = (p) => `slides/thumb/p${pad(p)}.webp`;
  const secLabel = (sec) => (sec.no ? sec.no + ' ' : '') + sec.title;

  // ===== Views =====
  function viewHome() {
    document.title = M.title;
    main.innerHTML = `
      <section class="view">
        <div class="home-head">
          <p class="home-eyebrow">${esc(M.org || '')}</p>
          <h1 class="home-title">${esc(M.title)}</h1>
          <p class="home-sub">${esc(M.subtitle || '')}</p>
        </div>
        <div class="part-grid">
          ${M.parts.map((p, i) => {
            const nSec = p.chapters.reduce((n, c) => n + c.sections.length, 0);
            const meta = p.chapters.length > 1 ? `${p.chapters.length}개 장 · ${nSec}개 기준` : (p.meta || '');
            return `
            <a class="part-card" style="--i:${i}" href="${partHref(p)}">
              <span class="part-no">${esc(p.no)}</span>
              <h2 class="part-title">${esc(p.title)}</h2>
              <p class="part-desc">${esc(p.desc || '')}</p>
              <div class="part-meta"><span>${esc(meta)}</span><span class="arrow" aria-hidden="true">&rarr;</span></div>
            </a>`;
          }).join('')}
        </div>
      </section>`;
  }

  function partHref(p) {
    const only = p.chapters.length === 1 && p.chapters[0].sections.length === 1;
    return only ? `#/s/${encodeURIComponent(p.chapters[0].sections[0].id)}` : `#/p/${p.id}`;
  }

  function viewPart(id) {
    const part = M.parts.find((p) => p.id === id);
    if (!part) return viewHome();
    document.title = `${part.title} – ${M.title}`;
    currentSlides = [];
    main.innerHTML = `
      <section class="view">
        <nav class="crumbs"><a href="#/">처음</a><span class="sep">/</span><span>${esc(part.title)}</span></nav>
        <h1 class="page-title">${esc(part.no)}. ${esc(part.title)}</h1>
        <p class="page-sub">${esc(part.desc || '')}</p>
        ${part.chapters.map((ch) => `
          <div class="chapter" id="ch-${esc(ch.id)}">
            <div class="chapter-head">
              ${ch.no ? `<span class="chapter-no">${esc(ch.no)}</span>` : ''}
              <h2 class="chapter-title">${esc(ch.title)}</h2>
              ${ch.divider ? `<button type="button" class="chapter-std" data-slide="${ch.divider}">기준 · 원내 규정표</button>` : ''}
            </div>
            <ul class="sec-list">
              ${ch.sections.map((s) => `
                <li><a href="#/s/${encodeURIComponent(s.id)}">
                  <span class="sec-no">${esc(s.no)}</span>
                  <span class="sec-name">${esc(s.title)}${s.required ? ' <span class="tag red">필수</span>' : ''}${s.summary ? `<span class="sec-sum">${esc(s.summary)}</span>` : ''}</span>
                  <span class="sec-go" aria-hidden="true">&rsaquo;</span>
                </a></li>`).join('')}
            </ul>
          </div>`).join('')}
      </section>`;
  }

  function renderItems(items, ordered) {
    const tag = ordered ? 'ol' : 'ul';
    return `<${tag}>${(items || []).map((it) => {
      if (typeof it === 'string') return `<li>${inline(it)}</li>`;
      return `<li>${inline(it.text)}${it.sub && it.sub.length ? renderItems(it.sub, false) : ''}</li>`;
    }).join('')}</${tag}>`;
  }

  function renderBlock(b, i) {
    const h = b.heading ? `<h2>${inline(b.heading)}</h2>` : '';
    let body = '';
    if (b.type === 'list' || b.type === 'steps') {
      body = renderItems(b.items, b.type === 'steps' || b.ordered);
    } else if (b.type === 'table') {
      body = `<div class="table-wrap"><table>
        ${b.head && b.head.length ? `<thead><tr>${b.head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` : ''}
        <tbody>${(b.rows || []).map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    } else if (b.type === 'qa') {
      body = `<div class="qa">${(b.items || []).map((x) => `
        <details><summary>${inline(x.q)}</summary><div class="ans">${inline(x.a)}</div></details>`).join('')}</div>`;
    } else if (b.type === 'callout') {
      body = `<div class="callout ${esc(b.tone || '')}">${inline(b.text)}</div>`;
    } else if (b.type === 'figure') {
      body = `<figure class="figure"><img loading="lazy" data-slide="${b.page}" src="${slideSrc(b.page)}" alt="${esc(b.caption || '')}" />
        ${b.caption ? `<figcaption>${inline(b.caption)} (p.${b.page})</figcaption>` : ''}</figure>`;
    } else if (b.type === 'text') {
      body = `<p>${inline(b.text)}</p>`;
    }
    return `<div class="block" id="blk-${i}">${h}${body}</div>`;
  }

  let currentSlides = [];
  function viewSection(id, q) {
    const f = byId.get(id);
    if (!f) return viewHome();
    const { part, ch, sec } = f;
    const idx = flat.indexOf(f);
    const prev = flat[idx - 1], next = flat[idx + 1];
    currentSlides = sec.slides || [];
    document.title = `${secLabel(sec)} – ${M.title}`;
    const single = part.chapters.length === 1 && part.chapters[0].sections.length === 1;
    const sv = sec.survey || {};
    const jumps = (sec.blocks || []).map((bk, i) => ({ i, t: (bk.heading || '').replace(/\*\*/g, '') })).filter((j) => j.t);
    main.innerHTML = `
      <article class="view" id="sectionView">
        <nav class="crumbs">
          <a href="#/">처음</a><span class="sep">/</span>
          ${single ? `<span>${esc(part.title)}</span>` : `<a href="#/p/${part.id}">${esc(part.title)}</a>`}
          ${ch.no ? `<span class="sep">/</span><span>${esc(ch.no)} ${esc(ch.title)}</span>` : ''}
        </nav>
        <header class="sec-head">
          <span class="tag ${TAG[part.id] || 'green'}">${esc(part.title)}</span>${sec.required ? ' <span class="tag red">인증 필수기준</span>' : ''}
          <h1>${sec.no ? `<span class="no">${esc(sec.no)}</span>` : ''}${esc(sec.title)}</h1>
          ${sec.summary ? `<p class="sec-summary">${inline(sec.summary)}</p>` : ''}
          ${sec.regulations && sec.regulations.length ? `<p class="sec-regs"><span class="lbl">관련 지침</span>${sec.regulations.map((r) => `<span class="reg">${esc(r)}</span>`).join('')}</p>` : ''}
        </header>
        ${sv.items && sv.items.length ? `
          <div class="survey">
            <h2>조사항목</h2>
            <ol>${sv.items.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>
            ${sv.methods && sv.methods.length ? `<div class="survey-method"><b>조사방법</b>${sv.methods.map(inline).join(' · ')}</div>` : ''}
          </div>` : ''}
        ${jumps.length >= 4 ? `<nav class="jump" aria-label="이 페이지 목차">${jumps.map((j) => `<button type="button" data-jump="blk-${j.i}">${esc(j.t)}</button>`).join('')}${currentSlides.length ? '<button type="button" data-jump="blk-slides">원본 슬라이드</button>' : ''}</nav>` : ''}
        ${(sec.blocks || []).map(renderBlock).join('')}
        ${currentSlides.length ? `
          <div class="block" id="blk-slides">
            <div class="slides-head"><h2>원본 슬라이드</h2><span class="hint">${currentSlides.length}장 · 누르면 크게 보기</span></div>
            <div class="slide-grid">
              ${currentSlides.map((p) => `<button type="button" data-slide="${p}"><img loading="lazy" src="${thumbSrc(p)}" alt="슬라이드 ${p}쪽" /><span class="pno">p.${p}</span></button>`).join('')}
            </div>
          </div>` : ''}
        <nav class="pager">
          ${prev ? `<a class="prev" href="#/s/${encodeURIComponent(prev.sec.id)}"><span class="dir">&larr; 이전</span><span class="ttl">${esc(secLabel(prev.sec))}</span></a>` : ''}
          ${next ? `<a class="next" href="#/s/${encodeURIComponent(next.sec.id)}"><span class="dir">다음 &rarr;</span><span class="ttl">${esc(secLabel(next.sec))}</span></a>` : ''}
        </nav>
      </article>`;
    if (q) {
      const root = $('#sectionView');
      // open Q&A so highlighted matches are visible
      highlightInElement(root, q);
      root.querySelectorAll('details').forEach((d) => { if (d.querySelector('mark.search-hl')) d.open = true; });
      const first = root.querySelector('mark.search-hl');
      if (first) setTimeout(() => first.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    }
  }

  // ===== Routing =====
  function route() {
    const hash = location.hash.replace(/^#\/?/, '');
    let m;
    if ((m = hash.match(/^s\/([^?]+)(?:\?q=(.+))?$/))) {
      viewSection(decodeURIComponent(m[1]), m[2] ? decodeURIComponent(m[2]) : null);
    } else if ((m = hash.match(/^p\/([\w-]+)$/))) {
      viewPart(m[1]);
    } else {
      viewHome();
    }
    homeBtn.hidden = !hash;
    if (!/\?q=/.test(hash)) window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  // ===== Search (dependency-free, works offline / file://) =====
  function blockText(b) {
    const out = [b.heading || '', b.text || '', b.caption || ''];
    const walk = (items) => (items || []).forEach((it) => {
      if (typeof it === 'string') out.push(it);
      else if (it.q) out.push(it.q, it.a);
      else { out.push(it.text || ''); walk(it.sub); }
    });
    walk(b.items);
    (b.head || []).forEach((c) => out.push(c));
    (b.rows || []).forEach((r) => r.forEach((c) => out.push(c)));
    return out.join(' ');
  }
  const norm = (s) => String(s).toLowerCase().replace(/\*\*/g, '');
  const docs = flat.map((f) => {
    const s = f.sec, sv = s.survey || {};
    const body = [s.summary || '', (s.regulations || []).join(' '), (sv.items || []).join(' '), (sv.methods || []).join(' '), (s.blocks || []).map(blockText).join(' ')].join(' ');
    return { f, title: norm(secLabel(s) + ' ' + f.ch.title), body: body.replace(/\*\*/g, ''), bodyN: norm(body), rawN: norm(s.search || '') };
  });

  function search(query) {
    const terms = norm(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const res = [];
    docs.forEach((d) => {
      let score = 0;
      for (const t of terms) {
        const inT = d.title.includes(t), inB = d.bodyN.includes(t), inR = d.rawN.includes(t);
        if (!inT && !inB && !inR) return;
        // 제목 > 정리 본문(등장 횟수 반영) > 슬라이드 원문
        score += (inT ? 12 : 0) + Math.min(d.bodyN.split(t).length - 1, 6) * 2 + (inR ? 1 : 0);
      }
      res.push({ d, score });
    });
    return res.sort((a, b) => b.score - a.score).slice(0, 14);
  }

  function snippet(d, query) {
    const terms = norm(query).split(/\s+/).filter(Boolean);
    let src = d.body, srcN = d.bodyN;
    if (!terms.some((t) => srcN.includes(t)) && d.rawN) { src = d.f.sec.search; srcN = d.rawN; }
    let pos = -1;
    terms.forEach((t) => { const p = srcN.indexOf(t); if (p !== -1 && (pos === -1 || p < pos)) pos = p; });
    if (pos === -1) pos = 0;
    const start = Math.max(0, pos - 24), end = Math.min(src.length, pos + 90);
    let sn = esc((start > 0 ? '… ' : '') + src.slice(start, end).replace(/\s+/g, ' ') + (end < src.length ? ' …' : ''));
    terms.forEach((t) => { sn = sn.replace(new RegExp(escapeRegExp(esc(t)), 'gi'), (x) => `<mark>${x}</mark>`); });
    return sn;
  }

  function renderResults(query) {
    if (!query.trim()) { searchResults.hidden = true; searchResults.innerHTML = ''; return; }
    const res = search(query);
    searchResults.hidden = false;
    if (!res.length) {
      searchResults.innerHTML = `<li class="no-result">"${esc(query)}" 검색 결과가 없습니다.</li>`;
      return;
    }
    searchResults.innerHTML = res.map(({ d }) => `
      <li data-id="${esc(d.f.sec.id)}">
        <div class="res-title"><span class="no">${esc(d.f.sec.no || d.f.part.title)}</span>${esc(d.f.sec.title)}</div>
        <div class="res-snippet">${snippet(d, query)}</div>
      </li>`).join('');
  }

  searchInput.addEventListener('input', () => { clearBtn.hidden = !searchInput.value; renderResults(searchInput.value); });
  searchInput.addEventListener('focus', () => { if (searchInput.value) renderResults(searchInput.value); });
  clearBtn.addEventListener('click', () => { searchInput.value = ''; clearBtn.hidden = true; searchResults.hidden = true; searchInput.focus(); });
  searchResults.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    location.hash = `#/s/${encodeURIComponent(li.dataset.id)}?q=${encodeURIComponent(searchInput.value.trim())}`;
    searchResults.hidden = true;
    searchInput.blur();
  });
  searchInput.addEventListener('keydown', (e) => {
    const items = Array.from(searchResults.querySelectorAll('li[data-id]'));
    const cur = items.findIndex((li) => li.classList.contains('active'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      const n = e.key === 'ArrowDown' ? (cur + 1) % items.length : (cur - 1 + items.length) % items.length;
      items.forEach((li) => li.classList.remove('active'));
      items[n].classList.add('active');
      items[n].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      const target = items[cur] || items[0];
      if (target) target.click();
    } else if (e.key === 'Escape') {
      searchResults.hidden = true; searchInput.blur();
    }
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search-wrap')) searchResults.hidden = true; });

  function highlightInElement(root, term) {
    const terms = term.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return;
    const re = new RegExp('(' + terms.map(escapeRegExp).join('|') + ')', 'gi');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (!n.nodeValue.trim() || /SCRIPT|STYLE|MARK/.test(n.parentNode.nodeName)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = []; let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach((node) => {
      const text = node.nodeValue;
      re.lastIndex = 0;
      if (!re.test(text)) return;
      re.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0, m;
      while ((m = re.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const mark = document.createElement('mark');
        mark.className = 'search-hl';
        mark.textContent = m[0];
        frag.appendChild(mark);
        last = re.lastIndex;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  // ===== Lightbox (prev / next within the section's slides) =====
  let lbIndex = -1;
  function openSlide(page) {
    let i = currentSlides.indexOf(page);
    if (i === -1) { currentSlides = [page]; i = 0; }
    lbIndex = i;
    showSlide();
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function showSlide() {
    const p = currentSlides[lbIndex];
    lightboxImg.src = slideSrc(p);
    lightboxImg.alt = `슬라이드 ${p}쪽`;
    lightboxCount.textContent = `p.${p}  ·  ${lbIndex + 1} / ${currentSlides.length}`;
    const multi = currentSlides.length > 1;
    lightbox.querySelector('.lb-prev').hidden = !multi;
    lightbox.querySelector('.lb-next').hidden = !multi;
  }
  function stepSlide(d) {
    if (currentSlides.length < 2) return;
    lbIndex = (lbIndex + d + currentSlides.length) % currentSlides.length;
    showSlide();
  }
  function closeSlide() { lightbox.hidden = true; lightboxImg.src = ''; document.body.style.overflow = ''; }

  main.addEventListener('click', (e) => {
    const jump = e.target.closest('[data-jump]');
    if (jump) {
      const target = document.getElementById(jump.dataset.jump);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const el = e.target.closest('[data-slide]');
    if (el) openSlide(Number(el.dataset.slide));
  });
  lightbox.addEventListener('click', (e) => {
    const act = e.target.dataset.act;
    if (act === 'prev') stepSlide(-1);
    else if (act === 'next') stepSlide(1);
    else if (act === 'close' || e.target === lightbox) closeSlide();
  });
  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) {
      if (e.key === '/' && document.activeElement !== searchInput) { e.preventDefault(); searchInput.focus(); }
      return;
    }
    if (e.key === 'Escape') closeSlide();
    else if (e.key === 'ArrowLeft') stepSlide(-1);
    else if (e.key === 'ArrowRight') stepSlide(1);
  });
  let touchX = null;
  lightbox.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) stepSlide(dx < 0 ? 1 : -1);
    touchX = null;
  });

  route();
})();
