// Interfața aplicației: pagini, test, rezultat, clasament, distribuire.
(() => {
"use strict";
const {CATS, CAT, TOTAL_TESTS, SECTIONS, ENC, rngFor, SEGS, testsFor, makeSession, scoreAll, answered, countItems} = window.TIN;
const C = window.CONFIG;
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
const icTxt = c => c.ic;

/* ---------- Supabase (clasament) ---------- */
const API = {
  async rpc(fn, body) {
    const r = await fetch(`${C.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {"Content-Type": "application/json", apikey: C.supabaseKey, Authorization: `Bearer ${C.supabaseKey}`},
      body: JSON.stringify(body || {})
    });
    if (!r.ok) { let m = ""; try { m = (await r.json()).message; } catch (e) {} throw new Error(m || ("HTTP " + r.status)); }
    return r.json();
  },
  submit: o => API.rpc("submit_result", {p_name: o.name, p_cat: o.cat, p_test: o.n, p_score: o.score, p_secs: o.secs}),
  board: cat => API.rpc("get_leaderboard", {p_cat: cat, p_limit: 100}),
  podium: () => API.rpc("get_podium"),
  testTop: (cat, n) => API.rpc("get_test_top", {p_cat: cat, p_test: n})
};
// trimiteri rămase netrimise (fără internet) — se reîncearcă
async function flushQueue() {
  const q = LS.get("tin_queue", []); if (!q.length) return;
  const rest = [];
  for (const o of q) { try { await API.submit(o); } catch (e) { if (!/invalid|prea multe/i.test(e.message)) rest.push(o); } }
  LS.set("tin_queue", rest);
}

/* ---------- Stare ---------- */
const S = {session: null, ans: [], idx: 0, start: 0, timer: null, name: LS.get("tin_name", ""), last: null, reviewFilter: "wrong", drawn: -1};
const hist = () => LS.get("tin_hist", {});
function saveHist(cat, n, score) {
  const h = hist(); const k = `${cat}:${n}`; const o = h[k] || {best: 0, tries: 0};
  o.best = Math.max(o.best, score); o.tries++; o.last = score; o.at = Date.now(); h[k] = o; LS.set("tin_hist", h);
}

/* ---------- Icoane ---------- */
const I = {
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  next:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>',
  share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>',
  link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a5 5 0 007.1 0l3-3a5 5 0 00-7.1-7.1l-1 1"/><path d="M14 10a5 5 0 00-7.1 0l-3 3a5 5 0 007.1 7.1l1-1"/></svg>',
  img:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>',
  wa:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.7 11.8 11.8 0 004.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 001.8-1.2 2.2 2.2 0 00.1-1.2c0-.1-.2-.2-.4-.3z"/></svg>',
  redo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  clock:'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  check:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
  book:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/></svg>',
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
  trophy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z"/><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5M9 8h6M9 12h6"/></svg>',
  dl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>'
};

/* ---------- Temă ---------- */
const prefDark = () => window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
function applyTheme(t) {
  document.documentElement.dataset.theme = t; LS.set("tin_theme", t);
  const b = $("#themeBtn"); if (b) b.innerHTML = t === "dark" ? I.sun : I.moon;
  const m = $('meta[name="theme-color"]'); if (m) m.content = t === "dark" ? "#000000" : "#f2f2f7";
}
applyTheme(LS.get("tin_theme", prefDark() ? "dark" : "light"));

/* ---------- Schelet ---------- */
const logoHtml = cls => `<img class="${cls}" src="${C.logo}" alt="${esc(C.church)}" onerror="this.outerHTML='<span class=&quot;${cls}&quot;>✝</span>'">`;
document.getElementById("app").innerHTML = `
<div class="app">
  <aside class="side">
    <a class="brand" href="#acasa">${logoHtml("logo")}<span><b>${esc(C.appName)}</b><small>${esc(C.church)}</small></span></a>
    <nav class="nav" id="nav"></nav>
    <div class="side-foot">© ${C.year} ${esc(C.author)}<br>Realizat pentru ${esc(C.church)}<br>Biblia Cornilescu · Bibliografia CBTN 2027</div>
  </aside>
  <div class="main">
    <header class="top" id="top"></header>
    <main id="content"></main>
  </div>
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
  const done = c => Object.keys(h).filter(k => k.startsWith(c.id + ":")).length;
  $("#nav").innerHTML = `
    <a class="nav-item ${active === "home" ? "on" : ""}" href="#acasa"><span class="ic" style="background:linear-gradient(135deg,#5e5ce6,#ec6a9c)">${I.home}</span>Acasă</a>
    <a class="nav-item ${active === "board" ? "on" : ""}" href="#clasament"><span class="ic" style="background:linear-gradient(135deg,#ffd75e,#f0a500)">${I.trophy}</span>Clasament</a>
    <div class="nav-label">Categorii</div>
    ${CATS.map(c => `<a class="nav-item ${active === c.id ? "on" : ""}" href="#c-${c.id}"><span class="ic" style="background:${c.grad}">${c.ic.replace("–", "")}</span>${esc(c.short)}<span class="cnt">${done(c)}/${c.tests}</span></a>`).join("")}
    <div class="nav-label">Altele</div>
    <a class="nav-item ${active === "about" ? "on" : ""}" href="#despre"><span class="ic" style="background:linear-gradient(135deg,#98989d,#636366)">${I.info}</span>Despre concurs</a>`;
  const tabMap = {home: "home", tests: "tests", board: "board", about: "about"};
  const t = tabMap[active] || (CAT[active] ? "tests" : "");
  $$("#tabbar a").forEach(a => a.classList.toggle("on", a.dataset.t === t));
}
function topbar({back, title, sub, right = ""}) {
  $("#top").innerHTML = `
    ${back ? `<button class="ib" id="backBtn" aria-label="Înapoi">${I.back}</button>` : `<span class="only-m" style="width:4px"></span>`}
    <div style="min-width:0"><div class="ttl">${title}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>
    <span class="sp"></span>${right}
    <button class="ib" id="themeBtn" aria-label="Schimbă tema">${document.documentElement.dataset.theme === "dark" ? I.sun : I.moon}</button>`;
  if (back) $("#backBtn").onclick = typeof back === "function" ? back : () => go(back);
  $("#themeBtn").onclick = () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}
function toast(msg, ms = 2400) { $$(".toast").forEach(t => t.remove()); const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
function sheet(html, opts = {}) {
  const sc = document.createElement("div"); sc.className = "scrim" + (opts.center ? " center" : "");
  sc.innerHTML = `<div class="sheet">${html}</div>`; document.body.appendChild(sc);
  const close = () => sc.remove();
  sc.addEventListener("click", e => { if (e.target === sc && !opts.modal) close(); });
  return {el: sc, close};
}
const foot = () => `<div class="foot">© ${C.year} <b>${esc(C.author)}</b> · Realizat cu drag pentru <b>${esc(C.church)}</b><br>Platformă neoficială de pregătire. Întrebările urmează Biblia Cornilescu (SBR 2006); verifică mereu în Biblie.<br>Regulamentul oficial: <a href="https://talantulinnegot.com" target="_blank" rel="noopener">talantulinnegot.com</a> · v${esc(C.version)}</div>`;

/* ---------- Navigare ---------- */
let CUR = location.hash || "#acasa";
function go(h, replace) {
  CUR = h;
  if (!EMBED) { try { if (location.hash !== h) history[replace ? "replaceState" : "pushState"](null, "", h); } catch (e) {} }
  route();
}
window.__go = go;
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest('a[href^="#"]');
  if (a) { e.preventDefault(); go(a.getAttribute("href")); }
});

/* ---------- Acasă ---------- */
function pageHome() {
  renderNav("home");
  topbar({title: esc(C.appName), sub: esc(C.church)});
  const h = hist(); const done = Object.keys(h).length;
  content.innerHTML = `<div class="page fade">
    <section class="hero">
      <div class="tag">${logoHtml("")}${esc(C.church)} · Concursul Biblic 2027</div>
      <h1>Pregătire pentru Talantul în Negoț</h1>
      <p>Teste în formatul concursului, pe categorii de vârstă, după bibliografia oficială. Fă un test, vezi unde ai greșit și urcă în clasament!</p>
      <blockquote>„Strâng Cuvântul Tău în inima mea, ca să nu păcătuiesc împotriva Ta!”<cite>Psalmii 119:11</cite></blockquote>
      <div class="stats"><div><b>${TOTAL_TESTS}</b>teste</div><div><b>8</b>categorii</div><div><b>31</b>itemi · 100 p</div><div><b>${done}</b>făcute de tine</div></div>
    </section>
    <div class="sec-h"><h2>Alege categoria ta</h2></div>
    ${catGrid(h)}
    <div class="sec-h"><h2>Clasament</h2><a href="#clasament" class="btn ghost sm">Vezi tot</a></div>
    <div class="grid podium" id="podium"><div class="list"><div class="empty">Se încarcă…</div></div></div>
    <div class="sec-h"><h2>Cum arată testul</h2></div>
    <div class="card">
      <div class="bars">${SECTIONS.map(s => `<div class="bar"><span><b>${s.roman}.</b> ${s.short}</span><div class="tr"><i style="width:${s.per * s.n * 2.5}%"></i></div><span class="pt">${s.n * s.per} p</span></div>`).join("")}</div>
      <p class="dim" style="margin:14px 0 0;font-size:14px">60 de minute · 100 de puncte. La alegerea multiplă pot fi 0, 1, 2 sau 3 răspunsuri corecte; punctele se dau doar pentru răspunsul complet. La final vezi greșelile cu referința biblică.</p>
    </div>
    ${installCard()}
    ${foot()}
  </div>`;
  bindInstall();
  loadPodium($("#podium"), 4);
}
function catGrid(h) {
  return `<div class="grid cats">${CATS.map(c => { const d = Object.keys(h).filter(k => k.startsWith(c.id + ":")).length; return `
    <a class="card cat" href="#c-${c.id}">
      <div class="appic" style="background:${c.grad}">${c.ic}</div>
      <div><div class="t">${esc(c.name)}</div><div class="b">1–2 Samuel · ${esc(c.ntName)}</div></div>
      <div class="prog-s"><i style="width:${Math.round(d / c.tests * 100)}%;background:${c.color}"></i></div>
      <div class="b" style="font-size:12px">${d} din ${c.tests} teste făcute</div>
    </a>`; }).join("")}</div>`;
}
function pageTests() {
  renderNav("tests");
  topbar({title: "Teste", sub: "Alege categoria de vârstă"});
  content.innerHTML = `<div class="page fade"><p class="muted" style="margin:0 0 14px">Categoria se stabilește după clasa sau vârsta de la 1 ianuarie 2027.</p>${catGrid(hist())}${foot()}</div>`;
}

/* ---------- Categorie ---------- */
function pageCat(id) {
  const c = CAT[id]; if (!c) return go("#acasa", true);
  renderNav(id);
  topbar({back: "#teste", title: esc(c.name), sub: `1–2 Samuel · ${esc(c.ntName)}`});
  const tests = testsFor(id), h = hist(), vs = window.VERSES[c.verses];
  content.innerHTML = `<div class="page fade">
    <div class="cat-head"><div class="appic" style="background:${c.grad}">${c.ic}</div>
      <div><h1 style="margin:0">${esc(c.name)}</h1><div class="books"><span class="pill">${I.book} 1 Samuel</span><span class="pill">${I.book} 2 Samuel</span><span class="pill" style="color:${c.color}">${I.book} ${esc(c.ntName)}</span></div></div></div>
    <div class="row" style="justify-content:space-between">
      <div class="seg" id="tabs"><button class="on" data-t="tests">Teste</button><button data-t="board">Clasament</button><button data-t="bib">Bibliografie</button></div>
      <button class="btn primary sm" id="rnd">Test la întâmplare</button>
    </div>
    <div id="body" style="margin-top:16px"></div>
    ${foot()}
  </div>`;
  const body = $("#body");
  const show = t => {
    $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === t));
    if (t === "tests") {
      body.innerHTML = `<div class="grid tests">${tests.map(t => { const r = h[`${id}:${t.n}`];
        const col = r ? (r.best >= 90 ? "#28cd41" : r.best >= 60 ? "#ff9500" : "#ff3b30") : "";
        return `<div class="card tt" data-n="${t.n}" role="button" tabindex="0">
          ${r ? `<span class="best" style="background:${col}22;color:${col}">${r.best}p</span>` : ""}
          <div class="n">Testul ${t.n}</div>
          <div class="t">${t.seg >= 0 ? esc(SEGS[t.seg].label) : "Recapitulare"}</div>
          <div class="s">${t.seg >= 0 ? "+ " + esc(c.ntName) : "Toate cărțile"}</div>
          <span class="lvl">${[1, 2, 3].map(i => `<i class="${i <= t.lvl ? "on" : ""}"></i>`).join("")} ${["", "Ușor", "Mediu", "Greu"][t.lvl]}</span>
        </div>`; }).join("")}</div>`;
      $$(".tt", body).forEach(el => el.onclick = () => startFlow(id, +el.dataset.n));
    } else if (t === "board") {
      body.innerHTML = `<div id="cb"></div>`; loadBoard($("#cb"), id);
    } else {
      body.innerHTML = `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
        <div class="card"><h3>Cărți de studiat</h3>
          <div class="vitem"><b>1 Samuel</b><div>31 de capitole: Ana și Samuel, chivotul, Saul, David și Goliat, prietenia cu Ionatan, fuga lui David.</div></div>
          <div class="vitem"><b>2 Samuel</b><div>24 de capitole: domnia lui David, chivotul la Ierusalim, legământul, Absalom, ultimele cuvinte ale lui David.</div></div>
          <div class="vitem"><b>${esc(c.ntName)}</b><div>${{iuda: "1 capitol: lupta pentru credință și păzirea în dragostea lui Dumnezeu.", petru1: "5 capitole: nădejdea vie, preoția împărătească, suferința pentru Hristos.", filipeni: "4 capitole: bucuria în Domnul, smerenia lui Hristos, alergarea spre țintă.", galateni: "6 capitole: Evanghelia harului, libertatea în Hristos, roada Duhului.", evrei: "13 capitole: Hristos mai presus de toate, Marele Preot, eroii credinței."}[c.nt]}</div></div>
          <div class="vitem"><b>Memorarea Scripturii</b><div>Apocalipsa 1–5 (toate categoriile).</div></div>
        </div>
        <div class="card"><h3>Versete de memorat</h3>${vs.map(v => `<div class="vitem"><b>${esc(v.ref)}</b><div>${esc(v.text)}</div></div>`).join("")}</div>
      </div>`;
    }
  };
  $$("#tabs button").forEach(b => b.onclick = () => show(b.dataset.t));
  $("#rnd").onclick = () => startFlow(id, 1 + Math.floor(Math.random() * tests.length));
  show("tests");
}

/* ---------- Clasament ---------- */
async function loadPodium(el, minCards) {
  try {
    const rows = await API.podium();
    const by = {}; rows.forEach(r => (by[r.cat] = by[r.cat] || []).push(r));
    const cats = CATS.filter(c => by[c.id]);
    const list = cats.length ? cats : [];
    if (!list.length) { el.innerHTML = `<div class="list" style="grid-column:1/-1"><div class="empty">Clasamentul e încă gol. Fii primul: fă un test și scrie-ți numele! 🏁</div></div>`; return; }
    el.innerHTML = list.map(c => `<div class="list">
      <a class="li" href="#clasament-${c.id}" style="background:var(--fill)"><span class="appic" style="width:30px;height:30px;border-radius:8px;font-size:10px;background:${c.grad}">${c.ic}</span><span class="grow nm">${esc(c.name)}</span><span class="dim">${I.next.replace("<svg", '<svg width="16" height="16"')}</span></a>
      ${by[c.id].map(r => rowHtml(r, false)).join("")}</div>`).join("");
  } catch (e) { el.innerHTML = `<div class="list" style="grid-column:1/-1"><div class="empty">Clasamentul nu se poate încărca acum. Verifică internetul.</div></div>`; }
}
function rowHtml(r, full) {
  const me = S.name && nameKey(S.name) === nameKey(r.name);
  const m = r.pos <= 3 ? `m${r.pos}` : "mx";
  return `<div class="li ${me ? "me" : ""}"><span class="medal ${m}">${r.pos}</span>
    <span class="grow"><div class="nm">${esc(r.name)}${me ? " · tu" : ""}</div><div class="ds">${r.tests} ${r.tests == 1 ? "test" : "teste"}${full && r.avg_score != null ? ` · medie ${Number(r.avg_score).toLocaleString("ro-RO")}` : ""}</div></span>
    <span class="pts">${r.total}</span></div>`;
}
async function loadBoard(el, cat) {
  el.innerHTML = `<div class="list"><div class="empty">Se încarcă…</div></div>`;
  try {
    const rows = await API.board(cat);
    el.innerHTML = `<p class="dim" style="font-size:13px;margin:0 0 10px">Punctele = suma celor mai bune scoruri ale tale la fiecare test din categorie. Cu cât faci mai multe teste și le iei mai bine, cu atât urci!</p>
      <div class="list">${rows.length ? rows.map(r => rowHtml(r, true)).join("") : `<div class="empty">Nimeni încă în această categorie. Fii primul! 🏁</div>`}</div>`;
  } catch (e) { el.innerHTML = `<div class="list"><div class="empty">Clasamentul nu se poate încărca acum. Verifică internetul.</div></div>`; }
}
function pageBoard(cat) {
  renderNav("board");
  topbar({title: "Clasament", sub: cat ? esc(CAT[cat].name) : "Toate categoriile"});
  content.innerHTML = `<div class="page fade">
    <div class="chips" id="bchips"><button class="chip-btn ${!cat ? "on" : ""}" data-c="">Toate</button>${CATS.map(c => `<button class="chip-btn ${cat === c.id ? "on" : ""}" data-c="${c.id}">${esc(c.short)}</button>`).join("")}</div>
    <div id="bbody" style="margin-top:12px"></div>${foot()}</div>`;
  $$("#bchips button").forEach(b => b.onclick = () => go(b.dataset.c ? `#clasament-${b.dataset.c}` : "#clasament", true));
  const on = $("#bchips .on"); on && on.scrollIntoView({inline: "center", block: "nearest"});
  if (cat) loadBoard($("#bbody"), cat);
  else { $("#bbody").innerHTML = `<p class="dim" style="font-size:13px;margin:0 0 12px">Primii trei din fiecare categorie. Atinge o categorie pentru tot clasamentul.</p><div class="grid podium" id="pod"></div>`; loadPodium($("#pod")); }
}

/* ---------- Despre + instalare ---------- */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; const b = $("#instBtn"); if (b) b.hidden = false; });
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
function installCard() {
  if (isStandalone() || EMBED) return "";
  return `<div class="card" style="margin-top:14px;display:flex;gap:14px;align-items:center">
    ${logoHtml("logo")}<div style="flex:1"><b>Pune aplicația pe ecranul telefonului</b><div class="dim" style="font-size:13.5px">${isIOS() ? "În Safari: apasă Partajează ⬆︎, apoi „Adaugă pe ecranul principal”." : "Se deschide ca o aplicație, pe tot ecranul."}</div></div>
    ${isIOS() ? "" : `<button class="btn primary sm" id="instBtn" ${deferredPrompt ? "" : "hidden"}>Instalează</button>`}</div>`;
}
function bindInstall() { const b = $("#instBtn"); if (b) b.onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; b.hidden = true; }; }
function pageAbout() {
  renderNav("about");
  topbar({title: "Despre concurs"});
  content.innerHTML = `<div class="page fade">
    <h1>Despre Talantul în Negoț</h1>
    <p class="muted" style="max-width:680px">Concursul Biblic „Talantul în Negoț” este organizat de Departamentul Familii și Copii al Cultului Creștin Penticostal din România. Scopul lui este cunoașterea Cuvântului lui Dumnezeu: „Strâng Cuvântul Tău în inima mea, ca să nu păcătuiesc împotriva Ta!” (Psalmii 119:11). Se desfășoară după Biblia Cornilescu, ediția SBR Oradea 2006.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-top:18px">
      <div class="card"><h3>Etape</h3>${["Biserica locală", "Faza județeană", "Faza regională", "Faza națională", "Faza internațională"].map((x, i) => `<div class="vitem"><b>${i + 1}.</b> ${x}</div>`).join("")}</div>
      <div class="card"><h3>Categorii (secțiunea Clasic)</h3>${CATS.map(c => `<div class="vitem"><b>${esc(c.name)}</b><div>1 Samuel, 2 Samuel, ${esc(c.ntName)}</div></div>`).join("")}
        <p class="dim" style="margin:10px 0 0;font-size:13px">Categoria se stabilește la 1 ianuarie 2027 și nu se schimbă între faze. Elevii din clasa a 11-a concurează la 10–11, iar cei din clasa a 12-a la 18–35 ani.</p></div>
      <div class="card"><h3>Structura testului</h3>${SECTIONS.map(s => `<div class="vitem"><b>${s.roman}. ${s.name}</b><div>${s.n} itemi × ${s.per} puncte = ${s.n * s.per} p</div></div>`).join("")}<p class="dim" style="margin:10px 0 0;font-size:13px">Total 100 de puncte, 60 de minute.</p></div>
      <div class="card"><h3>Clasamentul</h3><div class="vitem"><div>Scrie-ți numele înainte de test. Pentru fiecare test se păstrează doar cel mai bun scor al tău: dacă refaci testul și iei mai puțin, rămâne scorul vechi; dacă iei mai mult, urci.</div></div><div class="vitem"><div>Locul în clasament = suma celor mai bune scoruri la toate testele din categoria ta.</div></div></div>
    </div>
    ${installCard()}${foot()}</div>`;
  bindInstall();
}

/* ---------- Începerea testului ---------- */
function startFlow(catId, n) {
  const c = CAT[catId], cur = LS.get("tin_cur", null);
  const resume = cur && cur.cat === catId && cur.n === n && (cur.ans || []).some(x => x != null);
  const sh = sheet(`
    <div class="appic" style="background:${c.grad};margin-bottom:12px">${c.ic}</div>
    <h3>Testul ${n} · ${esc(c.name)}</h3>
    <p class="muted" style="margin:0">31 de itemi · 100 de puncte · 60 de minute</p>
    <label class="lbl" for="nm">Numele și prenumele tău</label>
    <input class="field" id="nm" maxlength="40" autocomplete="name" placeholder="ex. Maria Popescu" value="${esc(S.name)}">
    <div class="note">Apare în clasamentul categoriei. Scrie-l la fel de fiecare dată ca să-ți aduni punctele. Lasă gol dacă nu vrei să apari.</div>
    <label class="check"><input type="checkbox" id="tm" ${LS.get("tin_timer", true) ? "checked" : ""}> Cronometru de 60 de minute</label>
    <div class="acts">${resume ? `<button class="btn" id="rs">Continuă</button><button class="btn primary" id="go">De la capăt</button>` : `<button class="btn" id="cn">Anulează</button><button class="btn primary" id="go">Începe testul</button>`}</div>`);
  const sc = sh.el;
  $("#cn", sc) && ($("#cn", sc).onclick = sh.close);
  const begin = res => {
    const nm = normName($("#nm", sc).value);
    if (nm && nm.length < 2) { toast("Numele trebuie să aibă cel puțin 2 litere"); return; }
    S.name = nm; LS.set("tin_name", nm); LS.set("tin_timer", $("#tm", sc).checked); sh.close();
    if (!res) LS.set("tin_cur", {cat: catId, n, ans: [], idx: 0, start: Date.now()});
    go(`#t-${catId}-${n}`);
  };
  $("#go", sc).onclick = () => begin(false);
  $("#rs", sc) && ($("#rs", sc).onclick = () => begin(true));
  $("#nm", sc).addEventListener("keydown", e => { if (e.key === "Enter") begin(false); });
}

/* ---------- Ecranul de test ---------- */
function pageTest(catId, n) {
  const c = CAT[catId]; if (!c || n < 1 || n > c.tests) return go("#acasa", true);
  let cur = LS.get("tin_cur", null);
  if (!cur || cur.cat !== catId || cur.n !== n) { cur = {cat: catId, n, ans: [], idx: 0, start: Date.now()}; LS.set("tin_cur", cur); }
  S.drawn = -1; S.session = makeSession(catId, n); S.ans = cur.ans || []; S.idx = cur.idx || 0; S.start = cur.start || Date.now();
  document.body.classList.add("testing");
  renderNav(catId);
  topbar({back: () => { const sh = sheet(`<h3>Ieși din test?</h3><p class="muted" style="margin:0">Răspunsurile rămân salvate pe telefon; poți continua mai târziu de unde ai rămas.</p><div class="acts"><button class="btn" id="st">Rămân</button><button class="btn primary" id="lv">Ies</button></div>`, {center: true});
      $("#st", sh.el).onclick = sh.close; $("#lv", sh.el).onclick = () => { sh.close(); go(`#c-${catId}`); }; },
    title: `Testul ${n}`, sub: `${esc(c.name)} · ${esc(S.session.T.title)}`});
  content.innerHTML = `<div class="tw" id="tw"></div>`;
  clearInterval(S.timer);
  if (LS.get("tin_timer", true)) S.timer = setInterval(() => {
    const el = $("#tmr"); if (!el) return clearInterval(S.timer);
    const left = 3600 - Math.floor((Date.now() - S.start) / 1000); el.innerHTML = I.clock + fmt(Math.max(0, left)); el.classList.toggle("low", left < 300);
    if (left <= 0) { clearInterval(S.timer); toast("Timpul a expirat!"); finish(); }
  }, 1000);
  drawQ();
}
function persist() { LS.set("tin_cur", {cat: S.session.T.cat, n: S.session.T.n, ans: S.ans, idx: S.idx, start: S.start}); }
function move(d) { const n = S.idx + d; if (n < 0 || n >= S.session.items.length) return; S.idx = n; persist(); drawQ(); window.scrollTo({top: 0}); }

function drawQ() {
  const {items} = S.session, it = items[S.idx], a = S.ans[S.idx];
  const sec = SECTIONS.find(s => s.k === it.sec);
  const secItems = items.filter(x => x.sec === it.sec), pos = secItems.indexOf(it) + 1;
  const cnt = countItems(items, S.ans);
  const left = 3600 - Math.floor((Date.now() - S.start) / 1000);
  const L = ["a", "b", "c"];
  let body = "";
  if (it.sec === "tf") {
    body = `<div class="qt">${esc(it.q.text)}</div><div class="tf">
      <button class="opt t ${a === true ? "on" : ""}" data-v="1"><span class="k">A</span>Adevărat</button>
      <button class="opt f ${a === false ? "on" : ""}" data-v="0"><span class="k">F</span>Fals</button></div>`;
  } else if (it.sec === "mc") {
    body = `<div class="qt">${esc(it.q.text)}</div><div class="opts">${it.order.map((oi, i) => `<button class="opt ${a === i ? "on" : ""}" data-v="${i}"><span class="k">${L[i]}</span><span>${esc(it.q.opts[oi])}</span></button>`).join("")}</div>`;
  } else if (it.sec === "ms") {
    const st = a || {sel: [], none: false};
    body = `<div class="qt">${esc(it.q.text)}</div><div class="qhint">Pot fi 0, 1, 2 sau 3 răspunsuri corecte. Primești 5 puncte doar dacă alegi exact răspunsurile corecte.</div>
      <div class="opts">${it.order.map((oi, i) => `<button class="opt ${st.sel.includes(i) ? "on" : ""}" data-v="${i}"><span class="box">${st.sel.includes(i) ? I.check : ""}</span><span class="k">${L[i]}</span><span>${esc(it.q.opts[oi])}</span></button>`).join("")}
      <button class="opt ${st.none ? "on" : ""}" data-v="none"><span class="box">${st.none ? I.check : ""}</span><span>Niciun răspuns nu este corect</span></button></div>`;
  } else if (it.sec === "mt") {
    const st = a || [null, null, null, null, null];
    body = `<div class="qt">${esc(it.q.text)}</div><div class="qhint">Pentru fiecare număr, alege litera potrivită. Fiecare pereche corectă valorează 2 puncte.</div>
      <div class="mt-right">${it.rorder.map((pi, p) => `<div class="mt-r"><b>${it.letters[p]}</b><span>${esc(it.q.pairs[pi][1])}</span></div>`).join("")}</div>
      <div class="mt-rows">${it.q.pairs.map((p, i) => `<div class="mt-row"><div class="l"><b>${i + 1}.</b>${esc(p[0])}</div><div class="letters" data-row="${i}">${it.letters.map((l, q) => `<button data-pos="${q}" class="${st[i] === q ? "on" : ""} ${st.includes(q) && st[i] !== q ? "used" : ""}">${l}</button>`).join("")}</div></div>`).join("")}</div>`;
  } else {
    const st = a || [];
    body = `<div class="qt">Așază fragmentele versetului în ordinea corectă</div><span class="ref">${I.book} ${esc(it.q.ref)}</span>
      <div class="ord-ans ${st.length ? "" : "empty"}" id="oa">${st.map((pi, k) => `<button class="chip in" data-k="${k}"><span class="i">${k + 1}</span>${esc(it.parts[it.order[pi]])}</button>`).join("")}</div>
      <div class="ord-pool">${it.order.map((pIdx, pi) => `<button class="chip ${st.includes(pi) ? "gone" : ""}" data-pi="${pi}">${esc(it.parts[pIdx])}</button>`).join("")}</div>
      ${st.length ? `<button class="btn ghost sm" id="oclr" style="margin-top:8px">Șterge ordinea</button>` : ""}`;
  }
  const isLast = S.idx === items.length - 1;
  const secStart = SECTIONS.map(s => items.findIndex(x => x.sec === s.k));
  $("#tw").innerHTML = `
    <div class="tbar"><div class="prog"><i style="width:${cnt.done / cnt.total * 100}%"></i></div><span class="dim" style="font-size:12.5px;font-weight:700">${cnt.done}/${cnt.total}</span>
      ${LS.get("tin_timer", true) ? `<span class="timer ${left < 300 ? "low" : ""}" id="tmr">${I.clock}${fmt(Math.max(0, left))}</span>` : ""}</div>
    <div class="secl"><span class="num">${sec.roman}</span>${sec.name} · ${sec.per} p${it.sec === "mt" ? " / pereche" : ""}</div>
    <div class="card qcard ${S.drawn === S.idx ? "" : "fade"}" id="qc">
      <div class="qn">${it.sec === "mt" ? "Itemii 1–5" : it.sec === "or" ? `Versetul ${pos} din ${secItems.length}` : `Întrebarea ${pos} din ${secItems.length}`}</div>${body}
    </div>
    <div class="navbtns">
      <button class="btn" id="prev" ${S.idx === 0 ? "disabled" : ""}>${I.back} Înapoi</button>
      ${isLast ? `<button class="btn primary" id="fin">Termină testul</button>` : `<button class="btn primary" id="next">Următoarea ${I.next}</button>`}
    </div>
    <div class="dots">${items.map((x, i) => `${secStart.includes(i) && i ? '<span class="gap"></span>' : ""}<button class="${answered(x, S.ans[i]) ? "a" : ""} ${i === S.idx ? "cur" : ""}" data-i="${i}">${x.sec === "mt" ? "III" : i - secStart[SECTIONS.findIndex(s => s.k === x.sec)] + 1}</button>`).join("")}</div>
    ${isLast ? "" : `<div style="text-align:center;margin-top:14px"><button class="btn ghost sm" id="fin2">Termină testul acum</button></div>`}`;
  S.drawn = S.idx;
  const qc = $("#qc");
  const set = v => { S.ans[S.idx] = v; persist(); drawQ(); };
  if (it.sec === "tf") $$(".opt", qc).forEach(b => b.onclick = () => set(b.dataset.v === "1"));
  if (it.sec === "mc") $$(".opt", qc).forEach(b => b.onclick = () => set(+b.dataset.v));
  if (it.sec === "ms") $$(".opt", qc).forEach(b => b.onclick = () => {
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
  if (!CUR.startsWith("#t-") || !S.session || $(".scrim") || e.target.tagName === "INPUT") return;
  const it = S.session.items[S.idx], k = e.key.toLowerCase();
  if (k === "arrowright") move(1);
  else if (k === "arrowleft") move(-1);
  else if (it.sec === "tf" && (k === "a" || k === "f")) { S.ans[S.idx] = k === "a"; persist(); drawQ(); }
  else if ((it.sec === "mc" || it.sec === "ms") && ["1", "2", "3"].includes(k)) { const b = $$("#qc .opt")[+k - 1]; b && b.click(); }
});
function askFinish() {
  const cnt = countItems(S.session.items, S.ans), miss = cnt.total - cnt.done;
  const sh = sheet(`<h3>Termini testul?</h3><p class="muted" style="margin:0">${miss ? `Mai ai <b>${miss}</b> ${miss === 1 ? "item necompletat" : "itemi necompletați"}. Itemii fără răspuns primesc 0 puncte.` : "Ai răspuns la toți cei 31 de itemi. Bravo!"}</p>
    <div class="acts"><button class="btn" id="no">Mai verific</button><button class="btn primary" id="yes">Vezi rezultatul</button></div>`, {center: true});
  $("#no", sh.el).onclick = sh.close; $("#yes", sh.el).onclick = () => { sh.close(); finish(); };
}
function finish() {
  clearInterval(S.timer);
  const {T, items} = S.session, sc = scoreAll(items, S.ans);
  const secs = Math.min(3600, Math.round((Date.now() - S.start) / 1000));
  const d = new Date().toISOString().slice(0, 10);
  S.last = {cat: T.cat, n: T.n, items, ans: S.ans.slice(), sc, secs, name: S.name, d, sub: null, id: Date.now()};
  LS.set("tin_last", {cat: T.cat, n: T.n, ans: S.last.ans, secs, name: S.name, d, id: S.last.id});
  saveHist(T.cat, T.n, sc.total); LS.del("tin_cur");
  go("#rezultat");
}

/* ---------- Rezultat ---------- */
const tier = s => s >= 90 ? "high" : s >= 60 ? "mid" : "low";
function message(s) {
  if (s >= 90) return ["Excelent! 🏆", "Ai strâns Cuvântul în inima ta. „Bine, rob bun și credincios!”"];
  if (s >= 75) return ["Foarte bine! ⭐", "Mai ai puțin până la vârf. Uită-te la greșeli și încearcă din nou."];
  if (s >= 60) return ["Bine! 👍", "Ești pe drumul cel bun. Recitește capitolele unde ai greșit."];
  if (s >= 40) return ["Nu te descuraja! 🌱", "Fiecare test te face mai puternic în Cuvânt. Citește din nou și revino."];
  return ["Curaj, începe din nou! 💪", "Dumnezeu este cu tine. Citește capitolele cu atenție și vei vedea progresul."];
}
const pickVerse = (score, seed) => { const a = ENC[tier(score)]; return a[Math.floor(rngFor("v" + seed)() * a.length)]; };
const encodePayload = o => [...new TextEncoder().encode([o.c, o.t, o.s, o.m, o.d, o.p.join("."), o.n].join("|"))].map(x => x.toString(16).padStart(2, "0")).join("");
function decodePayload(p) { try { const a = new TextDecoder().decode(new Uint8Array(p.match(/../g).map(h => parseInt(h, 16)))).split("|");
  return {c: a[0], t: +a[1], s: +a[2], m: +a[3], d: a[4], p: a[5].split(".").map(Number), n: a.slice(6).join("|")}; } catch (e) { return null; } }
const shareUrl = L => `${location.origin}${location.pathname}#r-${encodePayload({c: L.cat, t: L.n, s: L.sc.total, n: L.name || "", m: L.secs, d: L.d, p: SECTIONS.map(s => L.sc.per[s.k])})}`;

function pageResult() {
  if (!S.last) { const l = LS.get("tin_last", null); if (!l) return go("#acasa", true);
    const ses = makeSession(l.cat, l.n); S.last = {...l, items: ses.items, sc: scoreAll(ses.items, l.ans)}; }
  document.body.classList.remove("testing");
  const L = S.last, c = CAT[L.cat], score = L.sc.total;
  renderNav(L.cat);
  topbar({back: `#c-${L.cat}`, title: `Rezultat · Testul ${L.n}`, sub: esc(c.name)});
  const [m1, m2] = message(score), [vr, vt] = pickVerse(score, L.cat + L.n + score);
  const R = 72, CC = 2 * Math.PI * R, col = score >= 90 ? "#28cd41" : score >= 60 ? "#ff9500" : "#ff3b30";
  const all = L.items.map((it, i) => ({it, i, r: L.sc.res[i]})), wrong = all.filter(x => x.r.pts < x.r.max);
  const nextN = L.n < c.tests ? L.n + 1 : null;
  content.innerHTML = `<div class="page fade">
    <div class="card" style="padding:24px">
      <div class="res-top">
        <div class="ring"><svg viewBox="0 0 168 168"><circle cx="84" cy="84" r="${R}" fill="none" stroke="var(--fill)" stroke-width="14"/>
          <circle id="arc" cx="84" cy="84" r="${R}" fill="none" stroke="${col}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${CC}" stroke-dashoffset="${CC}" style="transition:stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)"/></svg>
          <div class="v"><div><b id="sn">0</b><span>din 100 puncte</span></div></div></div>
        <div style="width:100%">
          <p class="msg">${m1}</p><p class="muted" style="margin:0 0 12px">${m2}</p>
          <div class="bars">${SECTIONS.map(s => `<div class="bar"><span><b>${s.roman}.</b> ${s.short}</span><div class="tr"><i data-w="${L.sc.per[s.k] / L.sc.max[s.k] * 100}" style="width:0;background:${L.sc.per[s.k] === L.sc.max[s.k] ? "var(--green)" : "var(--accent)"}"></i></div><span class="pt">${L.sc.per[s.k]}/${L.sc.max[s.k]}</span></div>`).join("")}</div>
          <p class="dim" style="margin:12px 0 0;font-size:13px">${L.name ? esc(L.name) + " · " : ""}Timp: ${fmt(L.secs)} · ${new Date(L.d).toLocaleDateString("ro-RO", {day: "numeric", month: "long", year: "numeric"})}</p>
        </div>
      </div>
      <div id="rank"></div>
      <div class="verse ${tier(score)}"><div class="l">${score >= 90 ? "Un cuvânt pentru tine" : score >= 60 ? "Mergi mai departe" : "Un verset de încurajare"}</div><q>${esc(vt)}</q><cite>${esc(vr)}</cite></div>
      <div class="share">
        <button class="btn primary" id="shBtn">${I.share}<span>Distribuie</span></button>
        <button class="btn" id="waBtn" style="color:#25d366">${I.wa}<span>WhatsApp</span></button>
        <button class="btn" id="imBtn">${I.img}<span>Imagine</span></button>
      </div>
      <div class="share2">
        <button class="btn" id="cpBtn">${I.link} Copiază linkul</button>
        <button class="btn" id="rdBtn">${I.redo} Refă testul</button>
      </div>
      ${nextN ? `<button class="btn primary block" id="nxBtn" style="margin-top:10px">Testul ${nextN} ${I.next}</button>` : ""}
    </div>
    <div class="sec-h"><h2>Corectura</h2><div class="seg" id="rf"><button data-f="wrong" class="${S.reviewFilter === "wrong" ? "on" : ""}">Greșeli (${wrong.length})</button><button data-f="all" class="${S.reviewFilter === "all" ? "on" : ""}">Toate</button></div></div>
    <div class="card" id="rev"></div>
    <div class="sec-h"><h2>Top la acest test</h2></div><div id="ttop"><div class="list"><div class="empty">Se încarcă…</div></div></div>
    ${foot()}
  </div>`;
  setTimeout(() => { $("#arc").style.strokeDashoffset = CC * (1 - score / 100); $$(".bar .tr i").forEach(i => i.style.width = i.dataset.w + "%"); }, 80);
  animateNum($("#sn"), score);
  if (score >= 90) confetti();
  const drawRev = () => {
    const list = S.reviewFilter === "wrong" ? wrong : all;
    $("#rev").innerHTML = list.length ? list.map(x => reviewItem(x.it, L.ans[x.i], x.r)).join("") : `<div class="empty"><div style="font-size:40px">🎉</div>Nicio greșeală! Ai răspuns perfect la toate.</div>`;
  };
  drawRev();
  $$("#rf button").forEach(b => b.onclick = () => { S.reviewFilter = b.dataset.f; $$("#rf button").forEach(x => x.classList.toggle("on", x === b)); drawRev(); });

  const url = shareUrl(L);
  const text = `${L.name ? L.name + " a" : "Am"} obținut ${score}/100 la Testul ${L.n} – ${c.name} (Talantul în Negoț 2027 · ${C.church}). Încearcă și tu!`;
  $("#cpBtn").onclick = () => copy(EMBED ? text : url, EMBED ? "Text copiat ✓" : "Link copiat ✓");
  $("#waBtn").onclick = () => { const u = "https://wa.me/?text=" + encodeURIComponent(text + (EMBED ? "" : "\n" + url)); const w = window.open(u, "_blank"); if (!w) location.href = u; };
  $("#shBtn").onclick = async () => {
    if (!EMBED && navigator.share) { try { await navigator.share({title: "Talantul în Negoț – rezultat", text, url}); return; } catch (e) { if (e.name === "AbortError") return; } }
    copy(EMBED ? text : text + "\n" + url, "Copiat ✓ Lipește-l unde vrei să-l trimiți");
  };
  $("#imBtn").onclick = async () => {
    const blob = await shareImage(L, vr, vt), file = new File([blob], `talant-test${L.n}-${score}p.png`, {type: "image/png"});
    if (!EMBED && navigator.canShare && navigator.canShare({files: [file]})) { try { await navigator.share({files: [file], text: text + "\n" + url}); return; } catch (e) { if (e.name === "AbortError") return; } }
    const src = URL.createObjectURL(blob);
    const sh = sheet(`<img src="${src}" alt="Rezultat" style="width:100%;max-height:60dvh;object-fit:contain;border-radius:14px">
      <p class="muted" style="font-size:13.5px;margin:12px 0 0;text-align:center">Pe telefon: ține apăsat pe imagine și alege „Salvează” sau „Partajează”.</p>
      <div class="acts">${EMBED ? "" : `<a class="btn" href="${src}" download="${file.name}">${I.dl} Descarcă</a>`}<button class="btn primary" id="ok">Gata</button></div>`, {center: true});
    $("#ok", sh.el).onclick = () => { sh.close(); URL.revokeObjectURL(src); };
  };
  $("#rdBtn").onclick = () => startFlow(L.cat, L.n);
  $("#nxBtn") && ($("#nxBtn").onclick = () => startFlow(L.cat, nextN));
  submitAndRank(L);
}
async function submitAndRank(L) {
  const box = $("#rank");
  const done = LS.get("tin_sent", {});
  const show = r => {
    if (!box) return;
    const imp = r.improved ? (r.previous != null ? `Ai urcat de la ${r.previous} la <b>${L.sc.total}</b> puncte la acest test! 🎉` : "Primul tău scor la acest test a intrat în clasament! 🎉")
      : `Cel mai bun scor al tău la acest test rămâne <b>${r.previous}</b> puncte.`;
    box.innerHTML = `<a class="rank-box" href="#clasament-${L.cat}" style="text-decoration:none;color:inherit"><div class="big">#${r.rank}</div><div class="txt"><b>Locul tău în ${esc(CAT[L.cat].name)}</b><br>${imp}<br>Total: <b>${r.total}</b> puncte din ${r.tests} ${r.tests == 1 ? "test" : "teste"}.</div></a>`;
  };
  if (!L.name) {
    if (box) box.innerHTML = `<div class="rank-box"><div class="big">🏁</div><div class="txt"><b>Vrei să apari în clasament?</b><br>Data viitoare scrie-ți numele înainte de test.</div></div>`;
  } else if (L.id && done[L.id]) show(done[L.id]);
  else {
    if (box) box.innerHTML = `<div class="rank-box"><div class="big">…</div><div class="txt">Se trimite rezultatul în clasament…</div></div>`;
    const o = {name: L.name, cat: L.cat, n: L.n, score: L.sc.total, secs: L.secs};
    try {
      const r = await API.submit(o); if (L.id) { done[L.id] = r; const ks = Object.keys(done); if (ks.length > 30) delete done[ks[0]]; LS.set("tin_sent", done); }
      show(r);
    } catch (e) {
      if (/invalid|prea multe/i.test(e.message)) { if (box) box.innerHTML = `<div class="rank-box"><div class="big">!</div><div class="txt">Rezultatul nu a putut fi trimis (${esc(e.message)}).</div></div>`; }
      else { const q = LS.get("tin_queue", []); q.push(o); LS.set("tin_queue", q); if (L.id) { done[L.id] = {rank: "–", total: "…", tests: "…", improved: true}; }
        if (box) box.innerHTML = `<div class="rank-box"><div class="big">📶</div><div class="txt"><b>Fără internet acum.</b><br>Rezultatul se trimite automat în clasament când revine conexiunea.</div></div>`; }
    }
  }
  try {
    const top = await API.testTop(L.cat, L.n); const el = $("#ttop"); if (!el) return;
    el.innerHTML = `<div class="list">${top.length ? top.map(r => { const me = L.name && nameKey(L.name) === nameKey(r.name);
      return `<div class="li ${me ? "me" : ""}"><span class="medal ${r.pos <= 3 ? "m" + r.pos : "mx"}">${r.pos}</span><span class="grow"><div class="nm">${esc(r.name)}${me ? " · tu" : ""}</div><div class="ds">timp ${fmt(r.secs)}</div></span><span class="pts">${r.score}</span></div>`; }).join("")
      : `<div class="empty">Încă nimeni la acest test.</div>`}</div>`;
  } catch (e) { const el = $("#ttop"); if (el) el.innerHTML = `<div class="list"><div class="empty">Nu se poate încărca acum.</div></div>`; }
}
function copy(t, msg) {
  const fb = () => { const ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (e) {} ta.remove();
    if (ok) toast(msg); else { const sh = sheet(`<h3>Copiază</h3><textarea class="field" style="height:120px;padding:10px" readonly>${esc(t)}</textarea><div class="acts"><button class="btn primary" id="ok">Gata</button></div>`, {center: true}); $("#ok", sh.el).onclick = sh.close; $("textarea", sh.el).select(); } };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(() => toast(msg), fb); else fb();
}
function animateNum(el, to) { const t0 = performance.now(); const f = t => { const p = Math.min(1, (t - t0) / 1100); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }

function reviewItem(it, a, r) {
  const L = ["a", "b", "c"], st = r.pts === r.max ? "ok" : r.pts > 0 ? "part" : "no";
  let q = esc(it.q.text), ans = "", extra = "";
  if (it.sec === "tf") {
    ans = `${a == null ? `<span class="y">Fără răspuns</span>` : `<span class="${a === it.q.ans ? "c" : "y"}">Răspunsul tău: ${a ? "Adevărat" : "Fals"}</span>`}${a !== it.q.ans ? `<span class="c">Corect: ${it.q.ans ? "Adevărat" : "Fals"}</span>` : ""}`;
    if (!it.q.ans && it.q.fix) extra = `<div class="fix">✎ ${esc(it.q.fix)}</div>`;
  } else if (it.sec === "mc") {
    ans = `${a == null ? `<span class="y">Fără răspuns</span>` : `<span class="${a === it.correct ? "c" : "y"}">Răspunsul tău: ${L[a]}) ${esc(it.q.opts[it.order[a]])}</span>`}${a !== it.correct ? `<span class="c">Corect: ${L[it.correct]}) ${esc(it.q.opts[0])}</span>` : ""}`;
  } else if (it.sec === "ms") {
    const f = arr => arr.length ? arr.map(i => `${L[i]}) ${esc(it.q.opts[it.order[i]])}`).join("; ") : "niciun răspuns corect";
    const mine = !a || (!a.none && !a.sel.length) ? null : (a.none ? [] : a.sel.slice().sort());
    ans = `${mine == null ? `<span class="y">Fără răspuns</span>` : `<span class="${r.pts ? "c" : "y"}">Răspunsul tău: ${f(mine)}</span>`}${r.pts ? "" : `<span class="c">Corect: ${f(it.correct)}</span>`}`;
  } else if (it.sec === "mt") {
    ans = it.q.pairs.map((p, i) => { const m = a && a[i] != null ? a[i] : null, ok = m === it.correct[i];
      return `<span class="${ok ? "c" : "y"}">${i + 1}. ${esc(p[0])} → ${m == null ? "—" : it.letters[m]} ${ok ? "✓" : `<span class="c">(corect: ${it.letters[it.correct[i]]}. ${esc(p[1])})</span>`}</span>`; }).join("");
  } else {
    q = "Ordonează versetul";
    ans = a && a.length ? `<span class="${r.pts ? "c" : "y"}">Ordinea ta: ${esc(a.map(pi => it.parts[it.order[pi]]).join(" "))}</span>` : `<span class="y">Fără răspuns</span>`;
    if (!r.pts) extra = `<div class="fix">✎ ${esc(it.q.text)}</div>`;
  }
  const sec = SECTIONS.find(s => s.k === it.sec);
  return `<div class="rev"><div class="st ${st}">${st === "ok" ? "✓" : st === "part" ? "½" : "✕"}</div><div>
    <div class="rq">${q}</div><div class="ra">${ans}</div>${extra}
    <div class="rm"><span class="ref" style="margin:0">${I.book} ${esc(it.q.ref)}</span><span class="pts">${sec.roman} · ${r.pts}/${r.max} p</span></div></div></div>`;
}

/* ---------- Rezultat distribuit ---------- */
function pageShared(p) {
  const o = decodePayload(p), c = o && CAT[o.c];
  renderNav("");
  topbar({title: "Rezultat distribuit"});
  if (!o || !c || !(o.t >= 1 && o.t <= c.tests)) { content.innerHTML = `<div class="page"><div class="card" style="text-align:center"><h2>Linkul nu este valid</h2><p><a class="btn primary" href="#acasa">Mergi la teste</a></p></div></div>`; return; }
  const [m1] = message(o.s), col = o.s >= 90 ? "#28cd41" : o.s >= 60 ? "#ff9500" : "#ff3b30", [vr, vt] = pickVerse(o.s, o.c + o.t + o.s);
  content.innerHTML = `<div class="page fade"><div class="card" style="max-width:520px;margin:0 auto;text-align:center;padding:28px 22px">
    <div class="appic" style="background:${c.grad};margin:0 auto 12px;width:60px;height:60px;border-radius:16px">${c.ic}</div>
    <div class="dim" style="font-weight:600">${esc(c.name)} · Testul ${o.t}</div>
    <h2 style="margin:6px 0 12px">${o.n ? esc(o.n) + " a obținut" : "Rezultat obținut"}</h2>
    <div style="font-size:72px;font-weight:800;letter-spacing:-.05em;line-height:1;color:${col}">${o.s}<span style="font-size:24px;color:var(--text-3)">/100</span></div>
    <p class="msg" style="margin-top:12px;font-size:20px">${m1}</p>
    <div class="bars" style="text-align:left;margin:16px 0">${SECTIONS.map((s, i) => `<div class="bar"><span><b>${s.roman}.</b> ${s.short}</span><div class="tr"><i style="width:${(o.p[i] || 0) / (s.per * s.n) * 100}%"></i></div><span class="pt">${o.p[i] || 0}/${s.per * s.n}</span></div>`).join("")}</div>
    <div class="verse ${tier(o.s)}" style="text-align:left"><q>${esc(vt)}</q><cite>${esc(vr)}</cite></div>
    <button class="btn primary block" id="try" style="margin-top:18px">Fă și tu testul acesta</button>
    <a class="btn block" href="#acasa" style="margin-top:10px">Toate testele</a>
    <p class="dim" style="font-size:12.5px;margin:14px 0 0">${o.d ? new Date(o.d).toLocaleDateString("ro-RO", {day: "numeric", month: "long", year: "numeric"}) : ""}${o.m ? " · timp " + fmt(o.m) : ""}</p>
  </div>${foot()}</div>`;
  $("#try").onclick = () => startFlow(o.c, o.t);
}

/* ---------- Imaginea pentru distribuire ---------- */
let logoImg = null;
(() => { const im = new Image(); im.onload = () => { logoImg = im; }; im.src = C.logo; })();
function shareImage(L, vr, vt) {
  const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  const c = CAT[L.cat], score = L.sc.total, F = "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,sans-serif";
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#4f46e5"); bg.addColorStop(.5, "#9b5cf0"); bg.addColorStop(1, "#ec6a9c"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,.16)"; g.beginPath(); g.arc(W - 110, 110, 300, 0, 7); g.fill();
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.textAlign = "center";
  if (logoImg) { g.save(); rr(W / 2 - 230, 52, 64, 64, 14); g.fillStyle = "#fff"; g.fill(); g.clip(); g.drawImage(logoImg, W / 2 - 228, 54, 60, 60); g.restore(); g.textAlign = "left"; g.fillStyle = "#fff"; g.font = `700 40px ${F}`; g.fillText("Talantul în Negoț 2027", W / 2 - 150, 98); g.textAlign = "center"; }
  else { g.fillStyle = "#fff"; g.font = `700 44px ${F}`; g.fillText("Talantul în Negoț 2027", W / 2, 100); }
  g.fillStyle = "rgba(255,255,255,.95)"; rr(70, 150, W - 140, H - 290, 48); g.fill();
  g.fillStyle = "#8e8e93"; g.font = `600 34px ${F}`; g.fillText(`${c.name} · Testul ${L.n}`, W / 2, 245);
  g.fillStyle = "#1d1d1f"; g.font = `800 54px ${F}`; g.fillText(L.name || "Rezultatul meu", W / 2, 320);
  const col = score >= 90 ? "#28cd41" : score >= 60 ? "#ff9500" : "#ff3b30";
  g.lineWidth = 34; g.strokeStyle = "#ececf0"; g.beginPath(); g.arc(W / 2, 560, 170, 0, 7); g.stroke();
  g.strokeStyle = col; g.lineCap = "round"; g.beginPath(); g.arc(W / 2, 560, 170, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(score, .5) / 100); g.stroke();
  g.fillStyle = "#1d1d1f"; g.font = `800 150px ${F}`; g.fillText(String(score), W / 2, 612);
  g.fillStyle = "#8e8e93"; g.font = `600 32px ${F}`; g.fillText("din 100 de puncte", W / 2, 668);
  g.fillStyle = "#1d1d1f"; g.font = `800 48px ${F}`; g.fillText(message(score)[0].replace(/[^\p{L}\p{N}\s!,.]/gu, "").trim(), W / 2, 820);
  g.fillStyle = "#515154"; g.font = `italic 500 32px ${F}`;
  const words = ("„" + vt.replace(/^„|”$/g, "") + "”").split(" "), lines = []; let line = "";
  words.forEach(w => { const t = line ? line + " " + w : w; if (g.measureText(t).width > W - 260) { lines.push(line); line = w; } else line = t; }); if (line) lines.push(line);
  const shown = lines.slice(0, 5); if (lines.length > 5) shown[4] = shown[4].replace(/\s+\S+$/, "") + "…";
  shown.forEach((l, i) => g.fillText(l, W / 2, 900 + i * 44));
  g.fillStyle = "#007aff"; g.font = `700 32px ${F}`; g.fillText(vr, W / 2, 900 + shown.length * 44 + 22);
  g.fillStyle = "#fff"; g.font = `600 30px ${F}`; g.fillText(`${C.church} · ${location.host}`, W / 2, H - 76);
  return new Promise(res => cv.toBlob(res, "image/png"));
}

/* ---------- Confetti ---------- */
function confetti() {
  const cv = document.createElement("canvas"); cv.className = "confetti"; cv.width = innerWidth; cv.height = innerHeight; document.body.appendChild(cv);
  const g = cv.getContext("2d"), cols = ["#ff5f57", "#febc2e", "#28c840", "#007aff", "#bf5af2", "#ff375f"];
  const P = Array.from({length: 150}, () => ({x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .35, vx: (Math.random() - .5) * 16, vy: -Math.random() * 15 - 4, r: Math.random() * 6 + 4, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6}));
  let f = 0; const step = () => { g.clearRect(0, 0, cv.width, cv.height); P.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .45; p.vx *= .99; p.a += .2; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * .6); g.restore(); });
    if (f++ < 170) requestAnimationFrame(step); else cv.remove(); }; step();
}

/* ---------- Router ---------- */
function route() {
  const h = CUR || "#acasa";
  clearInterval(S.timer); $$(".scrim").forEach(e => e.remove());
  if (!h.startsWith("#t-")) document.body.classList.remove("testing");
  let m;
  if ((m = h.match(/^#c-(\w+)$/))) pageCat(m[1]);
  else if ((m = h.match(/^#t-(\w+)-(\d+)$/))) pageTest(m[1], +m[2]);
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
window.__TIN_UI = {go};
route();
flushQueue();

/* ---------- Aplicație instalabilă + actualizare automată ---------- */
if ("serviceWorker" in navigator && !EMBED && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").then(reg => {
    reg.addEventListener("updatefound", () => { const w = reg.installing; w && w.addEventListener("statechange", () => {
      if (w.state === "activated" && navigator.serviceWorker.controller && !CUR.startsWith("#t-")) toast("Aplicația s-a actualizat ✓"); }); });
    setInterval(() => reg.update(), 30 * 60 * 1000);
  }).catch(() => {});
}
})();
