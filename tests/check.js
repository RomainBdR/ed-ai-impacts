#!/usr/bin/env node
/* Contrôles automatiques du modèle (sans dépendance) : node tests/check.js

   Ils vérifient les propriétés que l’interface suppose (reproductibilité, ordre des quantiles, linéarité,
   bornes des parts) et la valeur des résultats du scénario par défaut, afin de repérer une modification
   involontaire d’un paramètre. Si un changement de paramètre est voulu, il faut mettre à jour les valeurs
   de référence ci-dessous en même temps que la documentation. */
"use strict";
const assert = require("node:assert/strict");
const M = require("../src/model.js");

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("OK   " + name); }
  catch (e) { failed++; console.log("ÉCHEC " + name + "\n       " + String(e.message).split("\n").join("\n       ")); }
}
const near = (x, ref, tol, label) => assert.ok(Math.abs(x - ref) <= tol * Math.abs(ref), (label || "valeur") + " : " + x + " attendu " + ref + " ± " + (tol * 100) + " %");

const S = M.defaultState();
const mc = M.runMC(S, { N: 2500 });
const median = (i) => M.totalStats(mc, i).p50;

/* ---------- scénario par défaut ---------- */
check("scénario par défaut : valeurs médianes de référence (document du projet)", () => {
  near(median(0), 1.4e3 * 1000, 0.08, "électricité (Wh)");
  near(median(1), 540e3, 0.08, "carbone (g)");
  near(median(2), 5.9e6, 0.08, "eau (mL)");
  near(median(3), 120e3, 0.08, "matière (mg Sb éq.)");
});

check("les quantiles sont ordonnés (P5 < P50 < P95) pour les quatre indicateurs", () => {
  for (let i = 0; i < 4; i++) {
    const s = M.totalStats(mc, i);
    assert.ok(s.p5 > 0 && s.p5 < s.p50 && s.p50 < s.p95, "indicateur " + i + " : " + [s.p5, s.p50, s.p95].join(" / "));
  }
});

check("le calcul est reproductible (graine fixe)", () => {
  const again = M.runMC(M.defaultState(), { N: 2500 });
  for (let i = 0; i < 4; i++) assert.equal(M.totalStats(again, i).p50, median(i));
});

check("les parts par étape du cycle de vie somment à 1", () => {
  for (let i = 0; i < 4; i++) {
    const sum = M.phaseShares(mc, i).reduce((a, r) => a + r.frac, 0);
    near(sum, 1, 1e-9, "somme des parts (indicateur " + i + ")");
  }
});

check("les résultats sont proportionnels au nombre de jours travaillés", () => {
  const S2 = M.defaultState(); S2.workdays = 400;
  const mc2 = M.runMC(S2, { N: 2500 });
  for (let i = 0; i < 4; i++) near(M.totalStats(mc2, i).p50 / median(i), 2, 0.01, "rapport (indicateur " + i + ")");
});

check("un réseau électrique bas carbone réduit le carbone sans changer l’électricité", () => {
  const S2 = M.defaultState(); S2.grid = "fr";
  const mc2 = M.runMC(S2, { N: 2500 });
  near(M.totalStats(mc2, 0).p50, median(0), 1e-9, "électricité");
  assert.ok(M.totalStats(mc2, 1).p50 < median(1) / 3, "le carbone doit baisser d’un facteur supérieur à 3");
  assert.ok(M.totalStats(mc2, 2).p50 < median(2), "l’eau liée à l’électricité doit baisser avec un réseau moins consommateur d’eau");
});

/* ---------- reste de l’entreprise et comparaison ---------- */
const mcb = M.runBase(S, { N: 2500 });
const rows = M.compare(mc, mcb);

check("la comparaison porte sur quatre indicateurs, avec des parts comprises entre 0 et 1", () => {
  assert.deepEqual(rows.map((r) => r.id), ["elec", "energy", "co2", "water"]);
  rows.forEach((r) => {
    assert.ok(r.share.p5 > 0 && r.share.p5 < r.share.p50 && r.share.p50 < r.share.p95 && r.share.p95 < 1, r.id);
  });
});

check("part de l’IA du scénario par défaut (document du projet)", () => {
  const p = Object.fromEntries(rows.map((r) => [r.id, r.share.p50]));
  near(p.elec, 0.031, 0.15, "électricité"); near(p.energy, 0.024, 0.15, "énergie finale");
  near(p.co2, 0.0071, 0.15, "carbone"); near(p.water, 0.124, 0.15, "eau");
});

check("la part de l’IA croît avec le multiplicateur d’usage et le multiplicateur inverse est cohérent", () => {
  rows.forEach((r) => {
    const a = M.shareAt(r, 1).p50, b = M.shareAt(r, 10).p50, c = M.shareAt(r, 100).p50;
    assert.ok(a < b && b < c && c < 1, r.id);
    near(a, r.share.p50, 0.02, "part à ×1 (" + r.id + ")");
    const m10 = M.multiplierFor(r, 0.1), m50 = M.multiplierFor(r, 0.5);
    assert.ok(m10 > 0 && m10 < m50, r.id + " : multiplicateurs " + m10 + " / " + m50);
    near(M.shareAt(r, m50).p50, 0.5, 0.02, "part au multiplicateur calculé pour 50 % (" + r.id + ")");
  });
});

check("des factures saisies remplacent les estimations et resserrent l’intervalle", () => {
  const S2 = M.defaultState(); S2.base.elecKWh = 30000; S2.base.gasKWh = 0;
  const mcb2 = M.runBase(S2, { N: 2500 });
  const r2 = M.compare(mc, mcb2).find((r) => r.id === "elec"), r1 = rows.find((r) => r.id === "elec");
  assert.ok(r2.base.p50 > 30e3 * 1000 * 0.95 && r2.base.p50 < 40e3 * 1000, "électricité du reste : " + r2.base.p50);
  assert.ok(r2.base.p95 / r2.base.p5 < r1.base.p95 / r1.base.p5, "l’intervalle doit se resserrer");
});

check("un bilan carbone saisi remplace l’estimation des postes d’émission", () => {
  const S2 = M.defaultState(); S2.orgFootprint = 80;
  const r = M.compare(mc, M.runBase(S2, { N: 2500 })).find((x) => x.id === "co2");
  near(r.base.p50, 80e6, 0.15, "carbone du reste de l’entreprise (g)");
});

/* ---------- robustesse de l’état enregistré ---------- */
check("un état enregistré invalide ou ancien est assaini", () => {
  const s = M.sanitizeState({ base: { staff: "30", area: -5, homeShare: 2, elecKWh: "", gasKWh: 0 } });
  assert.equal(s.base.staff, 30); assert.ok(s.base.area >= 0); assert.equal(s.base.homeShare, 1);
  assert.equal(s.base.elecKWh, null); assert.equal(s.base.gasKWh, 0);
  assert.deepEqual(M.sanitizeState({ v: 1, workdays: 200 }).base, M.defaultBase());
});

console.log(failed ? "\n" + failed + " contrôle(s) en échec." : "\nTous les contrôles passent.");
process.exit(failed ? 1 : 0);
