// Motorul de teste: categorii, generarea celor 100 de teste, punctaj. Nu depinde de interfață.
(() => {
"use strict";
/* ---------- Categorii ---------- */
const CATS = [
  {id:"p",     name:"Preșcolari – Clasa 1", short:"Preșcolari – Cl. 1", ic:"P–1",  nt:"iuda",     ntName:"Iuda",     verses:"p",     maxD:1, tests:20, color:"#B7791F", grad:"#B7791F"},
  {id:"c23",   name:"Clasele 2–3",          short:"Clasele 2–3",        ic:"2–3",  nt:"iuda",     ntName:"Iuda",     verses:"p",     maxD:2, tests:20, color:"#A8455E", grad:"#A8455E"},
  {id:"c45",   name:"Clasele 4–5",          short:"Clasele 4–5",        ic:"4–5",  nt:"petru1",   ntName:"1 Petru",  verses:"c45",   maxD:2, tests:20, color:"#6B4FA0", grad:"#6B4FA0"},
  {id:"c67",   name:"Clasele 6–7",          short:"Clasele 6–7",        ic:"6–7",  nt:"filipeni", ntName:"Filipeni", verses:"c67",   maxD:3, tests:20, color:"#3D5A99", grad:"#3D5A99"},
  {id:"c89",   name:"Clasele 8–9",          short:"Clasele 8–9",        ic:"8–9",  nt:"galateni", ntName:"Galateni", verses:"c89",   maxD:3, tests:20, color:"#2F6F9F", grad:"#2F6F9F"},
  {id:"c1011", name:"Clasele 10–11",        short:"Clasele 10–11",      ic:"10–11",nt:"evrei",    ntName:"Evrei",    verses:"c1011", maxD:3, tests:20, color:"#2C7A7B", grad:"#2C7A7B"},
  {id:"a1835", name:"Tineri 18–35 ani",     short:"18–35 ani",          ic:"18+",  nt:"evrei",    ntName:"Evrei",    verses:"a1835", maxD:3, tests:20, color:"#3F7D4E", grad:"#3F7D4E"},
  {id:"a35",   name:"Adulți 35+ ani",       short:"35+ ani",            ic:"35+",  nt:"evrei",    ntName:"Evrei",    verses:"a35",   maxD:3, tests:20, color:"#763849", grad:"#763849"}
];
const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
const TOTAL_TESTS = CATS.reduce((a, c) => a + c.tests, 0);

const SECTIONS = [
  {k:"tf", roman:"I",   name:"Adevărat sau Fals",          short:"Adevărat / Fals",  per:2, n:10},
  {k:"mc", roman:"II",  name:"Alegere unică",              short:"Alegere unică",    per:4, n:10},
  {k:"mt", roman:"III", name:"Potrivește",                 short:"Potriviri",        per:2, n:5},
  {k:"ms", roman:"IV",  name:"Alegere multiplă",           short:"Alegere multiplă", per:5, n:3},
  {k:"or", roman:"V",   name:"Ordonează versetul",         short:"Ordonarea versetelor", per:5, n:3}
];

const ENC = {
  high: [
    ["Matei 25:21", "Stăpânul său i-a zis: „Bine, rob bun și credincios; ai fost credincios în puține lucruri, te voi pune peste multe lucruri; intră în bucuria stăpânului tău!”"],
    ["Psalmii 119:11", "Strâng Cuvântul Tău în inima mea, ca să nu păcătuiesc împotriva Ta!"]
  ],
  mid: [
    ["Psalmii 119:105", "Cuvântul Tău este o candelă pentru picioarele mele și o lumină pe cărarea mea."],
    ["Filipeni 1:6", "Sunt încredințat că Acela care a început în voi această bună lucrare o va isprăvi până în ziua lui Isus Hristos."],
    ["2 Timotei 2:15", "Caută să te înfățișezi înaintea lui Dumnezeu ca un om încercat, ca un lucrător care n-are de ce să-i fie rușine și care împarte drept Cuvântul adevărului."],
    ["Iosua 1:8", "Cartea aceasta a legii să nu se depărteze de gura ta; cugetă asupra ei zi și noapte, căutând să faci tot ce este scris în ea; căci atunci vei izbuti în toate lucrările tale și atunci vei lucra cu înțelepciune."]
  ],
  low: [
    ["Isaia 41:10", "Nu te teme, căci Eu sunt cu tine; nu te uita cu îngrijorare, căci Eu sunt Dumnezeul tău; Eu te întăresc, tot Eu îți vin în ajutor, Eu te sprijinesc cu dreapta Mea biruitoare."],
    ["Filipeni 4:13", "Pot totul în Hristos, care mă întărește."],
    ["Galateni 6:9", "Să nu obosim în facerea binelui; căci la vremea potrivită vom secera, dacă nu vom cădea de oboseală."],
    ["Iosua 1:9", "Oare nu ți-am dat Eu porunca aceasta: „Întărește-te și îmbărbătează-te”? Nu te înspăimânta și nu te îngrozi, căci Domnul, Dumnezeul tău, este cu tine în tot ce vei face."],
    ["Isaia 40:31", "Dar cei ce se încred în Domnul își înnoiesc puterea, ei zboară ca vulturii; aleargă și nu obosesc, umblă și nu ostenesc."],
    ["Plângerile lui Ieremia 3:22-23", "Bunătățile Domnului nu s-au sfârșit, îndurările Lui nu sunt la capăt, ci se înnoiesc în fiecare dimineață. Și credincioșia Ta este atât de mare!"]
  ]
};

/* ---------- RNG determinist ---------- */
function xmur(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return (h ^= h >>> 16) >>> 0; }; }
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rngFor = s => mulberry(xmur(s)());
function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ---------- Referințe ---------- */
const BOOK_ORD = {"1 Samuel":1, "2 Samuel":2};
function refKey(ref) {
  const m = String(ref).match(/^((?:\d )?[A-Za-zĂÂÎȘȚăâîșț]+)\s*(\d+)?(?::(\d+))?/);
  if (!m) return 999999;
  const b = BOOK_ORD[m[1]] || 5;
  return b * 100000 + (+m[2] || 0) * 1000 + (+m[3] || 0);
}
const chapOf = ref => { const k = refKey(ref); return {b: Math.floor(k / 100000), c: Math.floor(k / 1000) % 100}; };

/* ---------- Pregătirea băncii ---------- */
const POOLS = {};
function prep(src) {
  if (POOLS[src]) return POOLS[src];
  const B = window.BANK[src], out = {tf: [], mc: [], ms: [], mt: []};
  B.tf.forEach((q, i) => out.tf.push({id:`${src}.tf.${i}`, type:"tf", src, text:q[0], ans:q[1], ref:q[2], d:q[3], fix:q[4] || "", key:refKey(q[2])}));
  B.mc.forEach((q, i) => out.mc.push({id:`${src}.mc.${i}`, type:"mc", src, text:q[0], opts:q[1], ref:q[2], d:q[3], key:refKey(q[2])}));
  B.ms.forEach((q, i) => out.ms.push({id:`${src}.ms.${i}`, type:"ms", src, text:q[0], opts:q[1], cor:q[2], ref:q[3], d:q[4], key:refKey(q[3])}));
  B.mt.forEach((q, i) => out.mt.push({id:`${src}.mt.${i}`, type:"mt", src, text:q.t, pairs:q.p, ref:q.r, d:2, key:refKey(q.r)}));
  return POOLS[src] = out;
}

// 5 segmente pe capitole pentru 1–2 Samuel (testele 1–10 merg pe rând prin cărți)
const SEGS = (() => {
  const s = prep("sam"); const keys = [...s.tf, ...s.mc].map(q => q.key).sort((a, b) => a - b);
  const cuts = [1, 2, 3, 4].map(i => keys[Math.floor(keys.length * i / 5)]);
  // rotunjim tăieturile la început de capitol
  const chapStart = k => Math.floor(k / 1000) * 1000;
  const c = cuts.map(chapStart);
  const segs = []; let lo = 0;
  for (let i = 0; i <= 4; i++) { const hi = i < 4 ? c[i] : Infinity; segs.push([lo, hi]); lo = hi; }
  const label = (lo, hi) => {
    const items = keys.filter(k => k >= lo && k < hi);
    const a = items[0], b = items[items.length - 1];
    const fa = {b: Math.floor(a / 100000), c: Math.floor(a / 1000) % 100}, fb = {b: Math.floor(b / 100000), c: Math.floor(b / 1000) % 100};
    if (fa.b === fb.b) return `${fa.b} Samuel ${fa.c}–${fb.c}`;
    return `1 Samuel ${fa.c} – 2 Samuel ${fb.c}`;
  };
  return segs.map(([lo, hi]) => ({lo, hi, label: label(lo, hi)}));
})();
const segOf = key => SEGS.findIndex(s => key >= s.lo && key < s.hi);

/* ---------- Generarea testelor ---------- */
const TESTS = {};
function testsFor(catId) {
  if (TESTS[catId]) return TESTS[catId];
  const cat = CAT[catId];
  const sam = prep("sam"), nt = prep(cat.nt);
  const rk = rngFor("ord:" + catId), rkey = new Map();
  const rr = q => { if (!rkey.has(q.id)) rkey.set(q.id, rk()); return rkey.get(q.id); };
  const usage = new Map();
  const use = q => usage.get(q.id) || 0;
  function pick(pool, k, seg) {
    const okD = d => d <= cat.maxD + 1;
    const cost = q => use(q) + (q.d > cat.maxD ? 1.5 : 0) + (tRefs.has(q.ref) ? 3 : 0);
    let cand = pool.filter(q => okD(q.d) && (seg < 0 || segOf(q.key) === seg));
    if (cand.length < k + 2) cand = pool.filter(q => okD(q.d));
    if (cand.length < k) cand = pool.slice();
    const sorted = cand.slice().sort((a, b) => (cost(a) - cost(b)) || (rr(a) - rr(b)));
    const res = sorted.slice(0, k);
    res.forEach(q => { usage.set(q.id, use(q) + 1); tRefs.add(q.ref); });
    return res;
  }
  let tRefs = new Set();
  const pickTF = (pool, k, nF, seg) => [...pick(pool.filter(q => !q.ans), nF, seg), ...pick(pool.filter(q => q.ans), k - nF, seg)];
  const vlist = window.VERSES[cat.verses];
  const list = [];
  for (let n = 1; n <= cat.tests; n++) {
    const seg = n <= 15 ? Math.floor((n - 1) / 3) : -1;
    const ntN = 3;
    const byKey = (a, b) => (a.src === "sam" ? 0 : 1) - (b.src === "sam" ? 0 : 1) || a.key - b.key;
    tRefs = new Set();
    const rf = rngFor(`tf:${catId}:${n}`);
    const tf = [...pickTF(sam.tf, 10 - ntN, rf() < .5 ? 3 : 4, seg), ...pickTF(nt.tf, ntN, rf() < .6 ? 1 : 2, -1)].sort(byKey);
    const mc = [...pick(sam.mc, 10 - ntN, seg), ...pick(nt.mc, ntN, -1)].sort(byKey);
    const mt = (n % 2 === 1 ? pick(sam.mt, 1, -1) : pick(nt.mt, 1, -1))[0];
    const ms = [...pick(sam.ms, 2, -1), ...pick(nt.ms, 1, -1)].sort(byKey);
    const off = {p:0, c23:5, c45:0, c67:0, c89:0, c1011:0, a1835:0, a35:0}[catId] || 0;
    const ov = [0, 1, 2].map(k => vlist[(off + (n - 1) * 3 + k) % vlist.length]);
    const title = seg >= 0 ? `${SEGS[seg].label} · ${cat.ntName}` : `Recapitulare · 1–2 Samuel · ${cat.ntName}`;
    const all = [...tf, ...mc, ...ms];
    const avg = all.reduce((a, q) => a + q.d, 0) / all.length;
    list.push({cat: catId, n, title, seg, tf, mc, mt, ms, ov, lvl: avg < 1.5 ? 1 : avg < 2.05 ? 2 : 3});
  }
  return TESTS[catId] = list;
}

/* ---------- Împărțirea versetelor în fragmente ---------- */
function splitVerse(text) {
  const t = text.replace(/[,;]\s*$/, ".");
  let parts = (t.match(/[^,;:!?.]+[,;:!?.”"]*[”"]?\s*/g) || [t]).map(s => s.trim()).filter(Boolean);
  const wc = s => s.split(/\s+/).length;
  let guard = 0;
  while (parts.length > 1 && parts.some(p => wc(p) < 3) && guard++ < 50) {
    const i = parts.findIndex(p => wc(p) < 3);
    if (i < parts.length - 1) parts.splice(i, 2, parts[i] + " " + parts[i + 1]);
    else parts.splice(i - 1, 2, parts[i - 1] + " " + parts[i]);
  }
  guard = 0;
  while (parts.length < 4 && guard++ < 10) {
    let bi = -1, bw = 0; parts.forEach((p, i) => { const w = wc(p); if (w > bw) { bw = w; bi = i; } });
    if (bw < 4) break;
    const ws = parts[bi].split(/\s+/), mid = Math.ceil(ws.length / 2);
    parts.splice(bi, 1, ws.slice(0, mid).join(" "), ws.slice(mid).join(" "));
  }
  while (parts.length > 6) {
    let bi = 0, bw = Infinity;
    for (let i = 0; i < parts.length - 1; i++) { const w = wc(parts[i]) + wc(parts[i + 1]); if (w < bw) { bw = w; bi = i; } }
    parts.splice(bi, 2, parts[bi] + " " + parts[bi + 1]);
  }
  return parts;
}

/* ---------- Construirea unei sesiuni de test ---------- */
function makeSession(catId, n) {
  const T = testsFor(catId)[n - 1];
  const r = rngFor(`sess:${catId}:${n}`);
  const items = [];
  T.tf.forEach(q => items.push({sec:"tf", q}));
  T.mc.forEach(q => { const order = shuffle([0, 1, 2], r); items.push({sec:"mc", q, order, correct: order.indexOf(0)}); });
  { const q = T.mt; const L = ["A","B","C","D","E"]; const rorder = shuffle([0,1,2,3,4], r); // rorder[pos] = index pereche
    items.push({sec:"mt", q, rorder, correct: q.pairs.map((_, i) => rorder.indexOf(i)), letters: L}); }
  T.ms.forEach(q => { const order = shuffle([0, 1, 2], r); items.push({sec:"ms", q, order, correct: q.cor.map(c => order.indexOf(c)).sort()}); });
  T.ov.forEach(v => { const parts = splitVerse(v.text); let order; let g = 0;
    do { order = shuffle(parts.map((_, i) => i), r); } while (order.every((x, i) => x === i) && g++ < 10);
    items.push({sec:"or", q:{type:"or", ref:v.ref, text:v.text}, parts, order}); });
  return {T, items};
}


/* ---------- Antrenament pe versete (în afara clasamentului) ---------- */
const VERSE_MODES = [
  {k: 1, name: "Ordonează versetele", short: "Ordonare", desc: "Așază fragmentele fiecăruia dintre cele 10 versete în ordinea corectă."},
  {k: 2, name: "Cuvântul care lipsește", short: "Cuvânt lipsă", desc: "Alege cuvântul care lipsește din verset."},
  {k: 3, name: "Unde este scris?", short: "Referința", desc: "Recunoaște referința fiecărui verset."},
  {k: 4, name: "Recapitulare versete", short: "Amestecat", desc: "Toate felurile de întrebări, amestecate."}
];
const STOP = new Set("care căci pentru dintre despre până după înaintea asupra decât acesta aceasta acestea aceia acela atunci toate toată toți fiecare niciun nicio orice oricine cineva ceea sunteți suntem este sunt vor voi noi lui lor mine tine Mine Tine Meu Mea Tău Ta".toLowerCase().split(" "));
const words = t => t.split(/\s+/).map(w => w.replace(/^[„"(]+|[”"),.;:!?]+$/g, "")).filter(Boolean);
function keyWord(text, r) {
  const ws = words(text).filter(w => w.length >= 5 && !STOP.has(w.toLowerCase()) && /^[A-Za-zĂÂÎȘȚăâîșț-]+$/.test(w));
  if (!ws.length) return null;
  const sorted = ws.slice().sort((a, b) => b.length - a.length).slice(0, 4);
  return sorted[Math.floor(r() * sorted.length)];
}
function verseItem(mode, v, i, list, r) {
  if (mode === 1) { const parts = splitVerse(v.text); let order, g = 0;
    do { order = shuffle(parts.map((_, j) => j), r); } while (order.every((x, j) => x === j) && g++ < 10);
    return {sec: "or", w: 10, q: {type: "or", ref: v.ref, text: v.text}, parts, order}; }
  if (mode === 2) {
    const kw = keyWord(v.text, r) || words(v.text).sort((a, b) => b.length - a.length)[0];
    const pool = [...new Set(list.filter(x => x !== v).flatMap(x => words(x.text)).filter(w => w.length >= 4 && w.toLowerCase() !== kw.toLowerCase() && !STOP.has(w.toLowerCase()) && (kw.includes("-") ? /^[A-Za-zĂÂÎȘȚăâîșț-]+$/ : /^[A-Za-zĂÂÎȘȚăâîșț]+$/).test(w)))];
    pool.sort((a, b) => Math.abs(a.length - kw.length) - Math.abs(b.length - kw.length) || (r() - .5));
    const cap = w => kw[0] === kw[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w[0].toLowerCase() + w.slice(1);
    const ds = []; for (const w of shuffle(pool.slice(0, 10), r)) { const c = cap(w); if (!ds.includes(c) && c.toLowerCase() !== kw.toLowerCase()) ds.push(c); if (ds.length === 2) break; }
    const re = new RegExp("(^|[^A-Za-zĂÂÎȘȚăâîșț])" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-zĂÂÎȘȚăâîșț])");
    const blank = v.text.replace(re, "$1_____");
    const opts = [kw, ...ds]; const order = shuffle([0, 1, 2], r);
    return {sec: "mc", w: 10, kind: "fill", q: {type: "mc", text: blank, opts, ref: v.ref, full: v.text}, order, correct: order.indexOf(0)};
  }
  const others = shuffle(list.filter(x => x !== v), r).slice(0, 2).map(x => x.ref);
  const order = shuffle([0, 1, 2], r);
  return {sec: "mc", w: 10, kind: "ref", q: {type: "mc", text: v.text, opts: [v.ref, ...others], ref: v.ref, full: v.text}, order, correct: order.indexOf(0)};
}
function makeVerseSession(catId, k) {
  const cat = CAT[catId], list = window.VERSES[cat.verses], r = rngFor(`vers:${catId}:${k}`);
  const vs = shuffle(list, r);
  const items = vs.map((v, i) => verseItem(k === 4 ? 1 + (i % 3) : k, v, i, list, r));
  const m = VERSE_MODES.find(x => x.k === k);
  return {T: {cat: catId, n: "v" + k, title: m.name, kind: "verse", mode: m}, items, kind: "verse"};
}

/* ---------- Punctaj ---------- */
function scoreItem(it, a) {
  switch (it.sec) {
    case "tf": return {pts: a === it.q.ans ? 2 : 0, max: 2};
    case "mc": { const w = it.w || 4; return {pts: a === it.correct ? w : 0, max: w}; }
    case "mt": { let p = 0; for (let i = 0; i < 5; i++) if (a && a[i] === it.correct[i]) p += 2; return {pts: p, max: 10, ok: p / 2}; }
    case "ms": { if (!a || (!a.none && !a.sel.length)) return {pts: 0, max: 5};
      const sel = a.none ? [] : a.sel.slice().sort(); const ok = sel.length === it.correct.length && sel.every((x, i) => x === it.correct[i]);
      return {pts: ok ? 5 : 0, max: 5}; }
    case "or": { const w = it.w || 5; const ok = a && a.length === it.parts.length && a.every((pi, i) => it.order[pi] === i); return {pts: ok ? w : 0, max: w}; }
  }
}
function scoreAll(items, ans) {
  const per = {tf:0, mc:0, mt:0, ms:0, or:0}, max = {tf:0, mc:0, mt:0, ms:0, or:0};
  const res = items.map((it, i) => { const s = scoreItem(it, ans[i]); per[it.sec] += s.pts; max[it.sec] += s.max; return s; });
  const total = Object.values(per).reduce((a, b) => a + b, 0);
  return {per, max, res, total};
}
const answered = (it, a) => {
  if (a == null) return false;
  if (it.sec === "mt") return a.some(x => x != null);
  if (it.sec === "ms") return a.none || a.sel.length > 0;
  if (it.sec === "or") return a.length > 0;
  return true;
};
const countItems = (items, ans) => items.reduce((acc, it, i) => {
  const w = it.sec === "mt" ? 5 : 1;
  acc.total += w;
  if (it.sec === "mt") acc.done += (ans[i] || []).filter(x => x != null).length;
  else if (answered(it, ans[i])) acc.done += 1;
  return acc;
}, {done:0, total:0});
window.TIN = {prep, VERSE_MODES, makeVerseSession, CATS, CAT, TOTAL_TESTS, SECTIONS, ENC, rngFor, shuffle, SEGS, testsFor, makeSession, scoreAll, answered, countItems, splitVerse};
})();
