// Interfața aplicației: dashboard, bibliotecă, test, rezultat, clasament, distribuire.
(() => {
"use strict";
const {CATS, CAT, SECTIONS, ENC, rngFor, SEGS, testsFor, makeSession, makeVerseSession, VERSE_MODES, scoreAll, answered, countItems, shuffle} = window.TIN;
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
const tile = (c, cls = "") => `<span class="ic-tile ${cls}" style="background:linear-gradient(145deg,${c.color},${shade(c.color)})">${esc(c.ic)}</span>`;
function shade(hex) { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.round(v * .72)); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; }

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
const S = {session: null, ans: [], chk: [], idx: 0, start: 0, timer: null, name: LS.get("tin_name", ""), last: null, reviewFilter: "wrong", drawn: -1, practice: false};
const hist = () => LS.get("tin_hist", {});
function saveHist(key, score) { const h = hist(); const o = h[key] || {best: 0, tries: 0}; o.best = Math.max(o.best, score); o.tries++; o.last = score; o.at = Date.now(); h[key] = o; LS.set("tin_hist", h); }
const doneIn = (h, c) => Object.keys(h).filter(k => k.startsWith(c.id + ":") && !k.includes(":v")).length;
const prefCat = () => CAT[LS.get("tin_cat", "")] ? LS.get("tin_cat", "") : null;

/* ---------- Simboluri ---------- */
const sv = (d, w = 1.8) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
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
  grid: sv('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>'),
  trophy: sv('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z"/><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/>'),
  info: sv('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  quote: sv('<path d="M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6"/>'),
  q: sv('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.7-2.5 2-2.5 3.5M12 17v.5"/>'),
  check: sv('<path d="M5 12.5l4.5 4.5L19 7"/>', 2.6), x: sv('<path d="M7 7l10 10M17 7L7 17"/>', 2.6),
  search: sv('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', 2),
  chart: sv('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  star: sv('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
  play: sv('<path d="M8 5v14l11-7z"/>'),
  dl: sv('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>')
};
const W = w => `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${w}</svg>`;
const OK = W('<path d="M5 12.5l4.5 4.5L19 7"/>'), NO = W('<path d="M7 7l10 10M17 7L7 17"/>'), HALF = W('<path d="M6 12h12"/>');
const ART = `<svg class="art" viewBox="0 0 400 400" fill="none" stroke="#fff" stroke-width="1.2"><circle cx="200" cy="200" r="190"/><circle cx="200" cy="200" r="150"/><circle cx="200" cy="200" r="110"/><circle cx="200" cy="200" r="70"/><path d="M200 10v380M10 200h380" stroke-dasharray="2 8"/><path d="M200 120v160M150 175h100" stroke-width="10" stroke-linecap="round"/></svg>`;

/* ---------- Temă ---------- */
const prefDark = () => window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
function applyTheme(t) {
  document.documentElement.dataset.theme = t; LS.set("tin_theme", t);
  const b = $("#themeBtn"); if (b) b.innerHTML = t === "dark" ? I.sun : I.moon;
  const m = $('meta[name="theme-color"]'); if (m) m.content = t === "dark" ? "#0E1420" : "#F5F6F8";
}
applyTheme(LS.get("tin_theme", "light"));

/* ---------- Schelet ---------- */
const markImg = cls => `<img class="${cls}" src="${C.logo}" alt="">`;
const wordmark = () => `<img class="wm wm-l" src="img/agape-full.svg" alt="${esc(C.church)}"><img class="wm wm-d" src="img/agape-full-dark.svg" alt="${esc(C.church)}">`;
document.getElementById("app").innerHTML = `
<div class="app">
  <aside class="side">
    <a class="brand" href="#acasa">${markImg("mark")}<span><b>${esc(C.appName)}</b><small>Concursul Biblic 2027</small></span></a>
    <nav class="nav" id="nav"></nav>
    <div class="side-foot">${wordmark()}<br>© ${C.year} ${esc(C.author)}<br><span class="sf-n">Platformă personală, neafiliată cu organizatorii oficiali.</span></div>
  </aside>
  <div class="main"><header class="top" id="top"></header><main id="content"></main></div>
  <nav class="tabbar" id="tabbar">
    <a href="#acasa" data-t="home">${I.home}Acasă</a>
    <a href="#teste" data-t="tests">${I.grid}Teste</a>
    <a href="#memorare" data-t="memo">${I.quote}Memorare</a>
    <a href="#clasament" data-t="board">${I.trophy}Clasament</a>
    <a href="#despre" data-t="about">${I.info}Despre</a>
  </nav>
</div>`;
const content = $("#content");
window.addEventListener("scroll", () => { const t = $("#top"); t && t.classList.toggle("scrolled", scrollY > 4); }, {passive: true});

function renderNav(active) {
  const h = hist();
  $("#nav").innerHTML = `
    <a class="${active === "home" ? "on" : ""}" href="#acasa"><span class="sym">${I.home}</span>Acasă</a>
    <a class="${active === "tests" ? "on" : ""}" href="#teste"><span class="sym">${I.grid}</span>Biblioteca de teste</a>
    <a class="${active === "board" ? "on" : ""}" href="#clasament"><span class="sym">${I.trophy}</span>Clasament</a>
    <a class="${active === "memo" ? "on" : ""}" href="#memorare"><span class="sym">${I.quote}</span>Memorare · Apocalipsa</a>
    <div class="nav-h">Categorii</div>
    ${CATS.map(c => `<a class="${active === c.id ? "on" : ""}" href="#c-${c.id}"><span class="dot" style="background:${c.color}"></span>${esc(c.short)}<span class="cnt">${doneIn(h, c)}/${c.tests}</span></a>`).join("")}
    <div class="nav-h">Informații</div>
    <a class="${active === "about" ? "on" : ""}" href="#despre"><span class="sym">${I.info}</span>Despre concurs</a>`;
  const t = {home: "home", tests: "tests", board: "board", about: "about", memo: "memo"}[active] || (CAT[active] ? "tests" : "");
  $$("#tabbar a").forEach(a => a.classList.toggle("on", a.dataset.t === t));
}
function topbar({back, title, sub}) {
  $("#top").innerHTML = `
    ${back ? `<button class="ib nav-back" id="backBtn" aria-label="Înapoi">${I.back}</button>` : ""}
    <div style="min-width:0">${title ? `<div class="ttl">${title}</div>` : ""}${sub ? `<div class="sub">${sub}</div>` : ""}</div>
    <span class="sp"></span>
    <button class="ib" id="themeBtn" aria-label="Schimbă tema">${document.documentElement.dataset.theme === "dark" ? I.sun : I.moon}</button>`;
  if (back) $("#backBtn").onclick = typeof back === "function" ? back : () => go(back);
  $("#themeBtn").onclick = () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}
function toast(msg, ms = 2600) { $$(".toast").forEach(t => t.remove()); const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
function sheet(html, opts = {}) {
  const sc = document.createElement("div"); sc.className = "scrim" + (opts.center ? " center" : "");
  sc.innerHTML = `<div class="sheet">${html}</div>`; document.body.appendChild(sc);
  const close = () => sc.remove();
  sc.addEventListener("click", e => { if (e.target === sc) close(); });
  return {el: sc, close};
}
const DISCL = `Platformă personală, realizată de <b>${esc(C.author)}</b> pentru <b>${esc(C.church)}</b>. Nu este afiliată sub nicio formă cu site-ul oficial sau cu organizatorii concursului Talantul în Negoț. Pentru regulament, bibliografie și informații oficiale, intră pe <a href="https://talantulinnegot.com" target="_blank" rel="noopener">talantulinnegot.com</a>.`;
const foot = () => `<div class="foot">${wordmark()}<br>© ${C.year} <b>${esc(C.author)}</b> · Realizat pentru <b>${esc(C.church)}</b><br>${DISCL}<br>Textul biblic: Biblia Cornilescu revizuită (VDC), folosit doar pentru studiu. Verifică mereu în Biblie. · versiunea ${esc(C.version)}</div>`;

/* ---------- Navigare ---------- */
let CUR = location.hash || "#acasa";
function go(h, replace) {
  CUR = h;
  if (!EMBED) { try { if (location.hash !== h) history[replace ? "replaceState" : "pushState"](null, "", h); } catch (e) {} }
  route();
}
document.addEventListener("click", e => { const a = e.target.closest && e.target.closest('a[href^="#"]'); if (a) { e.preventDefault(); go(a.getAttribute("href")); } });

/* ---------- Componente ---------- */
const DIFF = ["", "Ușor", "Mediu", "Greu"];
const diffHtml = l => `<span class="diff">${[1, 2, 3].map(i => `<i class="${i <= l ? "on" : ""}"></i>`).join("")} ${DIFF[l]}</span>`;
function testCard(cat, t, h) {
  const c = CAT[cat], r = h[`${cat}:${t.n}`], cur = LS.get("tin_cur", null), going = cur && cur.key === `${cat}:${t.n}` && (cur.ans || []).some(x => x != null);
  return `<button class="card tcard" style="--cc:${c.color}" data-cat="${cat}" data-n="${t.n}">
    <div class="top-l"><span class="tag" style="color:${c.color};background:${c.color}14">${esc(c.short)}</span>${diffHtml(t.lvl)}</div>
    <div><div class="no">Testul ${t.n}</div><div class="ttl">${t.seg >= 0 ? esc(SEGS[t.seg].label) : "Recapitulare generală"}</div></div>
    <div class="meta"><span>${I.q}31 de întrebări</span><span>${I.clock}60 min</span><span>${I.book}${t.seg >= 0 ? esc(c.ntName) : "Toate cărțile"}</span></div>
    <div class="pr"><span class="tr"><i style="width:${r ? r.best : 0}%"></i></span><span>${r ? r.best + " p" : going ? "în curs" : "nou"}</span></div>
  </button>`;
}
function verseCard(cat, m, h) {
  const c = CAT[cat], r = h[`${cat}:v${m.k}`];
  return `<button class="card tcard" style="--cc:var(--burg)" data-cat="${cat}" data-v="${m.k}">
    <div class="top-l"><span class="tag burg">${I.quote}Versete · ${esc(c.short)}</span></div>
    <div><div class="ttl">${m.name}</div><div class="muted" style="font-size:14px;margin-top:4px">${m.desc}</div></div>
    <div class="meta"><span>${I.q}10 întrebări</span><span>${I.clock}~10 min</span></div>
    <div class="pr"><span class="tr"><i style="width:${r ? r.best : 0}%"></i></span><span>${r ? r.best + " p" : "nou"}</span></div>
  </button>`;
}
function bindCards(root) {
  $$("button.tcard", root).forEach(b => b.onclick = () => b.dataset.v ? startFlow(b.dataset.cat, +b.dataset.v, true) : startFlow(b.dataset.cat, +b.dataset.n));
}
function catCard(c, h) {
  const d = doneIn(h, c);
  return `<a class="card ccard" href="#c-${c.id}" style="--cc:${c.color}">${tile(c)}
    <div><div class="t">${esc(c.name)}</div><div class="d">1–2 Samuel · ${esc(c.ntName)}</div></div>
    <div class="pr"><span class="tr"><i style="width:${d / c.tests * 100}%"></i></span>${d}/${c.tests}</div></a>`;
}
function verseOfDay() {
  const all = Object.values(window.VERSES).flat(); const day = Math.floor(Date.now() / 864e5);
  return all[day % all.length];
}

/* ---------- Dashboard ---------- */
function pageHome() {
  renderNav("home"); topbar({});
  const h = hist(), cur = LS.get("tin_cur", null), pc = prefCat();
  const keys = Object.keys(h).filter(k => !k.includes(":v")), vkeys = Object.keys(h).filter(k => k.includes(":v"));
  const avg = keys.length ? Math.round(keys.reduce((a, k) => a + h[k].best, 0) / keys.length) : 0;
  const best = keys.length ? Math.max(...keys.map(k => h[k].best)) : 0;
  const first = S.name ? S.name.split(" ")[0] : "";
  const date = new Date().toLocaleDateString("ro-RO", {weekday: "long", day: "numeric", month: "long"});
  // hero
  let hero;
  const curParts = cur && cur.key ? cur.key.split(":") : null;
  if (curParts && CAT[curParts[0]] && (cur.ans || []).some(x => x != null)) {
    const c = CAT[curParts[0]], isV = curParts[1].startsWith("v"), n = +curParts[1].replace("v", "");
    const ses = isV ? makeVerseSession(c.id, n) : makeSession(c.id, n), cnt = countItems(ses.items, cur.ans || []);
    const ttl = isV ? VERSE_MODES.find(m => m.k === n).name : `Testul ${n} · ${ses.T.title}`;
    hero = `<div class="eyebrow">Continuă de unde ai rămas</div><h2>${esc(ttl)}</h2><p>${esc(c.name)} · ${cur.practice ? "mod antrenament" : "mod concurs"}</p>
      <div class="hp"><span class="tr"><i style="width:${cnt.done / cnt.total * 100}%"></i></span><span>${cnt.done} din ${cnt.total}</span></div>
      <div class="acts"><a class="btn white lg" href="${isV ? `#v-${c.id}-${n}` : `#t-${c.id}-${n}`}">${I.play}Continuă</a><a class="btn light lg" href="#c-${c.id}">Vezi categoria</a></div>`;
  } else if (pc) {
    const c = CAT[pc], t = testsFor(pc).find(t => !h[`${pc}:${t.n}`]) || testsFor(pc)[0];
    hero = `<div class="eyebrow">Următorul pas</div><h2>Testul ${t.n} · ${esc(t.seg >= 0 ? SEGS[t.seg].label : "Recapitulare generală")}</h2><p>${esc(c.name)} · 31 de întrebări în formatul concursului, cu corectură și referințe biblice.</p>
      <div class="hp"><span class="tr"><i style="width:${doneIn(h, c) / c.tests * 100}%"></i></span><span>${doneIn(h, c)} din ${c.tests} teste</span></div>
      <div class="acts"><button class="btn white lg" id="heroGo">${I.play}Începe testul</button><a class="btn light lg" href="#c-${c.id}">Toate testele categoriei</a></div>`;
    setTimeout(() => { const b = $("#heroGo"); if (b) b.onclick = () => startFlow(pc, t.n); });
  } else {
    hero = `<div class="eyebrow">Concursul Biblic 2027</div><h2>Pregătește-te pentru Talantul în Negoț</h2><p>Teste în formatul concursului, pe categorii de vârstă, după bibliografia oficială. Vezi unde ai greșit, cu referința biblică, și urcă în clasament.</p>
      <div class="acts"><a class="btn white lg" href="#teste">${I.grid}Alege un test</a><a class="btn light lg" href="#despre">Cum funcționează</a></div>`;
  }
  const recCat = pc || "c45", rc = CAT[recCat];
  const recs = testsFor(recCat).filter(t => !h[`${recCat}:${t.n}`]).slice(0, 2);
  const vd = verseOfDay();
  content.innerHTML = `<div class="page fade">
    <div class="hello"><div><div class="eyebrow">${esc(C.church)}</div><h1 style="margin-top:6px">${first ? `Bună, ${esc(first)}` : "Bine ai venit"}</h1></div><div class="date">${esc(date.charAt(0).toUpperCase() + date.slice(1))}${(e => e ? `<br><a href="#despre" class="next-et">${esc(e.n)}: ${esc(fmtD(e.d).replace(/^[^,]+, /, ""))} · ${daysTo(e.d) === 0 ? "azi" : `în ${daysTo(e.d)} zile`}</a>` : "")(nextEtapa())}</div></div>
    <section class="hero">${ART}<div class="art2"></div><div style="position:relative">${hero}</div></section>
    <div class="grid g4 stats" style="margin-top:16px">
      <div class="card stat"><div class="k">${I.check}Teste finalizate</div><b>${keys.length}</b><small>din ${TOTAL}</small></div>
      <div class="card stat"><div class="k">${I.chart}Media ta</div><b>${keys.length ? avg : "–"}</b><small>puncte din 100</small></div>
      <div class="card stat"><div class="k">${I.star}Cel mai bun scor</div><b>${keys.length ? best : "–"}</b><small>puncte</small></div>
      <div class="card stat"><div class="k">${I.quote}Antrenamente versete</div><b>${vkeys.length}</b><small>din ${CATS.length * VERSE_MODES.length}</small></div>
    </div>
    <div class="sec-h"><div><h2>Recomandate pentru tine</h2><p>${pc ? esc(rc.name) : "Alege-ți categoria ca să primești recomandări potrivite"}</p></div><a href="#teste">Biblioteca de teste</a></div>
    <div class="grid g3" id="recs">${recs.map(t => testCard(recCat, t, h)).join("")}${verseCard(recCat, VERSE_MODES[0], h)}</div>
    <a class="card memo-band" href="#memorare"><span class="ic-tile" style="background:linear-gradient(145deg,${MEMO_COLOR},${shade(MEMO_COLOR)})">${I.quote}</span>
      <span class="grow"><span class="eyebrow">Nou · Memorare</span><b>Apocalipsa 1–5, verset cu verset</b><span class="muted">Completează cuvintele lipsă dintre variante care seamănă între ele. Trei niveluri pe fiecare capitol și clasament separat.</span></span><span class="btn primary">Începe${I.next}</span></a>
    <div class="sec-h"><div><h2>Categorii de vârstă</h2><p>Categoria se stabilește după clasa sau vârsta de la 1 ianuarie 2027</p></div></div>
    <div class="grid g4">${CATS.map(c => catCard(c, h)).join("")}</div>
    <div class="grid g2" style="margin-top:40px;align-items:start">
      <div><div class="sec-h" style="margin-top:0"><h2>Versetul zilei</h2></div><div class="card verse-card"><q>„${esc(vd.text)}”</q><cite>${esc(vd.ref)}</cite></div>
        <div class="card verse-card" style="margin-top:16px"><q>„Strâng Cuvântul Tău în inima mea, ca să nu păcătuiesc împotriva Ta!”</q><cite>Psalmii 119:11 · versetul concursului</cite></div></div>
      <div><div class="sec-h" style="margin-top:0"><h2>Clasament</h2><a href="#clasament">Vezi tot</a></div><div id="podium"><div class="card"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div></div></div>
    </div>
    ${installCard()}${foot()}
  </div>`;
  bindCards(content); bindInstall(); loadPodiumMini($("#podium"));
}

/* ---------- Bibliotecă ---------- */
const F = {q: "", cat: "", diff: 0, st: "all", type: "tests"};
function pageLibrary() {
  renderNav("tests"); topbar({title: "Biblioteca de teste"});
  if (!F.cat && prefCat()) F.cat = prefCat();
  content.innerHTML = `<div class="page fade">
    <div class="hello"><div><div class="eyebrow">Bibliotecă</div><h1 style="margin-top:6px">Teste și antrenamente</h1><p class="lead">${TOTAL} de teste în formatul concursului și ${CATS.length * VERSE_MODES.length} de antrenamente pe versetele de memorat.</p></div></div>
    <div class="toolbar" style="margin-top:8px"><label class="search">${I.search}<input id="q" type="search" placeholder="Caută: Goliat, 2 Samuel, recapitulare, testul 7…" value="${esc(F.q)}"></label>
      <div class="seg" id="fType"><button data-v="tests">Teste</button><button data-v="verses">Versete</button></div></div>
    <div class="chips" id="fCat"><button data-v="">Toate categoriile</button>${CATS.map(c => `<button data-v="${c.id}">${esc(c.short)}</button>`).join("")}</div>
    <div class="toolbar" style="margin:14px 0 20px"><div class="seg" id="fDiff"><button data-v="0">Orice nivel</button><button data-v="1">Ușor</button><button data-v="2">Mediu</button><button data-v="3">Greu</button></div>
      <div class="seg" id="fSt"><button data-v="all">Toate</button><button data-v="todo">Nefăcute</button><button data-v="done">Făcute</button></div></div>
    <div id="libCount" class="note" style="margin:0 0 12px"></div>
    <div class="grid g3" id="lib"></div>${foot()}</div>`;
  const draw = () => {
    const h = hist(), q = F.q.trim().toLowerCase();
    $$("#fType button").forEach(b => b.classList.toggle("on", b.dataset.v === F.type));
    $$("#fCat button").forEach(b => b.classList.toggle("on", b.dataset.v === F.cat));
    $$("#fDiff button").forEach(b => b.classList.toggle("on", +b.dataset.v === F.diff));
    $$("#fSt button").forEach(b => b.classList.toggle("on", b.dataset.v === F.st));
    $("#fDiff").style.display = F.type === "tests" ? "" : "none";
    const cats = F.cat ? [CAT[F.cat]] : CATS; let out = [];
    if (F.type === "tests") {
      cats.forEach(c => testsFor(c.id).forEach(t => {
        const label = `testul ${t.n} ${t.seg >= 0 ? SEGS[t.seg].label : "recapitulare generală"} ${c.name} ${c.short} ${c.ntName} ${DIFF[t.lvl]}`.toLowerCase();
        const kw = q && ![...t.tf, ...t.mc].some(x => x.text.toLowerCase().includes(q)) && !label.includes(q);
        if (kw) return; if (F.diff && t.lvl !== F.diff) return;
        const d = !!h[`${c.id}:${t.n}`]; if (F.st === "todo" && d) return; if (F.st === "done" && !d) return;
        out.push(testCard(c.id, t, h)); }));
    } else {
      cats.forEach(c => VERSE_MODES.forEach(m => {
        const label = `${m.name} ${m.desc} ${c.name} ${c.short}`.toLowerCase();
        if (q && !label.includes(q) && !window.VERSES[c.verses].some(v => (v.ref + " " + v.text).toLowerCase().includes(q))) return;
        const d = !!h[`${c.id}:v${m.k}`]; if (F.st === "todo" && d) return; if (F.st === "done" && !d) return;
        out.push(verseCard(c.id, m, h)); }));
    }
    $("#libCount").textContent = out.length ? `${out.length} ${out.length === 1 ? "rezultat" : "rezultate"}` : "";
    $("#lib").innerHTML = out.length ? out.join("") : `<div class="card empty" style="grid-column:1/-1">Niciun test nu se potrivește filtrelor. Încearcă altă căutare.</div>`;
    bindCards($("#lib"));
  };
  $("#q").addEventListener("input", e => { F.q = e.target.value; draw(); });
  $$("#fType button").forEach(b => b.onclick = () => { F.type = b.dataset.v; draw(); });
  $$("#fCat button").forEach(b => b.onclick = () => { F.cat = b.dataset.v; if (F.cat) LS.set("tin_cat", F.cat); draw(); });
  $$("#fDiff button").forEach(b => b.onclick = () => { F.diff = +b.dataset.v; draw(); });
  $$("#fSt button").forEach(b => b.onclick = () => { F.st = b.dataset.v; draw(); });
  draw();
  const on = $("#fCat .on"); on && on.scrollIntoView({inline: "center", block: "nearest"});
}

/* ---------- Categorie ---------- */
const NT_DESC = {iuda: "1 capitol: lupta pentru credință și păzirea în dragostea lui Dumnezeu.", petru1: "5 capitole: nădejdea vie, preoția împărătească, suferința pentru Hristos.", filipeni: "4 capitole: bucuria în Domnul, smerenia lui Hristos, alergarea spre țintă.", galateni: "6 capitole: Evanghelia harului, libertatea în Hristos, roada Duhului.", evrei: "13 capitole: Hristos mai presus de toate, Marele Preot, eroii credinței."};
function pageCat(id, tab) {
  const c = CAT[id]; if (!c) return go("#acasa", true);
  LS.set("tin_cat", id); F.cat = id;
  renderNav(id); topbar({back: "#teste", title: esc(c.name)});
  const tests = testsFor(id), h = hist(), vs = window.VERSES[c.verses], d = doneIn(h, c);
  content.innerHTML = `<div class="page fade">
    <section class="banner" style="--cc:${c.color}">${ART}<div style="position:relative;display:flex;gap:20px;align-items:center;flex-wrap:wrap">
      <span class="ic-tile l" style="background:rgba(255,255,255,.16)">${esc(c.ic)}</span>
      <div><div class="eyebrow" style="color:rgba(255,255,255,.75)">Categoria</div><h1 style="margin-top:4px">${esc(c.name)}</h1>
        <div class="bk"><span>${I.book}1 Samuel</span><span>${I.book}2 Samuel</span><span>${I.book}${esc(c.ntName)}</span><span>${I.check}${d} din ${c.tests} teste</span></div></div></div></section>
    <div class="toolbar"><div class="seg" id="tabs"><button data-t="tests">Teste</button><button data-t="verses">Versete</button><button data-t="board">Clasament</button><button data-t="bib">Bibliografie</button></div>
      <button class="btn" id="rnd">${I.redo}Test la întâmplare</button></div>
    <div id="body"></div>${foot()}</div>`;
  const body = $("#body");
  const show = t => {
    $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === t));
    if (t === "tests") {
      body.innerHTML = `<div class="sec-h" style="margin-top:0"><div><h2>Pe capitole</h2><p>Testele 1–15 parcurg pe rând 1 și 2 Samuel, împreună cu ${esc(c.ntName)}</p></div></div>
        <div class="grid g3">${tests.slice(0, 15).map(t => testCard(id, t, h)).join("")}</div>
        <div class="sec-h"><div><h2>Recapitulare</h2><p>Întrebări din toate cărțile, ca la concurs</p></div></div>
        <div class="grid g3">${tests.slice(15).map(t => testCard(id, t, h)).join("")}</div>`;
    } else if (t === "verses") {
      body.innerHTML = `<div class="sec-h" style="margin-top:0"><div><h2>Antrenament pe versete</h2><p>10 întrebări a câte 10 puncte · nu intră în clasament</p></div></div>
        <div class="grid g2">${VERSE_MODES.map(m => verseCard(id, m, h)).join("")}</div>
        <div class="sec-h"><div><h2>Cele 10 versete de memorat</h2><p>Din bibliografia oficială 2027</p></div></div><div class="card">${vs.map(v => `<div class="vitem"><b>${esc(v.ref)}</b><div>${esc(v.text)}</div></div>`).join("")}</div>`;
    } else if (t === "board") { body.innerHTML = `<div id="cb"></div>`; loadBoard($("#cb"), id); }
    else {
      body.innerHTML = `<div class="grid g2" style="align-items:start"><div class="card">
        <div class="vitem"><b>1 SAMUEL</b><div>31 de capitole: Ana și Samuel, chivotul, Saul, David și Goliat, prietenia cu Ionatan, fuga lui David.</div></div>
        <div class="vitem"><b>2 SAMUEL</b><div>24 de capitole: domnia lui David, chivotul la Ierusalim, legământul, Absalom, ultimele cuvinte ale lui David.</div></div>
        <div class="vitem"><b>${esc(c.ntName.toUpperCase())}</b><div>${NT_DESC[c.nt]}</div></div></div>
        <div class="card"><div class="vitem"><b>MEMORAREA SCRIPTURII</b><div>Apocalipsa 1–5, pentru toate categoriile.</div></div>
        <div class="vitem"><b>TRADUCEREA</b><div>Biblia Dumitru Cornilescu, ediția SBR Oradea 2006.</div></div></div></div>`;
    }
    bindCards(body);
  };
  $$("#tabs button").forEach(b => b.onclick = () => show(b.dataset.t));
  $("#rnd").onclick = () => startFlow(id, 1 + Math.floor(Math.random() * tests.length));
  show(tab || "tests");
}

/* ---------- Clasament ---------- */
function rankRow(r, full) {
  const me = S.name && nameKey(S.name) === nameKey(r.name);
  return `<div class="row ${me ? "me" : ""}"><span class="rank r${r.pos}">${r.pos}</span>
    <span class="grow"><div class="t">${esc(r.name)}${me ? ' <span class="tag navy" style="height:20px;margin-left:4px">tu</span>' : ""}</div><div class="d">${r.tests} ${r.tests == 1 ? "test" : "teste"}${full && r.avg_score != null ? ` · media ${Number(r.avg_score).toLocaleString("ro-RO")}` : ""}</div></span>
    <span class="pts">${r.total} p</span></div>`;
}
const errBox = `<div class="card empty">Clasamentul nu se poate încărca acum. Verifică conexiunea la internet.</div>`;
async function loadPodiumMini(el) {
  try {
    const rows = await API.podium(), by = {}; rows.forEach(r => (by[r.cat] = by[r.cat] || []).push(r));
    const list = CATS.filter(c => by[c.id]).slice(0, 3);
    if (!list.length) { el.innerHTML = `<div class="card empty">Clasamentul este încă gol.<br>Fă un test, scrie-ți numele și fii primul.</div>`; return; }
    el.innerHTML = `<div class="card">${list.map(c => `<a class="row" href="#clasament-${c.id}"><span class="dot" style="background:${c.color};margin:0"></span><span class="grow"><div class="t">${esc(c.name)}</div><div class="d">${esc(by[c.id][0].name)} conduce cu ${by[c.id][0].total} p</div></span><span class="chev">${I.chev}</span></a>`).join("")}</div>`;
  } catch (e) { el.innerHTML = errBox; }
}
async function loadBoard(el, cat) {
  el.innerHTML = `<div class="card"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>`;
  try {
    const rows = await API.board(cat);
    if (!rows.length) { el.innerHTML = `<div class="card empty">Nimeni în această categorie deocamdată. Fii primul!</div>`; return; }
    const pod = [rows[1], rows[0], rows[2]].map((r, i) => r ? `<div class="card pod p${r.pos}"><div class="pl">${r.pos}</div><div class="n">${esc(r.name)}</div><div class="s">${r.total} p</div><div class="x">${r.tests} ${r.tests == 1 ? "test" : "teste"}</div></div>` : `<div></div>`).join("");
    el.innerHTML = `<div class="podium">${pod}</div>${rows.length > 3 ? `<div class="card">${rows.slice(3).map(r => rankRow(r, true)).join("")}</div>` : ""}
      <p class="note">Punctele sunt suma celor mai bune scoruri ale tale la fiecare test din categorie. Cu cât faci mai multe teste și le iei mai bine, cu atât urci.</p>`;
  } catch (e) { el.innerHTML = errBox; }
}
async function loadAllBoards(el) {
  el.innerHTML = `<div class="card"><div class="skel"></div><div class="skel"></div></div>`;
  try {
    const rows = await API.podium(), by = {}; rows.forEach(r => (by[r.cat] = by[r.cat] || []).push(r));
    el.innerHTML = `<div class="grid g2">${CATS.map(c => `<div class="card"><a class="row" href="#clasament-${c.id}">${tile(c, "s")}<span class="grow t">${esc(c.name)}</span><span class="chev">${I.chev}</span></a>
      ${(by[c.id] || []).map(r => rankRow(r)).join("") || `<div class="row"><span class="grow d">Încă nimeni. Fii primul!</span></div>`}</div>`).join("")}</div>`;
  } catch (e) { el.innerHTML = errBox; }
}
function pageBoard(cat) {
  renderNav("board"); topbar({title: "Clasament", sub: cat ? esc(CAT[cat].name) : ""});
  content.innerHTML = `<div class="page fade">
    <div class="hello"><div><div class="eyebrow">Clasament</div><h1 style="margin-top:6px">${cat ? esc(CAT[cat].name) : "Toate categoriile"}</h1><p class="lead">Pentru fiecare test se păstrează cel mai bun scor. Locul se stabilește după suma lor.</p></div></div>
    <div class="chips" id="bchips"><button class="${!cat ? "on" : ""}" data-c="">Toate</button>${CATS.map(c => `<button class="${cat === c.id ? "on" : ""}" data-c="${c.id}">${esc(c.short)}</button>`).join("")}</div>
    <div id="bbody" style="margin-top:20px"></div>${foot()}</div>`;
  $$("#bchips button").forEach(b => b.onclick = () => go(b.dataset.c ? `#clasament-${b.dataset.c}` : "#clasament", true));
  const on = $("#bchips .on"); on && on.scrollIntoView({inline: "center", block: "nearest"});
  if (cat) loadBoard($("#bbody"), cat); else loadAllBoards($("#bbody"));
}

/* ---------- Despre + instalare ---------- */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; const b = $("#instBtn"); if (b) b.hidden = false; });
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
function installCard() {
  if (isStandalone() || EMBED) return "";
  return `<div class="card" style="margin-top:40px;display:flex;gap:18px;align-items:center;padding:22px 24px;flex-wrap:wrap">${markImg("mark")}
    <div style="flex:1;min-width:220px"><h3>Pune aplicația pe ecranul telefonului</h3><div class="muted" style="font-size:14.5px;margin-top:2px">${isIOS() ? "În Safari apasă butonul Partajează, apoi „Adaugă pe ecranul principal”." : "Se deschide ca o aplicație, pe tot ecranul, și merge și fără internet."}</div></div>
    ${isIOS() ? "" : `<button class="btn primary" id="instBtn" ${deferredPrompt ? "" : "hidden"}>Instalează</button>`}</div>`;
}
function bindInstall() { const b = $("#instBtn"); if (b) b.onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; b.hidden = true; }; }
const ETAPE = [{n: "Faza pe biserică (locală)", d: "2027-03-20"}, {n: "Faza județeană", d: "2027-04-10"}, {n: "Faza regională", d: "2027-05-18"}, {n: "Faza națională", d: "2027-06-05"}, {n: "Faza internațională", d: "2027-08-07", loc: "București"}];
const daysTo = d => { const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(d + "T00:00:00") - t) / 864e5); };
const fmtD = d => new Date(d + "T12:00:00").toLocaleDateString("ro-RO", {weekday: "long", day: "numeric", month: "long", year: "numeric"});
const nextEtapa = () => ETAPE.find(e => daysTo(e.d) >= 0);
function pageAbout() {
  renderNav("about"); topbar({title: "Despre concurs"});
  content.innerHTML = `<div class="page narrow fade">
    <div class="hello"><div><div class="eyebrow">Despre</div><h1 style="margin-top:6px">Talantul în Negoț</h1>
    <p class="lead">Concursul Biblic organizat de Departamentul Familii și Copii al Cultului Creștin Penticostal din România. Scopul lui este cunoașterea Cuvântului lui Dumnezeu și se desfășoară după Biblia Cornilescu, ediția SBR Oradea 2006.</p></div></div>
    <div class="card pad discl"><h3>Despre această platformă</h3><p class="muted" style="margin:6px 0 0;font-size:15px">${DISCL}</p></div>
    <div class="card verse-card" style="margin-top:16px"><q>„Strâng Cuvântul Tău în inima mea, ca să nu păcătuiesc împotriva Ta!”</q><cite>Psalmii 119:11</cite></div>
    <div class="sec-h"><h2>Structura testului</h2></div>
    <div class="card">${SECTIONS.map(s => `<div class="row"><span class="tag navy" style="min-width:40px;justify-content:center">${s.roman}</span><span class="grow"><div class="t">${s.name}</div><div class="d">${s.n} itemi × ${s.per} puncte</div></span><span class="pts">${s.n * s.per} p</span></div>`).join("")}</div>
    <p class="note">Total 100 de puncte, 60 de minute. La alegerea multiplă pot fi 0, 1, 2 sau 3 răspunsuri corecte; punctele se dau doar pentru răspunsul complet.</p>
    <div class="sec-h"><div><h2>Etape și date</h2><p>Anul școlar 2026–2027</p></div></div>
    <div class="card">${ETAPE.map((e, i) => { const z = daysTo(e.d), nx = e === nextEtapa();
      return `<div class="row"><span class="rank ${nx ? "r1" : ""}">${i + 1}</span><span class="grow"><div class="t">${e.n}</div><div class="d">${fmtD(e.d)}${e.loc ? " · " + e.loc : ""}</div></span>${z < 0 ? `<span class="tag">încheiată</span>` : nx ? `<span class="tag burg">${z === 0 ? "azi" : z === 1 ? "mâine" : `în ${z} zile`}</span>` : ""}</div>`; }).join("")}</div>
    <div class="sec-h"><h2>Categorii (secțiunea Clasic)</h2></div>
    <div class="card">${CATS.map(c => `<a class="row" href="#c-${c.id}">${tile(c, "s")}<span class="grow"><div class="t">${esc(c.name)}</div><div class="d">1 Samuel, 2 Samuel, ${esc(c.ntName)}</div></span><span class="chev">${I.chev}</span></a>`).join("")}</div>
    <p class="note">Categoria se stabilește la 1 ianuarie 2027 și nu se schimbă între faze. Elevii din clasa a 11-a concurează la 10–11, iar cei din clasa a 12-a la 18–35 ani.</p>
    <div class="sec-h"><h2>Memorare · Apocalipsa 1–5</h2></div>
    <a class="card row" href="#memorare" style="padding:18px 20px"><span class="ic-tile s" style="background:linear-gradient(145deg,${MEMO_COLOR},${shade(MEMO_COLOR)})">${I.quote}</span><span class="grow"><div class="t">Completează versetele din Apocalipsa 1–5</div><div class="d">Pe capitole, trei niveluri, cu clasament separat</div></span><span class="chev">${I.chev}</span></a>
    <div class="sec-h"><h2>Moduri de lucru în aplicație</h2></div>
    <div class="grid g2"><div class="card pad"><h3>Mod concurs</h3><p class="muted" style="margin:6px 0 0;font-size:15px">Ca la concurs: 60 de minute, vezi răspunsurile abia la final. Scorul intră în clasament.</p></div>
      <div class="card pad"><h3>Mod antrenament</h3><p class="muted" style="margin:6px 0 0;font-size:15px">Verifici fiecare răspuns pe loc și vezi imediat explicația și referința. Fără cronometru.</p></div></div>
    ${installCard()}${foot()}</div>`;
  bindInstall();
}

/* ---------- Începerea testului ---------- */
const curKey = (cat, n, v) => `${cat}:${v ? "v" + n : n}`;
function startFlow(catId, n, verse) {
  const c = CAT[catId], cur = LS.get("tin_cur", null), key = curKey(catId, n, verse);
  LS.set("tin_cat", catId);
  const resume = cur && cur.key === key && (cur.ans || []).some(x => x != null);
  const title = verse ? VERSE_MODES.find(m => m.k === n).name : `Testul ${n}`;
  let mode = LS.get("tin_mode", "concurs");
  const sh = sheet(`
    <div style="display:flex;gap:14px;align-items:center">${tile(c)}<div><h3>${esc(title)}</h3><div class="muted" style="font-size:14px">${esc(c.name)} · ${verse ? "10 întrebări" : "31 de itemi · 100 de puncte"}</div></div></div>
    ${verse ? `<p class="muted" style="font-size:14.5px;margin:18px 0 0">Antrenamentul de versete nu intră în clasament. După fiecare răspuns poți verifica pe loc.</p>` : `
    <label class="lbl" for="nm">Numele și prenumele</label>
    <input class="field" id="nm" maxlength="40" autocomplete="name" placeholder="ex. Maria Popescu" value="${esc(S.name)}">
    <div class="note" style="margin:8px 0 0">Apare în clasament. Scrie-l la fel de fiecare dată, ca să ți se adune punctele; lasă gol dacă nu vrei să apari.</div>
    <div class="lbl">Mod de lucru</div>
    <label class="opt-row ${mode === "concurs" ? "on" : ""}"><input type="radio" name="md" value="concurs" ${mode === "concurs" ? "checked" : ""}><div><b>Concurs</b><span>60 de minute, răspunsurile se văd la final.</span></div></label>
    <label class="opt-row ${mode === "antrenament" ? "on" : ""}"><input type="radio" name="md" value="antrenament" ${mode === "antrenament" ? "checked" : ""}><div><b>Antrenament</b><span>Verifici fiecare răspuns pe loc, fără cronometru.</span></div></label>`}
    <div class="acts">${resume ? `<button class="btn" id="rs">Continuă</button><button class="btn primary" id="go">Începe din nou</button>` : `<button class="btn" id="cn">Anulează</button><button class="btn primary" id="go">Începe</button>`}</div>`);
  const sc = sh.el;
  $$('input[name="md"]', sc).forEach(r => r.onchange = () => { mode = r.value; $$(".opt-row", sc).forEach(o => o.classList.toggle("on", $("input", o).checked)); });
  $("#cn", sc) && ($("#cn", sc).onclick = sh.close);
  const begin = res => {
    if (!verse) { const nm = normName($("#nm", sc).value); if (nm && nm.length < 2) { toast("Numele trebuie să aibă cel puțin 2 litere"); return; }
      S.name = nm; LS.set("tin_name", nm); LS.set("tin_mode", mode); }
    sh.close();
    if (!res) LS.set("tin_cur", {key, ans: [], chk: [], idx: 0, start: Date.now(), practice: verse ? true : mode === "antrenament"});
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
  if (!cur || cur.key !== key) { cur = {key, ans: [], chk: [], idx: 0, start: Date.now(), practice: verse ? true : LS.get("tin_mode", "concurs") === "antrenament"}; LS.set("tin_cur", cur); }
  S.drawn = -1; S.session = verse ? makeVerseSession(catId, n) : makeSession(catId, n); S.session.key = key; S.session.verse = !!verse;
  S.ans = cur.ans || []; S.chk = cur.chk || []; S.practice = !!cur.practice;
  S.idx = Math.min(cur.idx || 0, S.session.items.length - 1); S.start = cur.start || Date.now();
  document.body.classList.add("testing");
  renderNav(catId);
  const title = verse ? S.session.T.title : `Testul ${n}`;
  topbar({back: () => { const sh = sheet(`<h3>Ieși din test?</h3><p class="muted" style="margin:6px 0 0;font-size:15px">Răspunsurile rămân salvate pe acest dispozitiv; poți continua mai târziu de unde ai rămas.</p><div class="acts"><button class="btn" id="st">Rămân</button><button class="btn primary" id="lv">Ieși</button></div>`, {center: true});
      $("#st", sh.el).onclick = sh.close; $("#lv", sh.el).onclick = () => { sh.close(); go(`#c-${catId}`); }; },
    title: esc(title), sub: `${esc(c.name)} · ${S.practice ? "antrenament" : "concurs"}`});
  content.innerHTML = `<div class="tw" id="tw"></div>`;
  clearInterval(S.timer);
  if (!S.practice) S.timer = setInterval(() => {
    const el = $("#tmr"); if (!el) return clearInterval(S.timer);
    const left = 3600 - Math.floor((Date.now() - S.start) / 1000); el.innerHTML = I.clock + fmt(Math.max(0, left)); el.classList.toggle("low", left < 300);
    if (left <= 0) { clearInterval(S.timer); toast("Timpul a expirat"); finish(); }
  }, 1000);
  drawQ();
}
function persist() { LS.set("tin_cur", {key: S.session.key, ans: S.ans, chk: S.chk, idx: S.idx, start: S.start, practice: S.practice}); }
function move(d) { const n = S.idx + d; if (n < 0 || n >= S.session.items.length) return; S.idx = n; persist(); drawQ(); window.scrollTo({top: 0}); }
const secName = it => S.session.verse ? (it.kind === "fill" ? "Cuvântul care lipsește" : it.kind === "ref" ? "Unde este scris?" : "Ordonează versetul") : SECTIONS.find(s => s.k === it.sec).name;
function correctText(it) {
  const L = ["a", "b", "c"];
  if (it.sec === "tf") return it.q.ans ? "Adevărat" : "Fals";
  if (it.sec === "mc") return `${L[it.correct]}) ${it.q.opts[0]}`;
  if (it.sec === "ms") return it.correct.length ? it.correct.map(i => `${L[i]}) ${it.q.opts[it.order[i]]}`).join("; ") : "niciun răspuns corect";
  if (it.sec === "mt") return it.q.pairs.map((p, i) => `${i + 1}–${it.letters[it.correct[i]]}`).join(", ");
  return it.q.text;
}

function drawQ() {
  const {items} = S.session, it = items[S.idx], a = S.ans[S.idx], V = S.session.verse;
  const checked = S.practice && S.chk[S.idx], res = checked ? scoreAll([it], [a]).res[0] : null;
  const secItems = V ? items : items.filter(x => x.sec === it.sec), pos = secItems.indexOf(it) + 1;
  const left = 3600 - Math.floor((Date.now() - S.start) / 1000), L = ["a", "b", "c"];
  const st = (cond, wrongCond) => checked ? (cond ? "right" : wrongCond ? "wrong" : "") : "";
  const fbR = `<span class="fb">${I.check}Corect</span>`, fbW = `<span class="fb">${I.x}Greșit</span>`;
  let body = "";
  if (it.sec === "tf") {
    const cls = v => a === v ? (checked ? (it.q.ans === v ? "right" : "wrong") : "on") : (checked && it.q.ans === v ? "right" : "");
    body = `<div class="qt">${esc(it.q.text)}</div><div class="tf ${checked ? "locked" : ""}">
      <button class="ans ${cls(true)}" data-v="1"><span class="k sq">A</span>Adevărat</button>
      <button class="ans ${cls(false)}" data-v="0"><span class="k sq">F</span>Fals</button></div>`;
  } else if (it.sec === "mc") {
    const q = it.kind === "fill" ? "Care cuvânt lipsește din verset?" : it.kind === "ref" ? "Unde este scris versetul acesta?" : "";
    body = `${q ? `<div class="eyebrow" style="margin-bottom:10px">${q}</div>` : ""}<div class="qt${it.kind ? " serif" : ""}">${esc(it.q.text)}</div>${it.kind === "fill" ? `<div class="ref" style="margin-top:12px">${I.book}${esc(it.q.ref)}</div>` : ""}
      <div class="answers ${checked ? "locked" : ""}">${it.order.map((oi, i) => { const c = checked ? (i === it.correct ? "right" : a === i ? "wrong" : "") : (a === i ? "on" : "");
        return `<button class="ans ${c}" data-v="${i}"><span class="k">${L[i].toUpperCase()}</span><span class="lab">${esc(it.q.opts[oi])}</span>${c === "right" ? fbR : c === "wrong" ? fbW : ""}</button>`; }).join("")}</div>`;
  } else if (it.sec === "ms") {
    const s = a || {sel: [], none: false};
    body = `<div class="qt">${esc(it.q.text)}</div><div class="qhint">Pot fi 0, 1, 2 sau 3 răspunsuri corecte. Primești 5 puncte doar dacă alegi exact răspunsurile corecte.</div>
      <div class="answers ${checked ? "locked" : ""}">${it.order.map((oi, i) => { const sel = s.sel.includes(i), cor = it.correct.includes(i);
        const c = checked ? (cor ? "right" : sel ? "wrong" : "") : (sel ? "on" : "");
        return `<button class="ans ${c}" data-v="${i}"><span class="k sq">${sel ? `<span style="width:16px;height:16px">${I.check}</span>` : L[i].toUpperCase()}</span><span class="lab">${esc(it.q.opts[oi])}</span>${c === "right" ? fbR : c === "wrong" ? fbW : ""}</button>`; }).join("")}
      <button class="ans ${checked ? (!it.correct.length ? "right" : s.none ? "wrong" : "") : (s.none ? "on" : "")}" data-v="none"><span class="k sq">0</span><span class="lab muted">Niciun răspuns nu este corect</span></button></div>`;
  } else if (it.sec === "mt") {
    const s = a || [null, null, null, null, null];
    body = `<div class="qt">${esc(it.q.text)}</div><div class="qhint">Pentru fiecare număr alege litera potrivită. Fiecare pereche corectă valorează 2 puncte.</div>
      <div class="mt-grid"><div class="mt-col"><h4>Variante</h4>${it.rorder.map((pi, p) => `<div class="mt-r"><b>${it.letters[p]}</b><span>${esc(it.q.pairs[pi][1])}</span></div>`).join("")}</div>
      <div class="mt-col"><h4>Potrivește</h4>${it.q.pairs.map((p, i) => `<div class="mt-row ${checked ? (s[i] === it.correct[i] ? "right" : "wrong") : s[i] != null ? "set" : ""}"><div class="l"><b>${i + 1}</b>${esc(p[0])}</div>
        <div class="letters" data-row="${i}">${it.letters.map((l, q) => `<button data-pos="${q}" class="${s[i] === q ? "on" : ""} ${s.includes(q) && s[i] !== q ? "used" : ""}" ${checked ? "disabled" : ""}>${l}</button>`).join("")}</div></div>`).join("")}</div></div>`;
  } else {
    const s = a || [];
    body = `<div class="qt">Așază fragmentele versetului în ordinea corectă</div><div class="ref" style="margin-top:12px">${I.book}${esc(it.q.ref)}</div>
      <div class="ord-ans ${s.length ? "" : "empty"} ${checked ? (res.pts ? "right" : "wrong") : ""}" id="oa">${s.map((pi, k) => `<button class="chip in" data-k="${k}" ${checked ? "disabled" : ""}><span class="i">${k + 1}</span>${esc(it.parts[it.order[pi]])}</button>`).join("")}</div>
      <div class="ord-pool">${it.order.map((pIdx, pi) => `<button class="chip ${s.includes(pi) ? "gone" : ""}" data-pi="${pi}" ${checked ? "disabled" : ""}>${esc(it.parts[pIdx])}</button>`).join("")}</div>
      ${s.length && !checked ? `<button class="btn ghost sm" id="oclr" style="margin-top:12px">Șterge ordinea</button>` : ""}`;
  }
  if (checked) {
    const good = res.pts === res.max;
    body += `<div class="explain ${good ? "ok" : "bad"}"><span class="ico">${good ? I.check : I.x}</span><div><b>${good ? "Corect" : res.pts ? `Parțial: ${res.pts} din ${res.max} puncte` : "Răspuns greșit"}</b>
      ${good ? "" : `<div>Răspunsul corect: <b style="display:inline">${esc(correctText(it))}</b></div>`}
      ${it.sec === "tf" && !it.q.ans && it.q.fix ? `<div class="s">${esc(it.q.fix)}</div>` : ""}
      ${it.kind ? `<div class="s">${esc(it.q.full)}</div>` : ""}
      <div class="ref" style="margin-top:6px">${I.book}${esc(it.q.ref)}</div></div></div>`;
  }
  const isLast = S.idx === items.length - 1;
  const secStart = V ? [0] : SECTIONS.map(s => items.findIndex(x => x.sec === s.k));
  const sec = V ? null : SECTIONS.find(s => s.k === it.sec);
  const label = V ? `<span class="tag burg">${I.quote}${secName(it)}</span><span class="tag">10 puncte</span>` : `<span class="tag navy">${sec.roman}. ${sec.name}</span><span class="tag">${sec.per} ${it.sec === "mt" ? "p / pereche" : "puncte"}</span>`;
  const segs = V ? [items] : SECTIONS.map(s => items.filter(x => x.sec === s.k));
  const segHtml = segs.map(g => { const tot = g.reduce((acc, x) => acc + (x.sec === "mt" ? 5 : 1), 0), done = countItems(g, g.map(x => S.ans[items.indexOf(x)])).done;
    return `<div class="${g.includes(it) ? "cur" : ""}"><i style="width:${done / tot * 100}%"></i></div>`; }).join("");
  const cnt = countItems(items, S.ans);
  const needCheck = S.practice && !checked && answered(it, a);
  const rightBtn = needCheck ? `<button class="btn lg primary" id="chk">Verifică răspunsul</button>`
    : isLast ? `<button class="btn lg primary" id="fin">Termină testul</button>` : `<button class="btn lg primary" id="next">Următoarea${I.next}</button>`;
  const dotCls = (x, i) => { if (S.practice && S.chk[i]) { const r = scoreAll([x], [S.ans[i]]).res[0]; return r.pts === r.max ? "ok" : "no"; } return answered(x, S.ans[i]) ? "a" : ""; };
  $("#tw").innerHTML = `
    <div class="tbar"><div class="segs">${segHtml}</div><span class="cnt">${cnt.done}/${cnt.total}</span>
      ${S.practice ? `<span class="tag burg">Antrenament</span>` : `<span class="timer ${left < 300 ? "low" : ""}" id="tmr">${I.clock}${fmt(Math.max(0, left))}</span>`}</div>
    <div class="secl">${label}<span class="no">${it.sec === "mt" ? "Itemii 1–5" : `Întrebarea ${pos} din ${secItems.length}`}</span></div>
    <div class="card qcard ${S.drawn === S.idx ? "" : "fade"}" id="qc">${body}</div>
    <div class="navbtns"><button class="btn lg" id="prev" ${S.idx === 0 ? "disabled" : ""}>${I.back}Înapoi</button><span class="sp"></span>${rightBtn}</div>
    <div class="dots">${items.map((x, i) => `${secStart.includes(i) && i ? '<span class="gap"></span>' : ""}<button class="${dotCls(x, i)} ${i === S.idx ? "cur" : ""}" data-i="${i}" aria-label="Întrebarea ${i + 1}">${V ? i + 1 : x.sec === "mt" ? "III" : i - secStart[SECTIONS.findIndex(s => s.k === x.sec)] + 1}</button>`).join("")}</div>
    ${isLast ? "" : `<div style="text-align:center;margin-top:18px"><button class="btn ghost" id="fin2">Termină testul acum</button></div>`}`;
  S.drawn = S.idx;
  const qc = $("#qc"), set = v => { if (checked) return; S.ans[S.idx] = v; persist(); drawQ(); };
  if (it.sec === "tf") $$(".ans", qc).forEach(b => b.onclick = () => set(b.dataset.v === "1"));
  if (it.sec === "mc") $$(".ans", qc).forEach(b => b.onclick = () => set(+b.dataset.v));
  if (it.sec === "ms") $$(".ans", qc).forEach(b => b.onclick = () => {
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
  $("#chk") && ($("#chk").onclick = () => { S.chk[S.idx] = true; persist(); drawQ(); });
  $("#fin") && ($("#fin").onclick = askFinish);
  $("#fin2") && ($("#fin2").onclick = askFinish);
  $$(".dots button").forEach(b => b.onclick = () => { S.idx = +b.dataset.i; persist(); drawQ(); });
}
document.addEventListener("keydown", e => {
  if (!/^#[tv]-/.test(CUR) || !S.session || $(".scrim") || e.target.tagName === "INPUT") return;
  const it = S.session.items[S.idx], k = e.key.toLowerCase();
  if (k === "arrowright") move(1); else if (k === "arrowleft") move(-1);
  else if (k === "enter" && $("#chk")) $("#chk").click();
  else if (it.sec === "tf" && (k === "a" || k === "f")) { const b = $$("#qc .ans")[k === "a" ? 0 : 1]; b && b.click(); }
  else if ((it.sec === "mc" || it.sec === "ms") && ["1", "2", "3", "a", "b", "c"].includes(k)) { const b = $$("#qc .ans")["123".includes(k) ? +k - 1 : "abc".indexOf(k)]; b && b.click(); }
});
function askFinish() {
  const cnt = countItems(S.session.items, S.ans), miss = cnt.total - cnt.done;
  const sh = sheet(`<h3>Termini testul?</h3><p class="muted" style="margin:6px 0 0;font-size:15px">${miss ? `Mai ai ${miss} ${miss === 1 ? "item necompletat" : "itemi necompletați"}. Itemii fără răspuns primesc 0 puncte.` : "Ai răspuns la toți itemii."}</p>
    <div class="acts"><button class="btn" id="no">Mai verific</button><button class="btn primary" id="yes">Vezi rezultatul</button></div>`, {center: true});
  $("#no", sh.el).onclick = sh.close; $("#yes", sh.el).onclick = () => { sh.close(); finish(); };
}
function finish() {
  clearInterval(S.timer);
  const {T, items} = S.session, V = S.session.verse, sc = scoreAll(items, S.ans);
  const secs = Math.min(3600, Math.round((Date.now() - S.start) / 1000)), d = new Date().toISOString().slice(0, 10);
  S.last = {cat: T.cat, n: V ? +String(T.n).slice(1) : T.n, verse: V, practice: S.practice, items, ans: S.ans.slice(), sc, secs, name: S.name, d, id: Date.now()};
  LS.set("tin_last", {cat: S.last.cat, n: S.last.n, verse: V, practice: S.practice, ans: S.last.ans, secs, name: S.name, d, id: S.last.id});
  saveHist(S.session.key, sc.total); LS.del("tin_cur");
  go("#rezultat");
}

/* ---------- Rezultat ---------- */
const tier = s => s >= 90 ? "high" : s >= 60 ? "mid" : "low";
function message(s) {
  if (s >= 90) return ["Excelent!", "„Bine, rob bun și credincios!” Ai strâns Cuvântul în inima ta."];
  if (s >= 75) return ["Foarte bine!", "Mai ai puțin până la punctajul maxim. Revizuiește greșelile și încearcă din nou."];
  if (s >= 60) return ["Bine!", "Ești pe drumul cel bun. Recitește capitolele unde ai greșit."];
  if (s >= 40) return ["Nu te descuraja", "Fiecare test te face mai puternic în Cuvânt. Citește din nou și revino."];
  return ["Curaj, încearcă din nou", "Citește capitolele cu atenție; vei vedea cum crește punctajul."];
}
const pickVerse = (score, seed) => { const a = ENC[tier(score)]; return a[Math.floor(rngFor("v" + seed)() * a.length)]; };
const encodePayload = o => [...new TextEncoder().encode([o.c, o.t, o.s, o.m, o.d, o.p.join("."), o.n].join("|"))].map(x => x.toString(16).padStart(2, "0")).join("");
function decodePayload(p) { try { const a = new TextDecoder().decode(new Uint8Array(p.match(/../g).map(h => parseInt(h, 16)))).split("|");
  return {c: a[0], t: +a[1], s: +a[2], m: +a[3], d: a[4], p: a[5].split(".").map(Number), n: a.slice(6).join("|")}; } catch (e) { return null; } }
const shareUrl = L => `${location.origin}/r/${encodePayload({c: L.cat, t: L.n, s: L.sc.total, n: L.name || "", m: L.secs, d: L.d, p: SECTIONS.map(s => L.sc.per[s.k])})}`;
const correctCount = L => L.items.reduce((a, it, i) => { const r = L.sc.res[i]; return a + (it.sec === "mt" ? r.pts / 2 : r.pts === r.max ? 1 : 0); }, 0);

function pageResult() {
  if (!S.last) { const l = LS.get("tin_last", null); if (!l) return go("#acasa", true);
    const ses = l.verse ? makeVerseSession(l.cat, l.n) : makeSession(l.cat, l.n); S.last = {...l, items: ses.items, sc: scoreAll(ses.items, l.ans)}; }
  document.body.classList.remove("testing");
  const L = S.last, c = CAT[L.cat], score = L.sc.total, V = L.verse;
  const tName = V ? VERSE_MODES.find(m => m.k === L.n).name : `Testul ${L.n}`;
  renderNav(L.cat); topbar({back: `#c-${L.cat}`, title: `Rezultat · ${esc(tName)}`, sub: esc(c.name)});
  const [m1, m2] = message(score), [vr, vt] = pickVerse(score, L.cat + L.n + score);
  const R = 76, CC = 2 * Math.PI * R;
  const all = L.items.map((it, i) => ({it, i, r: L.sc.res[i]})), wrong = all.filter(x => x.r.pts < x.r.max);
  const nextN = !V && L.n < c.tests ? L.n + 1 : null, nItems = V ? 10 : 31, corr = correctCount(L);
  const rows = V ? [{n: "Răspunsuri corecte", s: "10 întrebări × 10 p", p: score, m: 100}] : SECTIONS.map(s => ({n: `${s.roman}. ${s.short}`, s: `${s.n} itemi × ${s.per} p`, p: L.sc.per[s.k], m: L.sc.max[s.k]}));
  content.innerHTML = `<div class="page fade">
    <section class="res-hero">${ART}
      <div class="ring" style="position:relative"><svg viewBox="0 0 176 176"><circle cx="88" cy="88" r="${R}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="12"/>
        <circle id="arc" cx="88" cy="88" r="${R}" fill="none" stroke="url(#rg)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${CC}" stroke-dashoffset="${CC}" style="transition:stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)"/>
        <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#E7B9C4"/></linearGradient></defs></svg>
        <div class="v"><div><b id="sn">0</b><span>din 100 de puncte</span></div></div></div>
      <div style="position:relative"><div class="eyebrow" style="color:#E7B9C4">${esc(c.name)} · ${esc(tName)}${L.practice && !V ? " · antrenament" : ""}</div>
        <h1 style="margin-top:8px">${m1}</h1><p>${m2}</p>
        <div class="facts"><div><b>${corr} / ${nItems}</b>răspunsuri corecte</div><div><b>${fmt(L.secs)}</b>timp</div><div><b>${new Date(L.d).toLocaleDateString("ro-RO", {day: "numeric", month: "short"})}</b>data</div></div>
        <div class="acts"><button class="btn white lg" id="revBtn">Revizuiește răspunsurile</button>${nextN ? `<button class="btn light lg" id="nxBtn">Continuă studiul${I.next}</button>` : `<a class="btn light lg" href="#c-${L.cat}${V ? "-versete" : ""}">Continuă studiul${I.next}</a>`}</div></div>
    </section>
    <div class="grid g2" style="margin-top:16px;align-items:start">
      <div class="card chart"><h3 style="margin-bottom:8px">Punctaj pe secțiuni</h3>${rows.map(r => `<div class="bar"><div class="n">${r.n}<small>${r.s}</small></div><div class="tr"><i class="${r.p === r.m ? "full" : ""}" data-w="${r.p / r.m * 100}" style="width:0"></i></div><div class="pt">${r.p}/${r.m}</div></div>`).join("")}</div>
      <div class="grid" style="gap:16px">
        ${V ? "" : `<div class="card" id="rank"></div>`}
        ${V ? "" : `<div class="card pad"><h3>Distribuie rezultatul</h3><p class="muted" style="font-size:14px;margin:4px 0 16px">Trimite-l familiei sau prietenilor și provoacă-i să încerce și ei.</p>
          <div class="share"><button class="btn" id="shBtn">${I.share}Trimite</button><button class="btn" id="waBtn">${I.msg}WhatsApp</button><button class="btn" id="imBtn">${I.img}Imagine</button><button class="btn" id="cpBtn">${I.link}Link</button></div></div>`}
        <div class="card verse-card"><q>${esc(vt)}</q><cite>${esc(vr)}</cite></div>
      </div>
    </div>
    <div class="sec-h" id="revH"><div><h2>Revizuiește răspunsurile</h2><p>Fiecare întrebare are referința biblică, ca să poți citi pasajul.</p></div><div class="seg" id="rf"><button data-f="wrong" class="${S.reviewFilter === "wrong" ? "on" : ""}">Greșeli (${wrong.length})</button><button data-f="all" class="${S.reviewFilter === "all" ? "on" : ""}">Toate</button></div></div>
    <div class="card" id="rev"></div>
    <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;flex-wrap:wrap"><button class="btn lg" id="rdBtn">${I.redo}Refă testul</button>${nextN ? `<button class="btn lg primary" id="nxBtn2">Testul ${nextN}${I.next}</button>` : ""}</div>
    ${V ? "" : `<div class="sec-h"><div><h2>Cei mai buni la acest test</h2></div></div><div id="ttop"><div class="card"><div class="skel"></div><div class="skel"></div></div></div>`}
    ${foot()}</div>`;
  setTimeout(() => { $("#arc").style.strokeDashoffset = CC * (1 - score / 100); $$(".chart .tr i").forEach(i => i.style.width = i.dataset.w + "%"); }, 80);
  animateNum($("#sn"), score);
  if (score >= 90) confetti();
  const drawRev = () => { const list = S.reviewFilter === "wrong" ? wrong : all;
    $("#rev").innerHTML = list.length ? list.map(x => reviewItem(x.it, L.ans[x.i], x.r)).join("") : `<div class="empty">Nicio greșeală. Ai răspuns corect la tot!</div>`; };
  drawRev();
  $$("#rf button").forEach(b => b.onclick = () => { S.reviewFilter = b.dataset.f; $$("#rf button").forEach(x => x.classList.toggle("on", x === b)); drawRev(); });
  $("#revBtn").onclick = () => $("#revH").scrollIntoView({behavior: "smooth", block: "start"});
  $("#rdBtn").onclick = () => startFlow(L.cat, L.n, V);
  $$("#nxBtn,#nxBtn2").forEach(b => b.onclick = () => startFlow(L.cat, nextN));
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
    const sh = sheet(`<img src="${src}" alt="Rezultat" style="width:100%;max-height:60dvh;object-fit:contain;border-radius:14px;box-shadow:var(--sh-2)">
      <p class="muted" style="font-size:13.5px;margin:12px 0 0;text-align:center">Pe telefon, ține apăsat pe imagine pentru a o salva sau trimite.</p>
      <div class="acts">${EMBED ? "" : `<a class="btn" href="${src}" download="${file.name}">${I.dl}Descarcă</a>`}<button class="btn primary" id="ok">Gata</button></div>`, {center: true});
    $("#ok", sh.el).onclick = () => { sh.close(); URL.revokeObjectURL(src); };
  };
  submitAndRank(L);
}
async function submitAndRank(L) {
  const box = $("#rank"), done = LS.get("tin_sent", {});
  const show = r => { if (!box) return;
    const imp = r.improved ? (r.previous != null ? `Ai urcat de la ${r.previous} la ${L.sc.total} de puncte la acest test.` : "Primul tău scor la acest test a intrat în clasament.") : `Cel mai bun scor al tău la acest test rămâne ${r.previous} de puncte.`;
    box.innerHTML = `<a class="rank-box" href="#clasament-${L.cat}"><div class="big">#${r.rank}</div><div class="txt"><b>Locul tău în ${esc(CAT[L.cat].name)}</b><br>${r.total} puncte din ${r.tests} ${r.tests == 1 ? "test" : "teste"}. ${imp}</div><span class="chev">${I.chev}</span></a>`; };
  const msg = (big, html) => { if (box) box.innerHTML = `<div class="rank-box"><div class="big" style="font-size:24px">${big}</div><div class="txt">${html}</div></div>`; };
  if (!L.name) msg("–", "<b>Nu apari în clasament</b><br>Scrie-ți numele data viitoare, înainte de test.");
  else if (L.id && done[L.id]) show(done[L.id]);
  else {
    msg("…", "Se trimite rezultatul în clasament…");
    const o = {name: L.name, cat: L.cat, n: L.n, score: L.sc.total, secs: L.secs};
    try { const r = await API.submit(o); if (L.id) { done[L.id] = r; const ks = Object.keys(done); if (ks.length > 30) delete done[ks[0]]; LS.set("tin_sent", done); } show(r); }
    catch (e) {
      if (/invalid|prea multe/i.test(e.message)) msg("!", `Rezultatul nu a putut fi trimis (${esc(e.message)}).`);
      else { const q = LS.get("tin_queue", []); q.push(o); LS.set("tin_queue", q); if (L.id) { done[L.id] = {rank: "–", total: "…", tests: "…", improved: true}; LS.set("tin_sent", done); }
        msg("↻", "<b>Fără conexiune la internet</b><br>Rezultatul se trimite automat în clasament când revine conexiunea."); }
    }
  }
  try {
    const top = await API.testTop(L.cat, L.n), el = $("#ttop"); if (!el) return;
    el.innerHTML = `<div class="card">${top.length ? top.map(r => { const me = L.name && nameKey(L.name) === nameKey(r.name);
      return `<div class="row ${me ? "me" : ""}"><span class="rank r${r.pos}">${r.pos}</span><span class="grow"><div class="t">${esc(r.name)}</div><div class="d">timp ${fmt(r.secs)}</div></span><span class="pts">${r.score} p</span></div>`; }).join("")
      : `<div class="empty">Încă nimeni la acest test.</div>`}</div>`;
  } catch (e) { const el = $("#ttop"); if (el) el.innerHTML = `<div class="card empty">Nu se poate încărca acum.</div>`; }
}
function copy(t, msg) {
  const fb = () => { const ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (e) {} ta.remove();
    if (ok) toast(msg); else { const sh = sheet(`<h3>Copiază</h3><textarea class="field" style="height:120px;padding:12px" readonly>${esc(t)}</textarea><div class="acts"><button class="btn primary" id="ok">Gata</button></div>`, {center: true}); $("#ok", sh.el).onclick = sh.close; $("textarea", sh.el).select(); } };
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
  return `<div class="rev"><span class="st ${st}">${st === "ok" ? OK : st === "part" ? HALF : NO}</span><div>
    <div class="rq">${q}</div><div class="ra">${ans}</div>${extra}
    <div class="rm"><span class="ref">${I.book}${esc(it.q.ref)}</span><span>${r.pts}/${r.max} puncte</span></div></div></div>`;
}

/* ---------- Rezultat distribuit ---------- */
function pageShared(p) {
  const o = decodePayload(p), c = o && CAT[o.c];
  renderNav(""); topbar({title: "Rezultat distribuit"});
  if (!o || !c || !(o.t >= 1 && o.t <= c.tests)) { content.innerHTML = `<div class="page narrow"><div class="card pad" style="text-align:center"><h2>Linkul nu este valid</h2><p><a class="btn primary" href="#acasa">Mergi la teste</a></p></div></div>`; return; }
  const [m1, m2] = message(o.s), [vr, vt] = pickVerse(o.s, o.c + o.t + o.s);
  const R = 76, CC = 2 * Math.PI * R;
  content.innerHTML = `<div class="page narrow fade">
    <section class="res-hero">${ART}
      <div class="ring" style="position:relative"><svg viewBox="0 0 176 176"><circle cx="88" cy="88" r="${R}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="12"/>
        <circle cx="88" cy="88" r="${R}" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-dasharray="${CC}" stroke-dashoffset="${CC * (1 - o.s / 100)}"/></svg>
        <div class="v"><div><b>${o.s}</b><span>din 100 de puncte</span></div></div></div>
      <div style="position:relative"><div class="eyebrow" style="color:#E7B9C4">${esc(c.name)} · Testul ${o.t}</div>
        <h1 style="margin-top:8px">${o.n ? esc(o.n) : "Un prieten"} a obținut ${o.s} de puncte</h1><p>${m1} ${m2}</p>
        <div class="acts"><button class="btn white lg" id="try">${I.play}Fă și tu testul acesta</button><a class="btn light lg" href="#teste">Toate testele</a></div></div>
    </section>
    <div class="card chart" style="margin-top:16px"><h3 style="margin-bottom:8px">Punctaj pe secțiuni</h3>${SECTIONS.map((s, i) => `<div class="bar"><div class="n">${s.roman}. ${s.short}<small>${s.n} itemi × ${s.per} p</small></div><div class="tr"><i style="width:${(o.p[i] || 0) / (s.per * s.n) * 100}%"></i></div><div class="pt">${o.p[i] || 0}/${s.per * s.n}</div></div>`).join("")}</div>
    <div class="card verse-card" style="margin-top:16px"><q>${esc(vt)}</q><cite>${esc(vr)}</cite></div>${foot()}</div>`;
  $("#try").onclick = () => startFlow(o.c, o.t);
}

/* ---------- Imaginea pentru distribuire ---------- */
const imgs = {};
[["mark", "img/logo-mark-white.svg"], ["full", "img/agape-full.svg"]].forEach(([k, src]) => { const im = new Image(); im.onload = () => { imgs[k] = im; }; im.src = src; });
function shareImage(L, vr, vt) {
  const Wd = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = Wd; cv.height = H; const g = cv.getContext("2d");
  const c = CAT[L.cat], score = L.sc.total, F = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", SF = "'Source Serif 4',Georgia,serif";
  const bg = g.createLinearGradient(0, 0, Wd, H); bg.addColorStop(0, "#14233F"); bg.addColorStop(.6, "#1B2E52"); bg.addColorStop(1, "#24406B"); g.fillStyle = bg; g.fillRect(0, 0, Wd, H);
  const rg = g.createRadialGradient(Wd, 0, 0, Wd, 0, 700); rg.addColorStop(0, "rgba(118,56,73,.6)"); rg.addColorStop(1, "rgba(118,56,73,0)"); g.fillStyle = rg; g.fillRect(0, 0, Wd, H);
  g.strokeStyle = "rgba(255,255,255,.08)"; g.lineWidth = 2; [420, 330, 240].forEach(r => { g.beginPath(); g.arc(Wd - 80, H - 120, r, 0, 7); g.stroke(); });
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.textAlign = "center";
  if (imgs.mark) g.drawImage(imgs.mark, Wd / 2 - 40, 90, 80, 80);
  g.fillStyle = "#E7B9C4"; g.font = `600 26px ${F}`; g.fillText("TALANTUL ÎN NEGOȚ 2027 · AGAPE ATENA", Wd / 2, 225);
  g.fillStyle = "rgba(255,255,255,.75)"; g.font = `500 32px ${F}`; g.fillText(`${c.name} · Testul ${L.n}`, Wd / 2, 285);
  g.fillStyle = "#fff"; g.font = `700 60px ${F}`; g.fillText(L.name || "Rezultatul meu", Wd / 2, 370);
  g.lineWidth = 26; g.strokeStyle = "rgba(255,255,255,.14)"; g.beginPath(); g.arc(Wd / 2, 600, 160, 0, 7); g.stroke();
  const ag = g.createLinearGradient(Wd / 2 - 160, 440, Wd / 2 + 160, 760); ag.addColorStop(0, "#fff"); ag.addColorStop(1, "#E7B9C4");
  g.strokeStyle = ag; g.lineCap = "round"; g.beginPath(); g.arc(Wd / 2, 600, 160, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(score, .5) / 100); g.stroke();
  g.fillStyle = "#fff"; g.font = `700 140px ${F}`; g.fillText(String(score), Wd / 2, 645);
  g.fillStyle = "rgba(255,255,255,.7)"; g.font = `500 30px ${F}`; g.fillText("din 100 de puncte", Wd / 2, 700);
  g.fillStyle = "#fff"; g.font = `700 48px ${F}`; g.fillText(message(score)[0], Wd / 2, 870);
  g.fillStyle = "rgba(255,255,255,.1)"; rr(110, 920, Wd - 220, 260, 28); g.fill();
  g.fillStyle = "rgba(255,255,255,.92)"; g.font = `italic 400 32px ${SF}`;
  const words = ("„" + vt.replace(/^„|”$/g, "") + "”").split(" "), lines = []; let line = "";
  words.forEach(w => { const t = line ? line + " " + w : w; if (g.measureText(t).width > Wd - 320) { lines.push(line); line = w; } else line = t; }); if (line) lines.push(line);
  const shown = lines.slice(0, 4); if (lines.length > 4) shown[3] = shown[3].replace(/\s+\S+$/, "") + "…";
  const y0 = 1050 - (shown.length - 1) * 22; shown.forEach((l, i) => g.fillText(l, Wd / 2, y0 + i * 44));
  g.fillStyle = "#E7B9C4"; g.font = `600 26px ${F}`; g.fillText(vr, Wd / 2, y0 + shown.length * 44 + 10);
  g.fillStyle = "rgba(255,255,255,.55)"; g.font = `500 26px ${F}`; g.fillText(location.host || "talantul-in-negot.vercel.app", Wd / 2, H - 70);
  return new Promise(res => cv.toBlob(res, "image/png"));
}

/* ---------- Confetti ---------- */
function confetti() {
  const cv = document.createElement("canvas"); cv.className = "confetti"; cv.width = innerWidth; cv.height = innerHeight; document.body.appendChild(cv);
  const g = cv.getContext("2d"), cols = ["#14233F", "#763849", "#C29A3B", "#2C4A7A", "#E7B9C4"];
  const P = Array.from({length: 120}, () => ({x: innerWidth / 2 + (Math.random() - .5) * 160, y: innerHeight * .3, vx: (Math.random() - .5) * 14, vy: -Math.random() * 13 - 4, r: Math.random() * 6 + 4, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6}));
  let f = 0; const step = () => { g.clearRect(0, 0, cv.width, cv.height); P.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .42; p.vx *= .99; p.a += .2; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * .6); g.restore(); });
    if (f++ < 150) requestAnimationFrame(step); else cv.remove(); }; step();
}

/* ---------- Memorare · Apocalipsa 1–5 ---------- */
const AP = window.APOC;
const MEMO_COLOR = "#5B3A6E";
const MLV = [null,
  {k: 1, name: "Ușor", d: "3 cuvinte lipsă pe verset · 3 variante", opts: 3},
  {k: 2, name: "Mediu", d: "3–5 cuvinte lipsă · 4 variante, sinonime", opts: 4},
  {k: 3, name: "Greu", d: "3–5 cuvinte lipsă · 5 variante, forme foarte apropiate", opts: 5}];
const MCH = ["", "Hristos între sfeșnice", "Scrisorile către Efes, Smirna, Pergam, Tiatira", "Scrisorile către Sardes, Filadelfia, Laodiceea", "Scaunul de domnie din cer", "Cartea cu șapte peceți și Mielul"];
const MSTOP = new Set("care cele celor cel cei ce pentru prin din despre este sunt era erau sau iar dar nici mai lui lor sale său săi sa ale al ai am are au vor voi veți fie fost când cum unde acolo iată tot toate toți asupra până după peste între înaintea către spre fără decât acesta aceasta acestea aceste acela aceea acele acei acestei cine nimic nimeni orice fiecare unui unei unor unul una niște noi ei ele mine tine noastre voastre nostru vostru tău ta tale mei mea mele meu ea el le li ne vă îi îl dacă ca să și în la de pe cu o un nu mă te se că căci fiindcă eu tu iar amin mii".split(" "));
const MW = /([A-Za-zĂÂÎȘȚăâîșț]+(?:-[A-Za-zĂÂÎȘȚăâîșț]+)*)/;
const capLike = (w, ref) => ref[0] === ref[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w;
const isCap = w => w[0] !== w[0].toLowerCase();
const mapi = (ch, lvl) => `${ch}:${lvl}`;
const mhist = () => LS.get("tin_mhist", {});
const MPROP = new Set("isus hristos ioan dumnezeu dumnezeul dumnezeului asia patmos efes smirna pergam tiatira sardes filadelfia laodiceea antipa balaam balac israel izabela david ierusalim iuda satana satanei alfa omega".split(" "));

function memoVerse(ch, vi, lvl, R) {
  const text = AP.text[ch - 1][vi], toks = text.split(MW);
  const pool = []; // cuvinte din capitol, pentru variante
  AP.text[ch - 1].forEach((v, j) => { if (j !== vi) v.split(MW).forEach((t, k) => { if (k % 2 && !t.includes("-") && t.length >= 4 && !MSTOP.has(t.toLowerCase())) pool.push(t); }); });
  const cand = [];
  toks.forEach((t, k) => { if (k % 2 && !t.includes("-") && t.length >= 3 && !MSTOP.has(t.toLowerCase())) cand.push(k); });
  if (cand.length < 3) toks.forEach((t, k) => { if (k % 2 && !t.includes("-") && t.length >= 3 && !cand.includes(k)) cand.push(k); }), cand.sort((x, y) => x - y);
  const wc = toks.filter((t, k) => k % 2).length;
  let n = lvl === 1 ? 3 : wc <= 12 ? 3 : wc <= 24 ? 4 : 5;
  n = Math.min(n, cand.length);
  const known = k => { const w = toks[k].toLowerCase(); return (AP.syn[w] ? 2 : 0) + (AP.morph[w] ? 1 : 0); };
  // împărțim versetul în n zone și alegem câte un cuvânt din fiecare, preferând cuvintele cu sinonime
  const picks = [];
  for (let z = 0; z < n; z++) {
    const lo = Math.floor(z * cand.length / n), hi = Math.floor((z + 1) * cand.length / n);
    const zone = cand.slice(lo, hi).map(k => ({k, s: known(k) * (lvl === 1 ? .3 : 1) + R() * 2}));
    zone.sort((a, b) => b.s - a.s); if (zone.length) picks.push(zone[0].k);
  }
  const blanks = picks.sort((a, b) => a - b).map(k => {
    const ans = toks[k], lw = ans.toLowerCase(), seen = new Set([lw]), out = [];
    const proper = MPROP.has(lw), pl = pool.filter(w => proper ? MPROP.has(w.toLowerCase()) : !isCap(w));
    const add = w => { if (!w || w.includes(" ")) return; if (isCap(w) && !isCap(ans)) return; if (proper && !isCap(w)) return; const x = capLike(w, ans), l = x.toLowerCase(); if (seen.has(l)) return; seen.add(l); out.push(x); };
    const syn = shuffle(AP.syn[lw] || [], R), mor = shuffle(AP.morph[lw] || [], R);
    const near = shuffle(pl.filter(w => Math.abs(w.length - ans.length) <= 3 && w.slice(-2).toLowerCase() === lw.slice(-2)), R);
    const any = shuffle(pl.filter(w => Math.abs(w.length - ans.length) <= 4), R);
    const need = MLV[lvl].opts - 1;
    const order = lvl === 1 ? [syn.slice(0, 1), near, any, syn] : lvl === 2 ? [syn.slice(0, 2), mor.slice(0, 1), near, syn, any] : [mor.slice(0, 2), syn.slice(0, 2), mor, syn, near, any];
    for (const g of order) for (const w of g) { if (out.length >= need) break; add(w); }
    return {k, ans, opts: shuffle([ans, ...out], R)};
  });
  return {ch, v: vi + 1, toks, blanks};
}
function makeMemo(ch, lvl, seed) {
  const R = rngFor(`memo${ch}-${lvl}-${seed}`);
  return AP.text[ch - 1].map((_, i) => memoVerse(ch, i, lvl, R));
}
const memoTotal = items => items.reduce((a, it) => a + it.blanks.length, 0);
function memoScore(items, ans) {
  let ok = 0; const tot = memoTotal(items);
  items.forEach((it, i) => it.blanks.forEach((b, j) => { if ((ans[i] || [])[j] === b.ans) ok++; }));
  return {ok, tot, score: Math.round(ok / tot * 100)};
}

const MAPI = {
  submit: o => API.rpc("submit_memo", {p_name: o.name, p_ch: o.ch, p_lvl: o.lvl, p_score: o.score, p_secs: o.secs}),
  board: ch => API.rpc("get_memo_board", {p_ch: ch || null, p_limit: 100})
};
const M = {items: null, ans: [], idx: 0, slot: 0, ch: 1, lvl: 1, seed: 0, start: 0, last: null, drawn: -1};

function pageMemo() {
  renderNav("memo"); topbar({title: "Memorare", sub: "Apocalipsa 1–5"});
  const h = mhist(), cur = LS.get("tin_mcur", null);
  const done = Object.keys(h).length, sum = Object.values(h).reduce((a, x) => a + x.best, 0);
  content.innerHTML = `<div class="page fade">
    <section class="hero memo-hero">${ART}<div class="art2"></div><div style="position:relative">
      <div class="eyebrow">Secțiunea de memorare</div><h2>Apocalipsa, capitolele 1–5</h2>
      <p>Completează versetele cu cuvintele care lipsesc. Variantele sunt alese să semene între ele: sinonime, alte forme ale aceluiași cuvânt și cuvinte din același capitol. Numai cine știe textul pe de rost le deosebește.</p>
      <div class="acts">${cur ? `<a class="btn white lg" href="#m-${cur.ch}-${cur.lvl}">${I.play}Continuă capitolul ${cur.ch} · ${MLV[cur.lvl].name}</a>` : `<button class="btn white lg" id="mGo">${I.play}Începe cu capitolul 1</button>`}<a class="btn light lg" href="#m-clasament">${I.trophy}Clasament memorare</a></div></div></section>
    <div class="grid g3 stats" style="margin-top:16px">
      <div class="card stat"><div class="k">${I.check}Exerciții făcute</div><b>${done}</b><small>din 15</small></div>
      <div class="card stat"><div class="k">${I.chart}Punctele tale</div><b>${sum}</b><small>din 1500</small></div>
      <div class="card stat"><div class="k">${I.book}Versete</div><b>96</b><small>în 5 capitole</small></div>
    </div>
    <div class="sec-h"><div><h2>Alege capitolul și nivelul</h2><p>Fiecare capitol are trei niveluri. În clasament se adună cel mai bun scor la fiecare.</p></div></div>
    <div class="grid g2">${[1, 2, 3, 4, 5].map(ch => `<div class="card mch">
      <div class="mch-h"><span class="ic-tile" style="background:linear-gradient(145deg,${MEMO_COLOR},${shade(MEMO_COLOR)})">${ch}</span><div><h3>Apocalipsa ${ch}</h3><div class="muted" style="font-size:14px">${esc(MCH[ch])} · ${AP.text[ch - 1].length} versete</div></div></div>
      <div class="mlv">${[1, 2, 3].map(l => { const x = h[mapi(ch, l)]; return `<button class="mlvb" data-ch="${ch}" data-l="${l}">${diffHtml(l)}<b>${x ? x.best + " p" : "–"}</b><small>${x ? `${x.tries} ${x.tries == 1 ? "încercare" : "încercări"}` : "neîncercat"}</small></button>`; }).join("")}</div></div>`).join("")}</div>
    <div class="card verse-card" style="margin-top:24px"><q>„Ferice de cine citește și de cei ce ascultă cuvintele acestei prorocii și păzesc lucrurile scrise în ea! Căci vremea este aproape!”</q><cite>Apocalipsa 1:3</cite></div>
    ${foot()}</div>`;
  $$(".mlvb").forEach(b => b.onclick = () => memoStart(+b.dataset.ch, +b.dataset.l));
  $("#mGo") && ($("#mGo").onclick = () => memoStart(1, 1));
}

function memoStart(ch, lvl) {
  const cur = LS.get("tin_mcur", null), resume = cur && cur.ch === ch && cur.lvl === lvl;
  const sh = sheet(`
    <div style="display:flex;gap:14px;align-items:center"><span class="ic-tile" style="background:linear-gradient(145deg,${MEMO_COLOR},${shade(MEMO_COLOR)})">${ch}</span><div><h3>Apocalipsa ${ch} · ${MLV[lvl].name}</h3><div class="muted" style="font-size:14px">${AP.text[ch - 1].length} versete · ${MLV[lvl].d}</div></div></div>
    <label class="lbl" for="nm">Numele și prenumele</label>
    <input class="field" id="nm" maxlength="40" autocomplete="name" placeholder="ex. Maria Popescu" value="${esc(S.name)}">
    <div class="note" style="margin:8px 0 0">Apare în clasamentul de memorare. Lasă gol dacă nu vrei să apari. Răspunsurile se văd la final.</div>
    <div class="acts">${resume ? `<button class="btn" id="rs">Continuă</button><button class="btn primary" id="go">Începe din nou</button>` : `<button class="btn" id="cn">Anulează</button><button class="btn primary" id="go">Începe</button>`}</div>`);
  const sc = sh.el;
  $("#cn", sc) && ($("#cn", sc).onclick = sh.close);
  const begin = res => {
    const nm = normName($("#nm", sc).value); if (nm && nm.length < 2) { toast("Numele trebuie să aibă cel puțin 2 litere"); return; }
    S.name = nm; LS.set("tin_name", nm); sh.close();
    if (!res) LS.set("tin_mcur", {ch, lvl, seed: Date.now() % 1e9, ans: [], idx: 0, start: Date.now()});
    go(`#m-${ch}-${lvl}`);
  };
  $("#go", sc).onclick = () => begin(false);
  $("#rs", sc) && ($("#rs", sc).onclick = () => begin(true));
  $("#nm", sc).addEventListener("keydown", e => { if (e.key === "Enter") begin(false); });
}
function mPersist() { LS.set("tin_mcur", {ch: M.ch, lvl: M.lvl, seed: M.seed, ans: M.ans, idx: M.idx, start: M.start}); }
function pageMemoTest(ch, lvl) {
  if (ch < 1 || ch > 5 || lvl < 1 || lvl > 3) return go("#memorare", true);
  let cur = LS.get("tin_mcur", null);
  if (!cur || cur.ch !== ch || cur.lvl !== lvl) { cur = {ch, lvl, seed: Date.now() % 1e9, ans: [], idx: 0, start: Date.now()}; LS.set("tin_mcur", cur); }
  Object.assign(M, {ch, lvl, seed: cur.seed, ans: cur.ans || [], idx: Math.min(cur.idx || 0, AP.text[ch - 1].length - 1), start: cur.start || Date.now(), drawn: -1});
  M.items = makeMemo(ch, lvl, M.seed);
  M.slot = firstEmpty();
  document.body.classList.add("testing");
  renderNav("memo");
  topbar({back: () => { const sh = sheet(`<h3>Ieși din exercițiu?</h3><p class="muted" style="margin:6px 0 0;font-size:15px">Răspunsurile rămân salvate pe acest dispozitiv; poți continua mai târziu.</p><div class="acts"><button class="btn" id="st">Rămân</button><button class="btn primary" id="lv">Ieși</button></div>`, {center: true});
      $("#st", sh.el).onclick = sh.close; $("#lv", sh.el).onclick = () => { sh.close(); go("#memorare"); }; },
    title: `Apocalipsa ${ch}`, sub: `Memorare · ${MLV[lvl].name}`});
  content.innerHTML = `<div class="tw" id="tw"></div>`;
  clearInterval(S.timer);
  S.timer = setInterval(() => { const el = $("#tmr"); if (!el) return clearInterval(S.timer); el.innerHTML = I.clock + fmt(Math.min(5999, Math.floor((Date.now() - M.start) / 1000))); }, 1000);
  drawMemo();
}
function firstEmpty() { const it = M.items[M.idx], a = M.ans[M.idx] || []; const j = it.blanks.findIndex((_, i) => !a[i]); return j < 0 ? 0 : j; }
function drawMemo() {
  const items = M.items, it = items[M.idx], a = M.ans[M.idx] || [], b = it.blanks[M.slot];
  const filled = items.reduce((s, x, i) => s + x.blanks.filter((_, j) => (M.ans[i] || [])[j]).length, 0), tot = memoTotal(items);
  const bi = new Map(it.blanks.map((x, j) => [x.k, j]));
  const verse = it.toks.map((t, k) => bi.has(k) ? (j => `<button class="slot ${j === M.slot ? "cur" : ""} ${a[j] ? "fil" : ""}" data-j="${j}"><span class="sn">${j + 1}</span>${a[j] ? esc(a[j]) : "&nbsp;".repeat(9)}</button>`)(bi.get(k)) : esc(t)).join("");
  const isLast = M.idx === items.length - 1;
  const L = "ABCDE";
  $("#tw").innerHTML = `
    <div class="tbar"><div class="segs"><div class="cur"><i style="width:${filled / tot * 100}%"></i></div></div><span class="cnt">${filled}/${tot}</span><span class="timer" id="tmr">${I.clock}${fmt(Math.floor((Date.now() - M.start) / 1000))}</span></div>
    <div class="secl"><span class="tag burg">${I.quote}Completează versetul</span><span class="tag">${MLV[M.lvl].name}</span><span class="no">Versetul ${M.idx + 1} din ${items.length}</span></div>
    <div class="card qcard ${M.drawn === M.idx ? "" : "fade"}" id="qc">
      <div class="ref" style="margin-bottom:14px">${I.book}Apocalipsa ${it.ch}:${it.v}</div>
      <div class="mverse">${verse}</div>
      <div class="eyebrow" style="margin:28px 0 0">Cuvântul ${M.slot + 1} din ${it.blanks.length}</div>
      <div class="answers mopts">${b.opts.map((o, i) => `<button class="ans ${a[M.slot] === o ? "on" : ""}" data-o="${esc(o)}"><span class="k">${L[i]}</span><span class="lab">${esc(o)}</span></button>`).join("")}</div>
    </div>
    <div class="navbtns"><button class="btn lg" id="prev" ${M.idx === 0 ? "disabled" : ""}>${I.back}Înapoi</button><span class="sp"></span>${isLast ? `<button class="btn lg primary" id="fin">Termină</button>` : `<button class="btn lg primary" id="next">Următorul verset${I.next}</button>`}</div>
    <div class="dots">${items.map((x, i) => { const aa = M.ans[i] || [], n = x.blanks.filter((_, j) => aa[j]).length; return `<button class="${n === x.blanks.length ? "a" : ""} ${i === M.idx ? "cur" : ""}" data-i="${i}" aria-label="Versetul ${i + 1}">${i + 1}</button>`; }).join("")}</div>
    ${isLast ? "" : `<div style="text-align:center;margin-top:18px"><button class="btn ghost" id="fin2">Termină acum</button></div>`}`;
  M.drawn = M.idx;
  const qc = $("#qc");
  $$(".slot", qc).forEach(s => s.onclick = () => { M.slot = +s.dataset.j; drawMemo(); });
  $$(".mopts .ans", qc).forEach(btn => btn.onclick = () => {
    const arr = (M.ans[M.idx] || []).slice(); arr[M.slot] = btn.dataset.o; M.ans[M.idx] = arr;
    const nx = it.blanks.findIndex((_, j) => j > M.slot && !arr[j]), nx2 = it.blanks.findIndex((_, j) => !arr[j]);
    if (nx >= 0) M.slot = nx; else if (nx2 >= 0) M.slot = nx2;
    mPersist(); drawMemo();
  });
  const mv = d => { const n = M.idx + d; if (n < 0 || n >= items.length) return; M.idx = n; M.slot = firstEmpty(); mPersist(); drawMemo(); window.scrollTo({top: 0}); };
  $("#prev").onclick = () => mv(-1);
  $("#next") && ($("#next").onclick = () => mv(1));
  $$(".dots button").forEach(x => x.onclick = () => { M.idx = +x.dataset.i; M.slot = firstEmpty(); mPersist(); drawMemo(); });
  const ask = () => { const miss = tot - filled;
    const sh = sheet(`<h3>Termini exercițiul?</h3><p class="muted" style="margin:6px 0 0;font-size:15px">${miss ? `Mai ai ${miss} ${miss === 1 ? "cuvânt necompletat" : "cuvinte necompletate"}. Se notează cu 0.` : "Ai completat toate cuvintele."}</p>
      <div class="acts"><button class="btn" id="no">Mai verific</button><button class="btn primary" id="yes">Vezi rezultatul</button></div>`, {center: true});
    $("#no", sh.el).onclick = sh.close; $("#yes", sh.el).onclick = () => { sh.close(); memoFinish(); }; };
  $("#fin") && ($("#fin").onclick = ask); $("#fin2") && ($("#fin2").onclick = ask);
}
document.addEventListener("keydown", e => {
  if (!/^#m-\d/.test(CUR) || !M.items || $(".scrim") || e.target.tagName === "INPUT") return;
  const k = e.key.toLowerCase(), i = "12345".indexOf(k) >= 0 ? "12345".indexOf(k) : "abcde".indexOf(k);
  if (k === "arrowright") $("#next") && $("#next").click(); else if (k === "arrowleft") $("#prev").click();
  else if (i >= 0) { const b = $$("#qc .mopts .ans")[i]; b && b.click(); }
});
function memoFinish() {
  clearInterval(S.timer);
  const sc = memoScore(M.items, M.ans), secs = Math.min(7200, Math.round((Date.now() - M.start) / 1000));
  M.last = {ch: M.ch, lvl: M.lvl, seed: M.seed, ans: M.ans.slice(), sc, secs, name: S.name, id: Date.now()};
  LS.set("tin_mlast", M.last);
  const h = mhist(), key = mapi(M.ch, M.lvl), o = h[key] || {best: 0, tries: 0}; o.best = Math.max(o.best, sc.score); o.tries++; o.last = sc.score; h[key] = o; LS.set("tin_mhist", h);
  LS.del("tin_mcur"); go("#m-rezultat");
}
function pageMemoResult() {
  const L = M.last || LS.get("tin_mlast", null); if (!L) return go("#memorare", true);
  document.body.classList.remove("testing");
  const items = makeMemo(L.ch, L.lvl, L.seed), score = L.sc.score;
  renderNav("memo"); topbar({back: "#memorare", title: `Rezultat · Apocalipsa ${L.ch}`, sub: `Memorare · ${MLV[L.lvl].name}`});
  const [m1, m2] = message(score), [vr, vt] = pickVerse(score, "m" + L.ch + L.lvl + score);
  const R = 76, CC = 2 * Math.PI * R;
  const bad = items.map((it, i) => ({it, i})).filter(x => x.it.blanks.some((b, j) => (L.ans[x.i] || [])[j] !== b.ans));
  let filt = "wrong";
  content.innerHTML = `<div class="page fade">
    <section class="res-hero">${ART}
      <div class="ring" style="position:relative"><svg viewBox="0 0 176 176"><circle cx="88" cy="88" r="${R}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="12"/>
        <circle id="arc" cx="88" cy="88" r="${R}" fill="none" stroke="url(#rg)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${CC}" stroke-dashoffset="${CC}" style="transition:stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)"/>
        <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#E7B9C4"/></linearGradient></defs></svg>
        <div class="v"><div><b id="sn">0</b><span>din 100 de puncte</span></div></div></div>
      <div style="position:relative"><div class="eyebrow" style="color:#E7B9C4">Memorare · Apocalipsa ${L.ch} · ${MLV[L.lvl].name}</div>
        <h1 style="margin-top:8px">${m1}</h1><p>${m2}</p>
        <div class="facts"><div><b>${L.sc.ok} / ${L.sc.tot}</b>cuvinte corecte</div><div><b>${bad.length ? items.length - bad.length : items.length} / ${items.length}</b>versete perfecte</div><div><b>${fmt(L.secs)}</b>timp</div></div>
        <div class="acts"><button class="btn white lg" id="rdBtn">${I.redo}Încearcă din nou</button>${L.lvl < 3 ? `<button class="btn light lg" id="upBtn">Nivelul ${MLV[L.lvl + 1].name}${I.next}</button>` : L.ch < 5 ? `<button class="btn light lg" id="upBtn">Apocalipsa ${L.ch + 1}${I.next}</button>` : ""}</div></div>
    </section>
    <div class="grid g2" style="margin-top:16px;align-items:start">
      <div class="card" id="rank"></div>
      <div class="card pad"><h3>Distribuie</h3><p class="muted" style="font-size:14px;margin:4px 0 16px">Provoacă-ți prietenii să memoreze și ei Apocalipsa.</p>
        <div class="share"><button class="btn" id="shBtn">${I.share}Trimite</button><button class="btn" id="waBtn">${I.msg}WhatsApp</button><button class="btn" id="cpBtn">${I.link}Link</button></div></div>
    </div>
    <div class="card verse-card" style="margin-top:16px"><q>${esc(vt)}</q><cite>${esc(vr)}</cite></div>
    <div class="sec-h"><div><h2>Revizuiește versetele</h2><p>Cuvintele corecte sunt marcate cu verde, alegerile greșite cu roșu.</p></div><div class="seg" id="rf"><button data-f="wrong" class="on">Cu greșeli (${bad.length})</button><button data-f="all">Toate</button></div></div>
    <div class="card" id="rev"></div>
    ${foot()}</div>`;
  setTimeout(() => { $("#arc").style.strokeDashoffset = CC * (1 - score / 100); }, 80);
  animateNum($("#sn"), score); if (score >= 90) confetti();
  const drawRev = () => {
    const list = filt === "wrong" ? bad : items.map((it, i) => ({it, i}));
    $("#rev").innerHTML = list.length ? list.map(({it, i}) => { const aa = L.ans[i] || [], bi = new Map(it.blanks.map((x, j) => [x.k, j]));
      const html = it.toks.map((t, k) => { if (!bi.has(k)) return esc(t); const j = bi.get(k), ok = aa[j] === t;
        return ok ? `<mark class="mk ok">${esc(t)}</mark>` : `${aa[j] ? `<s class="mk no">${esc(aa[j])}</s> ` : `<s class="mk no">—</s> `}<mark class="mk ok">${esc(t)}</mark>`; }).join("");
      return `<div class="rv"><div class="ref">${I.book}Apocalipsa ${it.ch}:${it.v}</div><div class="serif mrev">${html}</div></div>`; }).join("")
      : `<div class="empty">Nicio greșeală. Ai completat totul corect!</div>`; };
  drawRev();
  $$("#rf button").forEach(b => b.onclick = () => { filt = b.dataset.f; $$("#rf button").forEach(x => x.classList.toggle("on", x === b)); drawRev(); });
  $("#rdBtn").onclick = () => memoStart(L.ch, L.lvl);
  $("#upBtn") && ($("#upBtn").onclick = () => L.lvl < 3 ? memoStart(L.ch, L.lvl + 1) : memoStart(L.ch + 1, 1));
  const url = `${location.origin}/#memorare`;
  const text = `${L.name ? L.name + " a" : "Am"} obținut ${score}/100 la memorarea Apocalipsei ${L.ch} (nivel ${MLV[L.lvl].name}) — Talantul în Negoț 2027, ${C.church}. Încearcă și tu:`;
  $("#cpBtn").onclick = () => copy(EMBED ? text : url, EMBED ? "Text copiat" : "Link copiat");
  $("#waBtn").onclick = () => { const u = "https://wa.me/?text=" + encodeURIComponent(text + (EMBED ? "" : " " + url)); const w = window.open(u, "_blank"); if (!w) location.href = u; };
  $("#shBtn").onclick = async () => {
    if (!EMBED && navigator.share) { try { await navigator.share({title: "Memorare Apocalipsa", text, url}); return; } catch (e) { if (e.name === "AbortError") return; } }
    copy(EMBED ? text : text + " " + url, "Copiat. Lipește textul unde vrei să-l trimiți.");
  };
  memoSubmit(L);
}
async function memoSubmit(L) {
  const box = $("#rank"), sent = LS.get("tin_msent", {});
  const show = r => { box.innerHTML = `<a class="rank-box" href="#m-clasament"><div class="big">#${r.rank}</div><div class="txt"><b>Locul tău la memorare</b><br>${r.total} puncte din ${r.done} ${r.done == 1 ? "exercițiu" : "exerciții"}. ${r.improved ? (r.previous != null ? `Ai urcat de la ${r.previous} la ${L.sc.score} de puncte aici.` : "Primul tău scor aici a intrat în clasament.") : `Cel mai bun scor al tău aici rămâne ${r.previous} de puncte.`}</div><span class="chev">${I.chev}</span></a>`; };
  const msg = (big, html) => { box.innerHTML = `<div class="rank-box"><div class="big" style="font-size:24px">${big}</div><div class="txt">${html}</div></div>`; };
  if (!L.name) return msg("–", "<b>Nu apari în clasament</b><br>Scrie-ți numele data viitoare, înainte de exercițiu.");
  if (sent[L.id]) return show(sent[L.id]);
  msg("…", "Se trimite rezultatul în clasament…");
  try { const r = await MAPI.submit({name: L.name, ch: L.ch, lvl: L.lvl, score: L.sc.score, secs: L.secs}); sent[L.id] = r; const ks = Object.keys(sent); if (ks.length > 30) delete sent[ks[0]]; LS.set("tin_msent", sent); show(r); }
  catch (e) { msg("!", /invalid|prea multe/i.test(e.message) ? `Rezultatul nu a putut fi trimis (${esc(e.message)}).` : "<b>Fără conexiune</b><br>Rezultatul nu a putut fi trimis acum. Încearcă din nou când ai internet."); }
}
function pageMemoBoard(ch) {
  renderNav("memo"); topbar({back: "#memorare", title: "Clasament memorare", sub: ch ? `Apocalipsa ${ch}` : "Apocalipsa 1–5"});
  content.innerHTML = `<div class="page fade">
    <div class="hello"><div><div class="eyebrow">Clasament separat · Memorare</div><h1 style="margin-top:6px">${ch ? `Apocalipsa ${ch}` : "Apocalipsa 1–5"}</h1><p class="lead">Pentru fiecare capitol și nivel se păstrează cel mai bun scor. Locul se stabilește după suma lor (maximum ${ch ? 300 : 1500} de puncte).</p></div></div>
    <div class="chips" id="bchips"><button class="${!ch ? "on" : ""}" data-c="">Toate capitolele</button>${[1, 2, 3, 4, 5].map(c => `<button class="${ch === c ? "on" : ""}" data-c="${c}">Capitolul ${c}</button>`).join("")}</div>
    <div id="bbody" style="margin-top:20px"><div class="card"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div></div>${foot()}</div>`;
  $$("#bchips button").forEach(b => b.onclick = () => go(b.dataset.c ? `#m-clasament-${b.dataset.c}` : "#m-clasament", true));
  const el = $("#bbody");
  MAPI.board(ch).then(rows => {
    if (!rows.length) { el.innerHTML = `<div class="card empty">Nimeni în clasament deocamdată. Fii primul!</div>`; return; }
    const ex = r => `${r.done} ${r.done == 1 ? "exercițiu" : "exerciții"}`;
    const pod = [rows[1], rows[0], rows[2]].map(r => r ? `<div class="card pod p${r.pos}"><div class="pl">${r.pos}</div><div class="n">${esc(r.name)}</div><div class="s">${r.total} p</div><div class="x">${ex(r)}</div></div>` : `<div></div>`).join("");
    el.innerHTML = `<div class="podium">${pod}</div>${rows.length > 3 ? `<div class="card">${rows.slice(3).map(r => { const me = S.name && nameKey(S.name) === nameKey(r.name);
      return `<div class="row ${me ? "me" : ""}"><span class="rank">${r.pos}</span><span class="grow"><div class="t">${esc(r.name)}</div><div class="d">${ex(r)} · media ${Number(r.avg_score).toLocaleString("ro-RO")}</div></span><span class="pts">${r.total} p</span></div>`; }).join("")}</div>` : ""}`;
  }).catch(() => { el.innerHTML = errBox; });
}

/* ---------- Router ---------- */
function route() {
  const h = CUR || "#acasa";
  clearInterval(S.timer); $$(".scrim").forEach(e => e.remove());
  if (!/^#([tv]-|m-\d)/.test(h)) document.body.classList.remove("testing");
  let m;
  if ((m = h.match(/^#c-(\w+?)(?:-(versete|clasament))?$/))) pageCat(m[1], m[2] === "versete" ? "verses" : m[2] === "clasament" ? "board" : null);
  else if ((m = h.match(/^#t-(\w+)-(\d+)$/))) pageTest(m[1], +m[2], false);
  else if ((m = h.match(/^#v-(\w+)-(\d+)$/))) pageTest(m[1], +m[2], true);
  else if (h === "#rezultat") pageResult();
  else if ((m = h.match(/^#r-([0-9a-f]+)$/))) pageShared(m[1]);
  else if ((m = h.match(/^#clasament(?:-(\w+))?$/))) pageBoard(m[1] && CAT[m[1]] ? m[1] : null);
  else if ((m = h.match(/^#m-(\d)-(\d)$/))) pageMemoTest(+m[1], +m[2]);
  else if (h === "#m-rezultat") pageMemoResult();
  else if ((m = h.match(/^#m-clasament(?:-(\d))?$/))) pageMemoBoard(m[1] ? +m[1] : null);
  else if (h === "#memorare") pageMemo();
  else if (h === "#teste") pageLibrary();
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
  let shown = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (shown || /^#([tv]-|m-\d)/.test(CUR)) return; shown = true; toast("Aplicația a fost actualizată"); });
}
})();
