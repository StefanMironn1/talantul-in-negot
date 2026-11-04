// Pagină de previzualizare pentru linkurile de rezultat (/r/<cod>).
// Aplicațiile de mesagerie citesc etichetele de mai jos; oamenii sunt trimiși imediat la rezultat în aplicație.
const CATS = {p: "Preșcolari – Clasa 1", c23: "Clasele 2–3", c45: "Clasele 4–5", c67: "Clasele 6–7", c89: "Clasele 8–9", c1011: "Clasele 10–11", a1835: "Tineri 18–35 ani", a35: "Adulți 35+ ani"};
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
module.exports = (req, res) => {
  const code = String((req.query && req.query.code) || "").toLowerCase();
  let title = "Talantul în Negoț 2027 · Rezultat", desc = "Vezi rezultatul și încearcă și tu testul. Biserica Agape Atena.";
  if (/^[0-9a-f]+$/.test(code) && code.length % 2 === 0 && code.length < 600) {
    try {
      const a = Buffer.from(code, "hex").toString("utf8").split("|");
      const cat = CATS[a[0]], t = parseInt(a[1], 10), s = parseInt(a[2], 10), name = a.slice(6).join("|").slice(0, 40);
      if (cat && t >= 1 && t <= 20 && s >= 0 && s <= 100) {
        title = `${name ? name + " a obținut" : "Rezultat:"} ${s}/100 la Testul ${t}`;
        desc = `${cat} · Talantul în Negoț 2027 · Biserica Agape Atena. Încearcă și tu testul!`;
      }
    } catch (e) {}
  }
  const host = req.headers["x-forwarded-host"] || req.headers.host || "talantul-in-negot.vercel.app";
  const base = `https://${host}`, target = `/#r-${/^[0-9a-f]+$/.test(code) ? code : ""}`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.end(`<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Talantul în Negoț · Agape Atena"><meta property="og:locale" content="ro_RO">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${base}/r/${esc(code)}">
<meta property="og:image" content="${base}/icons/og-result.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Talantul în Negoț 2027 — rezultat la test">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${base}/icons/og-result.jpg">
<meta name="theme-color" content="#14233F"><link rel="icon" href="/icons/icon-192.png">
<meta http-equiv="refresh" content="0;url=${target}"><script>location.replace(${JSON.stringify(target)})</script>
</head><body style="font-family:sans-serif;background:#F5F6F8;color:#172033;text-align:center;padding:60px 20px"><p>Se deschide rezultatul… <a href="${target}">Apasă aici</a> dacă nu se deschide singur.</p></body></html>`);
};
