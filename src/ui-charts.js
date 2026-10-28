/* ============================================================================
   Interface — graphiques SVG
   ========================================================================== */
(function () {
"use strict";
var M = window.EDM, A = window.EDApp;
var h = A.h, s = A.s, clamp = A.clamp;

function svgRoot(w, hh, aria) {
  return s("svg", { viewBox: "0 0 " + w + " " + hh, width: w, height: hh, role: "img", "aria-label": aria || "Graphique" });
}

/* Graduation de l’axe horizontal : l’étiquette reste dans le dessin, quitte à ne plus être centrée sur son trait. */
A.tickText = function (svg, x, y, text, width) {
  var tw = A.textW(text, 11.5, 400), anchor = "middle", lx = x;
  if (x - tw / 2 < 0) { anchor = "start"; lx = 0; } else if (x + tw / 2 > width) { anchor = "end"; lx = width; }
  svg.appendChild(s("text", { x: lx, y: y, "text-anchor": anchor, "class": "t-ax", text: text }));
};

/* Étiquette de ligne : à gauche (écran large) ou au-dessus de la barre (écran étroit). */
function rowLabel(svg, text, wide, labelW, y, midY, width, strong, maxW) {
  var cls = strong ? "t-strong" : "t-lb";
  if (wide) {
    var lines = A.wrapText(text, labelW - 14, 12.5, strong ? 600 : 400);
    if (lines.length === 1) svg.appendChild(s("text", { x: 0, y: midY + 4.5, "class": cls, text: lines[0] }));
    else {
      svg.appendChild(s("text", { x: 0, y: midY - 2, "class": cls, text: lines[0] }));
      svg.appendChild(s("text", { x: 0, y: midY + 12, "class": cls, text: lines[1] }));
    }
  } else {
    var l = A.wrapText(text, maxW || width, 12.5, strong ? 600 : 400);
    svg.appendChild(s("text", { x: 0, y: y + 13, "class": cls, text: l[0] }));
    if (l.length > 1) svg.appendChild(s("text", { x: 0, y: y + 27, "class": cls, text: l[1] }));
  }
}

/* Disposition verticale des lignes. Sur écran étroit, une étiquette qui tient sur deux lignes
   allonge sa ligne de 14 px : ys = ordonnée du haut de chaque ligne, ex = décalage, total = hauteur cumulée. */
function rowLayout(rows, baseH, wide, width, strong, maxW) {
  var ys = [], ex = [], y = 0;
  rows.forEach(function (r) {
    var e = (!wide && A.wrapText(r.label, maxW || width, 12.5, strong ? 600 : 400).length > 1) ? 14 : 0;
    ys.push(y); ex.push(e); y += baseH + e;
  });
  return { ys: ys, ex: ex, total: y };
}

/* ---------------------------------------------------------------------------
   Barres empilées horizontales (parts)
   rows : [{label, parts:[{frac, tip, aria}], end}], segs : [{label, slot}]
   -------------------------------------------------------------------------- */
A.stackedBars = function (width, rows, segs, o) {
  o = o || {};
  var wide = width >= 600;
  var labelW = wide ? Math.min(210, Math.round(width * 0.28)) : 0;
  var endW = o.endW || 0;
  var x0 = labelW, x1 = width - endW - 2;
  var barH = o.barH || 22, rowH = wide ? (o.rowH || 46) : (o.rowH2 || 62);
  var LY = rowLayout(rows, rowH, wide, width, o.strongLabels);
  var H = LY.total + 2;
  var svg = svgRoot(width, H, o.aria || "Barres empilées");
  rows.forEach(function (r, ri) {
    var y = LY.ys[ri], by = wide ? y + (rowH - barH) / 2 : y + 22 + LY.ex[ri];
    rowLabel(svg, r.label, wide, labelW, y, by + barH / 2, width, o.strongLabels);
    var g = s("g");
    var W = x1 - x0, cx = x0, last = -1, k;
    for (k = 0; k < r.parts.length; k++) if (r.parts[k].frac * W > 0.6) last = k;
    r.parts.forEach(function (p, pi) {
      var w = p.frac * W;
      if (w <= 0.6) return;
      var dw = pi === last ? w : Math.max(0.6, w - 2);
      var d = A.roundedPath(cx, by, dw, barH, 4, pi === last ? "r" : "");
      var sg = segs[pi], slot = sg.slot;
      var m = A.mark(g, d, slot, { label: p.aria || (r.label + " : " + sg.label), fill: sg.fill });
      A.bindTip(m, function () { return p.tip; });
      if (p.text && dw >= A.textW(p.text, 11.5, 600) + 12) {
        g.appendChild(s("text", { x: cx + dw / 2, y: by + barH / 2 + 4, "text-anchor": "middle", "class": "t-in", style: { fill: sg.on || A.onCol(slot), pointerEvents: "none" }, text: p.text }));
      }
      cx += w;
    });
    svg.appendChild(g);
    if (r.end) svg.appendChild(s("text", { x: x1 + 10, y: by + barH / 2 + 4.5, "class": "t-val", text: r.end }));
  });
  return svg;
};

/* ---------------------------------------------------------------------------
   Barres horizontales simples, avec moustaches facultatives (P5–P95)
   rows : [{label, slot, value, lo, hi, text, tip}]
   -------------------------------------------------------------------------- */
A.hBars = function (width, rows, o) {
  o = o || {};
  var wide = width >= 600;
  var labelW = wide ? Math.min(240, Math.round(width * 0.32)) : 0;
  var barH = o.barH || 18, rowH = wide ? (o.rowH || 32) : (o.rowH2 || 50);
  var LY = rowLayout(rows, rowH, wide, width, false);
  var maxV = o.max || Math.max.apply(null, rows.map(function (r) { return Math.max(r.hi || 0, r.value); })) || 1;
  var valW = Math.max.apply(null, rows.map(function (r) { return A.textW(r.text || "", 12.5, 600); })) + 14;
  var x0 = labelW, x1 = width - valW;
  var H = LY.total + 4;
  var svg = svgRoot(width, H, o.aria || "Barres");
  var xs = function (v) { return x0 + (v / maxV) * (x1 - x0); };
  svg.appendChild(s("line", { x1: x0 + 0.5, x2: x0 + 0.5, y1: 0, y2: H - 2, "class": "g-base" }));
  rows.forEach(function (r, ri) {
    var y = LY.ys[ri], by = wide ? y + (rowH - barH) / 2 : y + 22 + LY.ex[ri], mid = by + barH / 2;
    rowLabel(svg, r.label, wide, labelW, y, mid, width, false);
    var g = s("g");
    var w = Math.max(1, xs(r.value) - x0);
    var m = A.mark(g, A.roundedPath(x0 + 1, by, w, barH, 4, "r"), r.slot, { label: r.aria || (r.label + " : " + r.text) });
    A.bindTip(m, function () { return r.tip; });
    var endX = x0 + w;
    if (r.lo != null && r.hi != null && r.hi > r.lo) {
      var a = xs(r.lo), b = xs(r.hi);
      g.appendChild(s("line", { x1: a, x2: b, y1: mid, y2: mid, stroke: "var(--ink)", "stroke-width": 1.5, style: { pointerEvents: "none" } }));
      g.appendChild(s("line", { x1: a, x2: a, y1: mid - 4, y2: mid + 4, stroke: "var(--ink)", "stroke-width": 1.5, style: { pointerEvents: "none" } }));
      g.appendChild(s("line", { x1: b, x2: b, y1: mid - 4, y2: mid + 4, stroke: "var(--ink)", "stroke-width": 1.5, style: { pointerEvents: "none" } }));
      endX = Math.max(endX, b);
    }
    svg.appendChild(g);
    if (r.text) svg.appendChild(s("text", { x: endX + 8, y: mid + 4.5, "class": "t-val", text: r.text }));
  });
  return svg;
};

/* ---------------------------------------------------------------------------
   Plages P5–P95 avec médiane, axe logarithmique
   rows : [{label, slot, lo, mid, hi, right, tip}]
   -------------------------------------------------------------------------- */
A.rangeRows = function (width, rows, o) {
  var wide = width >= 640;
  var labelW = wide ? Math.min(260, Math.round(width * 0.34)) : 0;
  var rightW = wide ? Math.max.apply(null, rows.map(function (r) { return A.textW(r.right || "", 12.5, 600); })) + 14 : 0;
  /* écran étroit : la valeur de droite partage la première ligne de l’étiquette */
  var phoneMaxW = wide ? 0 : width - Math.max.apply(null, rows.map(function (r) { return A.textW(r.right || "", 12.5, 600); })) - 16;
  var rowH = wide ? 30 : 46, topPad = 4, axisH = 28;
  var LY = rowLayout(rows, rowH, wide, width, false, phoneMaxW), plotH = LY.total;
  var x0 = labelW + 4, x1 = width - rightW - 8;
  var min = o.min, max = o.max;
  if (min == null) { min = Math.min.apply(null, rows.map(function (r) { return r.lo; })); }
  if (max == null) { max = Math.max.apply(null, rows.map(function (r) { return r.hi; })); }
  min = Math.pow(10, Math.floor(Math.log10(min))); max = Math.pow(10, Math.ceil(Math.log10(max)));
  if (max <= min) max = min * 10;
  var lmin = Math.log10(min), lmax = Math.log10(max);
  var xs = function (v) { return x0 + (Math.log10(Math.max(v, min)) - lmin) / (lmax - lmin) * (x1 - x0); };
  var H = topPad + plotH + axisH;
  var svg = svgRoot(width, H, o.aria || "Plages d’incertitude");
  var ticks = A.logTicks(min, max, wide ? 9 : 5);
  var decades = ticks.filter(function (v) { return Math.abs(Math.log10(v) - Math.round(Math.log10(v))) < 1e-9; });
  ticks.forEach(function (v) {
    var isDec = decades.indexOf(v) >= 0;
    svg.appendChild(s("line", { x1: xs(v), x2: xs(v), y1: topPad, y2: topPad + plotH, "class": "g-grid", style: { opacity: isDec ? 1 : 0.55 } }));
    A.tickText(svg, xs(v), topPad + plotH + 16, o.tick ? o.tick(v) : String(v), width);
  });
  svg.appendChild(s("line", { x1: x0, x2: x1, y1: topPad + plotH + 0.5, y2: topPad + plotH + 0.5, "class": "g-base" }));
  (o.refs || []).forEach(function (rf) {
    if (rf.v < min || rf.v > max) return;
    svg.appendChild(s("line", { x1: xs(rf.v), x2: xs(rf.v), y1: topPad, y2: topPad + plotH, stroke: "var(--ink-3)", "stroke-width": 1, style: { pointerEvents: "none" } }));
    svg.appendChild(s("text", { x: xs(rf.v) + 4, y: topPad + 10, "class": "t-sub", text: rf.label, style: { pointerEvents: "none" } }));
  });
  rows.forEach(function (r, ri) {
    var y = topPad + LY.ys[ri], mid = wide ? y + rowH / 2 : y + 30 + LY.ex[ri];
    rowLabel(svg, r.label, wide, labelW, y, y + rowH / 2, width, false, phoneMaxW);
    var g = s("g");
    var a = xs(r.lo), b = xs(r.hi), m = xs(r.mid);
    g.appendChild(s("line", { x1: a, x2: b, y1: mid, y2: mid, stroke: A.col(r.slot), "stroke-width": 3, "stroke-linecap": "round", style: { pointerEvents: "none" } }));
    var hit = s("rect", { x: Math.min(a, m) - 8, y: mid - 14, width: Math.abs(b - a) + 16, height: 28, fill: "transparent", "class": "mark", tabindex: "0", role: "img", "aria-label": r.aria || r.label });
    A.bindTip(hit, function () { return r.tip; });
    g.appendChild(hit);
    g.appendChild(s("circle", { cx: m, cy: mid, r: 5, style: { fill: A.col(r.slot), stroke: "var(--surface)", strokeWidth: 2, pointerEvents: "none" } }));
    svg.appendChild(g);
    if (r.right) {
      if (wide) svg.appendChild(s("text", { x: x1 + 12, y: mid + 4.5, "class": "t-val", text: r.right }));
      else svg.appendChild(s("text", { x: width, y: y + 13, "text-anchor": "end", "class": "t-val", text: r.right }));
    }
  });
  return svg;
};

/* ---------------------------------------------------------------------------
   Histogramme (axe logarithmique) d’une série de valeurs positives
   -------------------------------------------------------------------------- */
A.histogram = function (width, values, o) {
  var st = o.stats;
  var H = 250, ml = 8, mr = 8, mt = 34, mb = 36;
  var svg = svgRoot(width, H, o.aria || "Distribution des résultats de la simulation");
  var sorted = M.sortedCopy(values), n = sorted.length;
  var lo = Math.max(M.quantileSorted(sorted, 0.004), 1e-30), hi = M.quantileSorted(sorted, 0.996);
  var lmin = Math.log10(lo), lmax = Math.log10(hi);
  var nb = clamp(Math.round((width - ml - mr) / 15), 18, 56), counts = new Array(nb).fill(0);
  for (var i = 0; i < n; i++) {
    var v = sorted[i]; if (v <= 0) continue;
    var b = Math.floor((Math.log10(v) - lmin) / (lmax - lmin) * nb);
    if (b < 0) b = 0; if (b >= nb) b = nb - 1;
    counts[b]++;
  }
  var cmax = Math.max.apply(null, counts);
  var x0 = ml, x1 = width - mr, plotH = H - mt - mb;
  var xs = function (v) { return x0 + (Math.log10(clamp(v, lo, hi)) - lmin) / (lmax - lmin) * (x1 - x0); };
  var bw = (x1 - x0) / nb;
  var ticks = A.logTicks(lo, hi, width < 520 ? 4 : 7);
  ticks.forEach(function (t) {
    svg.appendChild(s("line", { x1: xs(t), x2: xs(t), y1: mt, y2: mt + plotH, "class": "g-grid" }));
    A.tickText(svg, xs(t), mt + plotH + 17, o.tick(t), width);
  });
  svg.appendChild(s("line", { x1: x0, x2: x1, y1: mt + plotH + 0.5, y2: mt + plotH + 0.5, "class": "g-base" }));
  var g = s("g");
  counts.forEach(function (c, bi) {
    if (!c) return;
    var h0 = c / cmax * plotH, xl = x0 + bi * bw, vlo = Math.pow(10, lmin + bi / nb * (lmax - lmin)), vhi = Math.pow(10, lmin + (bi + 1) / nb * (lmax - lmin));
    var inside = vlo >= st.p5 * 0.999 && vhi <= st.p95 * 1.001;
    var mid = Math.sqrt(vlo * vhi), within = mid >= st.p5 && mid <= st.p95;
    var d = A.roundedPath(xl + 0.5, mt + plotH - h0, Math.max(1, bw - 1.5), h0, 3, "t");
    var m = s("path", { d: d, "class": "mark", style: { fill: within ? A.col(1) : "var(--line-2)" } });
    A.bindTip(m, function () {
      return { title: "Simulation", rows: [{ k: "Intervalle", v: o.tick(vlo) + " – " + o.tick(vhi) }, { k: "Part des tirages", v: A.pct(c / n, 1) }], note: within ? "Dans l’intervalle à 90 %." : "Hors de l’intervalle à 90 %." };
    });
    g.appendChild(m);
  });
  svg.appendChild(g);
  [["P5", st.p5, "start"], ["P50", st.p50, "middle"], ["P95", st.p95, "end"]].forEach(function (q) {
    var x = xs(q[1]);
    svg.appendChild(s("line", { x1: x, x2: x, y1: mt - 6, y2: mt + plotH, stroke: "var(--ink)", "stroke-width": q[0] === "P50" ? 2 : 1, style: { pointerEvents: "none" } }));
    var anchor = q[2];
    if (x < 70 && anchor !== "start") anchor = "start"; if (x > width - 70 && anchor !== "end") anchor = "end";
    svg.appendChild(s("text", { x: anchor === "start" ? x + 4 : anchor === "end" ? x - 4 : x, y: 12, "text-anchor": anchor, "class": "t-strong", text: q[0] }));
    svg.appendChild(s("text", { x: anchor === "start" ? x + 4 : anchor === "end" ? x - 4 : x, y: 26, "text-anchor": anchor, "class": "t-sub", text: o.tick(q[1]) }));
  });
  return svg;
};

/* ---------------------------------------------------------------------------
   Diagramme en tornade, en facteurs multiplicatifs (axe logarithmique)
   rows : [{label, lo, hi, tipLo, tipHi}] avec lo, hi = facteurs (≈ 0,3 et ≈ 3)
   -------------------------------------------------------------------------- */
A.tornado = function (width, rows, o) {
  o = o || {};
  var wide = width >= 620;
  var labelW = wide ? Math.min(340, Math.round(width * 0.4)) : 0;
  var barH = 15, rowH = wide ? 34 : 50, topPad = 6, axisH = 30;
  var LY = rowLayout(rows, rowH, wide, width, false), plotH = LY.total;
  var L = 0.15;
  rows.forEach(function (r) { L = Math.max(L, Math.abs(Math.log10(r.lo)), Math.abs(Math.log10(r.hi))); });
  L = Math.ceil(L * 10) / 10 + 0.05;
  var x0 = labelW + 6, x1 = width - 14;
  var xs = function (f) { return x0 + (Math.log10(f) + L) / (2 * L) * (x1 - x0); };
  var H = topPad + plotH + axisH;
  var svg = svgRoot(width, H, o.aria || "Sensibilité aux paramètres");
  /* graduations par ordre de priorité ; une graduation qui chevauche une graduation déjà placée est omise */
  var cands = [1, 0.5, 2, 0.25, 4, 0.33, 3, 0.2, 5, 0.125, 8, 0.1, 10, 20];
  var fmtF = function (f) { return f === 1 ? "×1" : "×" + A.fn(f, 2); };
  var placed = [];
  cands.forEach(function (f) {
    if (Math.abs(Math.log10(f)) > L) return;
    var x = xs(f), w = A.textW(fmtF(f), 11, 400) + 10;
    for (var k = 0; k < placed.length; k++) if (Math.abs(placed[k].x - x) < (placed[k].w + w) / 2) return;
    placed.push({ x: x, w: w });
    svg.appendChild(s("line", { x1: x, x2: x, y1: topPad, y2: topPad + plotH, "class": f === 1 ? "g-base" : "g-grid" }));
    svg.appendChild(s("text", { x: x, y: topPad + plotH + 17, "text-anchor": "middle", "class": "t-ax", text: fmtF(f) }));
  });
  rows.forEach(function (r, ri) {
    var y = topPad + LY.ys[ri], mid = wide ? y + rowH / 2 : y + 30 + LY.ex[ri];
    rowLabel(svg, r.label, wide, labelW, y, y + rowH / 2, width, false);
    var g = s("g"), c = xs(1);
    var a = xs(r.lo), b = xs(r.hi);
    /* un paramètre peut agir en sens inverse (par exemple la longueur de contexte) : la barre part toujours de ×1 */
    function seg(x, slot, label, tip) {
      var right = x >= c, w = Math.max(1, Math.abs(x - c) - 1);
      var m = A.mark(g, A.roundedPath(right ? c + 1 : x, mid - barH / 2, w, barH, 4, right ? "r" : "l"), slot, { label: label });
      A.bindTip(m, function () { return tip; });
    }
    seg(a, 1, r.label + " : valeur basse", r.tipLo);
    seg(b, 2, r.label + " : valeur haute", r.tipHi);
    svg.appendChild(g);
    if (Math.abs(Math.log10(r.lo)) < 0.02 && Math.abs(Math.log10(r.hi)) < 0.02) {
      /* effet négligeable : une seule étiquette, pour éviter deux « ×1 » superposés */
      svg.appendChild(s("text", { x: c + 8, y: mid + 4.5, "text-anchor": "start", "class": "t-val", text: "≈ ×1" }));
    } else {
      svg.appendChild(s("text", { x: a >= c ? a + 6 : a - 6, y: mid + 4.5, "text-anchor": a >= c ? "start" : "end", "class": "t-val", text: fmtF(r.lo) }));
      svg.appendChild(s("text", { x: b >= c ? b + 6 : b - 6, y: mid + 4.5, "text-anchor": b >= c ? "start" : "end", "class": "t-val", text: fmtF(r.hi) }));
    }
  });
  return svg;
};

/* ---------------------------------------------------------------------------
   Barres divergentes (variation relative), bleu = baisse, orange = hausse
   rows : [{label, group, delta, tip, text}]
   -------------------------------------------------------------------------- */
A.divBars = function (width, rows, o) {
  o = o || {};
  var wide = width >= 620;
  var labelW = wide ? Math.min(380, Math.round(width * 0.44)) : 0;
  var barH = 16, rowH = wide ? 34 : 50, topPad = 4, axisH = 26;
  var LY = rowLayout(rows, rowH, wide, width, false), plotH = LY.total;
  var mn = Math.min(0, Math.min.apply(null, rows.map(function (r) { return r.delta; }))), mx = Math.max(0, Math.max.apply(null, rows.map(function (r) { return r.delta; })));
  mn = Math.min(mn, -0.1); mx = Math.max(mx, 0.1);
  var padTxt = 52;
  var x0 = labelW + 6 + (mn < 0 ? padTxt : 0), x1 = width - 10 - (mx > 0 ? padTxt : 0);
  var xs = function (d) { return x0 + (d - mn) / (mx - mn) * (x1 - x0); };
  var H = topPad + plotH + axisH;
  var svg = svgRoot(width, H, o.aria || "Variation selon les leviers");
  /* pas de graduation : le plus fin qui laisse au moins 52 px entre deux étiquettes */
  var pxPer = (x1 - x0) / (mx - mn), steps = [0.1, 0.25, 0.5, 1, 2, 5], step = steps[steps.length - 1];
  for (var si = 0; si < steps.length; si++) if (steps[si] * pxPer >= 52) { step = steps[si]; break; }
  for (var t = Math.ceil(mn / step - 1e-9) * step; t <= mx + 1e-9; t += step) {
    var zero = Math.abs(t) < 1e-9;
    svg.appendChild(s("line", { x1: xs(t), x2: xs(t), y1: topPad, y2: topPad + plotH, "class": zero ? "g-base" : "g-grid" }));
    svg.appendChild(s("text", { x: xs(t), y: topPad + plotH + 16, "text-anchor": "middle", "class": "t-ax", text: (t > 0 ? "+" : t < 0 ? "−" : "") + Math.round(Math.abs(t) * 100) + " %" }));
  }
  rows.forEach(function (r, ri) {
    var y = topPad + LY.ys[ri], mid = wide ? y + rowH / 2 : y + 30 + LY.ex[ri];
    rowLabel(svg, r.label, wide, labelW, y, y + rowH / 2, width, false);
    var g = s("g"), z = xs(0), xv = xs(r.delta), neg = r.delta < 0;
    var w = Math.max(1.5, Math.abs(xv - z) - 1);
    var m = A.mark(g, A.roundedPath(neg ? xv : z + 1, mid - barH / 2, w, barH, 4, neg ? "l" : "r"), neg ? 1 : 2, { label: r.label + " : " + r.text });
    A.bindTip(m, function () { return r.tip; });
    svg.appendChild(g);
    svg.appendChild(s("text", { x: neg ? xv - 6 : xv + 6, y: mid + 4.5, "text-anchor": neg ? "end" : "start", "class": "t-val", text: r.text }));
  });
  return svg;
};

/* ---------------------------------------------------------------------------
   Nuage de points de la littérature (axe logarithmique, une ligne par source)
   rows : [{label, v, lo, hi, cls, tip}] ; bands : [{label, lo, mid, hi}]
   -------------------------------------------------------------------------- */
var CLS_COL = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--ink-3)"];
A.LIT_CLASSES = [
  { label: "Puces d’IA seules", color: CLS_COL[0], shape: "circle" },
  { label: "Site de calcul complet", color: CLS_COL[1], shape: "diamond" },
  { label: "Cycle de vie", color: CLS_COL[2], shape: "square" },
  { label: "Périmètre non précisé", color: CLS_COL[3], shape: "triangle" }
];
function shapePath(shape, cx, cy, r) {
  if (shape === "diamond") return "M" + cx + " " + (cy - r * 1.25) + "L" + (cx + r * 1.25) + " " + cy + "L" + cx + " " + (cy + r * 1.25) + "L" + (cx - r * 1.25) + " " + cy + "Z";
  if (shape === "square") return "M" + (cx - r) + " " + (cy - r) + "h" + 2 * r + "v" + 2 * r + "h" + (-2 * r) + "z";
  if (shape === "triangle") return "M" + cx + " " + (cy - r * 1.25) + "L" + (cx + r * 1.2) + " " + (cy + r * 0.95) + "L" + (cx - r * 1.2) + " " + (cy + r * 0.95) + "Z";
  return "M" + (cx - r) + " " + cy + "a" + r + " " + r + " 0 1 0 " + 2 * r + " 0a" + r + " " + r + " 0 1 0 " + (-2 * r) + " 0z";
}
A.litPlot = function (width, rows, bands, o) {
  var wide = width >= 620;
  var labelW = wide ? Math.min(330, Math.round(width * 0.42)) : 0;
  var rowH = wide ? 34 : 48, topPad = 22 + bands.length * 13, axisH = 30;
  var LY = rowLayout(rows, rowH, wide, width, false), plotH = LY.total;
  var allV = [];
  rows.forEach(function (r) { allV.push(r.v); if (r.lo) allV.push(r.lo); if (r.hi) allV.push(r.hi); });
  bands.forEach(function (b) { allV.push(b.lo, b.hi); });
  var min = Math.pow(10, Math.floor(Math.log10(Math.min.apply(null, allV)) - 0.0001)), max = Math.pow(10, Math.ceil(Math.log10(Math.max.apply(null, allV)) + 0.0001));
  var lmin = Math.log10(min), lmax = Math.log10(max);
  var x0 = labelW + 6, x1 = width - 16;
  var xs = function (v) { return x0 + (Math.log10(clamp(v, min, max)) - lmin) / (lmax - lmin) * (x1 - x0); };
  var H = topPad + plotH + axisH;
  var svg = svgRoot(width, H, o.aria || "Comparaison des sources");
  var ticks = A.logTicks(min, max, wide ? 10 : 6);
  ticks.forEach(function (t) {
    var dec = Math.abs(Math.log10(t) - Math.round(Math.log10(t))) < 1e-9;
    svg.appendChild(s("line", { x1: xs(t), x2: xs(t), y1: topPad, y2: topPad + plotH, "class": "g-grid", style: { opacity: dec ? 1 : 0.5 } }));
    A.tickText(svg, xs(t), topPad + plotH + 17, o.tick(t), width);
  });
  svg.appendChild(s("line", { x1: x0, x2: x1, y1: topPad + plotH + 0.5, y2: topPad + plotH + 0.5, "class": "g-base" }));
  bands.forEach(function (b, bi) {
    var xa = xs(b.lo), xb = xs(b.hi);
    var band = s("rect", { x: xa, y: topPad - 4, width: Math.max(2, xb - xa), height: plotH + 4, style: { fill: "var(--band)" }, "class": "mark", tabindex: "0", role: "img", "aria-label": b.label });
    A.bindTip(band, function () { return b.tip; });
    svg.appendChild(band);
    svg.appendChild(s("line", { x1: xs(b.mid), x2: xs(b.mid), y1: topPad - 4, y2: topPad + plotH, stroke: "var(--ink)", "stroke-width": 1.5, style: { pointerEvents: "none" } }));
    var lines = A.wrapText(b.label, Math.max(120, (xb - xa) + 80), 11.5, 600);
    var tx = (xa + xb) / 2, anchor = "middle";
    if (tx < 90) { tx = xa; anchor = "start"; } else if (tx > width - 90) { tx = xb; anchor = "end"; }
    svg.appendChild(s("text", { x: tx, y: 12 + bi * 13, "text-anchor": anchor, "class": "t-strong", style: { fontSize: "11.5px" }, text: lines[0] }));
  });
  rows.forEach(function (r, ri) {
    var y = topPad + LY.ys[ri], mid = wide ? y + rowH / 2 : y + 30 + LY.ex[ri];
    rowLabel(svg, r.label, wide, labelW, y, y + rowH / 2, width, false);
    var g = s("g"), cl = A.LIT_CLASSES[r.cls];
    if (r.lo != null && r.hi != null) g.appendChild(s("line", { x1: xs(r.lo), x2: xs(r.hi), y1: mid, y2: mid, stroke: cl.color, "stroke-width": 2.5, "stroke-linecap": "round", style: { pointerEvents: "none" } }));
    var hit = s("rect", { x: xs(r.lo != null ? r.lo : r.v) - 12, y: mid - 14, width: (r.lo != null ? xs(r.hi) - xs(r.lo) : 0) + 24, height: 28, fill: "transparent", "class": "mark", tabindex: "0", role: "img", "aria-label": r.label + " : " + r.text });
    A.bindTip(hit, function () { return r.tip; });
    g.appendChild(hit);
    g.appendChild(s("path", { d: shapePath(cl.shape, xs(r.v), mid, 5), style: { fill: cl.color, stroke: "var(--surface)", strokeWidth: 2, pointerEvents: "none" } }));
    svg.appendChild(g);
    var tx = xs(r.hi != null ? r.hi : r.v) + 10, tw = A.textW(r.text, 12, 600);
    if (tx + tw > width - 4) svg.appendChild(s("text", { x: xs(r.lo != null ? r.lo : r.v) - 10, y: mid + 4.5, "text-anchor": "end", "class": "t-val", text: r.text }));
    else svg.appendChild(s("text", { x: tx, y: mid + 4.5, "class": "t-val", text: r.text }));
  });
  return svg;
};

A.litLegend = function () {
  return h("div", { "class": "legend" }, A.LIT_CLASSES.map(function (c) {
    var sv = s("svg", { width: 14, height: 14, viewBox: "0 0 14 14", "aria-hidden": "true" }, [s("path", { d: shapePath(c.shape, 7, 7, 4.5), style: { fill: c.color } })]);
    return h("span", { "class": "lg" }, [sv, c.label]);
  }).concat([h("span", { "class": "lg" }, [h("i", { "class": "sw", style: "background:var(--band);border:1px solid var(--line-2)" }), "Cet outil, intervalle à 90 %"])]));
};

})();
