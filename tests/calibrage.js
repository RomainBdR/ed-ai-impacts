/* Rapport de calibrage : confronte les valeurs du modèle à des mesures publiées (node tests/calibrage.js).
   Il n’échoue jamais : il affiche les valeurs du modèle à côté des repères de la littérature. */
const M = require("../src/model.js");
const fmt = (x, d = 3) => (isFinite(x) ? Number(x.toPrecision(d)) : x);

console.log("=== 1. Calibrage sur la requête de référence (130 en / 530 sortie), Sonnet seul ===");
{
  const scn = M.defaultState(); scn.mix = { s: 1, o: 0, h: 0 }; scn.effort = 1;
  const siteMask = M.scopeById("site").mask, fullMask = M.scopeById("full").mask, accMask = M.scopeById("acc").mask;
  const r = M.evalCentral(scn, null, siteMask);
  const b = r.buf;
  console.log("énergie requête courte (Wh), site complet :", fmt(b.eref), " | Google 0,24 ; Epoch 0,3 ; Microsoft 0,31 ; Jegham 0,95");
  const A = b.A;
  const tot = (i, mask) => { let a = 0; for (let j = 0; j < 5; j++) if (mask[j]) a += A[i * 5 + j]; return a * b.eref; };
  console.log("accélérateurs seuls (Wh):", fmt(tot(0, accMask)), " | Google étroit 0,10 ; accélérateurs 0,14");
  console.log("carbone g, site complet, réseau US 0,345 :", fmt(tot(1, siteMask)), " | Google 0,03 (MB) ; Jegham 0,27");
  console.log("carbone g, cycle de vie complet:", fmt(tot(1, fullMask)), " | Mistral 1,14 (400 jetons)");
  console.log("eau mL, site complet:", fmt(tot(2, siteMask)), " | Google 0,26 (site seul) ; Jegham ~5");
  console.log("eau mL, cycle de vie complet:", fmt(tot(2, fullMask)), " | Mistral 45 mL");
  console.log("matière mg Sb éq., cycle de vie complet:", fmt(tot(3, fullMask)), " | Mistral 0,16 mg (400 jetons)");
}

console.log("\n=== 2. Journée de développement assisté (Sonnet seul), site complet ===");
{
  const scn = M.defaultState(); scn.mix = { s: 1, o: 0, h: 0 };
  const r = M.evalCentral(scn, null, M.scopeById("site").mask);
  const kwh = r.buf.ecode / 1000;
  console.log("énergie (kWh):", fmt(kwh), " | Couch 1,3 ; Hausfather 3,0 (1,2–5,9) ; 13 $ × 75,5 Wh/$ = 1,0");
  console.log("avec Opus (×1,8) :", fmt(kwh * 1.8));
}

console.log("\n=== 3. Énergie unitaire par tâche (Wh, Sonnet seul, site complet, valeurs centrales) ===");
{
  const scn = M.defaultState(); scn.mix = { s: 1, o: 0, h: 0 };
  const r = M.evalCentral(scn, null, M.scopeById("site").mask);
  const b = r.buf;
  M.TASKS.forEach((t, i) => {
    const prep = M.prepare(scn);
    console.log(t.id.padEnd(15), String(fmt(b.unit[i])).padStart(8), "Wh   ", "$" + fmt(M.taskCostUSD(prep, i), 2), "   Wh/$", fmt(b.unit[i] / M.taskCostUSD(prep, i), 3));
  });
}

console.log("\n=== 4. Scénario par défaut : Monte-Carlo ===");
{
  const scn = M.defaultState();
  let t0 = Date.now();
  const mc = M.runMC(scn, { N: 2500 });
  console.log("durée MC (ms):", Date.now() - t0);
  const names = ["Électricité", "Carbone", "Eau", "Matière"];
  for (let i = 0; i < 4; i++) {
    const s = M.totalStats(mc, i);
    console.log(names[i].padEnd(12), "P5", M.fmtVal(i, s.p5), "| P50", M.fmtVal(i, s.p50), "| P95", M.fmtVal(i, s.p95), "| moyenne", M.fmtVal(i, s.mean), "| P95/P5", fmt(s.p95 / s.p5, 3));
  }
  const cen = M.evalCentral(scn);
  console.log("valeurs centrales déterministes :", cen.tot.map((v, i) => M.fmtVal(i, v)).join(" | "));
  let nan = 0;
  ["Etot", "Ep", "Ecell", "Et", "Em", "Etok", "Unit", "Eday", "Eref", "A"].forEach(k => { for (const v of mc[k]) if (!isFinite(v)) nan++; });
  console.log("valeurs non finies :", nan);
  console.log("\nParts par étape (carbone) :");
  M.phaseShares(mc, 1).forEach((r, j) => console.log("  ", M.PHASES[j].label.padEnd(26), M.fmtPct(r.frac), " [P5–P95 part:", M.fmtPct(r.share.p5), "–", M.fmtPct(r.share.p95), "]"));
  console.log("Parts par étape (eau) :");
  M.phaseShares(mc, 2).forEach((r, j) => console.log("  ", M.PHASES[j].label.padEnd(26), M.fmtPct(r.frac)));
  console.log("Parts par étape (matière) :");
  M.phaseShares(mc, 3).forEach((r, j) => console.log("  ", M.PHASES[j].label.padEnd(26), M.fmtPct(r.frac)));
  console.log("Parts par étape (électricité) :");
  M.phaseShares(mc, 0).forEach((r, j) => console.log("  ", M.PHASES[j].label.padEnd(26), M.fmtPct(r.frac)));

  console.log("\nPar métier :");
  M.componentShares(mc, mc.Ep, 5, "p").forEach((r, j) => console.log("  ", M.PERSONAS[j].label.padEnd(32), M.fmtPct(r.frac)));
  console.log("Par modèle :");
  M.componentShares(mc, mc.Em, 3, "m").forEach((r, j) => console.log("  ", ["Sonnet", "Opus", "Haiku"][j].padEnd(10), M.fmtPct(r.frac)));
  console.log("Par type de jeton (entrée fraîche, cache, sortie) :");
  M.componentShares(mc, mc.Etok, 3, "tok").forEach((r, j) => console.log("  ", ["entrée", "cache", "sortie"][j].padEnd(10), M.fmtPct(r.frac)));
  console.log("Par tâche :");
  M.componentShares(mc, mc.Et, M.TASKS.length, "t").forEach((r, j) => console.log("  ", M.TASKS[j].id.padEnd(15), M.fmtPct(r.frac)));
  console.log("Par cellule (métier × intensité), part du total :");
  const cs = M.componentShares(mc, mc.Ecell, 20, "c");
  M.PERSONAS.forEach((p, pi) => console.log("  ", p.label.padEnd(32), M.INTENSITIES.map((_, ii) => M.fmtPct(cs[pi * 4 + ii].frac).padStart(7)).join("")));
  console.log("\nJournée type (électricité, P50) par cellule, Wh/jour actif :");
  M.PERSONAS.forEach((p, pi) => console.log("  ", p.label.padEnd(32), M.INTENSITIES.map((_, ii) => String(fmt(M.dayStats(mc, pi * 4 + ii, 0).p50, 3)).padStart(8)).join("")));
}

console.log("\n=== 5. Sensibilité et leviers (carbone) ===");
{
  const scn = M.defaultState();
  const tor = M.tornado(scn, 1);
  tor.forEach(r => console.log("  ", r.id.padEnd(9), M.fmtVal(1, r.lo).padStart(14), M.fmtVal(1, r.hi).padStart(14), " swing(ln)", fmt(r.swing, 3)));
  const lv = M.levers(scn, 1);
  console.log("  base:", M.fmtVal(1, lv.base));
  lv.list.forEach(r => console.log("  ", r.label.padEnd(60), M.fmtPct(r.delta)));
}

console.log("\n=== 6. Équivalences ===");
{
  const mc = M.runMC(M.defaultState());
  [0, 1, 2].forEach(i => console.log(M.equivalences(i, M.totalStats(mc, i).p50).map(e => fmt(e.n, 3) + " " + e.text).join(" ; ")));
}

console.log("\n=== 7. Tests de cohérence supplémentaires ===");
{
  // toutes valeurs fixées au centre : la dispersion doit disparaître
  const scn = M.defaultState(); M.PARAMS.forEach(q => scn.fixed[q.id] = "p50"); scn.volUnc = false;
  const mc = M.runMC(scn, { N: 500 });
  const s = M.totalStats(mc, 0);
  console.log("tout fixé au centre : P5 = P95 ?", s.p5 === s.p95, "| valeur", M.fmtVal(0, s.p50), "| déterministe", M.fmtVal(0, M.evalCentral(scn).tot[0]));
  // sans volumes incertains
  const scn2 = M.defaultState(); scn2.volUnc = false;
  const s2 = M.totalStats(M.runMC(scn2), 0), s1 = M.totalStats(M.runMC(M.defaultState()), 0);
  console.log("P95/P5 électricité : facteurs seuls", fmt(s2.p95 / s2.p5), "| facteurs + volumes", fmt(s1.p95 / s1.p5));
  // reproductibilité
  const a = M.totalStats(M.runMC(M.defaultState()), 1).p50, b = M.totalStats(M.runMC(M.defaultState()), 1).p50;
  console.log("reproductible :", a === b);
  // sanitisation
  const bad = M.sanitizeState({ headcount: [[-3, "x", 2]], mix: { s: 0, o: 0, h: 0 }, effort: 99, scope: "zzz", grid: "fr", fixed: { e_out: "p95", foo: "p5" } });
  console.log("sanitize :", JSON.stringify({ hc0: bad.headcount[0], mix: bad.mix, effort: bad.effort, scope: bad.scope, grid: bad.grid, fixed: bad.fixed }));
}
