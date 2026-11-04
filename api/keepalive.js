// Rulat zilnic de Vercel Cron: o interogare mică ține baza Supabase activă
// (proiectele gratuite se opresc după 7 zile fără activitate).
const URL_ = "https://afndlvxtmlbihztvvmci.supabase.co/rest/v1/rpc/get_podium";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbmRsdnh0bWxiaWh6dHZ2bWNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3NzQxNjksImV4cCI6MjEwOTM1MDE2OX0.gPQeLqPjjfg57ZsFBwxN39m-MqubLpXWTO0M6sBfmpU";
module.exports = async (req, res) => {
  try {
    const r = await fetch(URL_, {method: "POST", headers: {"Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}`}, body: "{}"});
    res.status(r.ok ? 200 : 502).json({ok: r.ok, status: r.status, at: new Date().toISOString()});
  } catch (e) { res.status(500).json({ok: false, error: String(e)}); }
};
