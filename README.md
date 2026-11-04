# Talantul în Negoț 2027 · Agape Atena

Platformă de pregătire pentru Concursul Biblic „Talantul în Negoț” 2027, secțiunea Clasic:
100 de teste pe 8 categorii de vârstă, în formatul oficial (31 de itemi, 100 de puncte), cu corectură,
versete de încurajare, distribuire a rezultatului și clasament pe categorii.

© 2026 Ștefan Miron · Realizat pentru Biserica Agape Atena

## Cum se actualizează
Orice modificare urcată pe ramura `main` se publică automat pe Vercel în ~30 de secunde.
Telefoanele iau versiunea nouă la următoarea deschidere.

## Unde sunt lucrurile
- `js/data/bank_sam.js` — întrebările din 1 și 2 Samuel (comune tuturor categoriilor)
- `js/data/bank_nt.js` — întrebările din Iuda, 1 Petru, Filipeni, Galateni, Evrei
- `js/data/verses.js` — versetele de memorat pe categorii (din bibliografia 2027)
- `js/engine.js` — categoriile și generarea celor 100 de teste (numărul de teste pe categorie: `tests`)
- `js/app.js` — interfața; `css/app.css` — stilul; `js/config.js` — nume, logo, Supabase
- `img/logo.png` — logo-ul bisericii

### Formatul întrebărilor
- Adevărat/Fals: `["afirmație", true/false, "referință", dificultate 1-3, "corectare dacă e falsă"]`
- Alegere unică: `["întrebare", ["corect", "greșit", "greșit"], "referință", dificultate]` (varianta corectă se scrie prima; ordinea se amestecă automat)
- Alegere multiplă: `["întrebare", ["a", "b", "c"], [indicii corecți], "referință", dificultate]`
- Potriviri: `{t: "titlu", p: [["stânga", "dreapta"] × 5], r: "referință"}`

Atenție: testele se generează determinist din bancă. Dacă adaugi întrebări, conținutul testelor se poate schimba
(clasamentul rămâne, pe număr de test). La o modificare, crește `version` în `js/config.js` și în `index.html`.

## Clasament (Supabase)
Proiect: „Talantul in Negot”. Pentru fiecare nume și test se păstrează doar scorul cel mai bun;
locul în categorie = suma scorurilor cele mai bune. Accesul public se face doar prin funcțiile
`submit_result`, `get_leaderboard`, `get_podium`, `get_test_top` (tabelele nu pot fi citite sau modificate direct).
Pentru a șterge un nume nepotrivit: în Supabase → SQL Editor:
`delete from best where name_key = 'nume prenume'; delete from results where name_key = 'nume prenume';`
