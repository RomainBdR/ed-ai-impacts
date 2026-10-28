/* ============================================================================
   Interface — comparaison avec le reste de l’entreprise
   ========================================================================== */
(function () {
"use strict";
var M = window.EDM, A = window.EDApp;
var h = A.h, s = A.s, fv = A.fv, fn = A.fn, pct = A.pct, pl = A.pl, clamp = A.clamp;
var P = A.panels;
var NB = " ", NN = " ";

/* Espaces insécables avant les unités et dans les nombres à plusieurs milliers */
function nb(str) {
  return String(str)
    .replace(/(\d) (?=(?:Wh|kWh|MWh|GWh|g|kg|t|mL|L|m³|m²|\$|%|W|h|ans|mois|jours|jetons|M de jetons|k jetons|milliards|fois|g\/kWh|L\/kWh|mg)(?![A-Za-zÀ-ÿ]))/g, "$1" + NB)
    .replace(/(\d) (\d{3})(?!\d)/g, "$1" + NN + "$2")
    .replace(/« /g, "«" + NB).replace(/ »/g, NB + "»");
}
function para(text, cls) { return h("p", { "class": cls || "", text: nb(text) }); }
function link(label, url) { return h("a", { href: url, target: "_blank", rel: "noopener noreferrer", text: label }); }

var CONF = ["faible", "moyenne", "bonne"], CONF_DOTS = ["●○○", "●●○", "●●●"];

/* Ordre fixe des segments : l’IA d’abord (couleur d’accent), puis les postes du reste de l’entreprise. */
var KEYS = ["ai", "elecOff", "gasOff", "home", "mob", "purch", "dig", "bilan"];
function segOf(key) { return key === "ai" ? { label: "IA (Claude)", slot: 0 } : { label: M.BASE_ITEMS[key].label, slot: M.BASE_ITEMS[key].slot }; }

var NOTES = {
  ai: "Usage de Claude par les personnes du scénario, avec le périmètre et le réseau électrique choisis dans l’onglet Scénario.",
  elecOff: "Surface des locaux × énergie finale par m² × part d’électricité, ou consommation saisie d’après les factures.",
  gasOff: "Surface des locaux × énergie finale par m² × part de gaz, ou consommation saisie d’après les factures.",
  home: "Jours de télétravail × énergie supplémentaire consommée à domicile par jour, répartie entre électricité et gaz dans les mêmes proportions que dans les locaux.",
  mob: "Trajets domicile-travail et déplacements professionnels, estimés par personne (vélo, marche, transports en commun, train).",
  purch: "Achats de services, de matériel et de fournitures, et repas, estimés par personne d’après le bilan 2024 de l’I4CE.",
  dig: "Matériel numérique, réseaux et services en ligne hors IA, estimés par personne d’après le bilan 2024 de l’I4CE.",
  bilan: "Total saisi dans le champ « Bilan carbone annuel », avec une incertitude de −20 % à +25 %."
};
var WATER_NOTE = "Eau évaporée pour produire cette électricité, à raison d’environ 1 L par kWh en France.";

function find(row, key) { for (var i = 0; i < row.items.length; i++) if (row.items[i].key === key) return row.items[i]; return null; }
function fmtX(x) {
  if (!isFinite(x)) return "—";
  if (x > 1e4) return "plus de ×10" + NN + "000";
  return "×" + fn(x, 2);
}
function fmtMult(m) {
  var v = m < 10 ? Math.round(m * 10) / 10 : m < 100 ? Math.round(m) : Math.round(m / 5) * 5;
  return "×" + v.toLocaleString("fr-FR");
}
function pc(x) { return pct(x, x < 0.1 ? 1 : 0); }
function pcNum(x) { return pc(x).replace(NN + "%", ""); }
function svgRoot(w, hh, aria) { return s("svg", { viewBox: "0 0 " + w + " " + hh, width: w, height: hh, role: "img", "aria-label": aria }); }

/* ------------------------------------------------------------ lecture dynamique */
function readingParagraphs(rows, S, mcb) {
  var el = rows[0], en = rows[1], co = rows[2], wa = rows[3];
  var nU = A.persons(S), B = S.base, out = [];
  function rg(r) { return pc(r.share.p5) + " à " + pc(r.share.p95); }
  out.push("Avec les hypothèses actuelles, l’usage de Claude par " + nU + " " + pl(nU, "personne", "personnes") + " représente, en valeur médiane, " + pc(el.share.p50) +
    " de l’électricité de l’ensemble d’Énergies Demain (de " + rg(el) + " pour 90 % des tirages), " + pc(en.share.p50) + " de son énergie finale lorsque le gaz est ajouté, " +
    pc(co.share.p50) + " de ses émissions de carbone et " + pc(wa.share.p50) + " de l’eau consommée pour produire l’énergie qu’elle utilise. Ces parts rapprochent " + fv(0, el.ai.p50) +
    " d’électricité pour l’IA de " + fv(0, el.base.p50) + " pour une entreprise de " + B.staff + " " + pl(B.staff, "personne", "personnes") + " occupant " + fn(B.area, 3) + NB + "m² de locaux.");
  if (!mcb.hasBilan) {
    var purch = find(co, "purch"), enKeys = ["elecOff", "gasOff", "home"], enFrac = 0, enMed = 0;
    enKeys.forEach(function (k) { var it = find(co, k); if (it) { enFrac += it.frac; enMed += it.stats.p50; } });
    out.push("La part du carbone dépend surtout du poids des achats de services, de matériel et de repas, qui représentent environ " + pc(purch.frac) + " des émissions estimées de l’entreprise, alors que l’énergie des locaux et du télétravail n’en représente que " + pc(enFrac) +
      ". Comparées aux seules émissions de cette énergie (" + fv(1, enMed) + "), celles de l’IA (" + fv(1, co.ai.p50) + ") en représentent environ " + pc(enMed > 0 ? co.ai.p50 / enMed : 0) +
      ", et environ " + pc(purch.stats.p50 > 0 ? co.ai.p50 / purch.stats.p50 : 0) + " de celles des achats ; l’intervalle à 90 % des émissions de l’IA couvre un facteur " + fn(co.ai.p95 / co.ai.p5, 2) + ", de sorte que ces rapports ne sont que des ordres de grandeur.");
  } else {
    out.push("Le bilan carbone saisi (" + fn(S.orgFootprint, 3) + NB + "t CO₂e par an) remplace l’estimation par postes, et l’IA lui est ajoutée comme un poste supplémentaire, de sorte que sa part reste proche du simple rapport entre ses émissions et ce total tant qu’elle est faible.");
  }
  var ws = M.wsrcOf(S);
  out.push("La part de l’eau est celle qui dépend le plus d’un choix de scénario. Pour l’IA, l’outil compte environ " + fn(4 * ws, 2) + NB + "L/kWh d’eau évaporée pour produire l’électricité (" +
    (ws < 1 ? "valeur ramenée à celle de la France" : "médiane de la littérature, calée sur des réseaux américains") + "), auxquels s’ajoutent environ 0,4" + NB + "L/kWh évaporés sur le site de calcul, alors que l’électricité consommée en France coûte environ 1" + NB +
    "L/kWh. Du côté d’Énergies Demain, seule l’eau liée à l’énergie est estimée, et non celle que contiennent les achats et le matériel, de sorte que la part affichée tend à surestimer le poids de l’IA.");
  return out;
}

/* ------------------------------------------------------------- tuiles (parts) */
function iconFor(row) { return A.icon(row.ind); }

/* ---------------------------------------------------------- courbe « et si… » */
function curveChart(width, row, m, hooks) {
  var wide = width >= 560, H = wide ? 270 : 244, ml = 44, mr = 14, mt = 20, mb = 38;
  var x0 = ml, x1 = width - mr, y0 = mt, y1 = H - mb, LX = 3;
  var xs = function (mm) { return x0 + Math.log10(clamp(mm, 1, 1000)) / LX * (x1 - x0); };
  var ys = function (f) { return y1 - clamp(f, 0, 1) * (y1 - y0); };
  var svg = svgRoot(width, H, "Part de l’IA dans le total en fonction du facteur de multiplication de l’usage, pour l’indicateur " + row.label.toLowerCase());
  [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
    svg.appendChild(s("line", { x1: x0, x2: x1, y1: ys(f), y2: ys(f), "class": f === 0 ? "g-base" : "g-grid" }));
    svg.appendChild(s("text", { x: x0 - 8, y: ys(f) + 4, "text-anchor": "end", "class": "t-ax", text: Math.round(f * 100) + NB + "%" }));
  });
  A.logTicks(1, 1000, wide ? 9 : 5).forEach(function (v) {
    svg.appendChild(s("line", { x1: xs(v), x2: xs(v), y1: y0, y2: y1, "class": "g-grid", style: { opacity: Math.abs(Math.log10(v) - Math.round(Math.log10(v))) < 1e-9 ? 1 : 0.5 } }));
    var tl = "×" + v.toLocaleString("fr-FR"), tw0 = A.textW(tl, 11.5, 400), tx0 = xs(v), an0 = "middle";
    if (tx0 - tw0 / 2 < 0) { an0 = "start"; tx0 = 0; } else if (tx0 + tw0 / 2 > width) { an0 = "end"; tx0 = width; }
    svg.appendChild(s("text", { x: tx0, y: y1 + 17, "text-anchor": an0, "class": "t-ax", text: tl }));
  });
  var axisTitle = A.textW("Facteur de multiplication de l’usage de Claude (échelle logarithmique)", 11.5, 400) <= width - 8 ? "Facteur de multiplication de l’usage de Claude (échelle logarithmique)" : "Multiplication de l’usage (échelle logarithmique)";
  svg.appendChild(s("text", { x: (x0 + x1) / 2, y: H - 4, "text-anchor": "middle", "class": "t-sub", text: axisTitle }));
  /* bande à 90 % et médiane */
  var N = 60, top = [], bot = [], med = [];
  for (var i = 0; i <= N; i++) {
    var mm = Math.pow(10, LX * i / N), q = M.shareAt(row, mm), X = xs(mm).toFixed(1);
    top.push(X + " " + ys(q.p95).toFixed(1)); bot.push(X + " " + ys(q.p5).toFixed(1)); med.push(X + " " + ys(q.p50).toFixed(1));
  }
  svg.appendChild(s("path", { d: "M" + top.join("L") + "L" + bot.reverse().join("L") + "Z", style: { fill: "var(--band)", stroke: "none" } }));
  svg.appendChild(s("path", { d: "M" + med.join("L"), fill: "none", stroke: "var(--ink)", "stroke-width": 2, "stroke-linejoin": "round" }));
  /* repères à 10 % et 50 % */
  [0.1, 0.5].forEach(function (f, k) {
    svg.appendChild(s("line", { x1: x0, x2: x1, y1: ys(f), y2: ys(f), stroke: "var(--ink-3)", "stroke-width": 1, "stroke-dasharray": "3 4", style: { pointerEvents: "none" } }));
    var mStar = M.multiplierFor(row, f);
    if (mStar >= 1 && mStar <= 1000) {
      svg.appendChild(s("circle", { cx: xs(mStar), cy: ys(f), r: 4, style: { fill: "var(--surface)", stroke: "var(--ink)", strokeWidth: 2, pointerEvents: "none" } }));
      var tx = xs(mStar), lab = fmtX(mStar) + " pour " + Math.round(f * 100) + NB + "%", tw = A.textW(lab, 11.5, 600), anchor = "start", lx = tx + 8;
      if (lx + tw > x1) { anchor = "end"; lx = tx - 8; }
      svg.appendChild(s("text", { x: lx, y: ys(f) + (k === 0 ? 16 : -8), "text-anchor": anchor, "class": "t-sub", style: { fill: "var(--ink)", fontWeight: 600, pointerEvents: "none" }, text: lab }));
    }
  });
  /* repère mobile */
  var cur = s("g", { style: { pointerEvents: "none" } });
  var line = s("line", { y1: y0, y2: y1, stroke: "var(--ink)", "stroke-width": 1.5 });
  var whisk = s("line", { stroke: "var(--ink)", "stroke-width": 4, "stroke-linecap": "round", opacity: 0.3 });
  var dot = s("circle", { r: 5.5, style: { fill: "var(--ink)", stroke: "var(--surface)", strokeWidth: 2 } });
  var lbl = s("text", { y: y0 - 6, "class": "t-val" });
  cur.appendChild(line); cur.appendChild(whisk); cur.appendChild(dot); cur.appendChild(lbl);
  svg.appendChild(cur);
  function move(mv) {
    var q = M.shareAt(row, mv), X = xs(mv);
    line.setAttribute("x1", X); line.setAttribute("x2", X);
    whisk.setAttribute("x1", X); whisk.setAttribute("x2", X); whisk.setAttribute("y1", ys(q.p95)); whisk.setAttribute("y2", ys(q.p5));
    dot.setAttribute("cx", X); dot.setAttribute("cy", ys(q.p50));
    var text = fmtMult(mv) + " : " + pc(q.p50), tw = A.textW(text, 12.5, 600);
    var anchor = "middle", lx = X;
    if (X - tw / 2 < 2) { anchor = "start"; lx = Math.max(2, X - 4); } else if (X + tw / 2 > width - 2) { anchor = "end"; lx = Math.min(width - 2, X + 4); }
    lbl.setAttribute("x", lx); lbl.setAttribute("text-anchor", anchor); lbl.textContent = text;
  }
  move(m);
  /* zone de saisie : un glissement sur le graphique règle le facteur */
  var hit = s("rect", { x: x0, y: y0 - 14, width: x1 - x0, height: y1 - y0 + 14, fill: "transparent", style: { cursor: "ew-resize", touchAction: "pan-y" } });
  function setFrom(e) {
    var r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (width / r.width);
    var t = clamp((px - x0) / (x1 - x0), 0, 1);
    hooks.set(Math.pow(10, LX * t));
  }
  var dragging = false;
  hit.addEventListener("pointerdown", function (e) { dragging = true; try { hit.setPointerCapture(e.pointerId); } catch (x) {} setFrom(e); });
  hit.addEventListener("pointermove", function (e) { if (dragging) setFrom(e); });
  hit.addEventListener("pointerup", function () { dragging = false; });
  hit.addEventListener("pointercancel", function () { dragging = false; });
  svg.appendChild(hit);
  svg.moveCursor = move;
  return svg;
}

/* ================================================================ PANNEAU */
P.comparaison = {
  build: function (root) {
    var self = this, S = A.S(), UI = A.UI(), B = S.base;
    this.root = root;
    root.appendChild(h("div", { "class": "sec-head" }, [
      h("h2", { "class": "h2", text: "Comparer l’IA au reste d’Énergies Demain" }),
      h("p", { text: nb("Cet onglet situe l’usage de Claude par rapport à l’énergie des locaux, au télétravail, aux déplacements, aux achats et au numérique de l’entreprise. Le reste d’Énergies Demain est estimé par postes à partir de repères publiés, avec ses propres incertitudes, et chaque estimation peut être remplacée par une valeur réelle (factures d’électricité et de gaz, bilan carbone) dans le cadre « Hypothèses sur Énergies Demain ».") }),
      h("button", { type: "button", "class": "btn cmp-jump", style: "align-self:flex-start", text: "Aller aux hypothèses sur l’entreprise", onclick: function () {
        var c = document.getElementById("cmp-inputs"); if (c) { c.scrollIntoView({ block: "start" }); var f = c.querySelector("input"); if (f) f.focus({ preventScroll: true }); }
      } })
    ]));

    var layout = h("div", { "class": "cmp-layout" });
    var main = h("div", { "class": "stack cmp-main" }), side = h("div", { "class": "stack cmp-side" });
    layout.appendChild(main); layout.appendChild(side); root.appendChild(layout);

    /* lecture et tuiles */
    this.read = h("div", { "class": "prose" });
    this.hintTiles = h("div", { "class": "stack", style: "gap:4px" }, [
      h("h3", { "class": "h3", text: "Part de l’IA dans le total de chaque impact" }),
      h("p", { "class": "hint", text: nb("Chaque tuile rapporte l’IA à l’ensemble formé par l’IA et le reste de l’entreprise, avec l’intervalle à 90 %. Cliquer sur une tuile choisit l’indicateur affiché dans les deux dernières figures.") })
    ]);
    this.tiles = h("div", { "class": "cmp-tiles" });
    main.appendChild(this.hintTiles); main.appendChild(this.tiles); main.appendChild(this.read);
    this.figA = h("div", { "class": "card" });
    this.figC = h("div", { "class": "card" });
    main.appendChild(this.figA); main.appendChild(this.figC);

    /* figure « et si l’usage augmentait ? » : construite une fois pour que le curseur garde le focus */
    this.slider = h("input", { type: "range", min: 0, max: 3, step: 0.01, "aria-label": "Facteur de multiplication de l’usage de Claude (échelle logarithmique de ×1 à ×1 000)" });
    this.slider.addEventListener("input", function () { self.setMult(Math.pow(10, +self.slider.value), true); });
    this.multOut = h("span", { "class": "cmp-mult num" });
    var presets = h("div", { "class": "row", style: "gap:6px" });
    [1, 2, 5, 10, 30, 100].forEach(function (v) {
      presets.appendChild(h("button", { type: "button", "class": "btn small", text: "×" + v, onclick: function () { self.setMult(v, false); } }));
    });
    this.readout = h("div", { "class": "livebar" });
    this.readCells = M.CMP_ROWS.map(function (r) {
      var l = h("div", { "class": "lv-l", text: r.short }), v = h("div", { "class": "lv-v" }), g = h("div", { "class": "lv-r" });
      self.readout.appendChild(h("div", null, [l, v, g]));
      return { v: v, g: g };
    });
    var extra = h("div", { "class": "stack cmp-slider", style: "margin-top:12px" }, [
      h("div", { "class": "row between" }, [h("label", { "class": "cmp-lbl" }, ["Usage de Claude multiplié par ", this.multOut]), presets]),
      this.slider, this.readout
    ]);
    this.figBFig = A.figure({
      id: "cmp-whatif",
      title: "Et si l’usage de l’IA augmentait ?",
      sub: "La courbe donne la part de l’IA dans le total lorsque l’usage de Claude est multiplié par un même facteur, à effectif et profils inchangés ; la bande indique l’intervalle à 90 %. Faire glisser le doigt ou la souris sur le graphique déplace le repère, comme le curseur.",
      extra: extra,
      build: function (w) { return self.buildCurve(w); },
      table: function () { return self.whatIfTable(); },
      foot: "Une multiplication par 10 équivaut, par exemple, à dix fois plus de personnes à intensité égale, ou à une intensité d’usage dix fois plus forte. Les deux membres de la comparaison sont tirés indépendamment."
    });
    this.beBox = h("div", { "class": "stack", style: "margin-top:14px" });
    this.figB = h("div", { "class": "card" }, [this.figBFig, this.beBox]);
    main.appendChild(this.figB);

    this.limits = h("div", { "class": "card stack" });
    main.appendChild(this.limits);
    this.detail = h("div", { "class": "card stack" });
    main.appendChild(this.detail);

    /* saisie des hypothèses sur l’entreprise */
    var card = h("div", { "class": "card stack", id: "cmp-inputs" });
    card.appendChild(h("div", { "class": "stack", style: "gap:4px" }, [h("h3", { "class": "h3", text: "Hypothèses sur Énergies Demain" }),
      h("p", { "class": "hint", text: nb("Les valeurs de départ sont des ordres de grandeur à remplacer. Un champ facultatif laissé vide conserve l’estimation, et une valeur saisie la remplace avec une incertitude plus faible.") })]));
    function intIn(val, aria, step, fn2) { return A.numInput(val, { step: step, min: 0, aria: aria }, fn2); }
    this.staffIn = intIn(B.staff, "Effectif total de l’entreprise", 1, function (v) { A.S().base.staff = Math.max(1, Math.round(v)); A.touchUI(); });
    this.areaIn = intIn(B.area, "Surface totale des locaux en mètres carrés", 10, function (v) { A.S().base.area = Math.max(0, v); A.touchUI(); });
    this.homeIn = intIn(Math.round(B.homeShare * 100), "Part du temps de travail réalisée à domicile, en pourcentage", 5, function (v) { A.S().base.homeShare = clamp(v / 100, 0, 1); A.touchUI(); });
    this.elecIn = intIn(B.elecKWh != null ? B.elecKWh : "", "Électricité annuelle des locaux d’après les factures, en kilowattheures", 1000, function (v) { A.S().base.elecKWh = v; A.touchUI(); });
    this.gasIn = intIn(B.gasKWh != null ? B.gasKWh : "", "Gaz annuel des locaux d’après les factures, en kilowattheures", 1000, function (v) { A.S().base.gasKWh = v; A.touchUI(); });
    this.bilanIn = intIn(S.orgFootprint != null ? S.orgFootprint : "", "Bilan carbone annuel de l’entreprise hors IA, en tonnes de CO2 équivalent", 5, function (v) { A.S().orgFootprint = v > 0 ? v : null; A.touchUI(); });
    [["elecIn", function (st) { st.base.elecKWh = null; }], ["gasIn", function (st) { st.base.gasKWh = null; }], ["bilanIn", function (st) { st.orgFootprint = null; }]].forEach(function (x) {
      self[x[0]].addEventListener("change", function () { if (self[x[0]].value === "") { x[1](A.S()); A.touchUI(); } });
    });
    this.hStaff = h("span", { "class": "hint" }); this.hArea = h("span", { "class": "hint" }); this.hHome = h("span", { "class": "hint" });
    this.hElec = h("span", { "class": "hint" }); this.hGas = h("span", { "class": "hint" }); this.hBilan = h("span", { "class": "hint" });
    function fld(label, input, hint) { return h("label", { "class": "field" }, [h("span", { text: label }), input, hint]); }
    card.appendChild(h("div", { "class": "stack", style: "gap:12px" }, [
      fld("Effectif total (personnes)", this.staffIn, this.hStaff),
      fld("Surface des locaux (m²)", this.areaIn, this.hArea),
      fld("Part du temps de travail à domicile (%)", this.homeIn, this.hHome)
    ]));
    card.appendChild(h("div", { "class": "stack", style: "gap:12px;border-top:1px solid var(--line);padding-top:12px" }, [
      h("span", { "class": "h3", text: "Valeurs réelles (facultatif)" }),
      fld("Électricité des locaux d’après les factures (kWh par an)", this.elecIn, this.hElec),
      fld("Gaz des locaux d’après les factures (kWh par an)", this.gasIn, this.hGas),
      fld("Bilan carbone annuel hors IA (t CO₂e)", this.bilanIn, this.hBilan)
    ]));
    card.appendChild(h("div", { "class": "row" }, [h("button", { type: "button", "class": "btn", text: "Rétablir les valeurs de départ", onclick: function () {
      var st = A.S(); st.base = M.defaultBase(); st.orgFootprint = null; self.syncInputs(true); A.touchUI();
    } })]));
    side.appendChild(card);
  },

  /* recopie l’état dans les champs, sauf celui que l’utilisateur est en train de modifier */
  syncInputs: function (force) {
    var S = A.S(), B = S.base, pairs = [[this.staffIn, B.staff], [this.areaIn, B.area], [this.homeIn, Math.round(B.homeShare * 100)],
      [this.elecIn, B.elecKWh != null ? B.elecKWh : ""], [this.gasIn, B.gasKWh != null ? B.gasKWh : ""], [this.bilanIn, S.orgFootprint != null ? S.orgFootprint : ""]];
    pairs.forEach(function (p) { if (force || p[0] !== document.activeElement) p[0].value = p[1]; });
  },

  setMult: function (m, fromSlider) {
    var UI = A.UI(); UI.cmpM = clamp(m, 1, 1000);
    if (!fromSlider) this.slider.value = Math.log10(UI.cmpM);
    A.touchUI();
  },

  buildCurve: function (w) {
    var self = this, row = this.rows[A.UI().cmpRow];
    var svg = curveChart(w, row, A.UI().cmpM, { set: function (m) { self.setMult(m, false); } });
    this.curve = svg;
    return svg;
  },

  whatIfTable: function () {
    this.curve = null;
    var rows = this.rows, mults = [1, 2, 3, 5, 10, 20, 50, 100, 300, 1000];
    return {
      head: ["Usage multiplié par"].concat(rows.map(function (r) { return r.short; })),
      rows: mults.map(function (m) {
        return ["×" + NB + m.toLocaleString("fr-FR")].concat(rows.map(function (r) { var q = M.shareAt(r, m); return pc(q.p50) + " (" + pc(q.p5) + " – " + pc(q.p95) + ")"; }));
      }),
      num: [false, true, true, true, true]
    };
  },

  update: function () {
    var UI = A.UI(), S = A.S(), mc = A.MC(), mcb = A.MCB();
    this.rows = M.compare(mc, mcb);
    UI.cmpRow = clamp(Math.round(+UI.cmpRow || 0), 0, this.rows.length - 1);
    UI.cmpM = clamp(+UI.cmpM || 1, 1, 1000);
    /* les figures et les textes ne sont refaits que si les données, l’indicateur ou la largeur ont changé ;
       un simple déplacement du curseur ne touche que le repère mobile, pour ne pas lui retirer le focus */
    var key = [mcb.key, UI.cmpRow, UI.texture ? 1 : 0, Math.round(this.root.getBoundingClientRect().width), A.measureEpoch].join("|");
    if (this.lastMC !== mc || this.lastKey !== key) {
      this.renderAll(S, UI, mc, mcb);
      this.lastMC = mc; this.lastKey = key;
    } else if (this.curve) {
      this.curve.moveCursor(UI.cmpM);
    }
    this.syncInputs(false);
    this.renderReadout(UI);
  },

  /* texte et valeurs sous le curseur */
  renderReadout: function (UI) {
    var self = this;
    if (document.activeElement !== this.slider) this.slider.value = Math.log10(UI.cmpM);
    this.multOut.textContent = fmtMult(UI.cmpM);
    this.rows.forEach(function (r, i) {
      var q = M.shareAt(r, UI.cmpM);
      self.readCells[i].v.textContent = pc(q.p50);
      self.readCells[i].g.textContent = "de " + pc(q.p5) + " à " + pc(q.p95);
    });
  },

  renderAll: function (S, UI, mc, mcb) {
    var self = this, B = S.base, rows = this.rows, cur = rows[UI.cmpRow], nU = A.persons(S);

    /* aides sous les champs */
    var elecOff = rows[0].items[0].stats, gasOff = find(rows[1], "gasOff").stats;
    this.hStaff.textContent = nb("Entre 25 et 30 personnes selon la période ; l’IA est comptée pour " + nU + " " + pl(nU, "personne", "personnes") + " dans l’onglet Scénario.");
    this.hArea.textContent = nb("Total des trois sites, soit " + fn(B.staff > 0 ? B.area / B.staff : 0, 2) + " m² par personne.");
    var hd = Math.round(mcb.homeDays);
    this.hHome.textContent = nb("Soit " + fn(hd, 3) + " jours de télétravail par an pour l’équipe, et " + fn(B.staff > 0 ? hd / B.staff : 0, 2) + " par personne.");
    this.hElec.textContent = nb(B.elecKWh != null ? "Valeur saisie utilisée, avec une incertitude de ±5 %." : "Estimation actuelle : " + fv(0, elecOff.p50) + " (de " + M.fmtRange(0, elecOff.p5, elecOff.p95, 2) + ").");
    this.hGas.textContent = nb(B.gasKWh != null ? (B.gasKWh === 0 ? "Aucun gaz : l’estimation par postes est remplacée par zéro." : "Valeur saisie utilisée, avec une incertitude de ±5 %.") : "Estimation actuelle : " + fv(0, gasOff.p50) + " (de " + M.fmtRange(0, gasOff.p5, gasOff.p95, 2) + ").");
    var coBase = rows[2].base;
    this.hBilan.textContent = nb(S.orgFootprint != null ? "Ce total remplace l’estimation par postes, avec une incertitude de −20 % à +25 %." : "Estimation actuelle : " + fv(1, coBase.p50) + " (de " + M.fmtRange(1, coBase.p5, coBase.p95, 2) + "), soit " + fn(coBase.p50 / 1e6 / Math.max(1, B.staff), 2) + " t par personne.");

    /* lecture */
    A.clear(this.read);
    readingParagraphs(rows, S, mcb).forEach(function (t) { self.read.appendChild(h("p", { text: nb(t) })); });

    /* tuiles */
    A.clear(this.tiles);
    rows.forEach(function (r, i) {
      var t = h("button", { type: "button", "class": "kpi cmp-tile", "aria-pressed": UI.cmpRow === i ? "true" : "false", title: "Afficher cet indicateur dans les deux dernières figures" });
      t.appendChild(h("span", { "class": "k-label" }, [iconFor(r), r.short]));
      t.appendChild(h("span", { "class": "k-val" }, [pcNum(r.share.p50), h("small", { text: "%" })]));
      t.appendChild(h("span", { "class": "k-rng", text: nb("90 % des tirages : " + pcNum(r.share.p5) + " – " + pc(r.share.p95)) }));
      var track = h("span", { "class": "cmp-track", "aria-hidden": "true" });
      track.appendChild(h("span", { "class": "cmp-fill", style: "width:" + Math.max(0.6, r.share.p50 * 100).toFixed(2) + "%" }));
      track.appendChild(h("span", { "class": "cmp-span", style: "left:" + (r.share.p5 * 100).toFixed(2) + "%;width:" + Math.max(0.5, (r.share.p95 - r.share.p5) * 100).toFixed(2) + "%" }));
      t.appendChild(track);
      t.appendChild(h("span", { "class": "cmp-sub", text: nb(fv(r.ind, r.ai.p50) + " pour l’IA, contre " + fv(r.ind, r.base.p50) + " pour le reste de l’entreprise.") }));
      t.addEventListener("click", function () { UI.cmpRow = i; A.touchUI(); });
      self.tiles.appendChild(t);
    });

    /* figure A : composition de chaque impact */
    A.clear(this.figA);
    var used = {}; rows.forEach(function (r) { used.ai = true; r.items.forEach(function (it) { used[it.key] = true; }); });
    var segs = KEYS.map(segOf), legendItems = KEYS.filter(function (k) { return used[k]; }).map(function (k) { return { label: segOf(k).label, slot: segOf(k).slot }; });
    this.figA.appendChild(A.figure({
      id: "cmp-shares",
      title: "Qui pèse combien dans chaque impact",
      sub: "Chaque barre représente 100 % de l’impact total d’Énergies Demain, IA comprise, calculé sur les valeurs médianes : le premier segment, à gauche, est l’usage de Claude et les suivants sont les postes du reste de l’entreprise. Survoler un segment affiche sa valeur et son intervalle à 90 %.",
      legend: legendItems,
      build: function (w) {
        var rr = rows.map(function (r) {
          var parts = KEYS.map(function (k) {
            var st, frac, label = segOf(k).label;
            if (k === "ai") { st = r.ai; frac = r.aiFrac; label = "IA (Claude)"; }
            else { var it = find(r, k); if (!it) return { frac: 0 }; st = it.stats; frac = it.frac; label = it.label; }
            var note = k === "ai" ? NOTES.ai : (r.id === "water" ? WATER_NOTE : NOTES[k]);
            return { frac: frac, text: frac >= 0.08 ? pc(frac) : "", aria: r.label + ", " + label + " : " + pc(frac),
              tip: { title: r.label + " · " + label, rows: [{ k: "Valeur médiane", v: fv(r.ind, st.p50), color: A.col(segOf(k).slot) }, { k: "90 % des tirages", v: M.fmtRange(r.ind, st.p5, st.p95, 2) }, { k: "Part du total (médianes)", v: pc(frac) }], note: note } };
          });
          return { label: r.label, end: "IA " + pc(r.aiFrac), parts: parts };
        });
        return A.stackedBars(w, rr, segs, { endW: w >= 600 ? 82 : 74, strongLabels: true, aria: "Part de l’IA et des postes du reste de l’entreprise dans chaque impact" });
      },
      table: function () {
        return { head: ["Indicateur", "IA (médiane)", "Reste de l’entreprise (médiane)", "Part de l’IA", "Part de l’IA, 90 % des tirages"],
          rows: rows.map(function (r) { return [r.label, fv(r.ind, r.ai.p50), fv(r.ind, r.base.p50), pc(r.share.p50), pc(r.share.p5) + " – " + pc(r.share.p95)]; }),
          num: [false, true, true, true, true] };
      },
      foot: "Les segments reposent sur les valeurs médianes de chaque poste, alors que la part indiquée dans les tuiles est la médiane des rapports calculés tirage par tirage, d’où de légers écarts. La matière n’est pas comparée, faute d’estimation pour le reste de l’entreprise."
    }));

    /* figure C : poste par poste, axe logarithmique */
    A.clear(this.figC);
    var ind = cur.ind;
    this.figC.appendChild(A.figure({
      id: "cmp-posts",
      title: "L’IA poste par poste : " + cur.label.toLowerCase(),
      sub: "Chaque ligne indique la valeur médiane d’un poste et son intervalle à 90 % sur une échelle logarithmique ; deux postes dont les intervalles se chevauchent ne se distinguent pas avec certitude. La première ligne est l’usage de Claude.",
      build: function (w) {
        var rr = [], all = [{ key: "ai", label: "IA (Claude)", slot: 0, stats: cur.ai }].concat(cur.items);
        all.forEach(function (it) {
          if (!(it.stats.p50 > 0)) return;
          var note = it.key === "ai" ? NOTES.ai : (cur.id === "water" ? WATER_NOTE : NOTES[it.key]);
          rr.push({ label: it.label, slot: it.slot, lo: Math.max(it.stats.p5, it.stats.p50 * 0.05), mid: it.stats.p50, hi: it.stats.p95, right: fv(ind, it.stats.p50),
            aria: it.label + " : " + fv(ind, it.stats.p50),
            tip: { title: cur.label + " · " + it.label, rows: [{ k: "Valeur médiane", v: fv(ind, it.stats.p50), color: A.col(it.slot) }, { k: "90 % des tirages", v: M.fmtRange(ind, it.stats.p5, it.stats.p95, 2) }], note: note } });
        });
        rr.sort(function (a, b) { return a.slot === 0 ? -1 : b.slot === 0 ? 1 : b.mid - a.mid; });
        return A.rangeRows(w, rr, { aria: "Valeur de l’IA et de chaque poste du reste de l’entreprise, " + cur.label.toLowerCase(), tick: function (v) { return fv(ind, v); } });
      },
      table: function () {
        var all = [{ label: "IA (Claude)", stats: cur.ai }].concat(cur.items);
        return { head: ["Poste", "Médiane", "Intervalle à 90 %"], rows: all.map(function (it) { return [it.label, fv(ind, it.stats.p50), M.fmtRange(ind, it.stats.p5, it.stats.p95, 2)]; }), num: [false, true, true] };
      }
    }));

    /* les figures A et C viennent d’être créées ; la figure B, construite une fois, est redessinée dès le deuxième passage */
    var firstPass = !this.figBDone;
    A.flushFigures();
    if (!firstPass) this.figBFig.render();
    this.figBDone = true;

    /* multiplicateurs d’équilibre */
    A.clear(this.beBox);
    this.beBox.appendChild(h("h3", { "class": "h3", text: "De combien faudrait-il multiplier l’usage pour que l’IA compte ?" }));
    var be = rows.map(function (r) {
      function cell(f) {
        var m50 = M.multiplierFor(r, f), lo = M.multiplierFor(r, f, "p95"), hi = M.multiplierFor(r, f, "p5");
        if (m50 <= 1) return "déjà atteint (part médiane de " + pc(r.share.p50) + ")";
        return fmtX(m50) + " (de " + fmtX(lo) + " à " + fmtX(hi) + ")";
      }
      return [r.label, pc(r.share.p50) + " (" + pc(r.share.p5) + " – " + pc(r.share.p95) + ")", cell(0.1), cell(0.5)];
    });
    this.beBox.appendChild(A.tableEl({ head: ["Indicateur", "Part de l’IA aujourd’hui", "Pour atteindre 10 %", "Pour atteindre 50 %"], rows: be.map(function (r) { return r.map(nb); }), num: [false, true, true, true], stack: [12, 12, 12, 12], labels: ["", "Part de l’IA aujourd’hui", "Pour atteindre 10 %", "Pour atteindre 50 %"] }));
    this.beBox.appendChild(para("Chaque cellule donne le facteur médian et, entre parenthèses, l’intervalle à 90 % qui découle des incertitudes cumulées de l’IA et de l’entreprise ; un facteur inférieur à ×1 signifie que le seuil est déjà dépassé dans ce cas de figure.", "hint"));

    /* limites */
    A.clear(this.limits);
    this.limits.appendChild(h("h3", { "class": "h3", text: "Ce que cette comparaison ne dit pas" }));
    var potable = B.staff * S.workdays * (1 - B.homeShare) * M.OFFICE_WATER_L_PER_DAY / 1000;
    var cifFr = M.gridById("fr").cif, cifUs = M.gridById("us_lb").cif, cifSc = M.cifOf(S), gridLine;
    if (S.grid === "fr") {
      gridLine = "Le scénario retient le réseau français pour l’IA, alors qu’Anthropic ne publie pas le lieu de ses calculs : avec le réseau moyen des États-Unis, les émissions de l’IA seraient environ " + fn(cifUs / cifFr, 2) + " fois plus élevées et l’eau évaporée pour produire son électricité environ quatre fois plus importante.";
    } else if (cifSc > cifFr * 1.05) {
      gridLine = "Les parts dépendent du lieu des calculs de l’IA, qu’Anthropic ne publie pas : avec le réseau français, chaque kWh de l’IA émettrait environ " + fn(cifSc / cifFr, 2) + " fois moins de carbone que dans le scénario actuel (« " + M.gridById(S.grid).label + " »), et l’eau évaporée pour produire cette électricité serait ramenée à environ 1 L/kWh.";
    } else {
      gridLine = "Les parts dépendent du lieu des calculs de l’IA, qu’Anthropic ne publie pas ; l’onglet Scénario permet de tester d’autres réseaux électriques.";
    }
    var lim = [
      "Les deux membres de la comparaison reposent sur des repères différents : l’IA est une transposition d’études publiées à des services dont Anthropic ne divulgue ni le matériel ni les sites, tandis que le reste de l’entreprise est une estimation par m² et par personne, à remplacer par les factures et le bilan réels dès qu’ils sont disponibles.",
      "Pour l’eau, l’IA est comptée avec l’eau évaporée sur le site de calcul, pour produire son électricité et pour fabriquer le matériel, alors que le reste de l’entreprise l’est seulement par l’eau évaporée pour produire son électricité : celle du gaz et celle des achats ne sont pas estimées, ce qui tend à surestimer la part de l’IA. L’eau potable des bureaux (de l’ordre de " + fn(potable, 2) + " m³ par an d’après 38 litres par salarié et par jour à Paris) est prélevée sur le réseau puis rendue pour l’essentiel à l’assainissement ; ce volume ne se compare donc pas à ceux des figures.",
      "La matière n’est pas comparée : l’indicateur d’épuisement des ressources minérales de l’IA n’a pas d’équivalent estimé pour le matériel, le bâtiment et le mobilier de l’entreprise.",
      "Une part n’est ni une responsabilité ni un bilan net. L’IA peut éviter des déplacements ou du temps de travail, ou au contraire susciter des livrables supplémentaires ; ces effets de substitution et de rebond ne sont pas modélisés (voir l’onglet Autres impacts).",
      gridLine
    ];
    var ul = h("ul", { "class": "stack", style: "padding-left:1.1em;gap:8px;margin:0;color:var(--ink-2);font-size:13.5px;max-width:78ch" });
    lim.forEach(function (t) { ul.appendChild(h("li", { text: nb(t) })); });
    this.limits.appendChild(ul);

    /* méthode, paramètres et sources (état ouvert ou fermé conservé) */
    if (!this.detail.firstChild) this.buildDetail();
  },

  buildDetail: function () {
    var box = this.detail;
    box.appendChild(h("h3", { "class": "h3", text: "Comment le reste de l’entreprise est estimé" }));
    box.appendChild(h("pre", { "class": "formula", tabindex: "0", text:
      "Énergie finale des locaux (kWh) = surface × énergie finale par m²\n" +
      "   gaz = part de gaz × énergie finale\n" +
      "   électricité = énergie finale − gaz\n" +
      "   (chacune est remplacée par la valeur saisie d’après les factures, si elle existe)\n\n" +
      "Télétravail (kWh) = effectif × jours de travail × part à domicile\n" +
      "                    × énergie supplémentaire par jour\n" +
      "   répartie entre électricité et gaz comme dans les locaux\n\n" +
      "Carbone (g) = électricité × facteur électricité + gaz × facteur gaz\n" +
      "              + effectif × (déplacements + achats + numérique)\n" +
      "   ou le bilan carbone saisi, avec une incertitude de −20 % à +25 %\n\n" +
      "Eau (L) = électricité × eau évaporée pour produire un kWh en France\n\n" +
      "Part de l’IA = IA / (IA + reste de l’entreprise), calculée sur chacun\n" +
      "des 2 500 tirages puis résumée par ses quantiles" }));
    box.appendChild(para("Les paramètres du reste de l’entreprise suivent la même loi que ceux de l’IA (log-normale asymétrique ajustée sur P5, médiane et P95) et sont tirés indépendamment de ceux de l’IA avec une graine fixe. Les incertitudes retenues pour les postes d’émissions sont larges, parce qu’elles reposent sur un seul bilan de référence (celui de l’I4CE, qui compte 41 équivalents temps plein) et sur des ratios monétaires.", "muted small"));
    var tb = h("table", { "class": "tbl" });
    tb.appendChild(h("thead", null, h("tr", null, ["Paramètre", "Unité", "P5", "Médiane", "P95", "Confiance"].map(function (c, i) { return h("th", { scope: "col", "class": i >= 2 && i <= 4 ? "r" : "", text: c }); }))));
    var body = h("tbody"), last = null;
    M.BASE_PARAMS.forEach(function (q) {
      if (q.group !== last) { last = q.group; body.appendChild(h("tr", null, h("td", { colspan: 6, style: "padding-top:14px;font-weight:600;color:var(--ink)", text: M.BASE_GROUPS[q.group] }))); }
      function f(v) { return (q.pct ? v * 100 : v).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: q.digits }); }
      body.appendChild(h("tr", null, [
        h("td", { "class": "wrapc" }, [h("div", { text: q.label }), h("details", { "class": "d-mini" }, [h("summary", { text: "Justification" }), h("p", { text: nb(q.src) })])]),
        h("td", { text: q.unit.replace("CO2e", "CO₂e") }),
        h("td", { "class": "r", text: f(q.p5) }), h("td", { "class": "r", text: f(q.p50) }), h("td", { "class": "r", text: f(q.p95) }),
        h("td", { title: "Confiance " + CONF[q.conf] }, h("span", { "class": "dots", "aria-label": "Confiance : " + CONF[q.conf], text: CONF_DOTS[q.conf] }))
      ]));
    });
    tb.appendChild(body);
    A.stack(tb, [12, 3, 3, 3, 3, 4], ["", "Unité", "P5", "Médiane", "P95", "Confiance"]);
    box.appendChild(h("div", { "class": "tscroll" }, tb));
    box.appendChild(h("h3", { "class": "h3", text: "Sources du reste de l’entreprise", style: "margin-top:6px" }));
    var ol = h("ol", { "class": "src-list" });
    M.BASE_SOURCES.concat([["ADEME, Base Empreinte (facteurs d’émission de l’électricité et du gaz)", "https://base-empreinte.ademe.fr/", ""]]).forEach(function (r) {
      ol.appendChild(h("li", null, [link(r[0], r[1]), r[2] ? h("span", { "class": "hint", text: " — " + r[2] }) : null]));
    });
    box.appendChild(ol);
  }
};

})();
