// Interfața aplicației: pagini, test, rezultat, clasament, distribuire.
(() => {
"use strict";
const {CATS, CAT, SECTIONS, ENC, rngFor, SEGS, testsFor, makeSession, makeVerseSession, VERSE_MODES, scoreAll, answered, countItems} = window.TIN;
const C = window.CONFIG;
const TOTAL = CATS.reduce((a, c) => a + c.tests, 0);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const EMBED = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
const normName = s => String(s || "").trim().replace(/\s+/g, " ");
const nameKey = s => normName(s).toLowerCase();
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const scoreCls = s => s >= 90 ? "hi" : s >= 60 ? "md" : "lo";
const badge = (c, size = "m") => `<span class="badge ${size}" style="background:${c.color}">${esc(size === "s" ? c.ic.replace("–", "") : c.ic)}</span>`;

/* ---------- Supabase (clasament) ---------- */
const API = {
  async rpc(fn, body) {
    const r = await fetch(`${C.supabaseUrl}/rest/v1/rpc/${fn}`, {method: "POST",
      headers: {"Content-Type": "application/json", apikey: C.supabaseKey, Authorization: `Bearer ${C.supabaseKey}`}, body: JSON.stringify(body || {})});
    if (!r.ok) { let m = ""; try { m = (await r.json()).message; } catch (e) {} throw new Error(m || ("HTTP " + r.status)); }
    return r.json();
  },
  submit: o => API.rpc("submit_result", {p_name: o.name, p_cat: o.cat, p_test: o.n, p_score: o.score, p_secs: o.secs}),
  board: cat => API.rpc("get_leaderboard", {p_cat: cat, p_limit: 100}),
  podium: () => API.rpc("get_podium"),
  testTop: (cat, n) => API.rpc("get_test_top", {p_cat: cat, p_test: n})
};
async function flushQueue() {
  const q = LS.get("tin_queue", []); if (!q.length) return;
  const rest = [];
  for (const o of q) { try { await API.submit(o); } catch (e) { if (!/invalid|prea multe/i.test(e.message)) rest.push(o); } }
  LS.set("tin_queue", rest);
}

/* ---------- Stare ---------- */
const S = {session: null, ans: [], idx: 0, start: 0, timer: null, name: LS.get("tin_name", ""), last: null, reviewFilter: "wrong", drawn: -1};
const hist = () => LS.get("tin_hist", {});
function saveHist(key, score) { const h = hist(); const o = h[key] || {best: 0, tries: 0}; o.best = Math.max(o.best, score); o.tries++; o.last = score; o.at = Date.now(); h[key] = o; LS.set("tin_hist", h); }
const doneIn = (h, c) => Object.keys(h).filter(k => k.startsWith(c.id + ":") && !k.includes(":v")).length;

/* ---------- Simboluri (stil SF Symbols) ---------- */
const sv = (d, w = 1.7) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  back: sv('<path d="M15 18l-6-6 6-6"/>', 2.2), next: sv('<path d="M9 18l6-6-6-6"/>', 2.2), chev: sv('<path d="M9 18l6-6-6-6"/>', 2),
  sun: sv('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: sv('<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>'),
  share: sv('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-1"/>'),
  link: sv('<path d="M10 14a5 5 0 007.1 0l3-3a5 5 0 00-7.1-7.1l-1 1"/><path d="M14 10a5 5 0 00-7.1 0l-3 3a5 5 0 007.1 7.1l1-1"/>'),
  img: sv('<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 9"/>'),
  msg: sv('<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/>'),
  redo: sv('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  clock: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 2),
  book: sv('<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/>'),
  home: sv('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>'),
  trophy: sv('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z"/><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/>'),
  info: sv('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  list: sv('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>'),
  quote: sv('<path d="M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6"/>'),
  dl: sv('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  no: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  half: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"><path d="M6 12h12"/></svg>'
};

/* ---------- Temă ---------- */
const prefDark = () => window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
function applyTheme(t) {
  document.documentElement.dataset.theme = t; LS.set("tin_theme", t);
  const b = $("#themeBtn"); if (b) b.innerHTML = t === "dark" ? I.sun : I.moon;
  const m = $('meta[name="theme-color"]'); if (m) m.content = t === "dark" ? "#1c1c1e" : "#f5f5f7";
}
applyTheme(LS.get("tin_theme", prefDark() ? "dark" : "light"));

/* ---------- Schelet ---------- */
const markImg = cls => `<img class="${cls}" src="${C.logo}" alt="">`;
const wordmark = () => `<img class="wm wm-l" src="img/agape-full.svg" alt="${esc(C.church)}"><img class="wm wm-d" src="img/agape-full-dark.svg" alt="${esc(C.church)}">`;
document.getElementById("app").innerHTML = `
<div class="app">
  <aside class="side">
    <a class="brand" href="#acasa">${markImg("mark")}<span><b>${esc(C.appName)}</b><small>Concursul Biblic 2027</small></span></a>
    <nav class="nav" id="nav"></nav>
    <div class="side-foot">${wordmark()}<br>© ${C.year} ${esc(C.author)} · ${esc(C.church)}</div>
  </aside>
  <div class="main"><header class="top" id="top"></header><main id="content"></main></div>
  <nav class="tabbar" id="tabbar">
    <a href="#acasa" data-t="home">${I.home}Acasă</a>
    <a href="#teste" data-t="tests">${I.list}Teste</a>
    <a href="#clasament" data-t="board">${I.trophy}Clasament</a>
    <a href="#despre" data-t="about">${I.info}Despre</a>
  </nav>
</div>`;
const content = $("#content");

function renderNav(active) {
  const h = hist();
  $("#nav").innerHTML = `
    <a class="${active === "home" ? "on" : ""}" href="#acasa"><span class="sym">${I.home}</span>Acasă</a>
    <a class="${active === "board" ? "on" : ""}" href="#clasament"><span class="sym">${I.trophy}</span>Clasament</a>
    <div class="nav-h">Categorii</div>
    ${CATS.map(c => `<a class="${active === c.id ? "on" : ""}" href="#c-${c.id}">${badge(c, "s")}${esc(c.short)}<span class="cnt">${doneIn(h, c)}/${c.tests}</span></a>`).join("")}
    <div class="nav-h">Informații</div>
    <a class="${active === "about" ? "on" : ""}" href="#despre"><span class="sym">${I.info}</span>Despre concurs</a>`;
  const t = {home: "home", tests: "tests", board: "board", about: "about"}[active] || (CAT[active] ? "tests" : "");
  $$("#tabbar a").forEach(a => a.classList.toggle("on", a.dataset.t === t));
}
function topbar({back, title, sub}) {
  $("#top").innerHTML = `
    ${back ? `<button class="ib acc" id="backBtn" aria-label="Înapoi">${I.back}</button>` : `<span style="width:6px"></span>`}
    <div style="min-width:0"><div class="ttl">${title}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>
    <span class="sp"></span>
    <button class="ib" id="themeBtn" aria-label="Schimbă tema">${document.documentElement.dataset.theme === "dark" ? I.sun : I.moon}</button>`;
  if (back) $("#backBtn").onclick = typeof back === "function" ? back : () => go(back);
  $("#themeBtn").onclick = () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}
function toast(msg, ms = 2400) { $$(".toast").forEach(t => t.remove()); const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
function sheet(html, opts = {}) {
  const sc = document.createElement("div"); sc.className = "scrim" + (opts.center ? " center" : "");
  sc.innerHTML = `<div class="sheet">${html}</div>`; document.body.appendChild(sc);
  const close = () => sc.remove();
  sc.addEventListener("click", e => { if (e.target === sc) close(); });
  return {el: sc, close};
}
const foot = () => `<div class="foot">${wordmark()}<br>© ${C.year} <b>${esc(C.author)}</b> · Realizat pentru <b>${esc(C.church)}</b><br>Platformă neoficială de pregătire, după Biblia Cornilescu revizuită (VDC). Verifică mereu în Biblie.<br>Regulamentul oficial: <a href="https://talantulinnegot.com" target="_blank" rel="noopener">talantulinnegot.com</a> · v${esc(C.version)}</div>`;

/* ---------- Navigare ---------- */
let CUR = location.hash || "#acasa";
function go(h, replace) {
  CUR = h;
  if (!EMBED) { try { if (location.hash !== h) history[replace ? "replaceState" : "pushState"](null, "", h); } catch (e) {} }
  route();
}
document.addEventListener("click", e => { const a = e.target.closest && e.target.closest('a[href^="#"]'); if (a) { e.preventDefault(); go(a.getAttribute("href")); } });

/* ---------- Acasă ---------- */
function catRows(h) {
  return `<div class="group">${CATS.map(c => `<a class="row ind" href="#c-${c.id}">${badge(c)}
    <span class="grow"><div class="t">${esc(c.name)}</div><div class="d">1–2 Samuel · ${esc(c.ntName)} · versete de memorat</div></span>
    <span class="prog only-d"><i style="width:${doneIn(h, c) / c.tests * 100}%"></i></span><span class="v">${doneIn(h, c)}/${c.tests}</span><span class="chev">${I.chev}</span></a>`).join("")}</div>`;
}
function pageHome() {
  renderNav("home");
  topbar({title: esc(C.appName), sub: esc(C.church)});
  const h = hist(), done = Object.keys(h).filter(k => !k.includes(":v")).length;
  content.innerHTML = `<div class="page fade">
    <div class="head">${markImg("mark")}<div><h1>Talantul în Negoț 2027</h1><div class="muted">Pregătire pentru Concursul Biblic · ${esc(C.church)}</div></div></div>
    <p class="lead">Teste în formatul concursului, pe categorii de vârstă, după bibliografia oficială. La final vezi unde ai greșit, cu referința biblică, și urci în clasament.</p>
    <div class="verse-line"><q>„Strâng Cuvântul Tău în inima mea, ca să nu păcătuiesc împotriva Ta!”</q><cite>Psalmii 119:11</cite></div>
    <div class="group metrics" style="margin-top:16px"><div><b>${TOTAL}</b><span>teste</span></div><div><b>${CATS.length * VERSE_MODES.length}</b><span>antrenamente de versete</span></div><div><b>31</b><span>itemi · 100 p</span></div><div><b>${done}</b><span>făcute de tine</span></div></div>
    <div class="sec-h"><h2>Categorii</h2></div>${catRows(h)}
    <div class="sec-h"><h2>Clasament</h2><a href="#clasament">Vezi tot</a></div>
    <div id="podium"><div class="group"><div class="empty">Se încarcă…</div></div></div>
    <div class="sec-h"><h2>Structura testului</h2></div>
    <div class="group">${SECTIONS.map(s => `<div class="row"><span class="num">${s.roman}</span><span class="grow"><div class="t">${s.name}</div><div class="d">${s.n} itemi × ${s.per} puncte</div></span><span class="v">${s.n * s.per} p</span></div>`).join("")}</div>
    <p class="note">60 de minute · 100 de puncte. La alegerea multiplă pot fi 0, 1, 2 sau 3 răspunsuri corecte; punctele se dau doar pentru răspunsul complet.</p>
    ${installRow()}${foot()}
  </div>`;
  bindInstall(); loadPodium($("#podium"));
}
function pageTests() {
  renderNav("tests"); topbar({title: "Teste"});
  content.innerHTML = `<div class="page fade"><h1>Teste</h1><p class="lead">Alege categoria după clasa sau vârsta de la 1 ianuarie 2027.</p><div style="margin-top:18px">${catRows(hist())}</div>${foot()}</div>`;
}

/* ---------- Categorie ---------- */
const NT_DESC = {iuda: "1 capitol: lupta pentru credință și păzirea în dragostea lui Dumnezeu.", petru1: "5 capitole: nădejdea vie, preoția împărătească, suferința pentru Hristos.", filipeni: "4 capitole: bucuria în Domnul, smerenia lui Hristos, alergarea spre țintă.", galateni: "6 capitole: Evanghelia harului, libertatea în Hristos, roada Duhului.", evrei: "13 capitole: Hristos mai presus de toate, Marele Preot, eroii credinței."};
function pageCat(id, tab) {
  const c = CAT[id]; if (!c) return go("#acasa", true);
  renderNav(id); topbar({back: "#teste", title: esc(c.name), sub: `1–2 Samuel · ${esc(c.ntName)}`});
  const tests = testsFor(id), h = hist(), vs = window.VERSES[c.verses];
  content.innerHTML = `<div class="page fade">
    <div class="head">${badge(c, "l")}<div><h1>${esc(c.name)}</h1><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><span class="tag">${I.book}1 Samuel</span><span class="tag">${I.book}2 Samuel</span><span class="tag">${I.book}${esc(c.ntName)}</span></div></div></div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:18px;flex-wrap:wrap">
      <div class="seg" id="tabs"><button data-t="tests">Teste</button><button data-t="verses">Versete</button><button data-t="board">Clasament</button><button data-t="bib">Bibliografie</button></div>
      <button class="btn" id="rnd">Test la întâmplare</button>
    </div>
    <div id="body" style="margin-top:14px"></div>${foot()}</div>`;
  const body = $("#body");
  const show = t => {
    $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === t));
    if (t === "tests") {
      const part = (from, to, label) => `<div class="sec-h" style="margin-top:${from === 1 ? 4 : 22}px"><h2>${label}</h2></div><div class="group">${tests.slice(from - 1, to).map(t => { const r = h[`${id}:${t.n}`];
        return `<button class="row ind" data-n="${t.n}"><span class="num">${t.n}</span><span class="grow"><div class="t">${t.seg >= 0 ? esc(SEGS[t.seg].label) : "Recapitulare generală"}</div>
          <div class="d"><span class="lvl">${[1, 2, 3].map(i => `<i class="${i <= t.lvl ? "on" : ""}"></i>`).join("")}</span>${["", "Ușor", "Mediu", "Greu"][t.lvl]} · ${t.seg >= 0 ? "+ " + esc(c.ntName) : "toate cărțile"}</div></span>
          ${r ? `<span class="score ${scoreCls(r.best)}">${r.best} p</span>` : ""}<span class="chev">${I.chev}</span></button>`; }).join("")}</div>`;
      body.innerHTML = part(1, 15, "Pe capitole") + part(16, tests.length, "Recapitulare");
      $$("button[data-n]", body).forEach(el => el.onclick = () => startFlow(id, +el.dataset.n));
    } else if (t === "verses") {
      body.innerHTML = `<p class="note" style="margin:0 4px 10px">Antrenament doar pentru cele 10 versete de memorat ale categoriei. Fiecare antrenament are 10 întrebări a câte 10 puncte și nu intră în clasament.</p>
        <div class="group">${VERSE_MODES.map(m => { const r = h[`${id}:v${m.k}`]; return `<button class="row ind" data-v="${m.k}"><span class="num">${I.quote}</span>
          <span class="grow"><div class="t">${m.name}</div><div class="d">${m.desc}</div></span>${r ? `<span class="score ${scoreCls(r.best)}">${r.best} p</span>` : ""}<span class="chev">${I.chev}</span></button>`; }).join("")}</div>
        <div class="sec-h"><h2>Cele 10 versete</h2></div><div class="group">${vs.map(v => `<div class="vitem"><b>${esc(v.ref)}</b><div>${esc(v.text)}</div></div>`).join("")}</div>`;
      $$("button[data-v]", body).forEach(el => el.onclick = () => startFlow(id, +el.dataset.v, true));
    } else if (t === "board") { body.innerHTML = `<div id="cb"></div>`; loadBoard($("#cb"), id); }
    else {
      body.innerHTML = `<div class="sec-h" style="margin-top:4px"><h2>Cărți de studiat</h2></div><div class="group">
        <div class="vitem"><b>1 Samuel</b><div>31 de capitole: Ana și Samuel, chivotul, Saul, David și Goliat, prietenia cu Ionatan, fuga lui David.</div></div>
        <div class="vitem"><b>2 Samuel</b><div>24 de capitole: domnia lui David, chivotul la Ierusalim, legământul, Absalom, ultimele cuvinte ale lui David.</div></div>
        <div class="vitem"><b>${esc(c.ntName)}</b><div>${NT_DESC[c.nt]}</div></div>
        <div class="vitem"><b>Memorarea Scripturii</b><div>Apocalipsa 1–5 (toate categoriile).</div></div></div>
        <p class="note">Concursul se desfășoară după Biblia Dumitru Cornilescu, ediția SBR Oradea 2006.</p>`;
    }
  };
  $$("#tabs button").forEach(b => b.onclick = () => show(b.dataset.t));
  $("#rnd").onclick = () => startFlow(id, 1 + Math.floor(Math.random() * tests.length));
  show(tab || "tests");
}

/* ---------- Clasament ---------- */
function rankRow(r, full) {
  const me = S.name && nameKey(S.name) === nameKey(r.name);
  return `<div class="row ${me ? "me" : ""}"><span class="rank r${r.pos}">${r.pos}</span>
    <span class="grow"><div class="t">${esc(r.name)}${me ? ' <span class="dim">(tu)</span>' : ""}</div><div class="d">${r.tests} ${r.tests == 1 ? "test" : "teste"}${full && r.avg_score != null ? ` · media ${Number(r.avg_score).toLocaleString("ro-RO")}` : ""}</div></span>
    <span class="pts">${r.total} p</span></div>`;
}
async function loadPodium(el) {
  try {
    const rows = await API.podium(); const by = {}; rows.forEach(r => (by[r.cat] = by[r.cat] || []).push(r));
    const list = CATS.filter(c => by[c.id]);
    if (!list.length) { el.innerHTML = `<div class="group"><div class="empty">Clasamentul este încă gol. Fă un test, scrie-ți numele și fii primul.</div></div>`; return; }
    el.innerHTML = `<div class="grid cols2">${list.map(c => `<div class="group"><a class="row" href="#clasament-${c.id}">${badge(c)}<span class="grow t">${esc(c.name)}</span><span class="chev">${I.chev}</span></a>${by[c.id].map(r => rankRow(r)).join("")}</div>`).join("")}</div>`;
  } catch (e) { el.innerHTML = `<div class="group"><div class="empty">Clasamentul nu se poate încărca acum. Verifică conexiunea la internet.</div></div>`; }
}
async function loadBoard(el, cat) {
  el.innerHTML = `<div class="group"><div class="empty">Se încarcă…</div></div>`;
  try {
    const rows = await API.board(cat);
    el.innerHTML = `<div class="group">${rows.length ? rows.map(r => rankRow(r, true)).join("") : `<div class="empty">Nimeni în această categorie deocamdată.</div>`}</div>
      <p class="note">Punctele sunt suma celor mai bune scoruri ale tale la fiecare test din categorie. Cu cât faci mai multe teste și le iei mai bine, cu atât urci.</p>`;
  } catch (e) { el.innerHTML = `<div class="group"><div class="empty">Clasamentul nu se poate încărca acum. Verifică conexiunea la internet.</div></div>`; }
}
function pageBoard(cat) {
  renderNav("board"); topbar({title: "Clasament", sub: cat ? esc(CAT[cat].name) : "Toate categoriile"});
  content.innerHTML = `<div class="page fade"><h1>Clasament</h1>
    <div class="chips" id="bchips" style="margin-top:14px"><button class="${!cat ? "on" : ""}" data-c="">Toate</button>${CATS.map(c => `<button class="${cat === c.id ? "on" : ""}" data-c="${c.id}">${esc(c.short)}</button>`).join("")}</div>
    <div id="bbody" style="margin-top:12px"></div>${foot()}</div>`;
  $$("#bchips button").forEach(b => b.onclick = () => go(b.dataset.c ? `#clasament-${b.dataset.c}` : "#clasament", true));
  const on = $("#bchips .on"); on && on.scrollIntoView({inline: "center", block: "nearest"});
  if (cat) loadBoard($("#bbody"), cat); else loadPodium($("#bbody"));
}

/* ---------- Despre + instalare ---------- */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; const b = $("#instBtn"); if (b) b.hidden = false; });
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
function installRow() {
  if (isStandalone() || EMBED) return "";
  return `<div class="sec-h"><h2>Pe telefon</h2></div><div class="group"><div class="row">${markImg("mark")}<span class="grow"><div class="t">Adaugă aplicația pe ecranul principal</div>
    <div class="d">${isIOS() ? "În Safari, apasă butonul Partajează, apoi „Adaugă pe ecranul principal”." : "Se deschide ca o aplicație, pe tot ecranul, și merge și fără internet."}</div></span>
    ${isIOS() ? "" : `<button class="btn primary" id="instBtn" ${deferredPrompt ? "" : "hidden"}>Instalează</button>`}</div></div>`;
}
function bindInstall() { const b = $("#instBtn"); if (b) b.onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; b.hidden = true; }; }
function pageAbout() {
  renderNav("about"); topbar({title: "Despre concurs"});
  content.innerHTML = `<div class="page fade"><h1>Despre Talantul în Negoț</h1>
    <p class="lead">Concursul Biblic „Talantul în Negoț” este organizat de Departamentul Familii și Copii al Cultului Creștin Penticostal din România. Scopul lui este cunoașterea Cuvântului lui Dumnezeu. Se desfășoară după Biblia Cornilescu, ediția SBR Oradea 2006.</p>
    <div class="sec-h"><h2>Etape</h2></div><div class="group">${["Biserica locală", "Faza județeană", "Faza regională", "Faza națională", "Faza internațională"].map((x, i) => `<div class="row"><span class="num">${i + 1}</span><span class="grow t">${x}</span></div>`).join("")}</div>
    <div class="sec-h"><h2>Categorii (secțiunea Clasic)</h2></div><div class="group">${CATS.map(c => `<div class="row ind">${badge(c)}<span class="grow"><div class="t">${esc(c.name)}</div><div class="d">1 Samuel, 2 Samuel, ${esc(c.ntName)}</div></span></div>`).join("")}</div>
    <p class="note">Categoria se stabilește la 1 ianuarie 2027 și nu se schimbă între faze. Elevii din clasa a 11-a concurează la 10–11, iar cei din clasa a 12-a la 18–35 ani.</p>
    <div class="sec-h"><h2>Clasamentul din aplicație</h2></div><div class="group"><div class="vitem" style="font-family:var(--font)"><div style="font-family:var(--font)">Scrie-ți numele înainte de test. Pentru fiecare test se păstrează doar cel mai bun scor al tău: dacă refaci testul și iei mai puțin, rămâne scorul vechi; dacă iei mai mult, urci. Locul în clasament este suma celor mai bune scoruri la toate testele din categoria ta. Antrenamentele de versete nu intră în clasament.</div></div></div>
    ${installRow()}${foot()}</div>`;
  bindInstall();
}

/* ---------- Începerea testului ---------- */
const curKey = (cat, n, v) => `${cat}:${v ? "v" + n : n}`;
function startFlow(catId, n, verse) {
  const c = CAT[catId], cur = LS.get("tin_cur", null), key = curKey(catId, n, verse);
  const resume = cur && cur.key === key && (cur.ans || []).some(x => x != null);
  const title = verse ? VERSE_MODES.find(m => m.k === n).name : `Testul ${n}`;
  const sh = sheet(`
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:6px">${badge(c)}<div><h3>${esc(title)}</h3><div class="muted" style="font-size:12.5px">${esc(c.name)} · ${verse ? "10 întrebări · 100 de puncte · fără cronometru" : "31 de itemi · 100 de puncte · 60 de minute"}</div></div></div>
    ${verse ? `<p class="muted" style="font-size:13px;margin:10px 0 0">Antrenamentul de versete nu intră în clasament; scorul tău cel mai bun se păstrează pe acest telefon.</p>` : `
    <label class="lbl" for="nm">Numele și prenumele (pentru clasament)</label>
    <input class="field" id="nm" maxlength="40" autocomplete="name" placeholder="ex. Maria Popescu" value="${esc(S.name)}">
    <div class="note" style="margin:6px 0 0">Scrie-l la fel de fiecare dată, ca să ți se adune punctele. Lasă gol dacă nu vrei să apari în clasament.</div>
    <label class="check"><input type="checkbox" id="tm" ${LS.get("tin_timer", true) ? "checked" : ""}> Cronometru de 60 de minute</label>`}
    <div class="acts">${resume ? `<button class="btn" id="rs">Continuă</button><button class="btn primary" id="go">Începe din nou</button>` : `<button class="btn" id="cn">Anulează</button><button class="btn primary" id="go">Începe</button>`}</div>`);
  const sc = sh.el;
  $("#cn", sc) && ($("#cn", sc).onclick = sh.close);
  const begin = res => {
    if (!verse) { const nm = normName($("#nm", sc).value); if (nm && nm.length < 2) { toast("Numele trebuie să aibă cel puțin 2 litere"); return; }
      S.name = nm; LS.set("tin_name", nm); LS.set("tin_timer", $("#tm", sc).checked); }
    sh.close();
    if (!res) LS.set("tin_cur", {key, ans: [], idx: 0, start: Date.now()});
    go(verse ? `#v-${catId}-${n}` : `#t-${catId}-${n}`);
  };
  $("#go", sc).onclick = () => begin(false);
  $("#rs", sc) && ($("#rs", sc).onclick = () => begin(true));
  const nm = $("#nm", sc); nm && nm.addEventListener("keydown", e => { if (e.key === "Enter") begin(false); });
}

/* ---------- Ecranul de test ---------- */
function pageTest(catId, n, verse) {
  const c = CAT[catId]; if (!c || n < 1 || n > (verse ? VERSE_MODES.length : c.tests)) return go("#acasa", true);
  const key = curKey(catId, n, verse);
  let cur = LS.get("tin_cur", null);
  if (!cur || cur.key !== key) { cur = {key, ans: [], idx: 0, start: Date.now()}; LS.set("tin_cur", cur); }
  S.drawn = -1; S.session = verse ? makeVerseSession(catId, n) : makeSession(catId, n); S.session.key = key; S.session.verse = !!verse;
  S.ans = cur.ans || []; S.idx = Math.min(cur.idx || 0, S.session.items.length - 1); S.start = cur.start || Date.now();
  document.body.classList.add("testing");
  renderNav(catId);
  const title = verse ? S.session.T.title : `Testul ${n}`;
  topbar({back: () => { const sh = sheet(`<h3>Ieși din test?</h3><p class="muted" style="margin:0;font-size:13px">Răspunsurile rămân salvate pe acest dispozitiv; poți continua mai târziu.</p><div class="acts"><button class="btn" id="st">Rămân</button><button class="btn primary" id="lv">Ieși</button></div>`, {center: true});
      $("#st", sh.el).onclick = sh.close; $("#lv", sh.el).onclick = () => { sh.close(); go(`#c-${catId}`); }; },
    title: esc(title), sub: `${esc(c.name)}${verse ? " · versete" : " · " + esc(S.session.T.title)}`});
  content.innerHTML = `<div class="tw" id="tw"></div>`;
  clearInterval(S.timer);
  if (!verse && LS.get("tin_timer", true)) S.timer = setInterval(() => {
    const el = $("#tmr"); if (!el) return clearInterval(S.timer);
    const left = 3600 - Math.floor((Date.now() - S.start) / 1000); el.innerHTML = I.clock + fmt(Math.max(0, left)); el.classList.toggle("low", left < 300);
    if (left <= 0) { clearInterval(S.timer); toast("Timpul a expirat"); finish(); }
  }, 1000);
  drawQ();
}
function persist() { LS.set("tin_cur", {key: S.session.key, ans: S.ans, idx: S.idx, start: S.start}); }
function move(d) { const n = S.idx + d; if (n < 0 || n >= S.session.items.length) return; S.idx = n; persist(); drawQ(); window.scrollTo({top: 0}); }
const secName = it => S.session.verse ? (it.kind === "fill" ? "Cuvântul care lipsește" : it.kind === "ref" ? "Unde este scris?" : "Ordonează versetul") : SECTIONS.find(s => s.k === it.sec).name;

function drawQ() {
  const {items} = S.session, it = items[S.idx], a = S.ans[S.idx], V = S.session.verse;
  const sec = V ? null : SECTIONS.find(s => s.k === it.sec);
  const secItems = V ? items : items.filter(x => x.sec === it.sec), pos = secItems.indexOf(it) + 1;
  const cnt = countItems(items, S.ans), left = 3600 - Math.floor((Date.now() - S.start) / 1000), L = ["a", "b", "c"];
  let body = "";
  if (it.sec === "tf") {
    body = `<div class="qt">${esc(it.q.text)}</div><div class="tf">
      <button class="tfb ${a === true ? "on" : ""}" data-v="1"><span class="k">A</span>Adevărat</button>
      <button class="tfb ${a === false ? "on" : ""}" data-v="0"><span class="k">F</span>Fals</button></div>`;
  } else if (it.sec === "mc") {
    const serif = it.kind ? " serif" : "";
    const q = it.kind === "fill" ? "Care cuvânt lipsește?" : it.kind === "ref" ? "Unde este scris versetul acesta?" : "";
    body = `${q ? `<div class="qn">${q}</div>` : ""}<div class="qt${serif}">${esc(it.q.text)}</div>${it.kind === "fill" ? `<span class="ref">${I.book}${esc(it.q.ref)}</span>` : ""}
      <div class="group choices">${it.order.map((oi, i) => `<button class="choice ${a === i ? "on" : ""}" data-v="${i}"><span class="rd"></span><span class="k">${L[i]}</span><span>${esc(it.q.opts[oi])}</span></button>`).join("")}</div>`;
  } else if (it.sec === "ms") {
    const st = a || {sel: [], none: false};
    body = `<div class="qt">${esc(it.q.text)}</div><div class="qhint">Pot fi 0, 1, 2 sau 3 răspunsuri corecte. Primești 5 puncte doar dacă alegi exact răspunsurile corecte.</div>
      <div class="group choices">${it.order.map((oi, i) => `<button class="choice ${st.sel.includes(i) ? "on" : ""}" data-v="${i}"><span class="rd ck"></span><span class="k">${L[i]}</span><span>${esc(it.q.opts[oi])}</span></button>`).join("")}
      <button class="choice ${st.none ? "on" : ""}" data-v="none"><span class="rd ck"></span><span class="k"></span><span class="muted">Niciun răspuns nu este corect</span></button></div>`;
  } else if (it.sec === "mt") {
    const st = a || [null, null, null, null, null];
    body = `<div class="qt">${esc(it.q.text)}</div><div class="qhint">Pentru fiecare număr alege litera potrivită. Fiecare pereche corectă valorează 2 puncte.</div>
      <div class="group mt-list">${it.rorder.map((pi, p) => `<div class="mt-r"><b>${it.letters[p]}</b><span>${esc(it.q.pairs[pi][1])}</span></div>`).join("")}</div>
      <div class="group mt-rows">${it.q.pairs.map((p, i) => `<div class="mt-row"><div class="l"><b>${i + 1}</b>${esc(p[0])}</div><div class="letters" data-row="${i}">${it.letters.map((l, q) => `<button data-pos="${q}" class="${st[i] === q ? "on" : ""} ${st.includes(q) && st[i] !== q ? "used" : ""}">${l}</button>`).join("")}</div></div>`).join("")}</div>`;
  } else {
    const st = a || [];
    body = `<div class="qt">Așază fragmentele versetului în ordinea corectă</div><span class="ref">${I.book}${esc(it.q.ref)}</span>
      <div class="ord-ans ${st.length ? "" : "empty"}" id="oa">${st.map((pi, k) => `<button class="chip in" data-k="${k}"><span class="i">${k + 1}</span>${esc(it.parts[it.order[pi]])}</button>`).join("")}</div>
      <div class="ord-pool">${it.order.map((pIdx, pi) => `<button class="chip ${st.includes(pi) ? "gone" : ""}" data-pi="${pi}">${esc(it.parts[pIdx])}</button>`).join("")}</div>
      ${st.length ? `<button class="btn plain" id="oclr" style="margin-top:8px">Șterge ordinea</button>` : ""}`;
  }
  const isLast = S.idx === items.length - 1;
  const secStart = V ? [0] : SECTIONS.map(s => items.findIndex(x => x.sec === s.k));
  const label = V ? `${secName(it)} · 10 p` : `${sec.roman}. ${sec.name} · ${sec.per} p${it.sec === "mt" ? " pe pereche" : ""}`;
  const dotLabel = (x, i) => V ? i + 1 : x.sec === "mt" ? "III" : i - secStart[SECTIONS.findIndex(s => s.k === x.sec)] + 1;
  $("#tw").innerHTML = `
    <div class="tbar"><div class="bar-p"><i style="width:${cnt.done / cnt.total * 100}%"></i></div><span class="cnt">${cnt.done}/${cnt.total}</span>
      ${!V && LS.get("tin_timer", true) ? `<span class="timer ${left < 300 ? "low" : ""}" id="tmr">${I.clock}${fmt(Math.max(0, left))}</span>` : ""}</div>
    <div class="secl">${label}</div>
    <div class="group qbox ${S.drawn === S.idx ? "" : "fade"}" id="qc">
      <div class="qn">${it.sec === "mt" ? "Itemii 1–5" : V ? `Întrebarea ${pos} din ${items.length}` : it.sec === "or" ? `Versetul ${pos} din ${secItems.length}` : `Întrebarea ${pos} din ${secItems.length}`}</div>${body}
    </div>
    <div class="navbtns">
      <button class="btn lg" id="prev" ${S.idx === 0 ? "disabled" : ""}>${I.back}Înapoi</button><span class="sp"></span>
      ${isLast ? `<button class="btn lg primary" id="fin">Termină</button>` : `<button class="btn lg primary" id="next">Următoarea${I.next}</button>`}
    </div>
    <div class="dots">${items.map((x, i) => `${secStart.includes(i) && i ? '<span class="gap"></span>' : ""}<button class="${answered(x, S.ans[i]) ? "a" : ""} ${i === S.idx ? "cur" : ""}" data-i="${i}">${dotLabel(x, i)}</button>`).join("")}</div>
    ${isLast ? "" : `<div style="text-align:center;margin-top:14px"><button class="btn plain" id="fin2">Termină acum</button></div>`}`;
  S.drawn = S.idx;
  const qc = $("#qc"), set = v => { S.ans[S.idx] = v; persist(); drawQ(); };
  if (it.sec === "tf") $$(".tfb", qc).forEach(b => b.onclick = () => set(b.dataset.v === "1"));
  if (it.sec === "mc") $$(".choice", qc).forEach(b => b.onclick = () => set(+b.dataset.v));
  if (it.sec === "ms") $$(".choice", qc).forEach(b => b.onclick = () => {
    const o = S.ans[S.idx] ? {sel: [...S.ans[S.idx].sel], none: S.ans[S.idx].none} : {sel: [], none: false};
    if (b.dataset.v === "none") { o.none = !o.none; if (o.none) o.sel = []; }
    else { const v = +b.dataset.v; o.none = false; o.sel = o.sel.includes(v) ? o.sel.filter(x => x !== v) : [...o.sel, v]; }
    set(o); });
  if (it.sec === "mt") $$(".letters", qc).forEach(row => $$("button", row).forEach(b => b.onclick = () => {
    const o = (S.ans[S.idx] || [null, null, null, null, null]).slice(), r = +row.dataset.row, p = +b.dataset.pos;
    if (o[r] === p) o[r] = null; else { const j = o.indexOf(p); if (j >= 0) o[j] = null; o[r] = p; }
    set(o); }));
  if (it.sec === "or") {
    $$(".ord-pool .chip", qc).forEach(b => b.onclick = () => { const o = (S.ans[S.idx] || []).slice(); o.push(+b.dataset.pi); set(o); });
    $$("#oa .chip", qc).forEach(b => b.onclick = () => { const o = (S.ans[S.idx] || []).slice(); o.splice(+b.dataset.k, 1); set(o.length ? o : null); });
    $("#oclr", qc) && ($("#oclr", qc).onclick = () => set(null));
  }
  $("#prev").onclick = () => move(-1);
  $("#next") && ($("#next").onclick = () => move(1));
  $("#fin") && ($("#fin").onclick = askFinish);
  $("#fin2") && ($("#fin2").onclick = askFinish);
  $$(".dots button").forEach(b => b.onclick = () => { S.idx = +b.dataset.i; persist(); drawQ(); });
}
document.addEventListener("keydown", e => {
  if (!/^#[tv]-/.test(CUR) || !S.session || $(".scrim") || e.target.tagName === "INPUT") return;
  const it = S.session.items[S.idx], k = e.key.toLowerCase();
  if (k === "arrowright") move(1); else if (k === "arrowleft") move(-1);
  else if (it.sec === "tf" && (k === "a" || k === "f")) { S.ans[S.idx] = k === "a"; persist(); drawQ(); }
  else if ((it.sec === "mc" || it.sec === "ms") && ["1", "2", "3"].includes(k)) { const b = $$("#qc .choice")[+k - 1]; b && b.click(); }
});
function askFinish() {
  const cnt = countItems(S.session.items, S.ans), miss = cnt.total - cnt.done;
  const sh = sheet(`<h3>Termini?</h3><p class="muted" style="margin:0;font-size:13px">${miss ? `Mai ai ${miss} ${miss === 1 ? "item necompletat" : "itemi necompletați"}. Itemii fără răspuns primesc 0 puncte.` : "Ai răspuns la toți itemii."}</p>
    <div class="acts"><button class="btn" id="no">Mai verific</button><button class="btn primary" id="yes">Vezi rezultatul</button></div>`, {center: true});
  $("#no", sh.el).onclick = sh.close; $("#yes", sh.el).onclick = () => { sh.close(); finish(); };
}
function finish() {
  clearInterval(S.timer);
  const {T, items} = S.session, V = S.session.verse, sc = scoreAll(items, S.ans);
  const secs = Math.min(3600, Math.round((Date.now() - S.start) / 1000)), d = new Date().toISOString().slice(0, 10);
  S.last = {cat: T.cat, n: V ? +String(T.n).slice(1) : T.n, verse: V, items, ans: S.ans.slice(), sc, secs, name: S.name, d, id: Date.now()};
  LS.set("tin_last", {cat: S.last.cat, n: S.last.n, verse: V, ans: S.last.ans, secs, name: S.name, d, id: S.last.id});
  saveHist(S.session.key, sc.total); LS.del("tin_cur");
  go("#rezultat");
}

/* ---------- Rezultat ---------- */
const tier = s => s >= 90 ? "high" : s >= 60 ? "mid" : "low";
function message(s) {
  if (s >= 90) return ["Excelent", "„Bine, rob bun și credincios!” Ai strâns Cuvântul în inima ta."];
  if (s >= 75) return ["Foarte bine", "Mai ai puțin până la punctajul maxim. Uită-te la greșeli și încearcă din nou."];
  if (s >= 60) return ["Bine", "Ești pe drumul cel bun. Recitește capitolele unde ai greșit."];
  if (s >= 40) return ["Nu te descuraja", "Fiecare test te face mai puternic în Cuvânt. Citește din nou și revino."];
  return ["Curaj, încearcă din nou", "Citește capitolele cu atenție; vei vedea cum crește punctajul."];
}
const pickVerse = (score, seed) => { const a = ENC[tier(score)]; return a[Math.floor(rngFor("v" + seed)() * a.length)]; };
const encodePayload = o => [...new TextEncoder().encode([o.c, o.t, o.s, o.m, o.d, o.p.join("."), o.n].join("|"))].map(x => x.toString(16).padStart(2, "0")).join("");
function decodePayload(p) { try { const a = new TextDecoder().decode(new Uint8Array(p.match(/../g).map(h => parseInt(h, 16)))).split("|");
  return {c: a[0], t: +a[1], s: +a[2], m: +a[3], d: a[4], p: a[5].split(".").map(Number), n: a.slice(6).join("|")}; } catch (e) { return null; } }
const shareUrl = L => L.verse ? `${location.origin}${location.pathname}#acasa` : `${location.origin}${location.pathname}#r-${encodePayload({c: L.cat, t: L.n, s: L.sc.total, n: L.name || "", m: L.secs, d: L.d, p: SECTIONS.map(s => L.sc.per[s.k])})}`;

function pageResult() {
  if (!S.last) { const l = LS.get("tin_last", null); if (!l) return go("#acasa", true);
    const ses = l.verse ? makeVerseSession(l.cat, l.n) : makeSession(l.cat, l.n); S.last = {...l, items: ses.items, sc: scoreAll(ses.items, l.ans)}; }
  document.body.classList.remove("testing");
  const L = S.last, c = CAT[L.cat], score = L.sc.total, V = L.verse;
  const tName = V ? VERSE_MODES.find(m => m.k === L.n).name : `Testul ${L.n}`;
  renderNav(L.cat); topbar({back: `#c-${L.cat}`, title: `Rezultat · ${esc(tName)}`, sub: esc(c.name)});
  const [m1, m2] = message(score), [vr, vt] = pickVerse(score, L.cat + L.n + score);
  const R = 64, CC = 2 * Math.PI * R, col = score >= 90 ? "var(--green)" : score >= 60 ? "var(--orange)" : "var(--red)";
  const all = L.items.map((it, i) => ({it, i, r: L.sc.res[i]})), wrong = all.filter(x => x.r.pts < x.r.max);
  const nextN = !V && L.n < c.tests ? L.n + 1 : null;
  const rows = V ? [] : SECTIONS.map(s => ({name: `${s.roman}. ${s.short}`, p: L.sc.per[s.k], m: L.sc.max[s.k]}));
  content.innerHTML = `<div class="page fade">
    <div class="group">
      <div class="res">
        <div class="ringw"><svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="${R}" fill="none" stroke="var(--fill)" stroke-width="8"/>
          <circle id="arc" cx="75" cy="75" r="${R}" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${CC}" stroke-dashoffset="${CC}" style="transition:stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)"/></svg>
          <div class="v"><div><b id="sn">0</b><span>din 100 de puncte</span></div></div></div>
        <div><p class="msg">${m1}</p><p class="muted" style="margin:4px 0 0">${m2}</p>
          <div class="meta">${L.name && !V ? esc(L.name) + " · " : ""}${V ? "Antrenament de versete · " : ""}Timp ${fmt(L.secs)} · ${new Date(L.d).toLocaleDateString("ro-RO", {day: "numeric", month: "long", year: "numeric"})}</div></div>
      </div>
      ${rows.length ? rows.map(r => `<div class="row"><span class="grow">${r.name}</span><span class="minibar"><i class="${r.p === r.m ? "full" : ""}" data-w="${r.p / r.m * 100}" style="width:0"></i></span><span class="v" style="width:52px;text-align:right">${r.p}/${r.m}</span></div>`).join("") : ""}
      <div id="rank"></div>
      <div class="actions">
        ${V ? "" : `<button class="btn" id="shBtn">${I.share}Distribuie</button><button class="btn" id="waBtn">${I.msg}WhatsApp</button><button class="btn" id="imBtn">${I.img}Imagine</button><button class="btn" id="cpBtn">${I.link}Copiază linkul</button>`}
        <button class="btn" id="rdBtn">${I.redo}Refă</button>
        ${nextN ? `<button class="btn primary" id="nxBtn">Testul ${nextN}${I.next}</button>` : ""}
      </div>
    </div>
    <div class="verse-line" style="margin-top:14px"><q>${esc(vt)}</q><cite>${esc(vr)}</cite></div>
    <div class="sec-h"><h2>Corectura</h2><div class="seg" id="rf"><button data-f="wrong" class="${S.reviewFilter === "wrong" ? "on" : ""}">Greșeli (${wrong.length})</button><button data-f="all" class="${S.reviewFilter === "all" ? "on" : ""}">Toate</button></div></div>
    <div class="group" id="rev"></div>
    ${V ? "" : `<div class="sec-h"><h2>Cei mai buni la acest test</h2></div><div id="ttop"><div class="group"><div class="empty">Se încarcă…</div></div></div>`}
    ${foot()}</div>`;
  setTimeout(() => { $("#arc").style.strokeDashoffset = CC * (1 - score / 100); $$(".minibar i").forEach(i => i.style.width = i.dataset.w + "%"); }, 60);
  animateNum($("#sn"), score);
  if (score >= 90) confetti();
  const drawRev = () => { const list = S.reviewFilter === "wrong" ? wrong : all;
    $("#rev").innerHTML = list.length ? list.map(x => reviewItem(x.it, L.ans[x.i], x.r)).join("") : `<div class="empty">Nicio greșeală. Ai răspuns corect la tot.</div>`; };
  drawRev();
  $$("#rf button").forEach(b => b.onclick = () => { S.reviewFilter = b.dataset.f; $$("#rf button").forEach(x => x.classList.toggle("on", x === b)); drawRev(); });
  $("#rdBtn").onclick = () => startFlow(L.cat, L.n, V);
  $("#nxBtn") && ($("#nxBtn").onclick = () => startFlow(L.cat, nextN));
  if (V) return;
  const url = shareUrl(L);
  const text = `${L.name ? L.name + " a" : "Am"} obținut ${score}/100 la Testul ${L.n}, ${c.name} — Talantul în Negoț 2027 (${C.church}). Încearcă și tu:`;
  $("#cpBtn").onclick = () => copy(EMBED ? text : url, EMBED ? "Text copiat" : "Link copiat");
  $("#waBtn").onclick = () => { const u = "https://wa.me/?text=" + encodeURIComponent(text + (EMBED ? "" : " " + url)); const w = window.open(u, "_blank"); if (!w) location.href = u; };
  $("#shBtn").onclick = async () => {
    if (!EMBED && navigator.share) { try { await navigator.share({title: "Talantul în Negoț — rezultat", text, url}); return; } catch (e) { if (e.name === "AbortError") return; } }
    copy(EMBED ? text : text + " " + url, "Copiat. Lipește textul unde vrei să-l trimiți.");
  };
  $("#imBtn").onclick = async () => {
    const blob = await shareImage(L, vr, vt), file = new File([blob], `talant-test${L.n}-${score}p.png`, {type: "image/png"});
    if (!EMBED && navigator.canShare && navigator.canShare({files: [file]})) { try { await navigator.share({files: [file], text: text + " " + url}); return; } catch (e) { if (e.name === "AbortError") return; } }
    const src = URL.createObjectURL(blob);
    const sh = sheet(`<img src="${src}" alt="Rezultat" style="width:100%;max-height:60dvh;object-fit:contain;border-radius:10px;box-shadow:var(--ring)">
      <p class="muted" style="font-size:12.5px;margin:10px 0 0;text-align:center">Pe telefon, ține apăsat pe imagine pentru a o salva sau trimite.</p>
      <div class="acts">${EMBED ? "" : `<a class="btn" href="${src}" download="${file.name}">${I.dl}Descarcă</a>`}<button class="btn primary" id="ok">Gata</button></div>`, {center: true});
    $("#ok", sh.el).onclick = () => { sh.close(); URL.revokeObjectURL(src); };
  };
  submitAndRank(L);
}
async function submitAndRank(L) {
  const box = $("#rank"), done = LS.get("tin_sent", {});
  const row = (big, html) => `<a class="row click" href="#clasament-${L.cat}" style="border-top:.5px solid var(--line)"><span class="rank r${big}" style="width:auto;min-width:36px;font-size:18px">${typeof big === "number" ? "#" + big : big}</span><span class="grow d" style="font-size:13px;color:var(--text)">${html}</span><span class="chev">${I.chev}</span></a>`;
  const show = r => { if (!box) return;
    const imp = r.improved ? (r.previous != null ? `Ai urcat de la ${r.previous} la ${L.sc.total} de puncte la acest test.` : "Primul tău scor la acest test a intrat în clasament.") : `Cel mai bun scor al tău la acest test rămâne ${r.previous} de puncte.`;
    box.innerHTML = row(r.rank, `<b>Locul ${r.rank} în ${esc(CAT[L.cat].name)}</b> · ${r.total} p din ${r.tests} ${r.tests == 1 ? "test" : "teste"}<br><span class="muted">${imp}</span>`); };
  if (!L.name) { if (box) box.innerHTML = `<div class="row" style="border-top:.5px solid var(--line)"><span class="grow d">Ca să apari în clasament, scrie-ți numele data viitoare, înainte de test.</span></div>`; }
  else if (L.id && done[L.id]) show(done[L.id]);
  else {
    if (box) box.innerHTML = `<div class="row" style="border-top:.5px solid var(--line)"><span class="grow d">Se trimite rezultatul în clasament…</span></div>`;
    const o = {name: L.name, cat: L.cat, n: L.n, score: L.sc.total, secs: L.secs};
    try { const r = await API.submit(o); if (L.id) { done[L.id] = r; const ks = Object.keys(done); if (ks.length > 30) delete done[ks[0]]; LS.set("tin_sent", done); } show(r); }
    catch (e) {
      if (/invalid|prea multe/i.test(e.message)) { if (box) box.innerHTML = `<div class="row"><span class="grow d">Rezultatul nu a putut fi trimis (${esc(e.message)}).</span></div>`; }
      else { const q = LS.get("tin_queue", []); q.push(o); LS.set("tin_queue", q); if (L.id) { done[L.id] = {rank: "–", total: "…", tests: "…", improved: true}; LS.set("tin_sent", done); }
        if (box) box.innerHTML = `<div class="row" style="border-top:.5px solid var(--line)"><span class="grow d"><b>Fără conexiune la internet.</b> Rezultatul se trimite automat în clasament când revine conexiunea.</span></div>`; }
    }
  }
  try {
    const top = await API.testTop(L.cat, L.n), el = $("#ttop"); if (!el) return;
    el.innerHTML = `<div class="group">${top.length ? top.map(r => { const me = L.name && nameKey(L.name) === nameKey(r.name);
      return `<div class="row ${me ? "me" : ""}"><span class="rank r${r.pos}">${r.pos}</span><span class="grow"><div class="t">${esc(r.name)}${me ? ' <span class="dim">(tu)</span>' : ""}</div><div class="d">timp ${fmt(r.secs)}</div></span><span class="pts">${r.score} p</span></div>`; }).join("")
      : `<div class="empty">Încă nimeni la acest test.</div>`}</div>`;
  } catch (e) { const el = $("#ttop"); if (el) el.innerHTML = `<div class="group"><div class="empty">Nu se poate încărca acum.</div></div>`; }
}
function copy(t, msg) {
  const fb = () => { const ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (e) {} ta.remove();
    if (ok) toast(msg); else { const sh = sheet(`<h3>Copiază</h3><textarea class="field" style="height:110px;padding:8px" readonly>${esc(t)}</textarea><div class="acts"><button class="btn primary" id="ok">Gata</button></div>`, {center: true}); $("#ok", sh.el).onclick = sh.close; $("textarea", sh.el).select(); } };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(() => toast(msg), fb); else fb();
}
function animateNum(el, to) { const t0 = performance.now(); const f = t => { const p = Math.min(1, (t - t0) / 1000); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }

function reviewItem(it, a, r) {
  const L = ["a", "b", "c"], st = r.pts === r.max ? "ok" : r.pts > 0 ? "part" : "no";
  let q = esc(it.q.text), ans = "", extra = "";
  if (it.sec === "tf") {
    ans = `${a == null ? `<span class="y">Fără răspuns</span>` : `<span class="${a === it.q.ans ? "c" : "y"}">Răspunsul tău: ${a ? "Adevărat" : "Fals"}</span>`}${a !== it.q.ans ? `<span class="c">Corect: ${it.q.ans ? "Adevărat" : "Fals"}</span>` : ""}`;
    if (!it.q.ans && it.q.fix) extra = `<div class="fix">${esc(it.q.fix)}</div>`;
  } else if (it.sec === "mc") {
    if (it.kind) q = it.kind === "fill" ? "Cuvântul care lipsește" : "Unde este scris versetul?";
    ans = `${a == null ? `<span class="y">Fără răspuns</span>` : `<span class="${a === it.correct ? "c" : "y"}">Răspunsul tău: ${L[a]}) ${esc(it.q.opts[it.order[a]])}</span>`}${a !== it.correct ? `<span class="c">Corect: ${L[it.correct]}) ${esc(it.q.opts[0])}</span>` : ""}`;
    if (it.kind) extra = `<div class="fix">${esc(it.q.full)}</div>`;
  } else if (it.sec === "ms") {
    const f = arr => arr.length ? arr.map(i => `${L[i]}) ${esc(it.q.opts[it.order[i]])}`).join("; ") : "niciun răspuns corect";
    const mine = !a || (!a.none && !a.sel.length) ? null : (a.none ? [] : a.sel.slice().sort());
    ans = `${mine == null ? `<span class="y">Fără răspuns</span>` : `<span class="${r.pts ? "c" : "y"}">Răspunsul tău: ${f(mine)}</span>`}${r.pts ? "" : `<span class="c">Corect: ${f(it.correct)}</span>`}`;
  } else if (it.sec === "mt") {
    ans = it.q.pairs.map((p, i) => { const m = a && a[i] != null ? a[i] : null, ok = m === it.correct[i];
      return `<span class="${ok ? "c" : "y"}">${i + 1}. ${esc(p[0])} → ${m == null ? "—" : it.letters[m]}${ok ? "" : ` <span class="c">(corect: ${it.letters[it.correct[i]]}, ${esc(p[1])})</span>`}</span>`; }).join("");
  } else {
    q = "Ordonează versetul";
    ans = a && a.length ? `<span class="${r.pts ? "c" : "y"}">Ordinea ta: ${esc(a.map(pi => it.parts[it.order[pi]]).join(" "))}</span>` : `<span class="y">Fără răspuns</span>`;
    if (!r.pts) extra = `<div class="fix">${esc(it.q.text)}</div>`;
  }
  return `<div class="rev"><span class="st ${st}">${st === "ok" ? I.ok : st === "part" ? I.half : I.no}</span><div>
    <div class="rq">${q}</div><div class="ra">${ans}</div>${extra}
    <div class="rm"><span class="ref">${I.book}${esc(it.q.ref)}</span><span>${r.pts}/${r.max} p</span></div></div></div>`;
}

/* ---------- Rezultat distribuit ---------- */
function pageShared(p) {
  const o = decodePayload(p), c = o && CAT[o.c];
  renderNav(""); topbar({title: "Rezultat distribuit"});
  if (!o || !c || !(o.t >= 1 && o.t <= c.tests)) { content.innerHTML = `<div class="page"><div class="group pad" style="text-align:center"><h2>Linkul nu este valid</h2><p><a class="btn primary" href="#acasa">Mergi la teste</a></p></div></div>`; return; }
  const [m1] = message(o.s), col = o.s >= 90 ? "var(--green)" : o.s >= 60 ? "var(--orange)" : "var(--red)", [vr, vt] = pickVerse(o.s, o.c + o.t + o.s);
  content.innerHTML = `<div class="page fade" style="max-width:520px">
    <div class="group" style="text-align:center;padding:26px 20px 18px">
      ${badge(c, "l")}<div class="muted" style="margin-top:10px;font-size:13px">${esc(c.name)} · Testul ${o.t}</div>
      <h2 style="font-size:17px;margin-top:4px">${o.n ? esc(o.n) + " a obținut" : "Rezultat obținut"}</h2>
      <div style="font-size:64px;font-weight:600;letter-spacing:-.04em;line-height:1.1;color:${col};font-variant-numeric:tabular-nums">${o.s}<span style="font-size:20px;color:var(--text-3)"> / 100</span></div>
      <p class="msg" style="font-size:16px;margin-top:6px">${m1}</p>
    </div>
    <div class="group" style="margin-top:12px">${SECTIONS.map((s, i) => `<div class="row"><span class="grow">${s.roman}. ${s.short}</span><span class="minibar"><i style="width:${(o.p[i] || 0) / (s.per * s.n) * 100}%"></i></span><span class="v" style="width:52px;text-align:right">${o.p[i] || 0}/${s.per * s.n}</span></div>`).join("")}</div>
    <div class="verse-line"><q>${esc(vt)}</q><cite>${esc(vr)}</cite></div>
    <button class="btn lg primary block" id="try" style="margin-top:18px">Fă și tu testul acesta</button>
    <a class="btn lg block" href="#acasa" style="margin-top:8px">Toate testele</a>
    <p class="note" style="text-align:center">${o.d ? new Date(o.d).toLocaleDateString("ro-RO", {day: "numeric", month: "long", year: "numeric"}) : ""}${o.m ? " · timp " + fmt(o.m) : ""}</p>${foot()}</div>`;
  $("#try").onclick = () => startFlow(o.c, o.t);
}

/* ---------- Imaginea pentru distribuire ---------- */
const imgs = {};
["mark", "full"].forEach(k => { const im = new Image(); im.onload = () => { imgs[k] = im; }; im.src = k === "mark" ? C.logo : "img/agape-full.svg"; });
function shareImage(L, vr, vt) {
  const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  const c = CAT[L.cat], score = L.sc.total, F = "-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue','Segoe UI',Roboto,sans-serif", SF = "'New York',Georgia,serif";
  g.fillStyle = "#f5f5f7"; g.fillRect(0, 0, W, H);
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.save(); g.shadowColor = "rgba(0,0,0,.08)"; g.shadowBlur = 30; g.shadowOffsetY = 8; g.fillStyle = "#fff"; rr(70, 70, W - 140, H - 140, 36); g.fill(); g.restore();
  g.textAlign = "center";
  if (imgs.full) { const h = 92, w = h * imgs.full.width / imgs.full.height; g.drawImage(imgs.full, W / 2 - w / 2, 120, w, h); }
  g.fillStyle = "#86868b"; g.font = `500 30px ${F}`; g.fillText("Talantul în Negoț 2027", W / 2, 268);
  g.fillStyle = c.color; rr(W / 2 - 150, 300, 300, 50, 12); g.fill(); g.fillStyle = "#fff"; g.font = `600 26px ${F}`; g.fillText(`${c.name} · Testul ${L.n}`, W / 2, 334);
  g.fillStyle = "#1d1d1f"; g.font = `600 52px ${F}`; g.fillText(L.name || "Rezultatul meu", W / 2, 440);
  const col = score >= 90 ? "#28a745" : score >= 60 ? "#f5a623" : "#e5484d";
  g.lineWidth = 22; g.strokeStyle = "#ececf0"; g.beginPath(); g.arc(W / 2, 640, 150, 0, 7); g.stroke();
  g.strokeStyle = col; g.lineCap = "round"; g.beginPath(); g.arc(W / 2, 640, 150, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(score, .5) / 100); g.stroke();
  g.fillStyle = "#1d1d1f"; g.font = `600 128px ${F}`; g.fillText(String(score), W / 2, 685);
  g.fillStyle = "#86868b"; g.font = `500 28px ${F}`; g.fillText("din 100 de puncte", W / 2, 730);
  g.fillStyle = "#1d1d1f"; g.font = `600 42px ${F}`; g.fillText(message(score)[0], W / 2, 870);
  g.fillStyle = "#3a3a3c"; g.font = `italic 400 32px ${SF}`;
  const words = ("„" + vt.replace(/^„|”$/g, "") + "”").split(" "), lines = []; let line = "";
  words.forEach(w => { const t = line ? line + " " + w : w; if (g.measureText(t).width > W - 280) { lines.push(line); line = w; } else line = t; }); if (line) lines.push(line);
  const shown = lines.slice(0, 5); if (lines.length > 5) shown[4] = shown[4].replace(/\s+\S+$/, "") + "…";
  shown.forEach((l, i) => g.fillText(l, W / 2, 950 + i * 46));
  g.fillStyle = "#007aff"; g.font = `600 28px ${F}`; g.fillText(vr, W / 2, 950 + shown.length * 46 + 18);
  g.fillStyle = "#a1a1a6"; g.font = `500 24px ${F}`; g.fillText(location.host || "talantul-in-negot.vercel.app", W / 2, H - 110);
  return new Promise(res => cv.toBlob(res, "image/png"));
}

/* ---------- Confetti discret ---------- */
function confetti() {
  const cv = document.createElement("canvas"); cv.className = "confetti"; cv.width = innerWidth; cv.height = innerHeight; document.body.appendChild(cv);
  const g = cv.getContext("2d"), cols = ["#007aff", "#34c759", "#ff9500", "#af52de", "#ff2d55"];
  const P = Array.from({length: 110}, () => ({x: innerWidth / 2 + (Math.random() - .5) * 160, y: innerHeight * .3, vx: (Math.random() - .5) * 14, vy: -Math.random() * 13 - 4, r: Math.random() * 5 + 3, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6}));
  let f = 0; const step = () => { g.clearRect(0, 0, cv.width, cv.height); P.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .42; p.vx *= .99; p.a += .2; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * .6); g.restore(); });
    if (f++ < 150) requestAnimationFrame(step); else cv.remove(); }; step();
}

/* ---------- Router ---------- */
function route() {
  const h = CUR || "#acasa";
  clearInterval(S.timer); $$(".scrim").forEach(e => e.remove());
  if (!/^#[tv]-/.test(h)) document.body.classList.remove("testing");
  let m;
  if ((m = h.match(/^#c-(\w+?)(?:-(versete|clasament))?$/))) pageCat(m[1], m[2] === "versete" ? "verses" : m[2] === "clasament" ? "board" : null);
  else if ((m = h.match(/^#t-(\w+)-(\d+)$/))) pageTest(m[1], +m[2], false);
  else if ((m = h.match(/^#v-(\w+)-(\d+)$/))) pageTest(m[1], +m[2], true);
  else if (h === "#rezultat") pageResult();
  else if ((m = h.match(/^#r-([0-9a-f]+)$/))) pageShared(m[1]);
  else if ((m = h.match(/^#clasament(?:-(\w+))?$/))) pageBoard(m[1] && CAT[m[1]] ? m[1] : null);
  else if (h === "#teste") pageTests();
  else if (h === "#despre") pageAbout();
  else pageHome();
  window.scrollTo({top: 0});
}
const fromUrl = () => { CUR = location.hash || "#acasa"; route(); };
window.addEventListener("popstate", fromUrl);
window.addEventListener("hashchange", fromUrl);
window.addEventListener("online", flushQueue);
route(); flushQueue();

/* ---------- Aplicație instalabilă + actualizare automată ---------- */
if ("serviceWorker" in navigator && !EMBED && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").then(reg => { setInterval(() => reg.update(), 30 * 60 * 1000); }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (reloaded || /^#[tv]-/.test(CUR)) return; reloaded = true; toast("Aplicația a fost actualizată"); });
}
})();
