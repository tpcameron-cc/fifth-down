/* Fifth Down — game logic and grid rendering. */
(function () {
  'use strict';

  const { FORMATIONS, GRID } = window.FifthDownData;
  const MAX_GUESSES = 5;
  const PLAYERS = 11;
  const EPOCH_UTC = Date.UTC(2026, 0, 1);
  const NS = 'http://www.w3.org/2000/svg';
  const COLS = GRID.maxCol - GRID.minCol + 1;
  const ROWS = GRID.defRows + GRID.offRows;
  const LOS_Y = GRID.defRows;
  const KEYS = { daily: 'fifthdown:daily', stats: 'fifthdown:stats' };

  const $ = (s) => document.querySelector(s);
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Lookup ----------
  const byId = new Map(FORMATIONS.map((f) => [f.id, f]));
  const lookup = new Map();
  for (const f of FORMATIONS) {
    for (const a of [f.name, ...f.aliases]) lookup.set(norm(a), f);
  }

  // ---------- Daily puzzle ----------
  function dayNumber(d = new Date()) {
    return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH_UTC) / 864e5);
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function dailyTarget(day) {
    // Each pass through the playbook uses a fresh shuffle so the order doesn't repeat.
    const n = FORMATIONS.length;
    const cycle = Math.floor(day / n);
    const order = FORMATIONS.map((_, i) => i);
    const rand = mulberry32(5150 + cycle);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return FORMATIONS[order[((day % n) + n) % n]];
  }

  // ---------- Matching ----------
  const cellKey = (p) => `${p.col},${p.row}`;
  const roleKey = (p) => `${p.role}@${cellKey(p)}`;

  /** Which target players does this guess light up, and which guessed players were right? */
  function matchPlayers(guess, target) {
    const targetKeys = new Map(target.players.map((p, i) => [roleKey(p), i]));
    const hitT = new Set();
    const hitG = new Set();
    guess.players.forEach((p, i) => {
      const t = targetKeys.get(roleKey(p));
      if (t !== undefined) { hitT.add(t); hitG.add(i); }
    });
    return { hitT, hitG };
  }

  // ---------- Game state ----------
  const games = { daily: null, practice: null };
  let mode = 'daily';
  const current = () => games[mode];

  function blankGame(gameMode, target, day) {
    return { mode: gameMode, target, day, guesses: [], results: [], lit: new Set(), fresh: new Set(), done: false, won: false };
  }

  function createDaily() {
    const day = dayNumber();
    const g = blankGame('daily', dailyTarget(day), day);
    const saved = store.get(KEYS.daily);
    if (saved && saved.day === day && saved.target === g.target.id && Array.isArray(saved.guesses)) {
      for (const id of saved.guesses) { const f = byId.get(id); if (f && !g.done) applyGuess(g, f); }
      g.fresh = new Set();
    }
    return g;
  }

  function createPractice() {
    const prev = games.practice && games.practice.target;
    let t;
    do t = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)];
    while (t === prev);
    return blankGame('practice', t, null);
  }

  function applyGuess(g, f) {
    const m = matchPlayers(f, g.target);
    g.fresh = new Set([...m.hitT].filter((i) => !g.lit.has(i)));
    m.hitT.forEach((i) => g.lit.add(i));
    g.guesses.push(f);
    g.results.push(m);
    if (f.id === g.target.id) {
      g.done = true; g.won = true;
      g.target.players.forEach((_, i) => { if (!g.lit.has(i)) { g.lit.add(i); g.fresh.add(i); } });
    } else if (g.guesses.length >= MAX_GUESSES) {
      g.done = true;
    }
  }

  function recordStats(g) {
    const s = store.get(KEYS.stats) || { played: 0, wins: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0], lastDay: null, lastWinDay: null };
    if (s.lastDay === g.day) return;
    s.played += 1;
    s.lastDay = g.day;
    if (g.won) {
      s.wins += 1;
      s.streak = s.lastWinDay === g.day - 1 ? s.streak + 1 : 1;
      s.best = Math.max(s.best, s.streak);
      s.dist[g.guesses.length - 1] += 1;
      s.lastWinDay = g.day;
    } else {
      s.streak = 0;
    }
    store.set(KEYS.stats, s);
  }

  // ---------- Field (SVG grid) ----------
  const field = $('#field');
  let playersLayer;

  function svg(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  }
  const gx = (col) => col - GRID.minCol;                          // left edge of the column
  const gy = (row) => (row > 0 ? GRID.defRows - row : LOS_Y - row - 1); // top edge of the row

  function drawGrid() {
    field.setAttribute('viewBox', `0 0 ${COLS} ${ROWS}`);
    field.replaceChildren();
    const turf = svg('g', { class: 'turf' }, field);
    for (let r = 0; r < ROWS; r++) {
      svg('rect', { x: 0, y: r, width: COLS, height: 1, class: r % 2 ? 'turf-b' : 'turf-a' }, turf);
    }
    const lines = svg('g', { class: 'gridlines' }, field);
    for (let c = 1; c < COLS; c++) svg('line', { x1: c, x2: c, y1: 0, y2: ROWS }, lines);
    for (let r = 1; r < ROWS; r++) svg('line', { x1: 0, x2: COLS, y1: r, y2: r }, lines);
    svg('rect', { x: 0.03, y: 0.03, width: COLS - 0.06, height: ROWS - 0.06, class: 'sideline' }, field);
    svg('line', { x1: 0, x2: COLS, y1: LOS_Y, y2: LOS_Y, class: 'los' }, field);
    svg('ellipse', { cx: gx(0) + 0.5, cy: LOS_Y, rx: 0.32, ry: 0.2, class: 'ball' }, field);
    const tDef = svg('text', { x: 0.25, y: 0.62, class: 'side-label' }, field); tDef.textContent = 'DEFENSE';
    const tOff = svg('text', { x: 0.25, y: ROWS - 0.3, class: 'side-label' }, field); tOff.textContent = 'OFFENSE';
    playersLayer = svg('g', { class: 'players' }, field);
  }

  function marker(p, side, cls, delay) {
    const x = gx(p.col), y = gy(p.row);
    const outer = svg('g', { transform: `translate(${x} ${y})` }, playersLayer);
    if (cls.includes('lit') || cls.includes('missed')) svg('rect', { x: 0.06, y: 0.06, width: 0.88, height: 0.88, rx: 0.12, class: `cell ${cls}` }, outer);
    const g = svg('g', { class: `pl ${side} ${cls}` }, outer);
    if (delay) g.style.animationDelay = `${delay}ms`;
    if (side === 'offense') {
      svg('circle', { cx: 0.5, cy: 0.5, r: 0.27, class: 'glyph' }, g);
    } else {
      const d = 0.24;
      svg('path', { d: `M${0.5 - d} ${0.5 - d}L${0.5 + d} ${0.5 + d}M${0.5 + d} ${0.5 - d}L${0.5 - d} ${0.5 + d}`, class: 'glyph' }, g);
    }
    const title = svg('title', {}, outer);
    title.textContent = cls.includes('ghost') ? `Your guess: ${p.label} (no match)` : p.label;
  }

  function renderField() {
    const g = current();
    playersLayer.replaceChildren();
    if ($('#ghostToggle').checked && !g.done) {
      // Every wrong player from every guess so far, drawn once per square
      // and never on top of a square that is already lit.
      const litCells = new Set([...g.lit].map((i) => cellKey(g.target.players[i])));
      const drawn = new Set();
      g.guesses.forEach((guess, gi) => {
        const m = g.results[gi];
        guess.players.forEach((p, i) => {
          const key = `${guess.side}:${cellKey(p)}`;
          if (m.hitG.has(i) || litCells.has(cellKey(p)) || drawn.has(key)) return;
          drawn.add(key);
          marker(p, guess.side, 'ghost');
        });
      });
    }
    let n = 0;
    g.target.players.forEach((p, i) => {
      if (g.lit.has(i)) {
        const fresh = g.fresh.has(i);
        marker(p, g.target.side, fresh ? 'lit pop' : 'lit', fresh ? 60 * n++ : 0);
      } else if (g.done) {
        marker(p, g.target.side, 'missed');
      }
    });
    g.fresh = new Set();
    $('#litCount').textContent = `${g.lit.size} / ${PLAYERS} players lit`;
  }

  // ---------- Guess list ----------
  function renderGuesses() {
    const g = current();
    const box = $('#guesses');
    box.replaceChildren();
    for (let i = 0; i < MAX_GUESSES; i++) {
      const row = document.createElement('div');
      const f = g.guesses[i];
      if (!f) {
        row.className = 'guess-row empty';
        row.innerHTML = `<span class="g-num">${i + 1}</span><span class="g-name">—</span>`;
      } else {
        const hits = g.results[i].hitT.size;
        const correct = f.id === g.target.id;
        row.className = `guess-row${correct ? ' correct' : ''}`;
        const pips = Array.from({ length: PLAYERS }, (_, k) => `<i class="${k < hits ? 'on' : ''}"></i>`).join('');
        row.innerHTML = `
          <span class="g-num">${i + 1}</span>
          <span class="g-name">${esc(f.name)}<span class="tag ${f.side}">${f.side === 'offense' ? 'O' : 'X'}</span></span>
          <span class="pips" aria-hidden="true">${pips}</span>
          <span class="g-score">${correct ? '✓' : `${hits}/${PLAYERS}`}</span>`;
        row.setAttribute('aria-label', `${f.name}: ${hits} of ${PLAYERS} players in the right spot`);
      }
      box.appendChild(row);
    }
  }

  // ---------- Result panel ----------
  let countdownTimer = null;
  function renderResult() {
    const g = current();
    const panel = $('#result');
    clearInterval(countdownTimer);
    if (!g.done) { panel.hidden = true; return; }
    panel.hidden = false;
    const t = g.target;
    const headline = g.won
      ? `${['Touchdown on the first snap!', 'Touchdown!', 'Touchdown!', 'Scored on third down!', 'Fourth-down conversion!'][g.guesses.length - 1]}`
      : 'Turnover on downs';
    panel.innerHTML = `
      <h2>${headline}</h2>
      <p class="answer">The formation was <strong>${esc(t.name)}</strong> <span class="tag ${t.side}">${t.side === 'offense' ? 'Offense' : 'Defense'}</span></p>
      <p class="desc">${esc(t.desc)}</p>
      <div class="result-actions">
        <button type="button" class="btn primary" id="shareBtn">Share result</button>
        <button type="button" class="btn" id="nextBtn">${g.mode === 'daily' ? 'Play practice' : 'New formation'}</button>
      </div>
      ${g.mode === 'daily' ? '<p class="countdown">Next daily formation in <span id="countdown"></span></p>' : ''}`;
    $('#shareBtn').addEventListener('click', share);
    $('#nextBtn').addEventListener('click', () => {
      if (g.mode === 'daily') setMode('practice');
      else { games.practice = createPractice(); render(); focusInput(); }
    });
    if (g.mode === 'daily') {
      const tick = () => {
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const s = Math.max(0, Math.floor((next - now) / 1000));
        const el = $('#countdown');
        if (el) el.textContent = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
      };
      tick();
      countdownTimer = setInterval(tick, 1000);
    }
  }

  function shareText(g) {
    const head = g.mode === 'daily' ? `Fifth Down #${g.day + 1}` : 'Fifth Down (practice)';
    const lines = g.results.map((m, i) => {
      const n = g.guesses[i].id === g.target.id ? PLAYERS : m.hitT.size;
      return `${'🟨'.repeat(n)}${'⬛'.repeat(PLAYERS - n)}${n === PLAYERS ? ' 🏈' : ''}`;
    });
    return `${head} ${g.won ? g.guesses.length : 'X'}/${MAX_GUESSES}\n${lines.join('\n')}`;
  }

  async function share() {
    const text = shareText(current());
    try {
      await navigator.clipboard.writeText(text);
      toast('Result copied to clipboard');
    } catch {
      window.prompt('Copy your result:', text);
    }
  }

  // ---------- Header / mode ----------
  function renderHeader() {
    const g = current();
    document.querySelectorAll('.seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    if (g.mode === 'daily') {
      const d = new Date();
      $('#puzzleLabel').textContent = `#${g.day + 1} · ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    } else {
      $('#puzzleLabel').textContent = 'Unlimited practice';
    }
    const left = MAX_GUESSES - g.guesses.length;
    $('#guessInput').disabled = g.done;
    $('#guessBtn').disabled = g.done;
    $('#guessInput').placeholder = g.done ? 'Game over' : `Name a formation… (${left} guess${left === 1 ? '' : 'es'} left)`;
  }

  function render() {
    renderHeader();
    renderField();
    renderGuesses();
    renderResult();
  }

  function setMode(m) {
    mode = m;
    if (!games[m]) games[m] = m === 'daily' ? createDaily() : createPractice();
    closeSuggest();
    $('#guessInput').value = '';
    render();
    focusInput();
  }

  // ---------- Input & suggestions ----------
  const input = $('#guessInput');
  const list = $('#suggestions');
  let items = [];
  let active = -1;

  function search(q) {
    const n = norm(q);
    if (!n) return [];
    const out = [];
    for (const f of FORMATIONS) {
      let best = null;
      for (const a of [f.name, ...f.aliases]) {
        const k = norm(a);
        const at = k.indexOf(n);
        if (at < 0) continue;
        const score = (at === 0 ? 0 : 10) + (a === f.name ? 0 : 1) + k.length / 100;
        if (!best || score < best.score) best = { score, via: a === f.name ? null : a };
      }
      if (best) out.push({ f, ...best });
    }
    return out.sort((a, b) => a.score - b.score).slice(0, 8);
  }

  function openSuggest() {
    const g = current();
    items = search(input.value);
    active = items.findIndex((it) => !g.guesses.includes(it.f));
    list.replaceChildren();
    items.forEach((it, i) => {
      const used = g.guesses.includes(it.f);
      const li = document.createElement('li');
      li.role = 'option';
      li.id = `opt-${i}`;
      li.className = `${used ? 'used' : ''}${i === active ? ' active' : ''}`;
      li.setAttribute('aria-selected', String(i === active));
      if (used) li.setAttribute('aria-disabled', 'true');
      li.innerHTML = `<span class="tag ${it.f.side}">${it.f.side === 'offense' ? 'O' : 'X'}</span>
        <span class="s-name">${esc(it.f.name)}${it.via ? `<small>${esc(it.via)}</small>` : ''}</span>
        ${used ? '<small class="s-used">guessed</small>' : ''}`;
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (!used) submitGuess(it.f);
      });
      list.appendChild(li);
    });
    list.hidden = items.length === 0;
    input.setAttribute('aria-expanded', String(items.length > 0));
    input.setAttribute('aria-activedescendant', active >= 0 ? `opt-${active}` : '');
  }

  function closeSuggest() {
    items = []; active = -1;
    list.hidden = true;
    list.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
  }

  function moveActive(step) {
    if (!items.length) return;
    const g = current();
    let i = active;
    for (let k = 0; k < items.length; k++) {
      i = (i + step + items.length) % items.length;
      if (!g.guesses.includes(items[i].f)) break;
    }
    active = i;
    [...list.children].forEach((li, j) => {
      li.classList.toggle('active', j === active);
      li.setAttribute('aria-selected', String(j === active));
    });
    input.setAttribute('aria-activedescendant', `opt-${active}`);
    list.children[active]?.scrollIntoView({ block: 'nearest' });
  }

  function resolveInput() {
    const exact = lookup.get(norm(input.value));
    if (exact) return exact;
    if (active >= 0 && items[active]) return items[active].f;
    return null;
  }

  function submitGuess(f) {
    const g = current();
    if (g.done) return;
    if (g.guesses.includes(f)) { toast(`You already tried ${f.name}`); shake(); return; }
    applyGuess(g, f);
    if (g.mode === 'daily') {
      store.set(KEYS.daily, { day: g.day, target: g.target.id, guesses: g.guesses.map((x) => x.id) });
      if (g.done) recordStats(g);
    }
    input.value = '';
    closeSuggest();
    render();
    if (!g.done) {
      const hits = g.results[g.results.length - 1].hitT.size;
      toast(hits === 0 ? 'No players in the right spot' : `${hits} player${hits === 1 ? '' : 's'} lit up`);
      focusInput();
    }
  }

  input.addEventListener('input', openSuggest);
  input.addEventListener('focus', () => { if (input.value) openSuggest(); });
  input.addEventListener('blur', () => setTimeout(closeSuggest, 100));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) openSuggest(); else moveActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
    else if (e.key === 'Escape') closeSuggest();
  });
  $('#guessForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    const f = resolveInput();
    if (!f) { toast('Not in the playbook — pick a formation from the list'); shake(); return; }
    submitGuess(f);
  });

  function focusInput() {
    if (!current().done && window.matchMedia('(hover: hover)').matches) input.focus();
  }

  // ---------- Toast / shake ----------
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function shake() {
    const w = $('#guessForm');
    w.classList.remove('shake');
    void w.offsetWidth;
    w.classList.add('shake');
  }

  // ---------- Dialogs ----------
  function buildPlaybook() {
    const box = $('#playbook');
    box.replaceChildren();
    for (const side of ['offense', 'defense']) {
      const col = document.createElement('div');
      col.innerHTML = `<h4><span class="tag ${side}">${side === 'offense' ? 'O' : 'X'}</span> ${side === 'offense' ? 'Offense' : 'Defense'}</h4>`;
      const ul = document.createElement('ul');
      for (const f of FORMATIONS.filter((x) => x.side === side)) {
        const li = document.createElement('li');
        li.textContent = f.name;
        li.title = [f.desc, f.aliases.length ? `Also: ${f.aliases.join(', ')}` : ''].filter(Boolean).join('\n');
        ul.appendChild(li);
      }
      col.appendChild(ul);
      box.appendChild(col);
    }
  }

  function renderStats() {
    const s = store.get(KEYS.stats) || { played: 0, wins: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0] };
    const pct = s.played ? Math.round((s.wins / s.played) * 100) : 0;
    $('#statNums').innerHTML = [
      [s.played, 'Played'], [pct, 'Win %'], [s.streak, 'Streak'], [s.best, 'Best'],
    ].map(([v, l]) => `<div><strong>${v}</strong><span>${l}</span></div>`).join('');
    const max = Math.max(1, ...s.dist);
    const g = games.daily;
    $('#statDist').innerHTML = s.dist.map((v, i) => {
      const mine = g && g.done && g.won && g.guesses.length === i + 1;
      return `<div class="bar-row"><span>${i + 1}</span><div class="bar${mine ? ' mine' : ''}" style="width:${Math.max(8, (v / max) * 100)}%">${v}</div></div>`;
    }).join('');
  }

  $('#helpBtn').addEventListener('click', () => $('#helpDialog').showModal());
  $('#statsBtn').addEventListener('click', () => { renderStats(); $('#statsDialog').showModal(); });
  document.querySelectorAll('dialog').forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.querySelector('.close')?.addEventListener('click', () => d.close());
  });
  document.querySelectorAll('.seg-btn').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('#ghostToggle').addEventListener('change', renderField);

  // ---------- Boot ----------
  drawGrid();
  buildPlaybook();
  games.daily = createDaily();
  setMode('daily');
  if (!store.get('fifthdown:seenHelp')) {
    store.set('fifthdown:seenHelp', true);
    $('#helpDialog').showModal();
  }
})();
