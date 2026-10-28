/* ============================================================================
   Interface — noyau : outils DOM, état, info-bulle, cartes de figures
   ========================================================================== */
(function () {
"use strict";
var M = window.EDM;
var App = window.EDApp = {};

/* ------------------------------------------------------------ outils DOM */
function append(e, ch) {
  if (ch == null || ch === false) return;
  if (!Array.isArray(ch)) ch = [ch];
  for (var i = 0; i < ch.length; i++) {
    var c = ch[i];
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(e, c);
    else e.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
  }
}
function h(tag, props, ch) {
  var e = document.createElement(tag);
  if (props) for (var k in props) {
    var v = props[k];
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else if (k.slice(0, 2) === "on" && typeof v === "function") e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  append(e, ch);
  return e;
}
var SVGNS = "http://www.w3.org/2000/svg";
function s(tag, attrs, ch) {
  var e = document.createElementNS(SVGNS, tag);
  if (attrs) for (var k in attrs) {
    var v = attrs[k];
    if (v == null || v === false) continue;
    if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else if (k === "text") e.textContent = v;
    else e.setAttribute(k, v);
  }
  append(e, ch);
  return e;
}
function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }
function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
function sum(a) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i]; return t; }
function pl(n, one, many) { return Math.abs(n) < 2 ? one : many; }
function cap(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

App.h = h; App.s = s; App.clear = clear; App.clamp = clamp; App.sum = sum; App.pl = pl; App.cap = cap; App.append = append;

/* --------------------------------------------------------------- état */
var LS_KEY = "ed-ia-empreinte-v2", LS_OLD = "ed-ia-empreinte-v1";
var S = null, UI = null, MC = null;

function defaultUI() {
  var forced = false;
  try { forced = window.matchMedia("(forced-colors: active)").matches; } catch (e) {}
  return { tab: "synthese", ind: 0, texture: forced, table: {}, cell: [2, 2], taskSort: "p50", cmpRow: 0, cmpM: 1 };
}

function loadStore() {
  S = null; UI = null;
  try {
    var raw = window.localStorage.getItem(LS_KEY);
    if (raw) {
      var o = JSON.parse(raw);
      S = M.sanitizeState(o.S);
      UI = Object.assign(defaultUI(), o.UI || {});
    } else {
      /* première ouverture après la révision des valeurs par défaut : on garde les préférences d’affichage, pas l’ancien scénario */
      var rawOld = window.localStorage.getItem(LS_OLD);
      if (rawOld) {
        var o0 = JSON.parse(rawOld);
        S = M.defaultState();
        UI = Object.assign(defaultUI(), o0.UI || {});
      }
    }
  } catch (e) { S = null; }
  if (!S) { S = M.defaultState(); UI = defaultUI(); }
  if (typeof UI.table !== "object" || !UI.table) UI.table = {};
  UI.ind = clamp(+UI.ind || 0, 0, 3);
  if (!Array.isArray(UI.cell) || UI.cell.length !== 2) UI.cell = [2, 2];
  UI.cmpRow = clamp(Math.round(+UI.cmpRow || 0), 0, M.CMP_ROWS.length - 1);
  UI.cmpM = clamp(+UI.cmpM || 1, 1, 1000);
}
function saveStore() {
  try { window.localStorage.setItem(LS_KEY, JSON.stringify({ S: S, UI: UI })); } catch (e) {}
}
loadStore();

App.S = function () { return S; };
App.UI = function () { return UI; };
App.setState = function (ns) { S = M.sanitizeState(ns); MC = null; saveStore(); };
App.resetState = function () { S = M.defaultState(); MC = null; saveStore(); };
App.MC = function () { if (!MC) MC = M.runMC(S, { N: 2500 }); return MC; };

/* Simulation du reste de l’entreprise : recalculée seulement si l’un de ses paramètres a changé. */
var MCB = null;
App.MCB = function () {
  var key = M.baseKey(S);
  if (!MCB || MCB.key !== key) MCB = M.runBase(S, { N: 2500 });
  return MCB;
};

var updaters = [], post = [];
var raf = 0;
App.onUpdate = function (fn) { updaters.push(fn); };
/* Actions à exécuter une fois la prochaine mise à jour terminée (par exemple faire défiler la page quand l’onglet est construit). */
App.afterUpdate = function (fn) { post.push(fn); };
function runUpdaters() {
  raf = 0;
  updaters.forEach(function (f) { f(); });
  var q = post; post = [];
  q.forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
}
App.touch = function (opt) {
  MC = null; saveStore();
  if (raf) return;
  raf = window.requestAnimationFrame(runUpdaters);
};
App.touchUI = function () {
  saveStore();
  if (raf) return;
  raf = window.requestAnimationFrame(runUpdaters);
};

/* --------------------------------------------------------- formatage */
App.fv = M.fmtVal; App.fn = M.fmtNum; App.pct = M.fmtPct;
App.ind = M.INDICATORS;
App.NB = M.NBSP;

App.cellLabel = function (p, i) { return M.PERSONAS[p].label + " · " + M.INTENSITIES[i].label.toLowerCase(); };

/* ---------------------------------------------------- mesure de texte */
var mctx = null, mcache = {};
App.textW = function (str, size, weight) {
  size = size || 12; weight = weight || 400;
  var key = size + "|" + weight + "|" + str;
  if (mcache[key] != null) return mcache[key];
  if (!mctx) { try { mctx = document.createElement("canvas").getContext("2d"); } catch (e) { mctx = null; } }
  var w;
  if (mctx) { mctx.font = weight + " " + size + 'px "IBM Plex Sans", system-ui, sans-serif'; w = mctx.measureText(str).width; }
  else w = str.length * size * 0.56;
  mcache[key] = w; return w;
};
App.measureEpoch = 0;
App.resetMeasure = function () { mcache = {}; App.measureEpoch++; };

/* -------------------------------------------------------- info-bulle */
var tipEl = null;
function ensureTip() {
  if (!tipEl) { tipEl = h("div", { "class": "tip", role: "tooltip", hidden: true }); document.body.appendChild(tipEl); }
  return tipEl;
}
function tipContent(spec) {
  var el = ensureTip(); clear(el);
  if (spec.title) el.appendChild(h("div", { "class": "tt", text: spec.title }));
  (spec.rows || []).forEach(function (r) {
    var left = h("span", null, [r.color ? h("i", { "class": "tk", style: "background:" + r.color }) : null, r.k]);
    el.appendChild(h("div", { "class": "tr" }, [left, h("b", { text: r.v })]));
  });
  if (spec.note) el.appendChild(h("div", { "class": "tn", text: spec.note }));
}
function placeTip(x, y) {
  var el = tipEl, w = el.offsetWidth, hh = el.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
  var px = x + 14, py = y + 16;
  if (px + w > vw - 8) px = Math.max(8, x - w - 14);
  if (py + hh > vh - 8) py = Math.max(8, y - hh - 14);
  el.style.left = px + "px"; el.style.top = py + "px";
}
function hideTip() { if (tipEl) tipEl.hidden = true; }
App.hideTip = hideTip;
App.bindTip = function (node, getSpec) {
  node.addEventListener("pointerenter", function (e) {
    if (e.pointerType === "touch") return;
    tipContent(getSpec()); tipEl.hidden = false; placeTip(e.clientX, e.clientY);
  });
  node.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    if (tipEl && !tipEl.hidden) placeTip(e.clientX, e.clientY);
  });
  node.addEventListener("pointerleave", hideTip);
  node.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "touch") { tipContent(getSpec()); tipEl.hidden = false; placeTip(e.clientX, Math.max(8, e.clientY - 60)); }
  });
  node.addEventListener("focus", function () {
    var r = node.getBoundingClientRect();
    tipContent(getSpec()); tipEl.hidden = false; placeTip(r.left + r.width / 2, r.top - 8);
  });
  node.addEventListener("blur", hideTip);
};
document.addEventListener("pointerdown", function (e) {
  if (e.pointerType === "touch" && !(e.target.closest && e.target.closest(".mark"))) hideTip();
}, true);
document.addEventListener("scroll", hideTip, true);

/* ------------------------------------------------------ couleurs, légende */
App.col = function (slot) { return "var(--c" + slot + ")"; };
App.onCol = function (slot) { return "var(--on-c" + slot + ")"; };

App.legend = function (items) {
  return h("div", { "class": "legend" }, items.map(function (it) {
    /* le rang 0 (couleur d’accent, réservé à l’IA dans l’onglet Comparaison) n’a pas de motif, comme dans les figures */
    var cls = "sw" + (UI.texture && it.slot ? " tex" + (it.slot % 2 === 0 ? " alt" : "") : "");
    return h("span", { "class": "lg" }, [h("i", { "class": cls, style: "background:" + (it.color || App.col(it.slot)) }), it.label]);
  }));
};

/* ------------------------------------------------------------- tableaux */
/* Mode « cartes » des tableaux sur écran étroit (règles .tbl.stk de la feuille de style).
   spans : largeur de chaque cellule en douzièmes de ligne (0 = cellule masquée) ;
   labels : intitulé affiché au-dessus de la valeur (vide = aucun) ; o.bold : première cellule en gras. */
App.stack = function (tb, spans, labels, o) {
  tb.classList.add("stk");
  if (o && o.bold) tb.classList.add("stk-b");
  tb.setAttribute("role", "table");
  Array.prototype.forEach.call(tb.querySelectorAll("thead, tbody, tfoot"), function (g) { g.setAttribute("role", "rowgroup"); });
  Array.prototype.forEach.call(tb.rows, function (tr) {
    tr.setAttribute("role", "row");
    var head = tr.parentNode.tagName === "THEAD";
    Array.prototype.forEach.call(tr.cells, function (c, i) {
      c.setAttribute("role", head ? "columnheader" : "cell");
      if (head || tr.cells.length !== spans.length) return; /* lignes de titre de groupe : un seul bloc */
      App.setSpan(c, spans[i]);
      if (labels && labels[i] && i > 0) c.setAttribute("data-label", labels[i]);
    });
  });
  return tb;
};
App.setSpan = function (cell, n) {
  cell.className = cell.className.replace(/\b(k\d+|stk-off)\b/g, "").replace(/\s+/g, " ").trim();
  cell.className += (cell.className ? " " : "") + (n === 0 ? "stk-off" : "k" + n);
};

App.tableEl = function (t) {
  var thead = h("thead", null, h("tr", null, t.head.map(function (c, i) {
    return h("th", { "class": t.num && t.num[i] ? "r" : "", scope: "col", text: c });
  })));
  var tbody = h("tbody", null, t.rows.map(function (r) {
    return h("tr", null, r.map(function (c, i) {
      return h("td", { "class": t.num && t.num[i] ? "r" : "", text: c });
    }));
  }));
  var tb = h("table", { "class": "tbl" }, [thead, tbody]);
  /* à partir de quatre colonnes, ou sur demande, le tableau devient une suite de cartes sur écran étroit */
  var n = t.head.length, spans = t.stack;
  if (!spans && n >= 4) { spans = [12]; for (var i = 1; i < n; i++) spans.push(Math.floor(12 / (n - 1))); }
  if (spans) App.stack(tb, spans, t.labels || t.head, { bold: true });
  return h("div", { "class": "tscroll" }, tb);
};

/* --------------------------------------------------- cartes de figures */
var pendingFigs = [];
App.figure = function (o) {
  var root = h("figure", { "class": "fig" });
  var body = h("div", { "class": "fig-body" });
  var seg = null;
  function renderBody() {
    clear(body);
    if (o.table && UI.table[o.id]) { body.appendChild(App.tableEl(o.table())); return; }
    var w = Math.max(260, Math.floor(body.getBoundingClientRect().width || root.getBoundingClientRect().width || 600));
    var node = o.build(w);
    if (node) body.appendChild(node);
  }
  if (o.table) {
    var bG = h("button", { type: "button", "aria-pressed": UI.table[o.id] ? "false" : "true", text: "Graphique" });
    var bT = h("button", { type: "button", "aria-pressed": UI.table[o.id] ? "true" : "false", text: "Tableau" });
    function setView(tbl) {
      UI.table[o.id] = tbl; App.touchUI0();
      bG.setAttribute("aria-pressed", tbl ? "false" : "true"); bT.setAttribute("aria-pressed", tbl ? "true" : "false");
      renderBody();
    }
    bG.addEventListener("click", function () { setView(false); });
    bT.addEventListener("click", function () { setView(true); });
    seg = h("div", { "class": "seg view-toggle", role: "group", "aria-label": "Mode d’affichage de la figure" }, [bG, bT]);
  }
  var head = h("div", { "class": "fig-head" }, [
    h("div", { "class": "fig-title" }, [h("h3", { text: o.title }), o.sub ? h("p", { "class": "fig-sub", text: o.sub }) : null]),
    seg
  ]);
  root.appendChild(head);
  if (o.extra) root.appendChild(o.extra);
  root.appendChild(body);
  if (o.legend) root.appendChild(App.legend(o.legend));
  if (o.foot) root.appendChild(h("p", { "class": "fig-foot", text: o.foot }));
  root.render = renderBody;
  pendingFigs.push(root);
  return root;
};
App.touchUI0 = function () { saveStore(); };
App.flushFigures = function () {
  var l = pendingFigs; pendingFigs = [];
  l.forEach(function (f) { if (f.isConnected) f.render(); });
};

/* ------------------------------------------------------------ primitives SVG */
/* Rectangle plein avec arrondi optionnel côté donnée ; ajoute la texture si activée. */
App.roundedPath = function (x, y, w, hh, r, side) {
  /* side : "r" arrondi à droite, "l" à gauche, "t" en haut, "b" en bas, "" aucun */
  r = Math.min(r, w / 2, hh / 2);
  if (!side || r <= 0) return "M" + x + " " + y + "h" + w + "v" + hh + "h" + (-w) + "z";
  if (side === "r") return "M" + x + " " + y + "h" + (w - r) + "a" + r + " " + r + " 0 0 1 " + r + " " + r + "v" + (hh - 2 * r) + "a" + r + " " + r + " 0 0 1 " + (-r) + " " + r + "h" + (-(w - r)) + "z";
  if (side === "l") return "M" + (x + r) + " " + y + "h" + (w - r) + "v" + hh + "h" + (-(w - r)) + "a" + r + " " + r + " 0 0 1 " + (-r) + " " + (-r) + "v" + (-(hh - 2 * r)) + "a" + r + " " + r + " 0 0 1 " + r + " " + (-r) + "z";
  return "M" + x + " " + y + "h" + w + "v" + hh + "h" + (-w) + "z";
};

App.mark = function (g, d, slot, opts) {
  opts = opts || {};
  var p = s("path", { d: d, "class": "mark", style: { fill: opts.fill || App.col(slot) } });
  if (opts.label) { p.setAttribute("tabindex", "0"); p.setAttribute("role", "img"); p.setAttribute("aria-label", opts.label); }
  g.appendChild(p);
  if (UI.texture && slot) {
    g.appendChild(s("path", { d: d, style: { fill: "url(#" + (slot % 2 === 0 ? "tx-b" : "tx-a") + ")", pointerEvents: "none" } }));
  }
  return p;
};

/* Axe logarithmique : graduations à 1, 2, 5 par décade (ou décades seules si étroit). */
App.logTicks = function (lo, hi, maxCount) {
  var out = [], e0 = Math.floor(Math.log10(lo)), e1 = Math.ceil(Math.log10(hi));
  var steps = [1, 2, 5];
  for (var e = e0; e <= e1; e++) for (var k = 0; k < 3; k++) {
    var v = steps[k] * Math.pow(10, e);
    if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v);
  }
  if (out.length > maxCount) out = out.filter(function (v) { var m = v / Math.pow(10, Math.floor(Math.log10(v))); return Math.abs(m - 1) < 1e-9; });
  if (out.length > maxCount) { var f = Math.ceil(out.length / maxCount); out = out.filter(function (_, i) { return i % f === 0; }); }
  return out;
};

App.linTicks = function (max, count) {
  var raw = max / Math.max(1, count), mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
  var step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag, out = [];
  for (var v = 0; v <= max * 1.0001; v += step) out.push(v);
  return out;
};

/* Texte mis en forme pour un tick, dans l’unité propre à l’indicateur. */
App.tickLabel = function (ind, v) {
  var un = M.unitFor(ind, v);
  return M.fmtNum(v / un.div, 2) + " " + un.u;
};

/* Découpe un libellé en deux lignes au plus selon une largeur disponible. */
App.wrapText = function (text, maxW, size, weight) {
  if (App.textW(text, size, weight) <= maxW) return [text];
  var words = text.split(" "), l1 = "", i = 0;
  while (i < words.length && App.textW((l1 ? l1 + " " : "") + words[i], size, weight) <= maxW) { l1 += (l1 ? " " : "") + words[i]; i++; }
  var l2 = words.slice(i).join(" ");
  if (!l1) { l1 = words[0]; l2 = words.slice(1).join(" "); }
  if (App.textW(l2, size, weight) > maxW) {
    while (l2.length > 3 && App.textW(l2 + "…", size, weight) > maxW) l2 = l2.slice(0, -1);
    l2 += "…";
  }
  return [l1, l2];
};

})();
