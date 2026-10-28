/* ============================================================================
   Interface — décomposition, tâches, journées types, sensibilités
   ========================================================================== */
(function () {
"use strict";
var M = window.EDM, A = window.EDApp;
var h = A.h, s = A.s, fv = A.fv, fn = A.fn, pct = A.pct, pl = A.pl;
var P = A.panels;
var T = M.TASKS;

A.isDark = function () {
  var t = document.documentElement.getAttribute("data-theme");
  if (t) return t === "dark";
  try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { return false; }
};

function indHead(root, title, intro) {
  var wrap = h("div", { "class": "row between", style: "align-items:flex-end" });
  wrap.appendChild(h("div", { "class": "sec-head", style: "flex:1 1 320px" }, [h("h2", { "class": "h2", text: title }), intro ? h("p", { text: intro }) : null]));
  var segBox = h("div", { "class": "stack", style: "gap:4px" });
  segBox.appendChild(h("span", { "class": "hint", text: "Indicateur affiché" }));
  var holder = h("div"); segBox.appendChild(holder);
  wrap.appendChild(segBox);
  root.appendChild(wrap);
  return holder;
}
function refreshSeg(holder) { A.clear(holder); holder.appendChild(A.indSeg()); }

function meanOf(arr) { var t = 0; for (var i = 0; i < arr.length; i++) t += arr[i]; return arr.length ? t / arr.length : 0; }
function valueTip(ind, title, rows, note) { return { title: title, rows: rows, note: note }; }

/* ---------------------------------------------------------- DÉCOMPOSITION */
P.decomp = {
  build: function (root) {
    this.seg = indHead(root, "Décomposition des impacts",
      "Comme tous les impacts sont proportionnels à l’énergie d’inférence dans ce modèle, la répartition entre tâches, métiers et modèles est identique pour les quatre indicateurs ; seule la répartition entre étapes du cycle de vie change d’un indicateur à l’autre.");
    this.body = h("div", { "class": "stack" });
    root.appendChild(this.body);
  },
  update: function () {
    var S = A.S(), UI = A.UI(), mc = A.MC(), ind = UI.ind, mask = M.maskOf(mc);
    refreshSeg(this.seg);
    A.clear(this.body);
    var tot = M.totalStats(mc, ind);

    /* 1. étapes du cycle de vie, avec dispersion */
    var ps = M.phaseShares(mc, ind);
    var f1 = A.figure({
      id: "dec-phases",
      title: "Étapes du cycle de vie — " + M.INDICATORS[ind].label.toLowerCase(),
      sub: "La barre indique la valeur médiane de chaque étape et la moustache l’intervalle à 90 % ; une moustache longue signale une étape dont la valeur est mal connue.",
      build: function (w) {
        var rows = [];
        ps.forEach(function (r, j) {
          if (!r.active || r.value.p50 <= 0) return;
          rows.push({ label: M.PHASES[j].label, slot: j + 1, value: r.value.p50, lo: r.value.p5, hi: r.value.p95,
            text: fv(ind, r.value.p50) + " (" + pct(r.frac, 0) + ")",
            tip: valueTip(ind, M.PHASES[j].label, [{ k: "Médiane", v: fv(ind, r.value.p50), color: A.col(j + 1) }, { k: "90 % des tirages", v: M.fmtRange(ind, r.value.p5, r.value.p95, 2) }, { k: "Part du total", v: pct(r.frac, 1) }], M.PHASES[j].long) });
        });
        return A.hBars(w, rows, { aria: "Valeur de chaque étape du cycle de vie" });
      },
      table: function () {
        var rows = [];
        ps.forEach(function (r, j) { if (r.active && r.value.p50 > 0) rows.push([M.PHASES[j].label, fv(ind, r.value.p50), M.fmtRange(ind, r.value.p5, r.value.p95, 2), pct(r.frac, 1)]); });
        return { head: ["Étape", "Médiane", "Intervalle à 90 %", "Part"], rows: rows, num: [false, true, true, true] };
      },
      foot: ind === 0 ? "L’électricité comptée est celle de l’exploitation et, si le périmètre l’inclut, de l’entraînement amorti ; l’énergie dépensée pour fabriquer le matériel n’apparaît pas dans cet indicateur, mais ses effets figurent dans le carbone, l’eau et la matière." : null
    });
    this.body.appendChild(h("div", { "class": "card" }, f1));

    /* 2. par type de tâche */
    var cs = M.componentShares(mc, mc.Et, T.length, "t");
    var order = T.map(function (_, t) { return t; }).sort(function (a, b) { return cs[b].frac - cs[a].frac; });
    var catIdx = {}; M.CATS.forEach(function (c, i) { catIdx[c.id] = i; });
    var f2 = A.figure({
      id: "dec-tasks",
      title: "Par type de tâche",
      sub: "Les barres sont triées par contribution décroissante ; la couleur indique la famille de tâches. Une tâche peut dominer par sa fréquence (les questions simples) ou par son poids unitaire (les chantiers en mode code).",
      legend: M.CATS.map(function (c, i) { return { label: c.label, slot: i + 1 }; }),
      build: function (w) {
        var rows = order.map(function (t) {
          var v = cs[t].frac * tot.p50, cnt = 0;
          for (var p = 0; p < 5; p++) cnt += mc.prep.cnt[p * T.length + t];
          return { label: T[t].label, slot: catIdx[T[t].cat] + 1, value: v, text: fv(ind, v) + " (" + pct(cs[t].frac, 0) + ")",
            tip: valueTip(ind, T[t].label, [{ k: "Contribution médiane", v: fv(ind, v), color: A.col(catIdx[T[t].cat] + 1) }, { k: "Part du total", v: pct(cs[t].frac, 1) }, { k: "Part, 90 % des tirages", v: pct(cs[t].share.p5, 0) + " – " + pct(cs[t].share.p95, 0) }, { k: "Occurrences par an", v: fn(cnt, 3) }], T[t].desc) };
        });
        return A.hBars(w, rows, { aria: "Contribution de chaque type de tâche", rowH: 34, rowH2: 52 });
      },
      table: function () {
        return { head: ["Tâche", "Famille", "Contribution", "Part"], rows: order.map(function (t) { return [T[t].label, M.CATS[catIdx[T[t].cat]].label, fv(ind, cs[t].frac * tot.p50), pct(cs[t].frac, 1)]; }), num: [false, false, true, true] };
      }
    });
    this.body.appendChild(h("div", { "class": "card" }, f2));

    /* 3. par métier et intensité */
    var cc = M.componentShares(mc, mc.Ecell, 20, "c");
    var fillsI = intensityFills();
    var segsI = M.INTENSITIES.map(function (it, i) { return { label: it.label, slot: i + 1, fill: fillsI[i].bg, on: fillsI[i].on }; });
    var perTot = M.PERSONAS.map(function (_, p) { var t = 0; for (var i = 0; i < 4; i++) t += cc[p * 4 + i].frac; return t; });
    var maxPer = Math.max.apply(null, perTot) || 1;
    var conc = A.concentration(mc, S), n = A.persons(S);
    var f3 = A.figure({
      id: "dec-personas",
      title: "Par métier et par intensité d’usage",
      sub: "La longueur de chaque barre est proportionnelle à la contribution du métier ; les teintes, de la plus claire à la plus foncée, correspondent à l’intensité d’usage croissante.",
      legend: segsI.map(function (g, i) { return { label: g.label, color: g.fill }; }),
      build: function (w) {
        var rows = M.PERSONAS.map(function (pe, p) {
          return { label: pe.label, end: fv(ind, perTot[p] * tot.p50) + " · " + pct(perTot[p], 0),
            parts: [0, 1, 2, 3].map(function (i) {
              var f = cc[p * 4 + i].frac, np = S.headcount[p][i];
              return { frac: f / maxPer, text: "", aria: pe.label + ", intensité " + segsI[i].label.toLowerCase() + " : " + pct(f, 1),
                tip: { title: pe.label + " · " + segsI[i].label.toLowerCase(), rows: [{ k: "Contribution médiane", v: fv(ind, f * tot.p50), color: segsI[i].fill }, { k: "Part du total", v: pct(f, 1) }, { k: "Personnes concernées", v: String(np) },
                  { k: "Par personne et par an", v: np > 0 ? fv(ind, f * tot.p50 / np) : "—" }], note: M.INTENSITIES[i].desc } };
            }) };
        });
        return A.stackedBars(w, rows, segsI, { endW: w >= 600 ? 150 : 120, aria: "Contribution de chaque métier, ventilée par intensité" });
      },
      table: function () {
        var rows = [];
        M.PERSONAS.forEach(function (pe, p) { for (var i = 0; i < 4; i++) rows.push([pe.label, M.INTENSITIES[i].label, String(S.headcount[p][i]), fv(ind, cc[p * 4 + i].frac * tot.p50), pct(cc[p * 4 + i].frac, 1)]); });
        return { head: ["Métier", "Intensité", "Personnes", "Contribution", "Part"], rows: rows, num: [false, false, true, true, true] };
      },
      foot: conc.people > 0 && n > 1 ? "La moitié de l’impact provient de " + conc.people + " " + pl(conc.people, "personne", "personnes") + " sur " + n + " : les profils les plus intensifs pèsent beaucoup plus que leur effectif." : null
    });
    this.body.appendChild(h("div", { "class": "card" }, f3));

    /* 4. modèle et type de jeton */
    var cm = M.componentShares(mc, mc.Em, 3, "m"), ct = M.componentShares(mc, mc.Etok, 3, "tok");
    var mixLabels = ["Sonnet", "Opus", "Haiku"], mixShare = [S.mix.s, S.mix.o, S.mix.h];
    var f4a = A.figure({
      id: "dec-models",
      title: "Par modèle",
      sub: "La part de chaque modèle dans l’impact dépasse sa part dans les tâches dès que son énergie par jeton est plus élevée.",
      legend: mixLabels.map(function (l, i) { return { label: l, slot: i + 1 }; }),
      build: function (w) {
        var row = { label: "Impact", parts: [0, 1, 2].map(function (i) {
          return { frac: cm[i].frac, text: cm[i].frac >= 0.08 ? pct(cm[i].frac, 0) : "", aria: mixLabels[i] + " : " + pct(cm[i].frac, 1),
            tip: { title: mixLabels[i], rows: [{ k: "Part de l’impact", v: pct(cm[i].frac, 1), color: A.col(i + 1) }, { k: "Part des tâches", v: pct(mixShare[i], 0) }, { k: "Valeur médiane", v: fv(ind, cm[i].frac * tot.p50) }] } };
        }) };
        return A.stackedBars(w, [row], mixLabels.map(function (l, i) { return { label: l, slot: i + 1 }; }), { rowH: 40, rowH2: 52 });
      },
      table: function () { return { head: ["Modèle", "Part des tâches", "Part de l’impact", "Valeur"], rows: mixLabels.map(function (l, i) { return [l, pct(mixShare[i], 0), pct(cm[i].frac, 1), fv(ind, cm[i].frac * tot.p50)]; }), num: [false, true, true, true] };  }
    });
    var tokLabels = ["Entrée fraîche", "Lecture du cache", "Sortie et raisonnement"];
    var f4b = A.figure({
      id: "dec-tokens",
      title: "Par type de jeton",
      sub: "Les jetons relus dans le cache sont les plus nombreux dans les usages agentiques, mais chacun coûte peu d’énergie ; les jetons de sortie en coûtent beaucoup plus chacun.",
      legend: tokLabels.map(function (l, i) { return { label: l, slot: i + 1 }; }),
      build: function (w) {
        var row = { label: "Impact", parts: [0, 1, 2].map(function (i) {
          return { frac: ct[i].frac, text: ct[i].frac >= 0.08 ? pct(ct[i].frac, 0) : "", aria: tokLabels[i] + " : " + pct(ct[i].frac, 1),
            tip: { title: tokLabels[i], rows: [{ k: "Part de l’impact", v: pct(ct[i].frac, 1), color: A.col(i + 1) }, { k: "Part, 90 % des tirages", v: pct(ct[i].share.p5, 0) + " – " + pct(ct[i].share.p95, 0) }, { k: "Valeur médiane", v: fv(ind, ct[i].frac * tot.p50) }] } };
        }) };
        return A.stackedBars(w, [row], tokLabels.map(function (l, i) { return { label: l, slot: i + 1 }; }), { rowH: 40, rowH2: 52 });
      },
      table: function () { return { head: ["Type de jeton", "Part de l’impact", "Valeur"], rows: tokLabels.map(function (l, i) { return [l, pct(ct[i].frac, 1), fv(ind, ct[i].frac * tot.p50)]; }), num: [false, true, true] }; }
    });
    this.body.appendChild(h("div", { "class": "grid2" }, [h("div", { "class": "card" }, f4a), h("div", { "class": "card" }, f4b)]));

    /* 5. mécanismes */
    var g = ps, ex = g[0].frac + g[1].frac + g[2].frac, wsite = meanOf(mc.wsite);
    var mech;
    if (ind === 0) mech = [["Puces d’IA", g[0].frac], ["Serveurs et capacité de réserve", g[1].frac], ["Refroidissement et alimentation du site", g[2].frac], ["Entraînement et développement amortis", g[4].frac]];
    else if (ind === 1) mech = [["Électricité d’exploitation (inférence)", ex], ["Électricité de l’entraînement amorti", g[4].frac], ["Fabrication du matériel (émissions incorporées)", g[3].frac]];
    else if (ind === 2) mech = [["Eau évaporée sur site (refroidissement)", (ex + g[4].frac) * wsite], ["Eau consommée pour produire l’électricité (hors site)", (ex + g[4].frac) * (1 - wsite)], ["Fabrication du matériel", g[3].frac]];
    else mech = [["Fabrication du matériel", g[3].frac], ["Exploitation : production d’électricité, bâtiments, réseau", ex + g[4].frac]];
    mech = mech.filter(function (m) { return m[1] > 1e-6; });
    var tbl = h("table", { "class": "tbl" });
    tbl.appendChild(h("thead", null, h("tr", null, ["Mécanisme", "Part", "", "Valeur médiane"].map(function (c, i) { return h("th", { scope: "col", "class": i === 1 || i === 3 ? "r" : "", text: c }); }))));
    var tb = h("tbody");
    mech.forEach(function (m) {
      tb.appendChild(h("tr", null, [h("td", { text: m[0] }), h("td", { "class": "r", text: pct(m[1], 0) }),
        h("td", { "class": "barc" }, h("div", { "class": "mb" }, h("i", { style: "width:" + Math.max(1, m[1] * 100).toFixed(1) + "%" }))),
        h("td", { "class": "r", text: fv(ind, m[1] * tot.p50) })]));
    });
    tbl.appendChild(tb);
    A.stack(tbl, [12, 3, 5, 4], ["", "Part", "", "Valeur médiane"], { bold: true });
    this.body.appendChild(h("div", { "class": "card" }, [
      h("div", { "class": "fig-title" }, [h("h3", { text: "Par mécanisme physique — " + M.INDICATORS[ind].label.toLowerCase() }),
        h("p", { "class": "fig-sub", text: ind === 2 ? "L’eau consommée se répartit entre l’évaporation sur le site de calcul, l’eau évaporée par les centrales qui produisent l’électricité, et la fabrication des puces ; les études qui ne comptent que l’eau sur site obtiennent donc des valeurs bien plus faibles que celles qui adoptent un cycle de vie complet." : ind === 3 ? "L’indicateur d’épuisement des ressources minérales est dominé par la fabrication des puces d’IA et des serveurs (métaux rares, cuivre, or), tandis que l’exploitation n’intervient que par les infrastructures de production d’électricité." : ind === 1 ? "Le carbone provient surtout de l’électricité consommée, en proportion du facteur d’émission du réseau, auquel s’ajoute la fabrication du matériel qui ne dépend pas du lieu d’usage." : "L’électricité se répartit entre les composants du centre de calcul, plus l’entraînement amorti sur l’ensemble de l’usage." })]),
      h("div", { "class": "tscroll", style: "margin-top:10px" }, tbl)]));
    A.flushFigures();
  }
};

/* ----------------------------------------------------------------- TÂCHES */
P.taches = {
  build: function (root) {
    var self = this, S = A.S();
    this.seg = indHead(root, "Tâches unitaires",
      "Chaque tâche est décrite par un budget de jetons (entrée fraîche, relecture du cache, sortie avec raisonnement, longueur moyenne du contexte). Les budgets sont des ordres de grandeur tirés de cas d’usage typiques ; ils peuvent être remplacés par des mesures réelles dans le tableau.");
    this.figBox = h("div", { "class": "card" });
    root.appendChild(this.figBox);
    /* tableau éditable (construit une fois) */
    var card = h("div", { "class": "card stack" });
    card.appendChild(h("div", { "class": "fig-title" }, [h("h3", { text: "Budgets de jetons et résultats par tâche" }),
      h("p", { "class": "fig-sub", text: "Les budgets sont exprimés en milliers de jetons. Pour les calibrer, on peut relever les volumes réels dans les journaux d’usage de Claude Code ou dans le récapitulatif de consommation du compte." })]));
    var tb = h("table", { "class": "tbl tbl-edit" });
    var heads = ["Tâche", "Entrée fraîche (k)", "Cache relu (k)", "Sortie (k)", "Contexte (k)", "Électricité", "", "≈ questions simples", "Tarif API ($)"], thr = h("tr");
    heads.forEach(function (c, i) { var th = h("th", { scope: "col", "class": i > 0 ? "r" : "", text: c }); if (i === 6) self.thInd = th; thr.appendChild(th); });
    tb.appendChild(h("thead", null, thr));
    var body = h("tbody"); this.out = [];
    T.forEach(function (t, ti) {
      var b = (S.budgets && S.budgets[t.id]) || {};
      function cell(key) {
        var v = b[key] != null ? b[key] : t[key];
        return h("td", { "class": "r" }, A.numInput(+(v / 1000).toFixed(4), { "class": "narrow", step: "any", min: 0, aria: t.label + ", " + key }, function (x) {
          var st = A.S(); st.budgets = st.budgets || {}; var o = Object.assign({}, st.budgets[t.id]); o[key] = Math.max(0, x * 1000); st.budgets[t.id] = o; A.touch();
        }));
      }
      var o1 = h("td", { "class": "r num" }), o2 = h("td", { "class": "r num" }), o3 = h("td", { "class": "r num" }), o4 = h("td", { "class": "r num" });
      self.out.push([o1, o2, o3, o4]);
      body.appendChild(h("tr", null, [h("td", { "class": "wrapc" }, [h("div", { style: "font-weight:500", text: t.label }), h("div", { "class": "hint", text: t.desc })]),
        cell("nin"), cell("ncache"), cell("nout"), cell("ctx"), o1, o2, o3, o4]));
    });
    tb.appendChild(body);
    /* écran étroit : une carte par tâche (quatre champs de saisie, puis les résultats) */
    A.stack(tb, [12, 3, 3, 3, 3, 3, 3, 3, 3], ["", "Entrée (k)", "Cache (k)", "Sortie (k)", "Contexte (k)", "Électricité", "", "≈ questions simples", "Tarif API ($)"]);
    card.appendChild(h("div", { "class": "tscroll" }, tb));
    card.appendChild(h("div", { "class": "row" }, [h("button", { type: "button", "class": "btn", text: "Rétablir les budgets par défaut", onclick: function () { A.S().budgets = {}; A.touch(); } })]));
    this.root = root; root.appendChild(card);
    root.appendChild(h("div", { "class": "callout", text: "Le contexte compte parce que chaque jeton traité coûte davantage quand il est long, l’attention devant parcourir tout ce qui précède ; une tâche qui garde un long document en mémoire consomme donc plus qu’une tâche qui produit autant de texte à partir d’un contexte court." }));
  },
  syncInputs: function () {
    var S = A.S(), ins = this.root.querySelectorAll(".tbl-edit input");
    T.forEach(function (t, ti) {
      var b = (S.budgets && S.budgets[t.id]) || {};
      ["nin", "ncache", "nout", "ctx"].forEach(function (k, ki) {
        var el = ins[ti * 4 + ki]; if (!el || el === document.activeElement) return;
        var v = b[k] != null ? b[k] : t[k];
        el.value = +(v / 1000).toFixed(4);
      });
    });
  },
  update: function () {
    var S = A.S(), UI = A.UI(), mc = A.MC(), ind = UI.ind, self = this;
    refreshSeg(this.seg);
    this.syncInputs();
    var us = T.map(function (_, t) { return M.unitStats(mc, t, ind); });
    var order = T.map(function (_, t) { return t; }).sort(function (a, b) { return us[a].p50 - us[b].p50; });
    var catIdx = {}; M.CATS.forEach(function (c, i) { catIdx[c.id] = i; });
    A.clear(this.figBox);
    var fig = A.figure({
      id: "task-range",
      title: "Impact d’une occurrence de chaque tâche — " + M.INDICATORS[ind].label.toLowerCase(),
      sub: "Le point indique la médiane, le trait l’intervalle à 90 % ; l’axe est logarithmique, car les tâches s’étalent sur plus de trois ordres de grandeur.",
      legend: M.CATS.map(function (c, i) { return { label: c.label, slot: i + 1 }; }),
      build: function (w) {
        var rows = order.map(function (t) {
          var r = M.unitRatioStats(mc, t);
          return { label: T[t].label, slot: catIdx[T[t].cat] + 1, lo: us[t].p5, mid: us[t].p50, hi: us[t].p95, right: fv(ind, us[t].p50),
            aria: T[t].label + " : " + fv(ind, us[t].p50),
            tip: { title: T[t].label, rows: [{ k: "Médiane", v: fv(ind, us[t].p50), color: A.col(catIdx[T[t].cat] + 1) }, { k: "90 % des tirages", v: M.fmtRange(ind, us[t].p5, us[t].p95, 2) }, { k: "Équivalent en questions simples", v: "≈ " + fn(r.p50, 2) }], note: T[t].desc } };
        });
        return A.rangeRows(w, rows, { tick: function (v) { return A.tickLabel(ind, v); }, aria: "Impact unitaire de chaque tâche, axe logarithmique" });
      },
      table: function () {
        return { head: ["Tâche", "Médiane", "Intervalle à 90 %", "≈ questions simples"], rows: order.map(function (t) { return [T[t].label, fv(ind, us[t].p50), M.fmtRange(ind, us[t].p5, us[t].p95, 2), fn(M.unitRatioStats(mc, t).p50, 2)]; }), num: [false, true, true, true] };
      }
    });
    this.figBox.appendChild(fig);
    /* sorties du tableau */
    var prep = mc.prep;
    this.thInd.textContent = M.INDICATORS[ind].label; this.thInd.hidden = ind === 0;
    T.forEach(function (t, ti) {
      var e = M.unitStats(mc, ti, 0), x = M.unitStats(mc, ti, ind), r = M.unitRatioStats(mc, ti);
      self.out[ti][0].textContent = fv(0, e.p50);
      self.out[ti][1].hidden = ind === 0;
      self.out[ti][1].textContent = fv(ind, x.p50);
      self.out[ti][2].textContent = fn(r.p50, 2);
      self.out[ti][3].textContent = fn(M.taskCostUSD(prep, ti), 2);
      /* présentation en cartes (écran étroit) : trois résultats de largeur égale si la colonne d’indicateur est masquée, quatre sinon */
      var sp = ind === 0 ? 4 : 3;
      A.setSpan(self.out[ti][0], sp); A.setSpan(self.out[ti][2], sp); A.setSpan(self.out[ti][3], sp);
      self.out[ti][1].setAttribute("data-label", M.INDICATORS[ind].label);
    });
    A.flushFigures();
  }
};

/* --------------------------------------------------------------- JOURNÉES */
var SEQ_STEPS = [["--s100", "#cde2fb"], ["--s150", "#b7d3f6"], ["--s200", "#9ec5f4"], ["--s250", "#86b6ef"], ["--s300", "#6da7ec"], ["--s350", "#5598e7"], ["--s400", "#3987e5"],
                 ["--s450", "#2a78d6"], ["--s500", "#256abf"], ["--s550", "#1c5cab"], ["--s600", "#184f95"], ["--s650", "#104281"], ["--s700", "#0d366b"]];
function lum(hex) {
  var c = [1, 3, 5].map(function (i) { var v = parseInt(hex.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function bestOn(hex) {
  var L = lum(hex), cDark = (L + 0.05) / (lum("#0b0b0b") + 0.05), cLight = 1.05 / (L + 0.05);
  return cDark >= cLight ? "#0b0b0b" : "#ffffff";
}
/* idx : 0 (clair) à 12 (foncé) ; en mode sombre, l’ordre est inversé pour que « plus » reste « plus visible » */
function seqStep(idx) {
  idx = Math.max(0, Math.min(12, Math.round(idx)));
  if (A.isDark()) idx = 12 - idx;
  return { bg: "var(" + SEQ_STEPS[idx][0] + ")", on: bestOn(SEQ_STEPS[idx][1]) };
}
function seqColor(t) { return seqStep(A.clamp(t, 0, 1) * 12); }
function intensityFills() { return [2, 5, 8, 11].map(function (k) { return seqStep(k); }); }

P.journees = {
  mode: "jour",
  build: function (root) {
    this.root = root;
    this.seg = indHead(root, "Journées types par métier et par intensité",
      "La matrice donne l’impact d’une journée d’usage pour chaque combinaison de métier et d’intensité ; en cliquant sur une case, on voit la composition de la journée et on peut en modifier le contenu.");
    this.heatCard = h("div", { "class": "card stack" });
    this.detail = h("div", { "class": "stack" });
    root.appendChild(this.heatCard); root.appendChild(this.detail);
    this.cellKey = null;
  },
  update: function () {
    var S = A.S(), UI = A.UI(), mc = A.MC(), ind = UI.ind, self = this;
    refreshSeg(this.seg);
    A.clear(this.heatCard);
    var modeSeg = h("div", { "class": "seg", role: "group", "aria-label": "Unité de la matrice" }, [
      h("button", { type: "button", text: "Par jour d’usage", "aria-pressed": this.mode === "jour" ? "true" : "false", onclick: function () { self.mode = "jour"; A.touchUI(); } }),
      h("button", { type: "button", text: "Par personne et par an", "aria-pressed": this.mode === "an" ? "true" : "false", onclick: function () { self.mode = "an"; A.touchUI(); } })]);
    this.heatCard.appendChild(h("div", { "class": "row between" }, [h("h3", { "class": "h3", text: "Matrice métier × intensité — " + M.INDICATORS[ind].label.toLowerCase() }), modeSeg]));
    var vals = [], mx = 0, mn = Infinity;
    for (var p = 0; p < 5; p++) { vals.push([]); for (var i = 0; i < 4; i++) {
      var st = M.dayStats(mc, p * 4 + i, ind), f = this.mode === "an" ? mc.prep.days[i] : 1;
      var v = { p5: st.p5 * f, p50: st.p50 * f, p95: st.p95 * f };
      vals[p].push(v); if (v.p50 > 0) { mx = Math.max(mx, v.p50); mn = Math.min(mn, v.p50); }
    } }
    if (!isFinite(mn)) mn = 1; if (mx <= mn) mx = mn * 10;
    var tb = h("table", { "class": "hm" });
    /* la disposition étant fixe, c’est la première ligne qui fixe les largeurs : on y réserve la colonne des libellés */
    var thr = h("tr", null, [h("th", { text: "" })]);
    M.INTENSITIES.forEach(function (it) { thr.appendChild(h("th", { "class": "col", text: it.label, title: it.desc })); });
    tb.appendChild(h("thead", null, thr));
    var tbody = h("tbody");
    M.PERSONAS.forEach(function (pe, p) {
      var tr = h("tr", null, [h("th", { scope: "row", title: pe.label }, [h("span", { "class": "fl", text: pe.label }), h("span", { "class": "sh", text: pe.short })])]);
      M.INTENSITIES.forEach(function (it, i) {
        var v = vals[p][i], tt = v.p50 > 0 ? (Math.log(v.p50) - Math.log(mn)) / (Math.log(mx) - Math.log(mn)) : 0, c = seqColor(tt);
        var sel = UI.cell[0] === p && UI.cell[1] === i, np = S.headcount[p][i];
        var btn = h("button", { type: "button", "aria-pressed": sel ? "true" : "false", style: "background:" + c.bg + ";color:" + c.on + (np === 0 ? ";opacity:.62" : ""),
          "aria-label": pe.label + ", intensité " + it.label.toLowerCase() + " : " + fv(ind, v.p50) + ", " + np + " personnes",
          onclick: function () { UI.cell = [p, i]; A.touchUI(); } }, [fv(ind, v.p50, 2), h("span", { "class": "sub", text: np + " " + pl(np, "pers.", "pers.") })]);
        A.bindTip(btn, function () { return { title: pe.label + " · " + it.label.toLowerCase(), rows: [{ k: "Médiane", v: fv(ind, v.p50) }, { k: "90 % des tirages", v: M.fmtRange(ind, v.p5, v.p95, 2) }, { k: "Personnes dans ce profil", v: String(np) }], note: it.desc }; });
        tr.appendChild(h("td", null, btn));
      });
      tbody.appendChild(tr);
    });
    tb.appendChild(tbody);
    this.heatCard.appendChild(h("div", { "class": "tscroll" }, tb));
    var sc = h("div", { "class": "scale" });
    sc.appendChild(document.createTextNode(fv(ind, mn))); sc.appendChild(h("i", { style: "background:linear-gradient(90deg," + (A.isDark() ? "var(--s700),var(--s400),var(--s100)" : "var(--s100),var(--s400),var(--s700)") + ")" })); sc.appendChild(document.createTextNode(fv(ind, mx)));
    sc.appendChild(h("span", { text: "échelle logarithmique ; médiane des tirages ; une case estompée désigne un profil sans personne dans le scénario" }));
    this.heatCard.appendChild(sc);
    this.renderDetail();
  },

  renderDetail: function () {
    var S = A.S(), UI = A.UI(), mc = A.MC(), ind = UI.ind, self = this;
    var p = UI.cell[0], i = UI.cell[1], cell = p * 4 + i, key = p + "-" + i;
    var pe = M.PERSONAS[p], it = M.INTENSITIES[i];
    var prep = mc.prep, TT = T.length;
    var catIdx = {}; M.CATS.forEach(function (c, k) { catIdx[c.id] = k; });
    if (this.cellKey !== key) {
      this.cellKey = key; A.clear(this.detail);
      var head = h("div", { "class": "card stack" });
      this.detTitle = h("h2", { "class": "h2" }); this.detSub = h("p", { "class": "muted small" });
      head.appendChild(this.detTitle); head.appendChild(this.detSub);
      this.kpiBox = h("div", { "class": "livebar" }); head.appendChild(this.kpiBox);
      this.compBox = h("div"); head.appendChild(this.compBox);
      this.apiNote = h("p", { "class": "hint" }); head.appendChild(this.apiNote);
      this.detail.appendChild(head);
      /* tableau éditable des tâches de la journée */
      var card = h("div", { "class": "card stack" });
      card.appendChild(h("div", { "class": "fig-title" }, [h("h3", { text: "Contenu de la journée type" }), h("p", { "class": "fig-sub", text: "Les nombres indiquent combien de fois chaque tâche est réalisée en moyenne lors d’un jour d’usage ; ils peuvent être modifiés pour refléter les pratiques réelles du métier." })]));
      var tb = h("table", { "class": "tbl tbl-edit" });
      tb.appendChild(h("thead", null, h("tr", null, ["Tâche", "Occurrences par jour", "Contribution médiane", "Part de la journée"].map(function (c, k) { return h("th", { scope: "col", "class": k > 0 ? "r" : "", text: c }); }))));
      var body = h("tbody"); this.dOut = []; this.dIns = [];
      T.forEach(function (t, ti) {
        var o1 = h("td", { "class": "r num" }), o2 = h("td", { "class": "r num" });
        self.dOut.push([o1, o2]);
        var inp = A.numInput(S.perDay[p][i][ti], { "class": "narrow", step: 0.05, min: 0, aria: t.label + ", occurrences par jour" }, function (v) { A.S().perDay[p][i][ti] = Math.max(0, v); A.touch(); });
        self.dIns.push(inp);
        body.appendChild(h("tr", null, [h("td", { text: t.label }), h("td", { "class": "r" }, inp), o1, o2]));
      });
      tb.appendChild(body);
      A.stack(tb, [12, 4, 4, 4], ["", "Occurrences / jour", "Contribution", "Part du jour"]);
      card.appendChild(h("div", { "class": "tscroll" }, tb));
      this.detail.appendChild(card);
    }
    this.dIns.forEach(function (el, ti) { if (el !== document.activeElement) el.value = A.S().perDay[p][i][ti]; });
    this.detTitle.textContent = pe.label + " — intensité " + it.label.toLowerCase();
    this.detSub.textContent = pe.desc + " " + it.desc;
    /* statistiques du jour */
    var dst = M.dayStats(mc, cell, ind), dst0 = M.dayStats(mc, cell, 0);
    var days = prep.days[i], annual = { p5: dst.p5 * days, p50: dst.p50 * days, p95: dst.p95 * days };
    var share = M.componentShares(mc, mc.Ecell, 20, "c")[cell].frac, np = S.headcount[p][i];
    /* coût indicatif */
    var cost = 0; for (var t = 0; t < TT; t++) cost += prep.cellPer[cell * TT + t] * M.taskCostUSD(prep, t);
    var monthly = cost * days / 12;
    A.clear(this.kpiBox);
    function lv(l, v, r) { return h("div", null, [h("div", { "class": "lv-l", text: l }), h("div", { "class": "lv-v", text: v }), h("div", { "class": "lv-r", text: r })]); }
    this.kpiBox.appendChild(lv("Par jour d’usage", fv(ind, dst.p50), M.fmtRange(ind, dst.p5, dst.p95, 2)));
    this.kpiBox.appendChild(lv("Par personne et par an", fv(ind, annual.p50), fn(days, 3) + " jours d’usage"));
    this.kpiBox.appendChild(lv("Part du scénario", np > 0 ? pct(share, 0) : "—", np + " " + pl(np, "personne", "personnes")));
    this.kpiBox.appendChild(lv("Tarif API indicatif", "≈ " + fn(cost, 2) + " $ par jour", "≈ " + fn(monthly, 2) + " $ par mois"));
    /* composition par famille : part moyenne sur les tirages */
    var catSum = new Array(M.CATS.length).fill(0), tot = 0, taskVal = new Array(TT).fill(0);
    for (var k = 0; k < mc.N; k++) {
      for (var t2 = 0; t2 < TT; t2++) { var v = mc.Unit[k * TT + t2] * prep.cellPer[cell * TT + t2]; taskVal[t2] += v; }
    }
    for (var t3 = 0; t3 < TT; t3++) { taskVal[t3] /= mc.N; catSum[catIdx[T[t3].cat]] += taskVal[t3]; tot += taskVal[t3]; }
    var fr = catSum.map(function (x) { return tot > 0 ? x / tot : 0; });
    var segs = M.CATS.map(function (c, k) { return { label: c.label, slot: k + 1 }; });
    A.clear(this.compBox);
    this.compBox.appendChild(A.figure({
      id: "day-comp", title: "Composition de la journée par famille de tâches",
      build: function (w) {
        var row = { label: "Journée", end: fv(ind, dst.p50), parts: fr.map(function (f, k) {
          return { frac: f, text: f >= 0.09 ? pct(f, 0) : "", aria: M.CATS[k].label + " : " + pct(f, 0),
            tip: { title: M.CATS[k].label, rows: [{ k: "Part de la journée", v: pct(f, 1), color: A.col(k + 1) }, { k: "Valeur médiane", v: fv(ind, f * dst.p50) }] } };
        }) };
        return A.stackedBars(w, [row], segs, { rowH: 44, rowH2: 62, endW: w >= 600 ? 110 : 90 });
      },
      table: function () { return { head: ["Famille", "Part", "Valeur"], rows: fr.map(function (f, k) { return [M.CATS[k].label, pct(f, 1), fv(ind, f * dst.p50)]; }), num: [false, true, true] }; },
      legend: segs
    }));
    A.flushFigures();
    var capTxt = monthly > 60
      ? "À ce niveau d’usage, le tarif API équivalent dépasse quelques dizaines de dollars par mois. Anthropic ne publie pas de plafond en jetons pour l’abonnement Pro (fenêtres de cinq heures et limite hebdomadaire) : cette intensité est donc vraisemblablement difficile à soutenir avec ce seul abonnement, et correspond plutôt à un forfait supérieur ou à la facturation à l’API."
      : "Ce niveau d’usage représente un volume de jetons modeste ; il est vraisemblablement compatible avec les limites d’un abonnement Pro, même si Anthropic ne publie pas ces limites en jetons.";
    this.apiNote.textContent = capTxt + " Les tarifs retenus sont ceux de la génération 4.x (Sonnet 3 et 15 $, Opus 5 et 25 $, Haiku 1 et 5 $ par million de jetons) et servent uniquement de repère de plausibilité.";
    /* sorties du tableau */
    for (var t4 = 0; t4 < TT; t4++) {
      var cnt = prep.cellPer[cell * TT + t4];
      this.dOut[t4][0].textContent = cnt > 0 ? fv(ind, taskVal[t4] / Math.max(1e-12, tot) * dst.p50) : "—";
      this.dOut[t4][1].textContent = cnt > 0 && tot > 0 ? pct(taskVal[t4] / tot, 0) : "—";
    }
  }
};

/* ---------------------------------------------------------- SENSIBILITÉS */
P.sensib = {
  build: function (root) {
    this.seg = indHead(root, "Sensibilités et leviers",
      "Deux questions distinctes se posent : ce qui reste mal connu (les paramètres de la littérature) et ce qui relève de nos choix (modèles, raisonnement, intensité). La première se lit dans la dispersion et la tornade, la seconde dans les leviers.");
    this.body = h("div", { "class": "stack" });
    root.appendChild(this.body);
  },
  update: function () {
    var S = A.S(), UI = A.UI(), mc = A.MC(), ind = UI.ind;
    refreshSeg(this.seg);
    A.clear(this.body);
    var st = M.totalStats(mc, ind), series = M.totalSeries(mc, ind), cen = M.evalCentral(S).tot[ind];
    var tick = function (v) { return A.tickLabel(ind, v); };

    var f1 = A.figure({
      id: "sens-hist",
      title: "Distribution du total annuel — " + M.INDICATORS[ind].label.toLowerCase(),
      sub: "Chacun des 2 500 tirages combine une valeur de chaque paramètre de la littérature ; la zone colorée correspond à l’intervalle à 90 %, et le trait épais à la médiane.",
      build: function (w) { return A.histogram(w, series, { stats: st, tick: tick, aria: "Distribution des totaux annuels simulés" }); },
      table: function () {
        return { head: ["Statistique", "Valeur"], rows: [["5e centile", fv(ind, st.p5)], ["25e centile", fv(ind, st.p25)], ["Médiane", fv(ind, st.p50)], ["Moyenne", fv(ind, st.mean)], ["75e centile", fv(ind, st.p75)], ["95e centile", fv(ind, st.p95)]], num: [false, true] };
      },
      foot: "La médiane vaut " + fv(ind, st.p50) + ", tandis que la moyenne atteint " + fv(ind, st.mean) + " : la distribution est asymétrique, avec une longue queue vers les valeurs élevées, de sorte que la médiane est le résumé le plus représentatif (comme dans l’étude de Google)."
    });
    this.body.appendChild(h("div", { "class": "card" }, f1));

    var tor = M.tornado(S, ind);
    var f2 = A.figure({
      id: "sens-tornado",
      title: "Quels paramètres expliquent l’incertitude",
      sub: "Chaque barre montre de quel facteur le total est multiplié lorsqu’un seul paramètre passe de sa valeur basse (P5, en bleu) à sa valeur haute (P95, en orange), tous les autres restant à leur valeur centrale.",
      legend: [{ label: "Paramètre à sa valeur basse (P5)", slot: 1 }, { label: "Paramètre à sa valeur haute (P95)", slot: 2 }],
      build: function (w) {
        var rows = tor.map(function (r) {
          var q = M.paramById(r.id), f1_ = r.lo / r.base, f2_ = r.hi / r.base;
          return { label: r.label, lo: f1_, hi: f2_,
            tipLo: { title: r.label, rows: [{ k: "Paramètre à P5", v: fn(q.p5, 3) + " " + q.unit, color: A.col(1) }, { k: "Total multiplié par", v: "×" + fn(f1_, 2) }, { k: "Total", v: fv(ind, r.lo) }], note: "Valeur centrale du paramètre : " + fn(q.p50, 3) + " " + q.unit },
            tipHi: { title: r.label, rows: [{ k: "Paramètre à P95", v: fn(q.p95, 3) + " " + q.unit, color: A.col(2) }, { k: "Total multiplié par", v: "×" + fn(f2_, 2) }, { k: "Total", v: fv(ind, r.hi) }], note: "Valeur centrale du paramètre : " + fn(q.p50, 3) + " " + q.unit } };
        });
        return A.tornado(w, rows, { aria: "Sensibilité du total aux paramètres" });
      },
      table: function () {
        return { head: ["Paramètre", "P5 → total", "P95 → total", "Facteur P5", "Facteur P95"], rows: tor.map(function (r) { return [r.label, fv(ind, r.lo), fv(ind, r.hi), "×" + fn(r.lo / r.base, 2), "×" + fn(r.hi / r.base, 2)]; }), num: [false, true, true, true, true] };
      },
      foot: "Le point de départ est la valeur centrale déterministe (" + fv(ind, cen) + "), inférieure à la médiane des tirages parce que les distributions des paramètres sont plus étirées vers le haut que vers le bas. Les paramètres de la même famille (par exemple l’énergie par jeton de sortie et le rapport d’entrée) interagissent : la tornade les traite un par un."
    });
    this.body.appendChild(h("div", { "class": "card" }, f2));

    var lv = M.levers(S, ind);
    lv.list = lv.list.filter(function (r) { return Math.abs(r.delta) > 1e-6; });
    var f3 = A.figure({
      id: "sens-levers",
      title: "Leviers de scénario : ce qui change si l’organisation change",
      sub: "Variation du total central lorsqu’un seul choix de scénario est modifié, les autres restant identiques. Ces écarts relèvent de décisions d’organisation et non de l’état des connaissances.",
      legend: [{ label: "Baisse", slot: 1 }, { label: "Hausse", slot: 2 }],
      build: function (w) {
        var rows = lv.list.map(function (r) {
          var txt = (r.delta >= 0 ? "+" : "−") + Math.round(Math.abs(r.delta) * 100) + " %";
          return { label: r.group + " · " + r.label, delta: r.delta, text: txt,
            tip: { title: r.label, rows: [{ k: "Variation", v: txt, color: r.delta < 0 ? A.col(1) : A.col(2) }, { k: "Total central", v: fv(ind, r.value) }, { k: "Scénario actuel", v: fv(ind, lv.base) }], note: "Calcul déterministe aux valeurs centrales des paramètres." } };
        });
        return A.divBars(w, rows, { aria: "Variation du total selon les leviers de scénario" });
      },
      table: function () { return { head: ["Levier", "Variation", "Total central"], rows: lv.list.map(function (r) { return [r.group + " · " + r.label, (r.delta >= 0 ? "+" : "−") + pct(Math.abs(r.delta), 0), fv(ind, r.value)]; }), num: [false, true, true] }; },
      foot: "La variation est exprimée par rapport au total central de " + fv(ind, lv.base) + "." + (ind === 1 ? " Le choix du réseau électrique n’agit que sur le carbone, d’où l’absence des leviers « réseau » pour les autres indicateurs." : "")
    });
    this.body.appendChild(h("div", { "class": "card" }, f3));
    A.flushFigures();
  }
};

A.indHead = indHead; A.refreshSeg = refreshSeg; A.seqStep = seqStep; A.seqColor = seqColor;

})();
