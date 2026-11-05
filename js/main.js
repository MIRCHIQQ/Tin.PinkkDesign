(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };

  /* ---------- световые ленты на фоне ---------- */
  /* Холст сам подбирает качество под компьютер: уровень 0 с мягким свечением, 1 без свечения,
     2 редкие линии и 30 кадров в секунду, 3 одна неподвижная картинка. Если кадры начинают тормозить,
     уровень снижается сам. Принудительно: добавьте к адресу ?fx=0, ?fx=1, ?fx=2 или ?fx=3. */
  (function () {
    var cv = $('#fx'); if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d'), root = document.documentElement;
    var W = 0, H = 0, sy = 0, tier = 0, running = false, dead = false, raf = 0;
    var last = 0, warm = 0, sum = 0, cnt = 0;
    var weak = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
               (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
               (navigator.connection && navigator.connection.saveData);
    var Q = [
      { k: 1,   am: 1,    glow: true,  scale: 1,  dpr: 1.5, gap: 0,  n: 56 },
      { k: .55, am: 1.25, glow: false, scale: 1,  dpr: 1,   gap: 0,  n: 44 },
      { k: .3,  am: 1.6,  glow: false, scale: .6, dpr: 1,   gap: 33, n: 34 }
    ];
    var forced = /[?&]fx=([0-3])/.exec(location.search);
    tier = forced ? +forced[1] : (weak || innerWidth < 700 ? 1 : 0);
    if (reduce && !forced) tier = 3;
    var dots = []; for (var d = 0; d < 40; d++) dots.push({ x: Math.random(), y: Math.random(), s: .2 + Math.random() * .8 });
    var B = [
      { n: 18, spread: .15, col: '196,246,70', w: 1.2, a: .62, sp: .32, s: 0 },
      { n: 13, spread: .24, col: '84,222,180',  w: 1,   a: .4,  sp: .25, s: 1 },
      { n: 11, spread: .32, col: '90,140,255',  w: 1,   a: .28, sp: .2,  s: 2 }
    ];
    var X = new Float32Array(80), Y = new Float32Array(80), NX = new Float32Array(80), NY = new Float32Array(80), E = new Float32Array(80);
    var pt = [0, 0];
    function bez(p, t) {
      var u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t;
      pt[0] = a * p[0][0] + b * p[1][0] + c * p[2][0] + e * p[3][0];
      pt[1] = a * p[0][1] + b * p[1][1] + c * p[2][1] + e * p[3][1];
    }
    function spine(b, tm) {
      var ph = tm * b.sp, s = b.s;
      return [
        [-.1 * W, (.96 + .04 * s) * H + Math.sin(ph + s) * H * .02],
        [(.3 + .07 * Math.sin(ph * 1.1 + s)) * W, (1.1 - .08 * s) * H],
        [(.46 + .08 * Math.cos(ph * .9 + s * 2)) * W, (.14 + .16 * s) * H + Math.sin(ph * 1.3) * H * .05],
        [1.1 * W, (.1 * s) * H]
      ];
    }
    function draw(tm) {
      var q = Q[Math.min(tier, 2)], N = q.n, m = Math.min(W, H);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (var bi = 0; bi < B.length; bi++) {
        var b = B[bi], p = spine(b, tm), lines = Math.max(3, Math.round(b.n * q.k));
        for (var j = 0; j <= N; j++) {
          var t = j / N; bez(p, t); var ax = pt[0], ay = pt[1]; bez(p, Math.min(1, t + .004));
          var dx = pt[0] - ax, dy = pt[1] - ay, l = Math.sqrt(dx * dx + dy * dy) || 1;
          X[j] = ax; Y[j] = ay; NX[j] = -dy / l; NY[j] = dx / l; E[j] = Math.pow(Math.sin(Math.PI * t), .85);
        }
        for (var i = 0; i < lines; i++) {
          var k = i / (lines - 1) - .5, core = 1 - Math.abs(k) * 1.5, amp = k * b.spread * m * 1.3, wob = .012 * m;
          ctx.beginPath();
          for (var jj = 0; jj <= N; jj++) {
            var tt = jj / N, e = E[jj], off = amp * e + Math.sin(tt * 8 + tm * b.sp * 2 + i * .6 + b.s) * wob * e;
            var x = X[jj] + NX[jj] * off, y = Y[jj] + NY[jj] * off;
            if (jj === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          if (q.glow) {
            ctx.lineWidth = b.w * 7; ctx.strokeStyle = 'rgba(' + b.col + ',' + (b.a * .05 * core).toFixed(3) + ')'; ctx.stroke();
          }
          ctx.lineWidth = b.w * (q.scale < 1 ? 1.3 : 1);
          ctx.strokeStyle = 'rgba(' + b.col + ',' + Math.min(1, b.a * (.35 + .65 * core) * q.am).toFixed(3) + ')'; ctx.stroke();
        }
      }
      ctx.fillStyle = '#fff';
      for (var di = 0; di < dots.length; di++) {
        var o = dots[di], dxp = (o.x * W + tm * 6 * o.s) % W, dyp = (((o.y * H - tm * 10 * o.s) % H) + H) % H;
        ctx.globalAlpha = .12 + .25 * o.s; ctx.fillRect(dxp, dyp, 1.5, 1.5);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    function size() {
      var q = Q[Math.min(tier, 2)], dpr = Math.min(window.devicePixelRatio || 1, q.dpr) * q.scale;
      W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!running) draw(7);
    }
    function mode() { root.setAttribute('data-fx', String(tier)); root.classList.toggle('lite', tier >= 2); }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var gap = Q[Math.min(tier, 2)].gap;
      if (now - last < gap - 3) return;
      var dt = now - last; last = now;
      draw(now / 1000);
      if (warm > 0) { warm--; return; }
      sum += dt; cnt++;
      if (cnt >= 40) {
        var avg = sum / cnt, target = gap || 16.7; sum = 0; cnt = 0;
        if (!forced && avg > target * 1.45) setTier(tier + 1);
      }
    }
    function setTier(t) {
      tier = t; warm = 12; sum = 0; cnt = 0; mode();
      if (tier >= 3) { pause(); dead = true; size(); draw(7); return; }
      size();
    }
    function resume() { if (running || dead || document.hidden) return; running = true; last = 0; warm = 12; sum = 0; cnt = 0; raf = requestAnimationFrame(frame); }
    function pause() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    function onScroll() {
      sy = window.scrollY;
      cv.style.transform = 'translate3d(0,' + (-sy * .18).toFixed(1) + 'px,0)';
      cv.style.opacity = (1 - .7 * smooth(0, H * 1.2, sy)).toFixed(3);
      if (tier >= 3 || reduce) return;
      if (sy > H * 1.4) pause(); else resume();
    }
    addEventListener('scroll', onScroll, { passive: true });
    var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { size(); onScroll(); }, 150); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else onScroll(); });
    mode(); size(); onScroll();
    if (tier < 3 && !reduce) resume();
  })();

  /* ---------- курсор-кольцо ---------- */
  (function () {
    var el = $('#cursor');
    if (!el || reduce || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var x = 0, y = 0, cx = 0, cy = 0, shown = false, raf = 0;
    function tick() {
      cx += (x - cx) * .22; cy += (y - cy) * .22;
      el.style.transform = 'translate3d(' + (cx - 14).toFixed(1) + 'px,' + (cy - 14).toFixed(1) + 'px,0)';
      raf = (Math.abs(x - cx) > .3 || Math.abs(y - cy) > .3) ? requestAnimationFrame(tick) : 0;
    }
    addEventListener('mousemove', function (e) {
      x = e.clientX; y = e.clientY;
      if (!shown) { shown = true; cx = x; cy = y; el.classList.add('on'); }
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
    document.addEventListener('mouseover', function (e) {
      el.classList.toggle('hot', !!(e.target.closest && e.target.closest('a, button, [role="tab"], .work')));
    });
    document.documentElement.addEventListener('mouseleave', function () { el.classList.remove('on'); shown = false; });
  })();

  /* ---------- появление блоков, лента, подсветка меню ---------- */
  (function () {
    var track = $('#belt'); if (track) track.innerHTML += track.innerHTML;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -6% 0px', threshold: .06 });
      $$('.rv').forEach(function (el) { io.observe(el); });
      setTimeout(function () {
        $$('.rv:not(.in)').forEach(function (el) { if (el.getBoundingClientRect().top < innerHeight * 1.5) el.classList.add('in'); });
      }, 3500);
      var links = $$('.nav a'), map = {};
      links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
      var io2 = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { links.forEach(function (l) { l.classList.remove('on'); }); var a = map[e.target.id]; if (a) a.classList.add('on'); }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) io2.observe(s); });
    } else {
      $$('.rv').forEach(function (el) { el.classList.add('in'); });
    }
  })();

  /* ---------- меню МИС: было и стало ---------- */
  (function () {
    var stage = $('#menuStage'); if (!stage) return;
    var G = [
      { id: 'work', name: 'Приём', items: ['Визиты', 'Картотека', 'Звонки', 'Задачи'] },
      { id: 'money', name: 'Деньги', items: ['Касса', 'Компании', 'Услуги', 'Зарплаты'] },
      { id: 'clinic', name: 'Клиника', items: ['Лаборатории', 'Склад', 'Персонал', 'Документы'] },
      { id: 'stat', name: 'Аналитика', items: ['Статистика', 'Маркетинг'] },
      { id: 'sys', name: 'Система', items: ['Интеграции', 'Настройки'] }
    ];
    var ROLES = {
      doctor: ['work', 'clinic'], nurse: ['work', 'clinic'], reception: ['work', 'money', 'clinic'],
      admin: ['work', 'money', 'clinic', 'stat', 'sys']
    };
    var RN = { doctor: 'Врач', nurse: 'Медсестра', reception: 'Регистратор', admin: 'Администратор' };
    var BEFORE = ['Визиты', 'Картотека', 'Касса', 'Компании', 'Зарплаты', 'Лаборатории', 'Звонки', 'Склад', 'Задачи', 'Статистика', 'Маркетинг', 'Персонал', 'Услуги', 'Документы', 'Интеграции', 'Настройки'];
    var chips = {}, heads = {}, nat = {}, mode = 'after', role = 'admin', P = 16;
    G.forEach(function (g) {
      var h = document.createElement('div'); h.className = 'mh'; h.textContent = g.name; stage.appendChild(h); heads[g.id] = h;
      g.items.forEach(function (n) {
        var c = document.createElement('div'); c.className = 'mc';
        if (n === 'Визиты') { var i = document.createElement('i'); i.className = 'act'; c.appendChild(i); }
        var s = document.createElement('span'); s.textContent = n; c.appendChild(s);
        stage.appendChild(c); chips[n] = c;
      });
    });
    function measure() { Object.keys(chips).forEach(function (n) { chips[n].style.width = 'auto'; nat[n] = chips[n].offsetWidth; }); }
    function noteText() {
      if (mode === 'before') return 'Было: 16 пунктов в одной ленте, последние не помещаются на экран.';
      var n = ROLES[role].length;
      return role === 'admin' ? 'Администратор видит все 5 групп.' : RN[role] + ' видит ' + n + ' ' + (n < 5 ? 'группы' : 'групп') + ' из 5.';
    }
    function apply() {
      var allowed = ROLES[role];
      G.forEach(function (g) {
        var off = mode === 'after' && allowed.indexOf(g.id) < 0;
        heads[g.id].classList.toggle('off', off);
        g.items.forEach(function (n) { chips[n].classList.toggle('off', off); });
      });
      stage.classList.toggle('before', mode === 'before');
      $('#roleNote').textContent = noteText();
      $$('[data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === mode)); });
      $$('[data-role]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-role') === role)); b.disabled = mode === 'before'; });
    }
    function layout() {
      var W = stage.clientWidth - 2 * P, gx = 14, gy = 22, ch = 34, cg = 8, hh = 26, idx = 0;
      if (mode === 'before') {
        var x = 0;
        BEFORE.forEach(function (n, i) {
          var c = chips[n]; c.style.width = nat[n] + 'px'; c.style.transform = 'translate(' + (P + x) + 'px,' + P + 'px)'; c.style.setProperty('--i', i); x += nat[n] + 8;
        });
        G.forEach(function (g) { heads[g.id].style.transform = 'translate(' + P + 'px,' + P + 'px)'; heads[g.id].style.opacity = 0; });
        stage.style.setProperty('--h', (ch + 2 * P) + 'px');
      } else {
        var cols = W >= 640 ? 5 : (W >= 440 ? 3 : 2), cw = (W - gx * (cols - 1)) / cols, rowY = 0, rowH = 0;
        G.forEach(function (g, gi) {
          var col = gi % cols;
          if (col === 0 && gi > 0) { rowY += rowH + gy; rowH = 0; }
          var x2 = P + col * (cw + gx), h = heads[g.id];
          h.style.transform = 'translate(' + x2 + 'px,' + (P + rowY) + 'px)'; h.style.opacity = '';
          g.items.forEach(function (n, k) {
            var c = chips[n]; c.style.width = cw + 'px';
            c.style.transform = 'translate(' + x2 + 'px,' + (P + rowY + hh + k * (ch + cg)) + 'px)'; c.style.setProperty('--i', idx++);
          });
          rowH = Math.max(rowH, hh + g.items.length * (ch + cg) - cg);
        });
        stage.style.setProperty('--h', (rowY + rowH + 2 * P) + 'px');
      }
      apply();
    }
    $$('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-mode'); layout(); }); });
    $$('[data-role]').forEach(function (b) { b.addEventListener('click', function () { role = b.getAttribute('data-role'); apply(); }); });
    var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(layout, 100); });
    measure(); layout();
    requestAnimationFrame(function () { requestAnimationFrame(function () { stage.classList.remove('no-anim'); }); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { stage.classList.add('no-anim'); measure(); layout(); requestAnimationFrame(function () { stage.classList.remove('no-anim'); }); });
  })();

  /* ---------- карточка визита: было и стало ---------- */
  (function () {
    var box = $('#visitBox'); if (!box) return;
    $$('[data-visit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var m = btn.getAttribute('data-visit');
        $$('[data-visit]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
        box.setAttribute('data-show', m);
      });
    });
  })();

  /* ---------- изометрические блоки статусов ---------- */
  (function () {
    var host = $('#iso'); if (!host) return;
    var S = [['Записан', '#2F6BC7'], ['Ожидает', '#E0A018'], ['На приёме', '#129672'], ['Завершён', '#7E928B']];
    host.innerHTML = S.map(function (s) {
      return '<div class="iso-i" style="--c:' + s[1] + '"><svg viewBox="0 0 96 124" aria-hidden="true"><ellipse cx="48" cy="108" rx="34" ry="10" fill="#000" opacity=".35"/><g class="blk"><polygon class="t" points="48,22 80,40 48,58 16,40"/><polygon class="l" points="16,40 48,58 48,108 16,90"/><polygon class="r" points="48,58 80,40 80,90 48,108"/></g></svg><b>' + s[0] + '</b><span class="mono dim">' + s[1] + '</span></div>';
    }).join('');
  })();

  /* ---------- экраны МИС ---------- */
  (function () {
    var tabs = $$('#shotTabs [role="tab"]'), panels = $$('#shotBody .shot'), cap = $('#shotCap'), url = $('#shotUrl');
    if (!tabs.length) return;
    var D = {
      before: ['мис / было / визиты', 'Исходный дизайн раздела «Визиты»: две строки шапки, меню из 16 пунктов, оранжевые и жёлтые карточки. Переключателя темы нет.'],
      login: ['мис / вход', 'Экран входа показывает расписание врачей по кабинетам. Блоки выстраиваются при загрузке, а нажатие на роль подставляет логин и пароль.'],
      visits: ['мис / визиты', 'Доска визитов: четыре колонки по статусам, время приёма крупно, кабинет табличкой. Карточки можно перетаскивать между колонками.'],
      home: ['мис / главная', 'Главная со сводкой приёма за сегодня: число визитов, сумма и распределение по статусам, лента сообщений и общие файлы.'],
      cartoteka: ['мис / картотека', 'Картотека: поля фильтра ровной сеткой, категории пациентов цветом, заголовки таблицы в одну строку.'],
      dark: ['мис / визиты / тёмная тема', 'Тёмная тема работает на всех экранах. Переключатель в верхней панели, выбор запоминается в браузере.'],
      phone: ['мис / телефон, 390 px', 'На телефоне доска превращается в одну колонку, а меню выезжает слева по кнопке.']
    };
    function pick(id, focus) {
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-shot') === id;
        t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus();
      });
      panels.forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-shot') === id); });
      url.textContent = D[id][0]; cap.textContent = D[id][1];
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { pick(t.getAttribute('data-shot')); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
          pick(n.getAttribute('data-shot'), true);
        }
      });
    });
    pick('visits');
  })();

  /* ---------- графика: просмотр крупно ---------- */
  (function () {
    var lb = $('#lb'), items = $$('.work-btn'); if (!lb || !items.length) return;
    var cur = 0, last = null;
    function show(i) {
      cur = (i + items.length) % items.length;
      var b = items[cur], im = $('img', b);
      $('#lbImg').src = im.currentSrc || im.src; $('#lbImg').alt = im.alt; $('#lbCap').textContent = b.getAttribute('data-cap');
    }
    function open(i) { last = document.activeElement; show(i); lb.hidden = false; document.body.style.overflow = 'hidden'; $('#lbClose').focus(); }
    function close() { lb.hidden = true; document.body.style.overflow = ''; if (last && last.focus) last.focus(); }
    items.forEach(function (b, i) { b.addEventListener('click', function () { open(i); }); });
    $('#lbClose').addEventListener('click', close);
    $('#lbPrev').addEventListener('click', function () { show(cur - 1); });
    $('#lbNext').addEventListener('click', function () { show(cur + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(cur - 1);
      else if (e.key === 'ArrowRight') show(cur + 1);
    });
  })();

  /* ---------- счётчики ---------- */
  (function () {
    var els = $$('[data-count]');
    if (!els.length || reduce || !('IntersectionObserver' in window)) return;
    function run(el) {
      var to = +el.getAttribute('data-count'), t0 = performance.now();
      (function step(now) { var p = clamp((now - t0) / 1200, 0, 1); el.textContent = Math.round(to * ease(p)); if (p < 1) requestAnimationFrame(step); })(t0);
    }
    els.forEach(function (el) { el.textContent = '0'; });
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }); }, { threshold: .6 });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* ---------- лаймовая панель, растущая при скролле ---------- */
  (function () {
    var track = $('#contact'), panel = $('#limePanel'), A = $('#lpA'), B = $('#lpB'); if (!track || !panel) return;
    var rest = false;
    function upd() {
      var r = track.getBoundingClientRect(), vh = innerHeight, vw = innerWidth, total = Math.max(1, r.height - vh);
      if (r.top > vh) { if (rest) return; rest = true; } else rest = false;
      var p = clamp(-r.top / total, 0, 1), e = ease(clamp(p / .32, 0, 1));
      panel.style.setProperty('--pw', lerp(Math.min(vw * .88, 440), vw, e) + 'px');
      panel.style.setProperty('--ph', lerp(Math.min(vh * .34, 240), vh, e) + 'px');
      panel.style.setProperty('--pr', lerp(36, 0, e) + 'px');
      A.style.opacity = 1 - smooth(.56, .68, p);
      var b = smooth(.62, .76, p);
      B.style.opacity = b; B.style.visibility = b > .02 ? 'visible' : 'hidden';
    }
    if (!reduce) {
      addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
      $$('[data-contact]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var top = track.getBoundingClientRect().top + window.scrollY + (track.offsetHeight - innerHeight) * .94;
          window.scrollTo({ top: top, behavior: 'smooth' });
        });
      });
    }
    $$('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var txt = btn.getAttribute('data-copy');
        function done() { btn.textContent = 'Скопировано'; setTimeout(function () { btn.textContent = 'Копировать'; }, 1600); }
        function fallback() {
          var r = document.createRange(); r.selectNodeContents(btn.previousElementSibling);
          var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); done();
        }
        try { navigator.clipboard.writeText(txt).then(done, fallback); } catch (err) { fallback(); }
      });
    });
  })();
})();
