/* ============================================================================
   Interface — onglets, routage, rendu et démarrage
   ========================================================================== */
(function () {
"use strict";
var M = window.EDM, A = window.EDApp;
var h = A.h, P = A.panels;

var TABS = [
  { id: "synthese",      label: "Synthèse",                panel: "synthese" },
  { id: "scenario",      label: "Scénario",                panel: "scenario" },
  { id: "comparaison",   label: "Comparaison",             panel: "comparaison" },
  { id: "decomposition", label: "Décomposition",           panel: "decomp" },
  { id: "taches",        label: "Tâches",                  panel: "taches" },
  { id: "journees",      label: "Journées types",          panel: "journees" },
  { id: "sensibilites",  label: "Incertitudes et leviers", panel: "sensib" },
  { id: "litterature",   label: "Littérature",             panel: "litterature" },
  { id: "autres",        label: "Autres impacts",          panel: "autres" },
  { id: "hypotheses",    label: "Hypothèses et sources",   panel: "hypotheses" }
];
function tabById(id) { for (var i = 0; i < TABS.length; i++) if (TABS[i].id === id) return TABS[i]; return null; }

var tabEls = {}, panelEls = {}, built = {};

function buildShell() {
  var nav = document.getElementById("tablist"), host = document.getElementById("panels");
  TABS.forEach(function (t, i) {
    var b = h("button", { type: "button", "class": "tab", role: "tab", id: "tab-" + t.id, "aria-controls": "panel-" + t.id, "aria-selected": "false", tabindex: "-1", text: t.label });
    b.addEventListener("click", function () { A.goTab(t.id); });
    b.addEventListener("keydown", function (e) {
      var k = e.key, j = i;
      if (k === "ArrowRight") j = (i + 1) % TABS.length; else if (k === "ArrowLeft") j = (i - 1 + TABS.length) % TABS.length;
      else if (k === "Home") j = 0; else if (k === "End") j = TABS.length - 1; else return;
      e.preventDefault(); A.goTab(TABS[j].id, false, true);
    });
    nav.appendChild(b); tabEls[t.id] = b;
    var sec = h("section", { "class": "panel", id: "panel-" + t.id, role: "tabpanel", "aria-labelledby": "tab-" + t.id, hidden: true });
    host.appendChild(sec); panelEls[t.id] = sec;
  });
}

function showError(el, e) {
  var old = el.querySelector(".err"); if (old) old.remove();
  el.appendChild(h("div", { "class": "callout err", role: "alert" }, "Une erreur s’est produite dans cet onglet (" + (e && e.message ? e.message : e) + "). Le bouton « Réinitialiser » de l’onglet Scénario rétablit les réglages par défaut."));
}

function ensureBuilt(t) {
  if (built[t.id]) return true;
  try { P[t.panel].build(panelEls[t.id]); built[t.id] = true; return true; }
  catch (e) { console.error(e); showError(panelEls[t.id], e); return false; }
}

function renderActive() {
  var t = tabById(A.UI().tab) || TABS[0];
  if (!ensureBuilt(t)) return;
  try {
    var old = panelEls[t.id].querySelector(".err"); if (old) old.remove();
    P[t.panel].update();
  } catch (e) { console.error(e); showError(panelEls[t.id], e); }
}

/* reveal : fait défiler la page jusqu’à la barre d’onglets (clic depuis l’introduction ou les pastilles du haut de page) */
A.goTab = function (id, init, focus, reveal) {
  var t = tabById(id) || TABS[0], UI = A.UI();
  UI.tab = t.id;
  TABS.forEach(function (x) {
    var on = x.id === t.id;
    tabEls[x.id].setAttribute("aria-selected", on ? "true" : "false");
    tabEls[x.id].tabIndex = on ? 0 : -1;
    panelEls[x.id].hidden = !on;
  });
  if (focus) { try { tabEls[t.id].focus({ preventScroll: true }); } catch (e) { tabEls[t.id].focus(); } }
  try { window.history.replaceState(null, "", "#" + t.id); } catch (e) {}
  A.hideTip();
  A.touchUI();
  if (!init) {
    var anchor = document.getElementById("tabs-anchor");
    if (anchor) {
      /* le défilement attend la construction de l’onglet : sans cela, la page est encore trop courte et la position est tronquée */
      A.afterUpdate(function () {
        var top = anchor.getBoundingClientRect().top + window.pageYOffset;
        if (reveal || window.pageYOffset > top) window.scrollTo(0, top);
      });
    }
  }
  centerTab(tabEls[t.id]);
};

/* fait défiler la barre d’onglets, et elle seule, pour montrer l’onglet actif : scrollIntoView ferait aussi défiler la page,
   et masquerait l’introduction au chargement sur un écran peu haut */
function centerTab(el) {
  var nav = el.parentNode;
  if (!nav || nav.scrollWidth <= nav.clientWidth + 1) return;
  var left = el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2;
  nav.scrollLeft = Math.max(0, Math.min(left, nav.scrollWidth - nav.clientWidth));
}

function hashTab() {
  var hsh = (window.location.hash || "").replace(/^#/, "");
  return tabById(hsh) ? hsh : null;
}

function boot() {
  buildShell();
  A.onUpdate(function () {
    try { A.updateHeader(); } catch (e) { console.error(e); }
    renderActive();
  });
  /* entrées de l’introduction */
  Array.prototype.forEach.call(document.querySelectorAll("[data-go]"), function (b) {
    b.addEventListener("click", function () { A.goTab(b.getAttribute("data-go"), false, false, true); });
  });
  var tex = document.getElementById("tex-toggle");
  if (tex) {
    tex.checked = !!A.UI().texture;
    tex.addEventListener("change", function () { A.UI().texture = tex.checked; A.touchUI(); });
  }
  window.addEventListener("hashchange", function () { var t = hashTab(); if (t && t !== A.UI().tab) A.goTab(t, false); });

  /* largeur : les figures sont redessinées quand le conteneur change de taille */
  var lastW = 0, timer = 0;
  function onSize(w) {
    if (Math.abs(w - lastW) < 6) return;
    lastW = w; clearTimeout(timer);
    timer = setTimeout(function () { A.hideTip(); renderActive(); }, 140);
  }
  var host = document.getElementById("panels");
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(function (entries) { onSize(entries[0].contentRect.width); }).observe(host);
  } else {
    window.addEventListener("resize", function () { onSize(host.getBoundingClientRect().width); });
  }

  /* thème : les couleurs séquentielles dépendent du mode clair ou sombre */
  try {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var rerender = function () { A.touchUI(); };
    if (mq.addEventListener) mq.addEventListener("change", rerender); else if (mq.addListener) mq.addListener(rerender);
  } catch (e) {}
  try {
    new MutationObserver(function () { A.touchUI(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  } catch (e) {}

  /* polices : les mesures de texte sont refaites une fois les polices chargées */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { A.resetMeasure(); renderActive(); });
  }

  A.goTab(hashTab() || A.UI().tab || "synthese", true);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

})();
