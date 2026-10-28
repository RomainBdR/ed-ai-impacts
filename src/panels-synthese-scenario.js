/* ============================================================================
   Interface — en-tête, synthèse, scénario
   ========================================================================== */
(function () {
"use strict";
var M = window.EDM, A = window.EDApp;
var h = A.h, s = A.s, fv = A.fv, fn = A.fn, pct = A.pct, pl = A.pl;
var NB = M.NBSP;
var P = A.panels = {};

/* ----------------------------------------------------------- utilitaires */
function persons(S) { var t = 0; S.headcount.forEach(function (r) { r.forEach(function (v) { t += v; }); }); return t; }
A.persons = persons;

function indName(i) { return M.INDICATORS[i].label; }
function indSeg(onChange) {
  var UI = A.UI();
  var seg = h("div", { "class": "seg", role: "group", "aria-label": "Indicateur affiché" });
  M.INDICATORS.forEach(function (ind, i) {
    seg.appendChild(h("button", { type: "button", text: ind.label, "aria-pressed": UI.ind === i ? "true" : "false", onclick: function () {
      UI.ind = i; A.touchUI();
    } }));
  });
  return seg;
}
A.indSeg = indSeg;

function shareText(f) { return pct(f, f < 0.1 ? 1 : 0); }

var ICONS = [
  "M8.4 1 3 8.2h3.4L5.6 13 11 5.8H7.6z",
  "M4.4 11a2.6 2.6 0 0 1 .1-5.2 3.4 3.4 0 0 1 6.5 1A2.1 2.1 0 0 1 10.6 11z",
  "M7 1.4C5.1 4.3 3.4 6.2 3.4 8.5a3.6 3.6 0 0 0 7.2 0C10.6 6.2 8.9 4.3 7 1.4z",
  "M7 1.4l4.8 2.7v5.8L7 12.6 2.2 9.9V4.1z"
];
function icon(i) {
  return s("svg", { width: 14, height: 14, viewBox: "0 0 14 14", "aria-hidden": "true" }, [s("path", { d: ICONS[i], fill: "none", stroke: "currentColor", "stroke-width": 1.4, "stroke-linejoin": "round" })]);
}
A.icon = icon;

/* --------------------------------------------------------- en-tête (KPI) */
A.updateHeader = function () {
  var S = A.S(), UI = A.UI(), mc = A.MC();
  var box = document.getElementById("kpis"); A.clear(box);
  for (var i = 0; i < 4; i++) {
    (function (i) {
      var st = M.totalStats(mc, i), un = M.unitFor(i, st.p50);
      var tile = h("button", { type: "button", "class": "kpi", "aria-pressed": UI.ind === i ? "true" : "false", title: "Afficher cet indicateur dans les autres onglets" });
      tile.appendChild(h("span", { "class": "k-label" }, [icon(i), M.INDICATORS[i].label]));
      tile.appendChild(h("span", { "class": "k-val" }, [fn(st.p50 / un.div, 2), h("small", { text: un.u })]));
      tile.appendChild(h("span", { "class": "k-rng", text: "90 % des tirages : " + M.fmtRange(i, st.p5, st.p95, 2) }));
      var bar = h("span", { "class": "k-bar", "aria-hidden": "true" });
      var a = Math.max(0, st.p5 / st.p95) * 100, m = st.p50 / st.p95 * 100;
      bar.appendChild(h("i", { style: "left:" + a.toFixed(1) + "%;width:" + (100 - a).toFixed(1) + "%" }));
      bar.appendChild(h("b", { style: "left:" + m.toFixed(1) + "%" }));
      tile.appendChild(bar);
      var eq;
      if (i === 3) { var ps = M.phaseShares(mc, 3); eq = "Dont " + pct(ps[3].frac, 0) + " liés à la fabrication du matériel"; }
      else { var e = M.equivalences(i, st.p50)[0]; eq = "≈ " + fn(e.n, 2) + " " + e.text.replace(/ \(.*\)$/, ""); }
      tile.appendChild(h("span", { "class": "k-eq", text: eq }));
      if (S.ref) {
        var r = S.ref.kpi[i], d = r && r.p50 > 0 ? st.p50 / r.p50 - 1 : null;
        if (d != null) tile.appendChild(h("span", { "class": "k-delta", text: (d >= 0 ? "▲ +" : "▼ −") + pct(Math.abs(d), 0).replace(/ /, " ") + " par rapport à la référence" }));
      }
      tile.addEventListener("click", function () { UI.ind = i; A.touchUI(); });
      box.appendChild(tile);
    })(i);
  }
  var chips = document.getElementById("chips"); A.clear(chips);
  var n = persons(S), g = M.gridById(S.grid), sc = M.scopeById(S.scope);
  function chip(label, value, tab) {
    return h("button", { type: "button", "class": "chip chip-btn", title: "Modifier dans l’onglet Scénario", onclick: function () { A.goTab("scenario", false, false, true); } }, [label + " ", h("b", { text: value })]);
  }
  chips.appendChild(chip("Effectif du scénario", n + " " + pl(n, "personne", "personnes")));
  chips.appendChild(chip("Périmètre", sc.label));
  chips.appendChild(chip("Réseau", g.id === "custom" ? fn(S.customCif * 1000, 3) + " g/kWh" : g.label + " (" + g.method + ")"));
  chips.appendChild(chip("Incertitudes", S.volUnc ? "facteurs et volumes" : "facteurs seuls"));
};

/* ------------------------------------------------------ textes de lecture */
function groupShares(mc, ind) {
  var ps = M.phaseShares(mc, ind);
  return { exploit: ps[0].frac + ps[1].frac + ps[2].frac, hw: ps[3].frac, train: ps[4].frac, ps: ps };
}

function concentration(mc, S) {
  var cs = M.componentShares(mc, mc.Ecell, 20, "c"), items = [];
  for (var p = 0; p < 5; p++) for (var i = 0; i < 4; i++) items.push({ p: p, i: i, f: cs[p * 4 + i].frac, n: S.headcount[p][i] });
  items = items.filter(function (x) { return x.n > 0; });
  items.sort(function (a, b) { return b.f / b.n - a.f / a.n; });   // du plus gros consommateur individuel au plus petit
  var acc = 0, ppl = 0, used = [];
  for (var k = 0; k < items.length && acc < 0.5; k++) { acc += items[k].f; ppl += items[k].n; used.push(items[k]); }
  return { share: acc, people: ppl, cells: used };
}
A.concentration = concentration;

function readingParagraphs(mc, S) {
  var n = persons(S), st = [0, 1, 2, 3].map(function (i) { return M.totalStats(mc, i); });
  var sc = M.scopeById(S.scope), g = M.gridById(S.grid);
  var out = [];
  out.push("Avec les hypothèses du scénario, l’usage de Claude par " + n + " " + pl(n, "personne", "personnes") + " représente chaque année, en valeur médiane, " +
    fv(0, st[0].p50) + " d’électricité, " + fv(1, st[1].p50) + ", " + fv(2, st[2].p50) + " d’eau consommée et " + fv(3, st[3].p50) +
    " d’épuisement des ressources minérales ; l’intervalle à 90 % de l’électricité s’étend de " + fv(0, st[0].p5) + " à " + fv(0, st[0].p95) +
    ", soit un facteur " + fn(st[0].p95 / st[0].p5, 2) + " entre ses deux bornes.");
  var g0 = groupShares(mc, 0), g1 = groupShares(mc, 1), g2 = groupShares(mc, 2), g3 = groupShares(mc, 3);
  function dom(gs) {
    if (gs.exploit >= gs.hw && gs.exploit >= gs.train) return "l’exploitation des centres de calcul (" + pct(gs.exploit, 0) + ")";
    if (gs.hw >= gs.train) return "la fabrication du matériel (" + pct(gs.hw, 0) + ")";
    return "l’entraînement amorti (" + pct(gs.train, 0) + ")";
  }
  if (sc.id === "acc" || sc.id === "site") {
    out.push("Le périmètre retenu (« " + sc.label.toLowerCase() + " ») exclut la fabrication du matériel et l’entraînement, de sorte que les quatre indicateurs reflètent uniquement l’exploitation ; élargir le périmètre permet de mesurer ce que les études publiées laissent de côté.");
  } else {
    out.push("Pour la structure, la part dominante est, pour l’électricité, " + dom(g0) + ", pour le carbone " + dom(g1) + ", pour l’eau " + dom(g2) +
      " et pour la matière " + dom(g3) + ". L’entraînement amorti pèse " + pct(g1.train, 0) + " du carbone, mais sa part est très incertaine, puisque les études situent le rapport entre entraînement et inférence entre 0,1 et plus de 1.");
  }
  var cc = concentration(mc, S);
  if (cc.people > 0 && n > 1) {
    var names = cc.cells.slice(0, 3).map(function (c) { return "« " + M.PERSONAS[c.p].label.toLowerCase() + " » à intensité " + M.INTENSITIES[c.i].label.toLowerCase(); });
    var list = names.length > 1 ? names.slice(0, -1).join(", ") + " et " + names[names.length - 1] : names[0];
    var who = cc.people === 1 ? "une seule personne sur " + n + " (" + list + ")" : cc.people + " personnes sur " + n + ", dont les profils les plus intensifs sont " + list;
    out.push("La demande se concentre sur peu de profils : la moitié de l’énergie est consommée par " + who + ", de sorte que l’intensité d’usage compte davantage dans le résultat que le nombre d’utilisateurs.");
  }
  return out;
}
A.readingParagraphs = readingParagraphs;

/* ---------------------------------------------------------------- LEXIQUE */
var LEXIQUE = [
  ["Jeton", "Fragment de texte (mot, partie de mot ou signe) traité par le modèle ; un millier de jetons représente un peu plus d’une page. Les budgets de jetons mesurent la quantité de lecture et d’écriture d’une tâche."],
  ["Jetons d’entrée, de cache et de sortie", "Les jetons d’entrée sont ce que le modèle lit (consigne, documents, historique de la conversation) ; ceux relus dans le cache ont déjà été traités et coûtent très peu d’énergie ; ceux de sortie sont ce que le modèle écrit, réflexion comprise, et coûtent le plus."],
  ["Inférence et entraînement", "L’inférence désigne les calculs effectués à chaque requête ; l’entraînement désigne les calculs qui ont servi à construire le modèle, dont l’outil amortit une part sur l’usage."],
  ["Puces d’IA", "Processeurs spécialisés dans les calculs d’un modèle : GPU de Nvidia, TPU de Google ou Trainium d’AWS. La littérature anglophone les nomme accelerators, d’où le terme « accélérateurs » que l’on rencontre parfois en français."],
  ["Serveurs et réserve", "Le reste de l’équipement qui accompagne les puces (processeurs, mémoire, réseau) et les machines tenues disponibles pour absorber les pointes de demande, même lorsqu’elles ne servent pas."],
  ["Refroidissement et alimentation", "L’énergie que consomme le bâtiment en plus des machines : climatisation, distribution et conversion de l’électricité. Elle se mesure par le PUE, rapport entre l’énergie totale du centre et celle de ses machines, de l’ordre de 1,1 chez les grands opérateurs."],
  ["Fabrication du matériel", "Les impacts incorporés dans les puces et les serveurs (extraction des métaux, fabrication, transport), répartis sur la durée de vie du matériel puis rapportés à l’usage."],
  ["Entraînement amorti", "La part de l’énergie d’entraînement et de développement d’un modèle qu’on attribue à chaque requête, en la répartissant sur l’ensemble des requêtes servies."],
  ["Sb éq. (antimoine équivalent)", "Unité de l’indicateur d’épuisement des ressources minérales (ADPe) : chaque métal consommé est converti en la quantité d’antimoine qui épuiserait autant les réserves."],
  ["Location-based et market-based", "Deux façons de compter le carbone de l’électricité : la première retient l’intensité du réseau physique auquel le centre de données est raccordé, la seconde tient compte des contrats d’achat d’électricité décarbonée de l’opérateur."],
  ["Sonnet, Opus, Haiku", "Les trois familles de modèles d’Anthropic, du plus petit au plus grand : Haiku, Sonnet, Opus (Anthropic ne publie pas leurs tailles). L’énergie par jeton augmente avec la taille."],
  ["Effort", "Réglage de Claude (Low, Medium, High, Extra high, Max) qui fixe la quantité de réflexion et de vérifications avant et pendant la réponse ; un niveau plus élevé produit davantage de jetons."],
  ["P5, médiane, P95", "Valeurs en dessous desquelles se situent 5 %, 50 % et 95 % des tirages aléatoires ; l’intervalle entre P5 et P95 contient donc 90 % d’entre eux."]
];
A.lexique = function (title) {
  var dl = h("dl", { "class": "lex" });
  LEXIQUE.forEach(function (r) { dl.appendChild(h("dt", { text: r[0] })); dl.appendChild(h("dd", { text: r[1] })); });
  return h("details", { "class": "lexique" }, [h("summary", { text: title || "Lexique des termes employés" }), dl]);
};

/* ------------------------------------------------------------- SYNTHÈSE */
P.synthese = {
  build: function (root) {
    this.root = root;
    root.appendChild(h("div", { "class": "sec-head" }, [
      h("h2", { "class": "h2", text: "Lecture d’ensemble" }),
      h("p", { text: "Les valeurs ci-dessous sont des médianes issues de 2 500 tirages aléatoires sur les paramètres de la littérature ; elles décrivent un ordre de grandeur et non une mesure." })
    ]));
    this.read = h("div", { "class": "prose" });
    this.persp = h("div", { "class": "callout" });
    this.figs = h("div", { "class": "stack" });
    this.ref = h("div", { "class": "stack" });
    /* le lexique est construit une seule fois pour que son état ouvert ou fermé survive aux mises à jour */
    this.lex = h("div", { "class": "card" }, A.lexique("Que recouvrent ces étapes et ces termes ? Lexique"));
    root.appendChild(this.read); root.appendChild(this.persp); root.appendChild(this.figs); root.appendChild(this.lex); root.appendChild(this.ref);
  },
  update: function () {
    var S = A.S(), mc = A.MC();
    A.clear(this.read);
    readingParagraphs(mc, S).forEach(function (t) { this.read.appendChild(h("p", { text: t })); }, this);

    /* mise en perspective : renvoie vers l’onglet Comparaison */
    var cmp = M.compare(mc, A.MCB());
    A.clear(this.persp);
    this.persp.appendChild(h("p", { text: "Mise en perspective : en valeur médiane, l’usage de Claude représente " + shareText(cmp[0].share.p50) + " de l’électricité d’Énergies Demain, " +
      shareText(cmp[2].share.p50) + " de ses émissions de carbone et " + shareText(cmp[3].share.p50) + " de l’eau consommée pour produire son énergie. Ces parts reposent sur une estimation par postes du reste de l’entreprise (locaux, télétravail, déplacements, achats), à remplacer par les factures et le bilan carbone réels." }));
    this.persp.appendChild(h("button", { type: "button", "class": "btn small", style: "margin-top:8px", text: "Ouvrir l’onglet Comparaison", onclick: function () { A.goTab("comparaison"); } }));

    /* Figure 1 : structure par étape */
    A.clear(this.figs);
    var segs = M.PHASES.map(function (p, j) { return { label: p.label, slot: j + 1 }; });
    var mask = M.maskOf(mc);
    var legendItems = segs.filter(function (_, j) { return mask[j]; });
    var fig = A.figure({
      id: "synth-phases",
      title: "Structure de chaque impact par étape du cycle de vie",
      sub: "Chaque barre représente 100 % de l’indicateur ; les segments indiquent la part de chaque étape (moyenne des tirages). Survoler un segment affiche sa valeur et la dispersion de sa part.",
      legend: legendItems,
      build: function (w) {
        var rows = [0, 1, 2, 3].map(function (i) {
          var ps = M.phaseShares(mc, i), tot = M.totalStats(mc, i);
          return {
            label: indName(i), end: fv(i, tot.p50),
            parts: ps.map(function (r, j) {
              var v = r.frac * tot.p50;
              return { frac: r.active ? r.frac : 0, text: r.frac >= 0.08 ? pct(r.frac, 0) : "",
                aria: indName(i) + ", " + M.PHASES[j].label + " : " + pct(r.frac, 1),
                tip: { title: indName(i) + " · " + M.PHASES[j].label, rows: [
                  { k: "Valeur médiane", v: fv(i, v), color: A.col(j + 1) },
                  { k: "Part du total", v: pct(r.frac, 1) },
                  { k: "Part, 90 % des tirages", v: pct(r.share.p5, 0) + " – " + pct(r.share.p95, 0) } ], note: M.PHASES[j].long } };
            })
          };
        });
        return A.stackedBars(w, rows, segs, { endW: w >= 600 ? 96 : 84, strongLabels: true, aria: "Structure de chaque indicateur par étape du cycle de vie" });
      },
      table: function () {
        var head = ["Indicateur"].concat(M.PHASES.map(function (p) { return p.label; })).concat(["Total (médiane)"]);
        var rows = [0, 1, 2, 3].map(function (i) {
          var ps = M.phaseShares(mc, i), tot = M.totalStats(mc, i);
          return [indName(i)].concat(ps.map(function (r) { return r.active ? pct(r.frac, 1) : "—"; })).concat([fv(i, tot.p50)]);
        });
        return { head: head, rows: rows, num: [false, true, true, true, true, true, true] };
      },
      foot: "Les parts sont des moyennes sur l’ensemble des tirages ; leur somme vaut 100 % pour chaque indicateur."
    });
    this.figs.appendChild(fig);

    /* Repères unitaires */
    A.clear(this.ref);
    var n = persons(S);
    var rowsDef = [
      { label: "Une question simple", t: M.taskIndex("q_simple") },
      { label: "Une conversation de travail", t: M.taskIndex("chat_multi") },
      { label: "Une recherche approfondie en ligne", t: M.taskIndex("deep_research") },
      { label: "Un rapport .docx de 30 à 60 pages", t: M.taskIndex("docx") },
      { label: "Un chantier d’une journée en mode code", t: M.taskIndex("feature_heavy") }
    ];
    var tb = h("table", { "class": "tbl" });
    tb.appendChild(h("thead", null, h("tr", null, [h("th", { text: "Repère", scope: "col" })].concat(M.INDICATORS.map(function (ind) { return h("th", { "class": "r", scope: "col", text: ind.label }); })))));
    var tbody = h("tbody");
    function cellFor(st, i) {
      return h("td", { "class": "r" }, [h("div", { "class": "t-strong", style: "font:600 13.5px var(--font-ui)", text: fv(i, st.p50) }), h("div", { "class": "hint", text: M.fmtRange(i, st.p5, st.p95, 2) })]);
    }
    rowsDef.forEach(function (r) {
      tbody.appendChild(h("tr", null, [h("td", { text: r.label })].concat([0, 1, 2, 3].map(function (i) { return cellFor(M.unitStats(mc, r.t, i), i); }))));
    });
    if (n > 0) {
      tbody.appendChild(h("tr", null, [h("td", { text: "Une personne, pendant un an (moyenne du scénario)" })].concat([0, 1, 2, 3].map(function (i) {
        var st = M.totalStats(mc, i); return cellFor({ p5: st.p5 / n, p50: st.p50 / n, p95: st.p95 / n }, i);
      }))));
    }
    tb.appendChild(tbody);
    A.stack(tb, [12, 6, 6, 6, 6], [""].concat(M.INDICATORS.map(function (ind) { return ind.label; })), { bold: true });
    this.ref.appendChild(h("div", { "class": "card" }, [
      h("div", { "class": "fig-title" }, [h("h3", { text: "Repères unitaires" }), h("p", { "class": "fig-sub", text: "Chaque ligne indique la valeur médiane d’une tâche, avec l’intervalle à 90 % en dessous, pour le mélange de modèles et le périmètre du scénario." })]),
      h("div", { "class": "tscroll", style: "margin-top:10px" }, tb)
    ]));
    var q = M.unitStats(mc, M.taskIndex("q_simple"), 0), rr = M.unitRatioStats(mc, M.taskIndex("deep_research")), rd = M.unitRatioStats(mc, M.taskIndex("feature_heavy"));
    this.ref.appendChild(h("div", { "class": "callout", text: "Une recherche approfondie équivaut à environ " + fn(rr.p50, 2) + " questions simples en énergie, et un chantier d’une journée en mode code à environ " + fn(rd.p50, 2) + ", de sorte que le rapport entre tâches est plus stable que les valeurs absolues, puisque l’incertitude sur l’énergie par jeton s’applique de la même façon à toutes." }));
    this.ref.appendChild(h("div", { "class": "callout", text: "Ces chiffres ne comprennent ni les terminaux des utilisateurs, ni le réseau, ni les polluants atmosphériques, ni l’occupation des sols, ni la rareté locale de l’eau, ni les effets rebond ; l’onglet «\u00a0Autres impacts\u00a0» détaille ces angles morts." }));
    A.flushFigures();
  }
};

/* ------------------------------------------------------------- SCÉNARIO */
function numInput(value, o, onchange) {
  o = o || {};
  var el = h("input", { type: "number", "class": o["class"] || "", min: o.min != null ? o.min : 0, step: o.step != null ? o.step : 1, value: value, inputmode: "decimal", "aria-label": o.aria || "" });
  el.addEventListener("input", function () {
    var v = parseFloat(String(el.value).replace(",", "."));
    if (isFinite(v)) onchange(v);
  });
  return el;
}
A.numInput = numInput;

function field(label, control, hint) {
  return h("label", { "class": "field" }, [h("span", { text: label }), control, hint ? h("span", { "class": "hint", text: hint }) : null]);
}

function presetState(kind) {
  var S0 = M.defaultState(), cur = A.S();
  S0.ref = cur.ref; S0.orgFootprint = cur.orgFootprint; S0.base = M.deepCopy(cur.base);
  if (kind === "sobre") {
    S0.mix = { s: 0.9, o: 0.05, h: 0.05 }; S0.effort = 0.5;
    S0.headcount = S0.headcount.map(function (h0) { return [h0[0] + h0[1], h0[2], h0[3], 0]; });
  } else if (kind === "generalise") {
    S0.headcount = [[0, 0, 8, 0], [0, 0, 5, 0], [0, 0, 2, 0], [0, 0, 3, 0], [0, 0, 2, 0]];
  } else if (kind === "opus") {
    S0.mix = { s: 0, o: 1, h: 0 }; S0.effort = 2;
  }
  return S0;
}

P.scenario = {
  build: function (root) {
    var self = this, S = A.S();
    this.root = root;
    var layout = h("div", { "class": "grid2", style: "grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);align-items:start" });
    var left = h("div", { "class": "stack" }), right = h("div", { "class": "stack", style: "position:sticky;top:64px" });
    layout.appendChild(left); layout.appendChild(right);
    root.appendChild(layout);
    if (window.matchMedia && window.matchMedia("(max-width:860px)").matches) { layout.style.gridTemplateColumns = "minmax(0,1fr)"; right.style.position = "static"; layout.insertBefore(right, left); }

    /* résultat instantané */
    this.live = h("div", { "class": "card" });
    right.appendChild(this.live);

    /* A. effectifs */
    var cardA = h("div", { "class": "card stack" });
    cardA.appendChild(h("div", { "class": "sec-head" }, [
      h("h2", { "class": "h2", text: "Qui utilise l’IA, et avec quelle intensité" }),
      h("p", { text: "Chaque case indique le nombre de personnes d’un métier qui se situent à un niveau d’intensité donné. Ce niveau décrit à la fois ce que la personne fait les jours où elle utilise Claude et la fréquence de ces jours, réglée plus bas dans « Fréquence d’usage ». Les personnes qui n’utilisent pas l’IA n’apparaissent pas, ce qui respecte leur choix et ne modifie pas le calcul. Les effectifs proposés sont des valeurs d’exemple à remplacer : ils supposent surtout des usages faibles et moyens, compatibles avec des comptes gratuits ou l’abonnement Pro à 20 € par mois, et quelques usages forts." })
    ]));
    var tb = h("table", { "class": "tbl tbl-edit" });
    var thr = h("tr", null, [h("th", { text: "Métier", scope: "col" })]);
    M.INTENSITIES.forEach(function (it) { thr.appendChild(h("th", { "class": "r", scope: "col", title: it.desc, text: it.label })); });
    thr.appendChild(h("th", { "class": "r", scope: "col", text: "Total" }));
    tb.appendChild(h("thead", null, thr));
    var tbody = h("tbody"); this.rowTot = []; this.colTot = [];
    M.PERSONAS.forEach(function (pe, p) {
      var tr = h("tr", null, [h("td", { "class": "wrapc" }, [h("div", { text: pe.label, style: "font-weight:500" }), h("div", { "class": "hint", text: pe.desc })])]);
      M.INTENSITIES.forEach(function (it, i) {
        tr.appendChild(h("td", { "class": "r" }, numInput(S.headcount[p][i], { "class": "narrow", step: 1, min: 0, aria: pe.label + ", intensité " + it.label.toLowerCase() }, function (v) {
          A.S().headcount[p][i] = Math.max(0, Math.round(v)); A.touch();
        })));
      });
      var tt = h("td", { "class": "r num" }); self.rowTot.push(tt); tr.appendChild(tt);
      tbody.appendChild(tr);
    });
    tb.appendChild(tbody);
    var tf = h("tr", null, [h("td", { text: "Total", style: "font-weight:600" })]);
    M.INTENSITIES.forEach(function () { var c = h("td", { "class": "r num" }); self.colTot.push(c); tf.appendChild(c); });
    this.grandTot = h("td", { "class": "r num", style: "font-weight:600" }); tf.appendChild(this.grandTot);
    tb.appendChild(h("tfoot", null, tf));
    /* écran étroit : une carte par métier, quatre champs de saisie en ligne ; le total par métier est masqué (il figure dans l’en-tête de page) */
    A.stack(tb, [12, 3, 3, 3, 3, 0], [""].concat(M.INTENSITIES.map(function (it) { return it.label; })).concat([""]));
    cardA.appendChild(h("div", { "class": "tscroll" }, tb));
    this.legendDays = [];
    var legendI = h("div", { "class": "hint" }, M.INTENSITIES.map(function (it) {
      var d = h("span"); self.legendDays.push(d);
      return h("div", null, [h("b", { text: it.label + " : ", style: "font-weight:600;color:var(--ink-2)" }), it.desc + " ", d]);
    }));
    cardA.appendChild(legendI);
    cardA.appendChild(h("p", { "class": "hint", text: "Les intensités forte et très forte supposent des volumes de jetons que l’abonnement Pro ne permet vraisemblablement pas de soutenir tous les jours, Anthropic ne publiant pas ses limites en jetons, et que les comptes gratuits permettent encore moins ; l’onglet «\u00a0Journées types\u00a0» indique l’équivalent en tarif d’API de chaque profil." }));
    left.appendChild(cardA);

    /* B. fréquence d’usage */
    var cardB = h("div", { "class": "card stack" });
    this.cardB = cardB;
    cardB.appendChild(h("div", { "class": "sec-head" }, [h("h2", { "class": "h2", text: "Fréquence d’usage au fil de l’année" }),
      h("p", { text: "Le niveau d’intensité d’une personne fixe deux choses : le contenu des jours où elle utilise Claude (onglet « Journées types ») et le nombre de ces jours dans l’année, réglé ici. Chaque pourcentage s’applique séparément aux personnes de son niveau et se lit comme la part de leurs jours de travail où elles utilisent Claude ; leur somme n’a donc pas à valoir 100 %." })]));
    /* l’ordre des cinq champs est relu par syncAll : jours de travail d’abord, puis les quatre taux d’usage */
    cardB.appendChild(h("div", { style: "max-width:340px" }, field("Jours de travail par an et par personne", numInput(S.workdays, { "class": "", step: 1, min: 1 }, function (v) { A.S().workdays = Math.min(366, Math.max(1, v)); A.touch(); }), "Valeur retenue pour Énergies Demain : 200 jours")));
    this.rateHints = [];
    var rates = h("div", { "class": "gf", style: "display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;max-width:520px" });
    M.INTENSITIES.forEach(function (it, i) {
      var hint = h("span", { "class": "hint" }); self.rateHints.push(hint);
      rates.appendChild(h("label", { "class": "field" }, [h("span", { text: it.label }),
        numInput(Math.round(S.activeRate[i] * 100), { "class": "", step: 5, min: 0, aria: "Part des jours de travail avec usage, intensité " + it.label.toLowerCase() }, function (v) { A.S().activeRate[i] = Math.min(1, Math.max(0, v / 100)); A.touch(); }),
        hint]));
    });
    cardB.appendChild(h("div", { "class": "stack", style: "gap:6px" }, [h("span", { style: "font-size:13px;font-weight:500", text: "Part des jours de travail où une personne de ce niveau utilise Claude (%)" }), rates]));
    this.rateEx = h("p", { "class": "callout" });
    cardB.appendChild(this.rateEx);
    left.appendChild(cardB);

    /* C. modèles et effort de raisonnement */
    var cardC = h("div", { "class": "card stack" });
    cardC.appendChild(h("div", { "class": "sec-head" }, [h("h2", { "class": "h2", text: "Modèles et effort de raisonnement" }),
      h("p", { text: "Les trois modèles diffèrent par leur énergie par jeton, avec des rapports que ni Anthropic ni la littérature ne donnent précisément. Le niveau d’effort, réglé dans Claude, module le nombre de jetons de réflexion, d’appels d’outils et de texte, qui sont tous comptés comme des jetons de sortie." })]));
    function mixRow(label, key) {
      var out = h("span", { "class": "num", style: "min-width:3.2em;text-align:right" });
      var inp = h("input", { type: "range", min: 0, max: 100, step: 1, "aria-label": "Part de " + label });
      inp.addEventListener("input", function () {
        var m = A.S().mix, v = +inp.value / 100;
        if (key === "o") { m.o = v; if (m.o + m.h > 1) m.h = 1 - m.o; }
        else { m.h = v; if (m.o + m.h > 1) m.o = 1 - m.h; }
        m.s = Math.max(0, 1 - m.o - m.h);
        self.syncMix(); A.touch();
      });
      return { out: out, inp: inp, el: h("div", { "class": "row", style: "flex-wrap:nowrap;gap:12px" }, [h("span", { style: "min-width:5.2em", text: label }), inp, out]) };
    }
    this.mixO = mixRow("Opus", "o"); this.mixH = mixRow("Haiku", "h");
    this.mixS = h("div", { "class": "row", style: "flex-wrap:nowrap;gap:12px" }, [h("span", { style: "min-width:5.2em", text: "Sonnet" }), h("span", { "class": "hint", text: "le reste des tâches" }), this.sOut = h("span", { "class": "num", style: "margin-left:auto;min-width:3.2em;text-align:right" })]);
    cardC.appendChild(h("div", { "class": "stack", style: "gap:8px" }, [this.mixS, this.mixO.el, this.mixH.el]));
    /* niveau d’effort : mêmes intitulés que le sélecteur de Claude, avec le facteur appliqué aux jetons de sortie */
    this.effortRadios = [];
    var effortBox = h("div", { "class": "stack", role: "radiogroup", "aria-label": "Niveau d’effort", style: "gap:8px" });
    M.EFFORTS.forEach(function (ef) {
      var r = h("input", { type: "radio", name: "effort", value: String(ef.f) });
      r.addEventListener("change", function () { A.S().effort = ef.f; A.touch(); });
      self.effortRadios.push(r);
      effortBox.appendChild(h("label", { "class": "check", style: "align-items:flex-start" }, [r, h("span", null, [
        h("b", { text: ef.fr + " (" + ef.en + ") : ×" + fn(ef.f, 2), style: "font-weight:600;color:var(--ink)" }), h("br"), h("span", { "class": "hint", text: ef.note })])]));
    });
    this.effortCustom = h("p", { "class": "hint" });
    cardC.appendChild(h("div", { "class": "stack", style: "gap:8px" }, [
      h("span", { style: "font-size:13px;font-weight:500", text: "Niveau d’effort le plus courant dans l’équipe" }),
      h("p", { "class": "hint", text: "Dans Claude, le niveau se règle en cliquant sur le nom du modèle à côté du bouton d’envoi, puis sur « Effort » ; en mode code, la commande /effort ouvre le même réglage. Le niveau marqué « Default » est celui qu’on obtient sans rien changer, soit Medium pour Sonnet 5.5 et Opus 5.5. Un niveau plus élevé fait réfléchir le modèle plus longtemps et multiplie les vérifications, donc le nombre de jetons produits, et Anthropic précise que les limites d’usage sont alors atteintes plus vite. Si personne n’a modifié le réglage, laissez Moyen." }),
      effortBox, this.effortCustom]));
    left.appendChild(cardC);

    /* D. périmètre et réseau */
    var cardD = h("div", { "class": "card stack" });
    cardD.appendChild(h("div", { "class": "sec-head" }, [h("h2", { "class": "h2", text: "Périmètre et réseau électrique" }),
      h("p", { text: "Les études publiées ne comptent pas les mêmes étapes, ce qui explique une grande partie de leurs écarts ; ce réglage permet de retrouver le périmètre de chacune. Le facteur d’émission dépend, lui, du réseau électrique qui alimente les centres de données où s’exécutent les calculs, et non du lieu où travaille l’utilisateur." })]));
    this.scopeRadios = h("div", { "class": "stack", style: "gap:6px" });
    M.SCOPES.forEach(function (sc) {
      var r = h("input", { type: "radio", name: "scope", value: sc.id });
      r.addEventListener("change", function () { A.S().scope = sc.id; A.touch(); });
      self.scopeRadios.appendChild(h("label", { "class": "check", style: "align-items:flex-start" }, [r, h("span", null, [h("b", { text: sc.label, style: "font-weight:600;color:var(--ink)" }), h("br"), h("span", { "class": "hint", text: sc.note })])]));
    });
    cardD.appendChild(this.scopeRadios);
    this.gridSel = h("select", { "aria-label": "Réseau électrique" }, M.GRIDS.map(function (g) { return h("option", { value: g.id, text: g.method === "au choix" ? g.label : g.label + " (" + g.method + ")" }); }));
    this.gridSel.addEventListener("change", function () { A.S().grid = self.gridSel.value; A.touch(); });
    this.cifIn = numInput(S.customCif * 1000, { "class": "narrow", step: 10, min: 0 }, function (v) { A.S().customCif = Math.max(0, v / 1000); A.touch(); });
    this.cifWrap = field("Facteur d’émission personnalisé (g CO₂e par kWh)", this.cifIn);
    this.gridNote = h("p", { "class": "hint" });
    cardD.appendChild(field("Réseau électrique", this.gridSel));
    cardD.appendChild(this.cifWrap); cardD.appendChild(this.gridNote);
    cardD.appendChild(h("details", { "class": "d-note" }, [h("summary", { text: "Quel réseau choisir pour Énergies Demain ?" }), h("div", { "class": "stack", style: "gap:8px" }, [
      h("p", { text: "Le réseau pertinent est celui du lieu où s’exécutent les calculs, et non celui d’Énergies Demain. Anthropic ne publie pas ce lieu pour les applications Claude. Pour son API, sa documentation indique que l’inférence peut s’exécuter par défaut « dans n’importe quelle zone géographique disponible », avec une option réservée aux États-Unis facturée 10 % plus cher et sans option européenne directe ; pour les offres professionnelles, son centre d’aide précise que le trafic peut être acheminé vers des pays des États-Unis, d’Europe, d’Asie et d’Australie, et que les données sont stockées aux États-Unis." }),
      h("p", { text: "Les partenaires d’infrastructure connus d’Anthropic (AWS, Google Cloud, Microsoft Azure) et les centres de données qu’elle a annoncés en propre (Texas et New York) sont américains, et la recherche de capacités à louer en Europe, rapportée en avril 2026, n’était pas aboutie. Le scénario retient donc le réseau moyen des États-Unis, dont l’incertitude (de −25 % à +30 %) couvre une part de calculs réalisés en Europe sans la rendre dominante." }),
      h("p", { text: "Le réseau français ne conviendrait que si les calculs étaient effectués en France, ce que rien ne permet d’affirmer ; il constitue une borne basse, dont l’onglet « Incertitudes et leviers » chiffre l’effet. La méthode « location-based » est préférée à la méthode « market-based », car elle décrit l’électricité physiquement consommée plutôt que des contrats d’achat." })])]));
    left.appendChild(cardD);

    /* E. incertitudes */
    var cardE = h("div", { "class": "card stack" });
    cardE.appendChild(h("div", { "class": "sec-head" }, [h("h2", { "class": "h2", text: "Sources d’incertitude propagées" }),
      h("p", { text: "Les facteurs d’impact (énergie par jeton, eau, fabrication…) sont toujours incertains. Les volumes d’usage (taille réelle des tâches, fréquence) le sont aussi, car les profils proposés reposent sur des cas typiques et non sur des journaux d’utilisation." })]));
    this.uncSeg = h("div", { "class": "seg", role: "group", "aria-label": "Sources d’incertitude" }, [
      h("button", { type: "button", text: "Facteurs seuls", title: "Seuls les facteurs d’impact sont incertains", onclick: function () { A.S().volUnc = false; A.touch(); } }),
      h("button", { type: "button", text: "Facteurs et volumes", title: "Les facteurs d’impact et les volumes d’usage sont incertains", onclick: function () { A.S().volUnc = true; A.touch(); } })]);
    cardE.appendChild(this.uncSeg);
    cardE.appendChild(h("p", { "class": "hint", text: "Chaque paramètre peut aussi être fixé à sa valeur basse, centrale ou haute dans l’onglet « Hypothèses »." }));
    left.appendChild(cardE);

    /* F. scénarios prédéfinis et référence */
    var cardF = h("div", { "class": "card stack" });
    cardF.appendChild(h("div", { "class": "sec-head" }, [h("h2", { "class": "h2", text: "Scénarios de comparaison" }),
      h("p", { text: "Un scénario prédéfini remplace les effectifs, le mélange de modèles et le niveau d’effort. En figeant une référence, les indicateurs en haut de page affichent l’écart par rapport à elle, ce qui facilite la comparaison de deux choix d’organisation." })]));
    var pr = h("div", { "class": "row" });
    [["depart", "Situation de départ"], ["sobre", "Usage sobre"], ["generalise", "Usage généralisé et soutenu"], ["opus", "Opus partout, effort élevé"]].forEach(function (x) {
      pr.appendChild(h("button", { type: "button", "class": "btn", text: x[1], onclick: function () { A.setState(presetState(x[0])); self.syncAll(); A.touch(); } }));
    });
    cardF.appendChild(pr);
    this.refInfo = h("p", { "class": "hint" });
    var rr = h("div", { "class": "row" }, [
      h("button", { type: "button", "class": "btn primary", text: "Figer ce scénario comme référence", onclick: function () {
        var mc = A.MC(), kpi = [0, 1, 2, 3].map(function (i) { var st = M.totalStats(mc, i); return { p5: st.p5, p50: st.p50, p95: st.p95 }; });
        A.S().ref = { kpi: kpi, n: persons(A.S()), at: new Date().toISOString().slice(0, 10) }; A.touch();
      } }),
      h("button", { type: "button", "class": "btn", text: "Supprimer la référence", onclick: function () { A.S().ref = null; A.touch(); } })]);
    cardF.appendChild(rr); cardF.appendChild(this.refInfo);
    left.appendChild(cardF);

    /* G. mise en perspective : déplacée dans l’onglet Comparaison */
    var cardG = h("div", { "class": "card stack" });
    cardG.appendChild(h("div", { "class": "sec-head" }, [h("h2", { "class": "h2", text: "Mise en perspective" }),
      h("p", { text: "La comparaison avec l’énergie, le carbone et l’eau du reste d’Énergies Demain (locaux, télétravail, déplacements, achats) a son propre onglet. Elle y prend en compte les factures et le bilan carbone de l’entreprise, lorsqu’ils sont saisis." })]));
    cardG.appendChild(h("div", { "class": "row" }, [h("button", { type: "button", "class": "btn", text: "Ouvrir l’onglet Comparaison", onclick: function () { A.goTab("comparaison"); } })]));
    left.appendChild(cardG);

    /* H. sauvegarde */
    var cardH = h("div", { "class": "card stack" });
    cardH.appendChild(h("div", { "class": "sec-head" }, [h("h2", { "class": "h2", text: "Conserver ou transmettre le scénario" }),
      h("p", { text: "Le scénario est conservé automatiquement dans ce navigateur. La zone ci-dessous contient sa description complète ; la copier permet de la transmettre à un collègue, qui pourra la coller ici pour retrouver exactement les mêmes hypothèses." })]));
    this.json = h("textarea", { "aria-label": "Description du scénario au format JSON", spellcheck: "false" });
    this.jsonMsg = h("p", { "class": "hint", role: "status" });
    var jr = h("div", { "class": "row" }, [
      h("button", { type: "button", "class": "btn", text: "Copier", onclick: function () {
        var txt = self.json.value, done = function (ok) { self.jsonMsg.textContent = ok ? "Copié dans le presse-papiers." : "Copie impossible ici : le contenu est sélectionné, utilisez le raccourci de copie."; if (!ok) { self.json.focus(); self.json.select(); } };
        try { navigator.clipboard.writeText(txt).then(function () { done(true); }, function () { done(false); }); } catch (e) { done(false); }
      } }),
      h("button", { type: "button", "class": "btn", text: "Appliquer le contenu de la zone", onclick: function () {
        try { var o = JSON.parse(self.json.value); A.setState(o); self.syncAll(); A.touch(); self.jsonMsg.textContent = "Scénario appliqué."; }
        catch (e) { self.jsonMsg.textContent = "Le contenu n’est pas un JSON valide : " + e.message; }
      } }),
      h("button", { type: "button", "class": "btn", text: "Tout réinitialiser", onclick: function () { A.resetState(); self.syncAll(); A.touch(); self.jsonMsg.textContent = "Valeurs par défaut rétablies."; } })]);
    cardH.appendChild(this.json); cardH.appendChild(jr); cardH.appendChild(this.jsonMsg);
    left.appendChild(cardH);
  },

  syncMix: function () {
    var m = A.S().mix;
    this.mixO.inp.value = Math.round(m.o * 100); this.mixH.inp.value = Math.round(m.h * 100);
    this.mixO.out.textContent = Math.round(m.o * 100) + " %"; this.mixH.out.textContent = Math.round(m.h * 100) + " %";
    this.sOut.textContent = Math.round(m.s * 100) + " %";
  },

  syncEffort: function () {
    var eff = A.S().effort, found = false;
    this.effortRadios.forEach(function (r, k) { var ok = Math.abs(M.EFFORTS[k].f - eff) < 1e-9; r.checked = ok; if (ok) found = true; });
    this.effortCustom.hidden = found;
    this.effortCustom.textContent = found ? "" : "Valeur personnalisée en cours : ×" + fn(eff, 2) + ". Choisir l’un des niveaux ci-dessus la remplace.";
  },

  /* exemple chiffré pour la case métier × intensité la plus peuplée : relie l’intensité à la fréquence d’usage */
  rateExample: function (S, mc) {
    var T = M.TASKS.length, best = null, p, i, t;
    for (p = 0; p < 5; p++) for (i = 0; i < 4; i++) if (S.headcount[p][i] > 0 && (!best || S.headcount[p][i] >= best.n)) best = { p: p, i: i, n: S.headcount[p][i] };
    if (!best) best = { p: 0, i: 1, n: 0 };
    var cell = best.p * 4 + best.i, days = mc.prep.days[best.i], tasks = 0;
    for (t = 0; t < T; t++) tasks += mc.prep.cellPer[cell * T + t];
    var annual = M.dayStats(mc, cell, 0).p50 * days;
    this.rateEx.textContent = "Exemple : une personne du métier « " + M.PERSONAS[best.p].label + " » à l’intensité " + M.INTENSITIES[best.i].label.toLowerCase() +
      " utilise Claude " + fn(Math.round(days), 3) + " jours par an (" + pct(S.activeRate[best.i], 0) + " de " + fn(S.workdays, 3) + " jours de travail). Ces jours-là, elle réalise la journée type correspondante, soit environ " +
      fn(tasks, 2) + " tâches, ce qui représente en médiane " + fv(0, annual) + " d’électricité par an.";
  },

  syncAll: function () {
    var S = A.S(), self = this;
    var inputs = this.root.querySelectorAll(".tbl-edit input");
    var k = 0;
    for (var p = 0; p < 5; p++) for (var i = 0; i < 4; i++) { inputs[k].value = S.headcount[p][i]; k++; }
    this.syncMix();
    this.syncEffort();
    var radios = this.scopeRadios.querySelectorAll("input"); for (var r = 0; r < radios.length; r++) radios[r].checked = radios[r].value === S.scope;
    this.gridSel.value = S.grid;
    /* champs de rythme : on les relit par ordre dans la carte B */
    if (this.cardB) { var ins = this.cardB.querySelectorAll("input"); if (ins.length === 5) { ins[0].value = S.workdays; for (var j = 0; j < 4; j++) ins[j + 1].value = Math.round(S.activeRate[j] * 100); } }
  },

  update: function () {
    var S = A.S(), mc = A.MC(), self = this;
    if (!this._init) { this.syncAll(); this._init = true; }
    var n = persons(S);
    for (var p = 0; p < 5; p++) this.rowTot[p].textContent = S.headcount[p].reduce(function (a, b) { return a + b; }, 0);
    for (var i = 0; i < 4; i++) this.colTot[i].textContent = S.headcount.reduce(function (a, r) { return a + r[i]; }, 0);
    this.grandTot.textContent = n;
    this.syncMix();
    for (var q = 0; q < 4; q++) {
      var dq = fn(Math.round(S.workdays * S.activeRate[q]), 3);
      this.legendDays[q].textContent = "Utilisé environ " + dq + " jours par an.";
      this.rateHints[q].textContent = "soit " + dq + " jours par an";
    }
    this.rateExample(S, mc);
    var btns = this.uncSeg.querySelectorAll("button");
    btns[0].setAttribute("aria-pressed", S.volUnc ? "false" : "true"); btns[1].setAttribute("aria-pressed", S.volUnc ? "true" : "false");
    var g = M.gridById(S.grid);
    this.cifWrap.hidden = S.grid !== "custom";
    this.gridNote.textContent = g.note + " Facteur retenu : " + fn(M.cifOf(S) * 1000, 3) + " g CO₂e par kWh.";
    this.refInfo.textContent = S.ref ? "Référence figée le " + S.ref.at + " pour " + S.ref.n + " " + pl(S.ref.n, "personne", "personnes") + "." : "Aucune référence figée pour le moment.";
    /* résultat instantané */
    A.clear(this.live);
    this.live.appendChild(h("h3", { "class": "h3", text: "Effet immédiat des réglages" }));
    this.live.appendChild(h("p", { "class": "hint", text: n + " " + pl(n, "personne", "personnes") + ", médiane et intervalle à 90 %, par an." }));
    var lb = h("div", { "class": "livebar", style: "margin-top:10px" });
    for (var k = 0; k < 4; k++) {
      var st = M.totalStats(mc, k);
      var d = S.ref && S.ref.kpi[k] && S.ref.kpi[k].p50 > 0 ? st.p50 / S.ref.kpi[k].p50 - 1 : null;
      lb.appendChild(h("div", null, [h("div", { "class": "lv-l", text: M.INDICATORS[k].label }), h("div", { "class": "lv-v", text: fv(k, st.p50) }),
        h("div", { "class": "lv-r", text: M.fmtRange(k, st.p5, st.p95, 2) }),
        d != null ? h("div", { "class": "lv-r", text: (d >= 0 ? "▲ +" : "▼ −") + pct(Math.abs(d), 0) + " vs référence" }) : null]));
    }
    this.live.appendChild(lb);
    this.json.value = JSON.stringify(S, null, 1).replace(/\n\s+(?=[\d\-\]\[,.])/g, " ");
  }
};

})();
