/* ============================================================================
   Interface — littérature, autres impacts, hypothèses et sources
   ========================================================================== */
(function () {
"use strict";
var M = window.EDM, A = window.EDApp;
var h = A.h, fv = A.fv, fn = A.fn, pct = A.pct, pl = A.pl;
var P = A.panels;
var NB = " ", NN = " ";

/* Espaces insécables avant les unités et dans les nombres à plusieurs milliers */
function nb(str) {
  return String(str)
    .replace(/(\d) (?=(?:Wh|kWh|MWh|GWh|g|kg|t|mL|L|m³|\$|%|W|h|ans|mois|jours|jetons|M de jetons|k jetons|milliards|fois|g\/kWh|L\/kWh|mg)(?![A-Za-zÀ-ÿ]))/g, "$1" + NB)
    .replace(/(\d) (\d{3})(?!\d)/g, "$1" + NN + "$2")
    .replace(/« /g, "«" + NB).replace(/ »/g, NB + "»");
}
function para(text, cls) { return h("p", { "class": cls || "", text: nb(text) }); }
function link(label, url) { return h("a", { href: url, target: "_blank", rel: "noopener noreferrer", text: label }); }

/* -------------------------------------------------- données de la littérature */
/* cls : 0 puces d’IA seules, 1 site de calcul, 2 cycle de vie, 3 périmètre non précisé */
var LIT_ELEC = [
  { label: "Google, requête médiane de Gemini", v: 0.24, cls: 1,
    note: "Médiane mesurée en production en 2025 : puces d’IA 0,14 Wh, processeurs et mémoire 0,06 Wh, capacité inactive 0,02 Wh, surcoût du site 0,02 Wh. L’entraînement est exclu." },
  { label: "Google, périmètre étroit", v: 0.10, cls: 0,
    note: "Valeur que Google obtient avec le périmètre étroit qu’il présente à titre de comparaison, limité à l’énergie des équipements de calcul en activité." },
  { label: "Epoch AI, requête de GPT-4o", v: 0.3, lo: 0.1, hi: 4, cls: 1,
    note: "Estimation de février 2025 pour une réponse d’environ 500 jetons ; la fourchette de 0,1 à 4 Wh reflète la longueur des requêtes (environ 2,5 Wh pour 10 000 jetons d’entrée, environ 40 Wh pour 100 000)." },
  { label: "Altman (OpenAI), requête moyenne", v: 0.34, cls: 3,
    note: "Chiffre avancé dans un billet de blog, sans méthode ni périmètre publiés." },
  { label: "Microsoft, requête médiane (300 jetons)", v: 0.31, lo: 0.16, hi: 0.60, cls: 3,
    note: "Mesure sur la flotte de Microsoft ; l’intervalle indiqué est interquartile. Lorsque le nombre de jetons est multiplié par quinze, l’énergie l’est par treize." },
  { label: "Jegham et al., requête courte", v: 0.95, cls: 1,
    note: "Claude 3.7 Sonnet, 100 jetons d’entrée et 300 de sortie. Estimation par modélisation à partir de bancs d’essai publics, sans donnée d’Anthropic, donc très sensible aux hypothèses sur le matériel." },
  { label: "Jegham et al., requête moyenne", v: 2.99, cls: 1,
    note: "Claude 3.7 Sonnet, 1 000 jetons d’entrée et 1 000 de sortie (même méthode). Pour 10 000 jetons d’entrée et 1 500 de sortie, les auteurs obtiennent 5,67 Wh." },
  { label: "de Vries (2023), cité par Google", v: 3, cls: 3,
    note: "Estimation de 2023 fondée sur le matériel supposé déployé, et non sur une mesure." },
  { label: "BLOOM, cité par Google", v: 4, cls: 3,
    note: "Valeur citée par Google pour le modèle ouvert BLOOM, sans périmètre précisé." },
  { label: "EcoLogits, cité par Google", v: 3.57, lo: 1.83, hi: 6.95, cls: 3,
    note: "Fourchette citée par Google pour le calculateur EcoLogits ; le point correspond à la moyenne géométrique des deux bornes." }
];
var LIT_CO2 = [
  { label: "Google, requête médiane (market-based)", v: 0.03, cls: 2,
    note: "0,023 g pour l’électricité, avec le facteur market-based de 94 g/kWh, et 0,010 g pour les émissions de scope 1 et de fabrication du matériel. Avec le facteur location-based de 345 g/kWh, le même calcul donne environ 0,09 g (calcul de l’outil)." },
  { label: "Jegham et al., requête courte (dérivé)", v: 0.27, cls: 1,
    note: "Dérivé de 0,95 Wh et du facteur d’émission de 287 g/kWh retenu pour AWS (calcul de l’outil à partir des valeurs publiées)." },
  { label: "Mistral, 400 jetons (cycle de vie)", v: 1.14, cls: 2,
    note: "Valeur marginale tirée de l’analyse de cycle de vie de Mistral Large 2 sur dix-huit mois (20,4 kt CO₂e au total) ; elle inclut l’entraînement, la fabrication du matériel et les terminaux des utilisateurs." },
  { label: "BLOOM, cité par Google", v: 1.5, cls: 3,
    note: "Valeur citée par Google pour le modèle BLOOM, sans périmètre précisé." }
];
var LIT_WATER = [
  { label: "Google, requête médiane (eau sur site)", v: 0.26, cls: 1,
    note: "Eau évaporée sur le site de calcul, avec un WUE de 1,15 L/kWh ; l’eau consommée pour produire l’électricité n’est pas comptée." },
  { label: "Altman (OpenAI), requête moyenne", v: 0.3, cls: 3,
    note: "Chiffre avancé dans un billet de blog, sans méthode publiée." },
  { label: "Jegham et al., requête courte (dérivé)", v: 5.0, cls: 1,
    note: "Dérivé de 0,95 Wh, de 0,18 L/kWh sur site et de 5,11 L/kWh pour produire l’électricité d’AWS (calcul de l’outil à partir des valeurs publiées)." },
  { label: "Li et al., une réponse de GPT-3", v: 22, lo: 10, hi: 50, cls: 3,
    note: "Une bouteille de 500 mL pour 10 à 50 réponses, soit 10 à 50 mL par réponse ; le point correspond à la moyenne géométrique des bornes." },
  { label: "Mistral, 400 jetons (cycle de vie)", v: 45, cls: 2,
    note: "Valeur marginale tirée de l’analyse de cycle de vie de Mistral Large 2 (281 000 m³ sur dix-huit mois) ; l’exploitation représente 91 % de l’eau, la fabrication du matériel 5 %." }
];
var LIT_MATTER = [
  { label: "Mistral, 400 jetons (cycle de vie)", v: 0.16, cls: 2,
    note: "Valeur marginale tirée de l’analyse de cycle de vie de Mistral Large 2 (660 kg Sb éq. au total) ; 61 % viennent du matériel, 29 % de l’exploitation et 7 % des terminaux des utilisateurs." }
];
var LIT_DAY = [
  { label: "Couch, session médiane de Claude Code", v: 41, cls: 1,
    note: "24 requêtes et 592 000 jetons en moyenne par session, converties en énergie à partir des mesures de Google." },
  { label: "CLEER, session de code", v: 76, cls: 3,
    note: "Estimation du tableau de bord CLEER (Sustainable AI Group) pour une session de code avec un modèle de pointe ; lue dans un article de presse, non vérifiée directement." },
  { label: "Anthropic, 13 $ par jour (dérivé)", v: 1000, cls: 3, day: true,
    note: "Dépense moyenne de 13 $ par développeur et par jour d’après Anthropic, multipliée par 75,5 Wh par dollar de Couch (calcul de l’outil)." },
  { label: "Couch, journée médiane", v: 1300, cls: 1, day: true,
    note: "Médiane des journées d’usage de Claude Code observées par l’auteur." },
  { label: "Hausfather, journée moyenne (8 semaines)", v: 3000, lo: 1200, hi: 5900, cls: 1, day: true,
    note: "Environ 170 kWh sur huit semaines d’usage intensif de Claude Code, soit 3,0 kWh par jour (1,2 à 5,9) ; lecture indirecte, par un résumé de presse. Les lectures de cache représentent environ deux tiers de l’électricité." }
];

var SITE = [1, 1, 1, 0, 0], FULL = [1, 1, 1, 1, 1];

function bandStats(mc, ind, mask, base, mult) {
  var out = new Float64Array(mc.N);
  for (var k = 0; k < mc.N; k++) out[k] = M.coefTot(mc, ind, k, mask) * base[k] * (mult ? mult[k] : 1);
  return M.stats(out);
}
function mkBand(ind, label, st, note) {
  return { label: label, lo: st.p5, mid: st.p50, hi: st.p95,
    tip: { title: label, rows: [{ k: "Médiane", v: fv(ind, st.p50) }, { k: "90 % des tirages", v: M.fmtRange(ind, st.p5, st.p95, 2) }], note: note } };
}

function litRows(ind, list) {
  return list.map(function (r) {
    var rows = [{ k: "Valeur", v: fv(ind, r.v) }];
    if (r.lo != null) rows.push({ k: "Fourchette", v: M.fmtRange(ind, r.lo, r.hi, 2) });
    rows.push({ k: "Périmètre", v: A.LIT_CLASSES[r.cls].label });
    return { label: r.label, v: r.v, lo: r.lo, hi: r.hi, cls: r.cls, text: fv(ind, r.v), aria: r.label,
      tip: { title: r.label, rows: rows, note: r.note } };
  });
}
function litTable(ind, list) {
  return { head: ["Source", "Valeur", "Fourchette", "Périmètre"],
    rows: list.map(function (r) { return [r.label, fv(ind, r.v), r.lo != null ? M.fmtRange(ind, r.lo, r.hi, 2) : "—", A.LIT_CLASSES[r.cls].label]; }),
    num: [false, true, true, false] };
}

/* ------------------------------------------------------------- LITTÉRATURE */
var DIVERGENCES = [
  "Le périmètre compté diffère d’une étude à l’autre : certaines ne retiennent que les puces d’IA en activité, d’autres ajoutent les serveurs, la capacité de réserve et le refroidissement, et seules quelques-unes intègrent la fabrication du matériel et l’entraînement.",
  "La statistique n’est pas la même, puisque Google et Microsoft publient une médiane, qui ignore les très longues requêtes, alors qu’une moyenne sur l’ensemble de l’usage, notamment agentique, est nettement plus élevée.",
  "Les mesures en production et les estimations par banc d’essai ne se comparent pas : Microsoft et Watershed indiquent que les estimations publiques surestiment l’énergie réelle d’un facteur 4 à 20, notamment parce que les bancs d’essai fonctionnent à un taux d’utilisation du matériel plus faible que celui d’un service en production.",
  "Le facteur d’émission de l’électricité varie d’un facteur supérieur à quinze entre la France continentale (52 g/kWh) et un réseau à dominante charbon (environ 800 g/kWh), et la méthode market-based de Google (94 g/kWh) donne un résultat très différent de la méthode location-based (345 g/kWh) pour le même opérateur.",
  "L’eau recouvre trois choses distinctes, à savoir l’eau évaporée sur le site de calcul, celle qui est évaporée pour produire l’électricité et celle qui sert à fabriquer le matériel, de sorte que les valeurs publiées s’étalent de 0,26 à 45 mL selon ce que chaque étude compte.",
  "La date compte aussi, car Google rapporte une réduction d’un facteur 33 de l’énergie par requête médiane en douze mois, et les études qui portent sur des modèles ou des matériels plus anciens peuvent donc surestimer la situation actuelle.",
  "La définition d’une requête varie enfin : une question courte de quelques centaines de jetons et une session de code de plusieurs centaines de milliers de jetons diffèrent de plusieurs ordres de grandeur en énergie."
];

var SRC_TABLE = [
  ["Google (Elsworth et al.)", "2025", "Énergie, carbone et eau de la requête médiane de Gemini, mesurés sur la flotte de production", "Site de calcul complet, plus fabrication du matériel pour le carbone ; hors entraînement et terminaux", "Un seul fournisseur, une médiane, des modèles et des puces propres à Google"],
  ["Microsoft", "2025–2026", "Énergie par requête mesurée sur la flotte, selon la longueur de la réponse", "Mesure en production", "Flotte de Microsoft, donc d’autres modèles que Claude ; la médiane est donnée pour 300 jetons de sortie"],
  ["Epoch AI (You)", "2025", "Énergie d’une requête de GPT-4o, estimée par calcul", "Site de calcul", "Estimation sans mesure, avec des hypothèses sur le matériel et le taux d’utilisation"],
  ["Jegham et al.", "2025", "Énergie, eau et carbone de nombreux modèles, dont Claude 3.7 Sonnet", "Site de calcul, électricité comprise pour l’eau", "Estimation par bancs d’essai publics, qui tend à donner des valeurs plus élevées que les mesures en production ; aucune donnée d’Anthropic"],
  ["Mistral AI", "2025", "Cycle de vie complet de Mistral Large 2 sur dix-huit mois, avec valeurs marginales par réponse", "Cycle de vie complet, avec entraînement, matériel et terminaux", "Un modèle de taille et d’usage différents ; valeurs marginales très supérieures aux mesures en production"],
  ["AI Energy Score (Hugging Face)", "2025", "Classement de l’énergie de nombreux modèles ouverts selon la tâche", "Énergie des puces d’IA mesurée en banc d’essai", "Modèles ouverts ; les modèles à raisonnement consomment en moyenne bien davantage"],
  ["Couch", "2026", "Énergie d’une session et d’une journée de Claude Code, à partir des jetons consommés", "Dérivé des mesures de Google", "Une seule personne ; extrapolation par les jetons"],
  ["Hausfather", "2026", "Énergie de huit semaines d’usage intensif de Claude Code", "Dérivé des jetons consommés", "Lu par un résumé de presse ; usage d’une seule personne"],
  ["CLEER (Sustainable AI Group)", "2026", "Tableau de bord d’estimation de l’énergie de plusieurs services d’IA", "Non détaillé dans les sources lues", "Lu par un article de presse ; méthode non vérifiée"],
  ["Anthropic", "2026", "Aucun rapport environnemental ni mesure par requête pour Claude", "—", "La presse rapporte qu’un chiffrage est en cours avec Watershed ; aucune publication n’est connue à la date de rédaction"]
];

P.litterature = {
  build: function (root) {
    this.seg = A.indHead(root, "Ce que dit la littérature, et où se situe l’outil",
      "Les sources publiées divergent de plus d’un ordre de grandeur. La figure place chaque valeur par requête sur une même échelle logarithmique, selon le périmètre qu’elle recouvre, et la compare à l’intervalle de l’outil pour la requête de référence.");
    this.body = h("div", { "class": "stack" });
    root.appendChild(this.body);
  },
  update: function () {
    var S = A.S(), UI = A.UI(), mc = A.MC(), ind = UI.ind, self = this;
    A.refreshSeg(this.seg);
    A.clear(this.body);
    var g = M.gridById(S.grid);

    /* 1. par requête */
    var list, bands = [], foot, unitName = M.INDICATORS[ind].label.toLowerCase();
    var refNote = "Requête de référence de 130 jetons d’entrée et 530 de sortie, sur Sonnet, avec le raisonnement standard.";
    function pos(v, st) { return v > st.p95 ? "au-dessus de l’intervalle à 90 % de l’outil" : v < st.p5 ? "en dessous de l’intervalle à 90 % de l’outil" : "dans l’intervalle à 90 % de l’outil"; }
    var stSite = bandStats(mc, ind, SITE, mc.Eref), stFull = bandStats(mc, ind, FULL, mc.Eref);
    if (ind === 0) {
      list = LIT_ELEC;
      bands.push(mkBand(0, "Outil : site de calcul", stSite, refNote));
      bands.push(mkBand(0, "Outil : avec entraînement amorti", stFull, refNote));
      foot = "Les valeurs publiées s’étendent de 0,1 à 7 Wh par requête, soit un facteur voisin de soixante-dix, alors que les mesures faites en production (Google, Microsoft) se regroupent autour de 0,2 à 0,3 Wh. La médiane de l’outil pour le site de calcul est de " + fv(0, stSite.p50) + ", et son intervalle laisse beaucoup de place vers le haut parce que les modèles de Claude et leur matériel ne sont pas connus.";
    } else if (ind === 1) {
      list = LIT_CO2;
      var gl = " Facteur du réseau : " + g.lc + ".";
      bands.push(mkBand(1, "Outil : site de calcul", stSite, refNote + gl));
      bands.push(mkBand(1, "Outil : cycle de vie complet", stFull, refNote + gl));
      foot = "La médiane de Google (0,03 g) repose sur un facteur market-based de 94 g/kWh, alors que les bandes de l’outil utilisent le réseau choisi dans le scénario (" + g.lc + (g.method === "au choix" ? "" : ", " + g.method) + "), ce qui explique une partie de l’écart. La valeur de Mistral (1,14 g) se situe " + pos(1.14, stFull) + " pour le cycle de vie complet" + (1.14 > stFull.p95 ? " ; cet écart peut tenir au rapport de l’ensemble des impacts d’un modèle récent à son volume d’usage réel, et il est conservé tel quel." : ".");
    } else if (ind === 2) {
      list = LIT_WATER;
      var stOn = bandStats(mc, 2, SITE, mc.Eref, mc.wsite);
      bands.push(mkBand(2, "Outil : eau sur site seule", stOn, refNote));
      bands.push(mkBand(2, "Outil : site et électricité", stSite, refNote));
      bands.push(mkBand(2, "Outil : cycle de vie complet", stFull, refNote));
      foot = "Les trois bandes de l’outil correspondent aux trois façons de compter l’eau : l’eau évaporée sur le site seul se compare à la valeur de Google (0,26 mL), l’eau de site et d’électricité à celle de Jegham et al. (environ 5 mL) et le cycle de vie complet à celle de Mistral (45 mL), qui se situe " + pos(45, stFull) + ".";
    } else {
      list = LIT_MATTER;
      bands.push(mkBand(3, "Outil : exploitation seule", stSite, refNote));
      bands.push(mkBand(3, "Outil : cycle de vie complet", stFull, refNote));
      var ratio = 0.16 / stFull.p50;
      foot = "Une seule source publie une valeur par réponse pour l’épuisement des ressources minérales. Pour le cycle de vie complet, la médiane de l’outil est " + fn(ratio >= 1 ? ratio : 1 / ratio, 2) + " fois " + (ratio >= 1 ? "inférieure" : "supérieure") + " à cette valeur, qui se situe " + pos(0.16, stFull) + ", ce qui est cohérent avec la faible confiance accordée à ce paramètre.";
    }
    var unitForTick = function (v) { return A.tickLabel(ind, v); };
    var f1 = A.figure({
      id: "lit-query-" + ind,
      title: "Valeurs publiées par requête — " + unitName,
      sub: "Chaque symbole correspond à une source ; sa forme et sa couleur indiquent le périmètre compté, et les traits fins l’éventail donné par la source. Les zones grisées montrent l’intervalle à 90 % de l’outil.",
      extra: A.litLegend(),
      build: function (w) { return A.litPlot(w, litRows(ind, list), bands, { tick: unitForTick, aria: "Valeurs de la littérature pour l’indicateur " + unitName + ", par requête" }); },
      table: function () { return litTable(ind, list); },
      foot: foot
    });
    this.body.appendChild(h("div", { "class": "card" }, f1));

    /* 2. par journée de développement */
    var base = mc.Ecode, optOpus = new Float64Array(mc.N);
    for (var k = 0; k < mc.N; k++) optOpus[k] = mc.Ecode[k] * mc.mOpus[k];
    var dayBands = [
      mkBand(0, "Outil : journée sur Sonnet", bandStats(mc, 0, SITE, base), "Journée de développement assisté : 1,2 M de jetons d’entrée frais, 20 M de jetons relus dans le cache et 150 000 jetons de sortie."),
      mkBand(0, "Outil : même journée sur Opus", bandStats(mc, 0, SITE, optOpus), "Même journée, avec l’énergie par jeton d’Opus (rapport m_opus tiré dans chaque simulation).")
    ];
    var dayRows = LIT_DAY.filter(function (r) { return r.day; });
    var dayLo = Math.min(dayBands[0].lo, dayBands[1].lo), dayHi = Math.max(dayBands[0].hi, dayBands[1].hi);
    var dayInside = dayRows.filter(function (r) { return r.v >= dayLo && r.v <= dayHi; }).length;
    var f2 = A.figure({
      id: "lit-day",
      title: "Usages de code : session et journée d’un développeur — électricité",
      sub: "Les estimations les plus récentes portent sur Claude Code et convertissent les jetons consommés en énergie. Les valeurs par session, plus courtes qu’une journée, se placent logiquement sous la bande de l’outil ; " + dayInside + " des " + dayRows.length + " valeurs par journée se situent dans son intervalle à 90 %.",
      extra: A.litLegend(),
      build: function (w) { return A.litPlot(w, litRows(0, LIT_DAY), dayBands, { tick: function (v) { return A.tickLabel(0, v); }, aria: "Valeurs de la littérature pour une session ou une journée de code" }); },
      table: function () { return litTable(0, LIT_DAY); },
      foot: "Une journée de ce type correspond à un usage très intensif, que l’abonnement Pro ne permet vraisemblablement pas de soutenir tous les jours. La bande de l’outil sert surtout à vérifier que le calage énergétique est cohérent avec les journées de développement rapportées par Couch et Hausfather."
    });
    this.body.appendChild(h("div", { "class": "card" }, f2));

    /* 3. pourquoi les écarts */
    var why = h("div", { "class": "card stack" });
    why.appendChild(h("h3", { "class": "h3", text: "Pourquoi les valeurs divergent" }));
    why.appendChild(para("Plusieurs différences de méthode expliquent l’essentiel de l’écart entre les études, et aucune ne rend une source plus «\u00a0juste\u00a0» qu’une autre, puisqu’elles décrivent des objets de mesure différents.", "muted small"));
    var ul = h("ul", { "class": "stack", style: "padding-left:1.1em;gap:8px;margin:0" });
    DIVERGENCES.forEach(function (t) { ul.appendChild(h("li", { text: nb(t) })); });
    why.appendChild(ul);
    this.body.appendChild(why);

    /* 4. tableau de sources comparées */
    var cmp = h("div", { "class": "card stack" });
    cmp.appendChild(h("h3", { "class": "h3", text: "Sources comparées" }));
    cmp.appendChild(A.tableEl({ head: ["Source", "Année", "Objet", "Périmètre", "Limite principale"], rows: SRC_TABLE.map(function (r) { return r.map(nb); }), num: [false, false, false, false, false], stack: [8, 4, 12, 12, 12], labels: ["", "", "Objet", "Périmètre", "Limite principale"] }));
    this.body.appendChild(cmp);
    A.flushFigures();
  }
};

/* ---------------------------------------------------------- AUTRES IMPACTS */
var AUTRES = [
  { st: 0, t: "Polluants atmosphériques et santé publique",
    p: "La production d’électricité et les groupes de secours des centres de données émettent des oxydes d’azote, des particules fines et du dioxyde de soufre, dont les effets sanitaires dépendent du lieu et de la filière. Han et al. estiment que le coût sanitaire lié aux centres de données américains pourrait dépasser 20 milliards de dollars par an d’ici 2030, avec environ 1 300 décès prématurés par an ; l’outil ne convertit pas l’énergie en effets sanitaires, faute de connaître les sites d’inférence d’Anthropic." },
  { st: 0, t: "Réseau électrique local et raccordements",
    p: "Les centres de données concentrent une forte demande en des points précis du réseau, ce qui pèse sur les files de raccordement et sur la planification des capacités. Ce sujet touche directement le métier d’Énergies Demain, mais il se traite à l’échelle du parc de centres de données plutôt qu’à celle d’une entreprise cliente ; la distinction entre émissions moyennes et émissions marginales du réseau y est en outre décisive, alors que l’outil retient uniquement des facteurs moyens." },
  { st: 0, t: "Occupation des sols et biodiversité",
    p: "L’emprise des centres de données, des lignes de raccordement et des sites miniers qui fournissent les métaux n’est pas quantifiée, parce que les études publiées ne la rapportent pas à une requête." },
  { st: 1, t: "Matières critiques, déchets électroniques et toxicité",
    p: "L’indicateur retenu mesure l’épuisement des ressources minérales en kilogrammes d’antimoine équivalent, donc la rareté des éléments extraits. Il ne rend compte ni des déchets électroniques en fin de vie, ni de la toxicité des procédés d’extraction et de fabrication, ni de la dépendance à quelques pays d’approvisionnement." },
  { st: 1, t: "Stress hydrique local",
    p: "Les volumes d’eau sont additionnés sans pondération par la rareté locale, alors qu’un litre évaporé dans un bassin en tension n’a pas les mêmes conséquences qu’un litre évaporé dans un bassin abondant. Comme la localisation des calculs d’Anthropic n’est pas publique, cette pondération n’est pas possible aujourd’hui." },
  { st: 0, t: "Effets rebond et substitution",
    p: "L’IA peut remplacer d’autres activités (recherche documentaire, déplacements, rédaction manuelle) ou en susciter de nouvelles (davantage de livrables, de versions, de vérifications). Le bilan net dépend de ce qu’elle évite ou provoque réellement, ce qu’aucune des sources citées ne mesure pour un bureau d’études." },
  { st: 0, t: "Effets indirects du travail produit",
    p: "Les analyses, les modèles et les outils réalisés avec l’aide de Claude influencent à leur tour des décisions de clients, dans un sens favorable ou défavorable à l’environnement. Ces effets peuvent être sans commune mesure avec l’empreinte de l’inférence, dans un sens comme dans l’autre, mais ils ne se mesurent pas de façon générale et relèvent de chaque mission." },
  { st: 1, t: "Recherche, développement et évaluations",
    p: "Le paramètre d’entraînement amorti couvre l’entraînement final et une part du développement, mais les sources ne distinguent pas les essais préalables, les évaluations de sécurité et les modèles abandonnés, dont la part dans l’énergie totale reste inconnue." },
  { st: 0, t: "Terminaux et réseau côté utilisateur",
    p: "Mistral attribue aux équipements des utilisateurs environ 3 % des émissions, 2 % de l’eau et 7 % de la matière de son analyse de cycle de vie, et au réseau moins de 1 %. Ces postes s’ajouteraient aux résultats de l’outil pour la part imputable à l’usage de Claude, mais ils restent faibles devant les centres de calcul." },
  { st: 1, t: "Durée de vie et renouvellement du matériel",
    p: "La fabrication du matériel est imputée à l’usage avec des ratios issus de Google et de Mistral, qui supposent une certaine durée d’amortissement. Un renouvellement plus rapide des puces d’IA, que la succession des nouvelles générations peut provoquer, augmenterait la part de la fabrication, notamment pour la matière." },
  { st: 0, t: "Énergie primaire et secours",
    p: "L’outil compte l’électricité finale consommée par les centres de données, et non l’énergie primaire nécessaire pour la produire, ni le carburant des groupes électrogènes de secours." }
];

P.autres = {
  build: function (root) {
    root.appendChild(h("div", { "class": "sec-head" }, [
      h("h2", { "class": "h2", text: "Ce que l’outil ne mesure pas, ou mesure mal" }),
      h("p", { text: nb("Les quatre indicateurs (électricité, carbone, eau et matière) ne résument pas l’ensemble des impacts de l’IA. Les angles morts ci-dessous sont classés selon qu’ils sont absents du calcul ou seulement partiellement pris en compte, afin de ne pas laisser croire que l’empreinte affichée est complète.") })
    ]));
    var grid = h("div", { "class": "grid2" });
    AUTRES.forEach(function (it) {
      grid.appendChild(h("article", { "class": "card imp" }, [
        h("div", null, h("span", { "class": "badge", text: it.st === 0 ? "Non modélisé" : "Partiellement modélisé" })),
        h("h3", { text: it.t }),
        h("p", { text: nb(it.p) })
      ]));
    });
    root.appendChild(grid);
    root.appendChild(h("div", { "class": "callout" },
      nb("La confidentialité des données des clients, la fiabilité des résultats, la dépendance à un fournisseur étranger et la souveraineté numérique ne relèvent pas du périmètre environnemental de cet outil ; elles dépendent plutôt de la politique d’usage de l’IA de l’entreprise.")));
  },
  update: function () {}
};

/* -------------------------------------------------------------- HYPOTHÈSES */
var FORMULAS =
"1. Énergie d’inférence d’une tâche, en Wh\n" +
"   E_tâche = m × (1 + L / c0) × [ N_entrée × e_in + N_cache × e_cache + N_sortie × effort × e_out ] / 1 000\n" +
"   avec e_in = r_in × e_out et e_cache = r_cache × e_in\n" +
"   N : jetons de la tâche · L : longueur moyenne du contexte · c0 : longueur de contexte qui double le coût par jeton\n" +
"   m = part Sonnet + part Opus × m_opus + part Haiku × m_haiku\n\n" +
"2. Énergie annuelle de l’organisation\n" +
"   E = vol_freq × Σ métiers Σ intensités Σ tâches  effectif × jours d’usage × occurrences par jour × vol_tok × E_tâche\n\n" +
"3. Passage de l’énergie aux quatre indicateurs (périmètre « cycle de vie avec entraînement »)\n" +
"   Électricité (Wh)  = E × (0,58 + 0,34 + 0,08 + k_train)\n" +
"   Carbone (g)       = E × (1 + k_train) × [ facteur_réseau × cif_f + emb_c / 1 000 ]\n" +
"   Eau (mL)          = E × (1 + k_train) × [ wue_site + wue_src × f_réseau + emb_w ]       avec f_réseau = 0,25 pour le réseau français et 1 sinon\n" +
"   Matière (mg Sb)   = E × (1 + k_train) × adpe / 1 000       dont 61 % pour le matériel et 39 % pour l’exploitation\n" +
"   Les périmètres plus étroits retirent les termes de fabrication (emb_*), d’entraînement (k_train) ou de serveurs et de site (0,34 et 0,08).";

var CONF = ["faible", "moyenne", "bonne"], CONF_DOTS = ["●○○", "●●○", "●●●"];

P.hypotheses = {
  build: function (root) {
    var self = this;
    root.appendChild(h("div", { "class": "sec-head" }, [
      h("h2", { "class": "h2", text: "Hypothèses, calage et sources" }),
      h("p", { text: nb("L’outil est une synthèse paramétrique de la littérature publique : il ne contient aucune mesure propre à Anthropic ni à Énergies Demain. Cet onglet expose chaque hypothèse afin qu’on puisse la contester, la fixer ou la remplacer.") })
    ]));

    root.appendChild(h("div", { "class": "card" }, A.lexique("Lexique des termes employés dans l’outil")));

    /* A. formules */
    var cA = h("div", { "class": "card stack" });
    cA.appendChild(h("h3", { "class": "h3", text: "Comment le calcul est construit" }));
    cA.appendChild(para("Le calcul part des jetons de chaque tâche, les convertit en énergie d’inférence, puis applique des coefficients propres à chaque indicateur et à chaque étape du cycle de vie. Comme les coefficients ne dépendent pas de la tâche, tous les impacts sont proportionnels à l’énergie d’inférence : les parts par tâche, par métier, par modèle et par type de jeton sont donc identiques d’un indicateur à l’autre, et seule la répartition entre étapes du cycle de vie change.", "muted small"));
    cA.appendChild(h("pre", { "class": "formula", text: FORMULAS, tabindex: "0" }));
    cA.appendChild(para("Les incertitudes sont propagées par 2 500 tirages de Monte-Carlo avec une graine fixe, de sorte que les résultats sont reproductibles. Chaque paramètre suit une loi log-normale asymétrique ajustée sur son 5e centile, sa médiane et son 95e centile, et les paramètres sont tirés indépendamment. Chaque tâche reçoit en outre un facteur de taille propre, dont les bornes figurent dans le modèle, afin de représenter la variabilité d’une occurrence à l’autre.", "muted small"));
    root.appendChild(cA);

    /* B. paramètres */
    var cB = h("div", { "class": "card stack" });
    cB.appendChild(h("h3", { "class": "h3", text: "Paramètres incertains" }));
    cB.appendChild(para("Chaque ligne donne la plage retenue pour un paramètre et la confiance que l’on peut lui accorder. Fixer un paramètre sur une de ses valeurs supprime son incertitude dans toutes les figures, ce qui permet de mesurer ce qu’il apporte au résultat ou de tester un scénario particulier.", "muted small"));
    var tb = h("table", { "class": "tbl" });
    tb.appendChild(h("thead", null, h("tr", null, ["Paramètre", "Unité", "P5", "Médiane", "P95", "Confiance", "Valeur utilisée"].map(function (c, i) { return h("th", { scope: "col", "class": i >= 2 && i <= 4 ? "r" : "", text: c }); }))));
    var body = h("tbody"); this.sels = [];
    var lastGroup = null;
    M.PARAMS.forEach(function (q) {
      if (q.group !== lastGroup) {
        lastGroup = q.group;
        body.appendChild(h("tr", null, h("td", { colspan: 7, style: "padding-top:14px;font-weight:600;color:var(--ink)", text: M.PARAM_GROUPS[q.group] })));
      }
      function fmtP(v) { return v.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: q.digits }); }
      var sel = h("select", { "aria-label": "Valeur utilisée pour : " + q.label }, [["", "Tirage aléatoire"], ["p5", "Fixer à P5"], ["p50", "Fixer à la médiane"], ["p95", "Fixer à P95"]].map(function (o) { return h("option", { value: o[0], text: o[1] }); }));
      sel.addEventListener("change", function () {
        var st = A.S(); if (sel.value) st.fixed[q.id] = sel.value; else delete st.fixed[q.id];
        A.touch();
      });
      self.sels.push({ el: sel, id: q.id });
      body.appendChild(h("tr", null, [
        h("td", { "class": "wrapc" }, [h("div", { text: q.label }), h("details", { "class": "d-mini" }, [h("summary", { text: "Justification" }), h("p", { text: nb(q.src) })])]),
        h("td", { text: q.unit.replace("CO2e", "CO₂e") }),
        h("td", { "class": "r", text: fmtP(q.p5) }), h("td", { "class": "r", text: fmtP(q.p50) }), h("td", { "class": "r", text: fmtP(q.p95) }),
        h("td", { title: "Confiance " + CONF[q.conf] }, h("span", { "class": "dots", "aria-label": "Confiance : " + CONF[q.conf], text: CONF_DOTS[q.conf] })),
        h("td", null, sel)
      ]));
    });
    tb.appendChild(body);
    /* écran étroit : une carte par paramètre (plage sur une ligne, puis confiance et choix de la valeur utilisée) */
    A.stack(tb, [12, 3, 3, 3, 3, 4, 8], ["", "Unité", "P5", "Médiane", "P95", "Confiance", "Valeur utilisée"]);
    cB.appendChild(h("div", { "class": "tscroll" }, tb));
    cB.appendChild(h("div", { "class": "row" }, [h("button", { type: "button", "class": "btn", text: "Remettre tous les paramètres en tirage aléatoire", onclick: function () { A.S().fixed = {}; A.touch(); } })]));
    root.appendChild(cB);

    /* C. contrôles de cohérence */
    this.checkBox = h("div", { "class": "card stack" });
    root.appendChild(this.checkBox);

    /* D. profils d’usage */
    var cD = h("div", { "class": "card stack" });
    cD.appendChild(h("h3", { "class": "h3", text: "Profils d’usage et budgets de jetons" }));
    cD.appendChild(para("Les journées types et les budgets de jetons reposent sur des cas d’usage typiques d’un bureau d’études et de conseil, et non sur un relevé de l’historique de Claude d’Énergies Demain, qui n’a pas pu être analysé depuis ce projet. Les effectifs par métier et par intensité (vingt personnes au total, surtout en usage faible ou moyen avec trois usages forts, ce qui correspond à des comptes gratuits ou à des abonnements Pro) sont des valeurs d’exemple à remplacer. Cette hypothèse est la plus fragile du modèle et la plus facile à améliorer, puisque les journaux d’usage de Claude Code et le récapitulatif de consommation du compte donnent les volumes réels de jetons.", "muted small"));
    cD.appendChild(para("Pour situer les usages, l’Anthropic Economic Index (mai 2026) rapporte que 23,8 % des conversations correspondent à des tâches informatiques et mathématiques, 5,8 % à des tâches de gestion et de finance et 3,6 % à des tâches d’architecture et d’ingénierie. Ces proportions décrivent l’ensemble des usages de Claude, non ceux d’Énergies Demain, et elles associent des conversations à des familles de tâches sans renseigner sur les métiers des utilisateurs.", "muted small"));
    root.appendChild(cD);

    /* E. limites */
    var cE = h("div", { "class": "card stack" });
    cE.appendChild(h("h3", { "class": "h3", text: "Limites à garder en tête" }));
    var lim = [
      "Anthropic n’a publié aucune mesure d’énergie, d’eau ou de carbone pour Claude : toutes les valeurs sont transposées à partir d’études portant sur d’autres services, et la taille comme l’architecture des modèles Sonnet et Opus sont inconnues.",
      "Les paramètres sont tirés indépendamment, alors que certains varient probablement ensemble, par exemple l’énergie par jeton et le rapport entre entrée et sortie ; l’intervalle global peut donc être un peu trop large ou trop étroit selon ces corrélations.",
      "L’outil fige l’état des connaissances à octobre 2026, alors que l’efficacité des services progresse vite : Google rapporte un gain d’un facteur 33 sur l’énergie par requête médiane en douze mois.",
      "Les abonnements Pro limitent l’usage par fenêtres de temps, mais Anthropic ne publie pas ces limites en jetons ; les tarifs d’API affichés servent uniquement à juger la vraisemblance des journées très intenses.",
      "Anthropic ne publie pas le lieu d’inférence de ses applications (la documentation de son API évoque « n’importe quelle zone géographique disponible », avec une option réservée aux États-Unis) : le facteur d’émission du réseau est donc un choix de scénario, fixé par défaut sur la moyenne des États-Unis et à comparer avec le réseau français, une valeur market-based et un réseau très carboné.",
      "Les modèles à raisonnement consomment en moyenne bien davantage d’énergie par requête d’après l’AI Energy Score v2 (environ trente fois, sur des modèles ouverts) ; l’outil représente cet effet par un facteur lié au niveau d’effort, réglable plutôt que mesuré : seul le rapport entre les niveaux Élevé et Moyen s’appuie sur un chiffre publié (Opus 4.5), les autres facteurs sont des ordres de grandeur."
    ];
    var ul = h("ul", { "class": "stack", style: "padding-left:1.1em;gap:8px;margin:0;color:var(--ink-2);font-size:13.5px;max-width:78ch" });
    lim.forEach(function (t) { ul.appendChild(h("li", { text: nb(t) })); });
    cE.appendChild(ul);
    root.appendChild(cE);

    /* F. sources */
    var cF = h("div", { "class": "card stack" });
    cF.appendChild(h("h3", { "class": "h3", text: "Sources" }));
    var SRC = [
      ["Elsworth et al. (Google), mesure de l’impact environnemental de l’IA à l’échelle de Google (2025)", "https://arxiv.org/abs/2508.15734", ""],
      ["Mistral AI, analyse de cycle de vie de Mistral Large 2 (juillet 2025)", "https://mistral.ai/news/our-contribution-to-a-global-environmental-standard-for-ai", ""],
      ["Jegham et al., How Hungry is AI ? (2025)", "https://arxiv.org/abs/2505.09598", ""],
      ["Epoch AI, How much energy does ChatGPT use ? (2025)", "https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use", ""],
      ["Étude de Microsoft sur l’énergie par requête (arXiv 2509.20241)", "https://arxiv.org/abs/2509.20241", ""],
      ["Hugging Face, AI Energy Score v2", "https://huggingface.co/blog/sasha/ai-energy-score-v2", ""],
      ["Couch, impact énergétique de Claude Code (janvier 2026)", "https://simonpcouch.com/blog/2026-01-20-cc-impact/", ""],
      ["Hausfather, The Climate Brink, The real energy use of agentic AI (2026)", "https://www.theclimatebrink.com/p/the-real-energy-use-of-agentic-ai", "lu par un résumé de presse : neoteo.com"],
      ["CLEER, Sustainable AI Group, tableau de bord de consommation", "https://cleerdash.sustainableaigroup.com/", "lu par un article de presse : computing.co.uk"],
      ["Watershed, recherche sur les émissions de l’IA", "https://watershed.com/blog/research-ai-emissions", "lu par un résumé secondaire"],
      ["Anthropic, coûts de Claude Code (environ 13 $ par développeur et par jour)", "https://code.claude.com/docs/en/costs", ""],
      ["Anthropic, système de recherche multi-agents (environ quinze fois plus de jetons qu’une conversation)", "https://www.anthropic.com/engineering/multi-agent-research-system", ""],
      ["Anthropic, résidence des données et zone d’inférence de l’API (valeurs « global » et « us »)", "https://platform.claude.com/docs/en/manage-claude/data-residency", ""],
      ["Anthropic, centre d’aide : où se trouvent les serveurs (page mise à jour le 15 juin 2026)", "https://privacy.claude.com/en/articles/7996890-where-are-your-servers-located-do-you-host-your-models-on-eu-servers", ""],
      ["Anthropic, 50 milliards de dollars pour des centres de données au Texas et à New York (novembre 2025)", "https://www.anthropic.com/news/anthropic-invests-50-billion-in-american-ai-infrastructure", ""],
      ["DatacenterDynamics, Anthropic cherche des capacités en Europe et en Australie (avril 2026)", "https://www.datacenterdynamics.com/en/news/anthropic-seeks-data-center-leasing-deals-in-europe-and-australia/", "lu par des résumés secondaires : letsdatascience.com et Yahoo Finance"],
      ["Anthropic, aide : régler le niveau d’effort et la réflexion étendue", "https://support.claude.com/en/articles/8664678-change-the-model-effort-and-extended-thinking-settings", ""],
      ["Anthropic, paramètre d’effort de l’API", "https://platform.claude.com/docs/en/build-with-claude/effort", ""],
      ["Anthropic, Claude Code : niveaux d’effort par défaut selon le modèle", "https://code.claude.com/docs/en/model-config", ""],
      ["Anthropic, présentation de Claude Opus 4.5 (jetons de sortie selon l’effort)", "https://www.anthropic.com/news/claude-opus-4-5", ""],
      ["Han et al., coût sanitaire des centres de données (arXiv 2412.06288)", "https://arxiv.org/abs/2412.06288", ""],
      ["ADEME, Base Empreinte (facteur de la France continentale)", "https://base-empreinte.ademe.fr/", ""],
      ["Ember, facteur d’émission du réseau américain", "https://ember-energy.org/", ""],
      ["Anthropic Economic Index", "https://www.anthropic.com/economic-index", ""],
      ["Heatmap, absence de publication des émissions d’Anthropic", "https://heatmap.news/climate/anthropic-carbon-emissions", ""],
      ["AZ VAI, Claude est-il durable ?", "https://azvai.com/en/is-claude-sustainable/", ""]
    ];
    var ol = h("ol", { "class": "src-list" });
    SRC.forEach(function (r) { ol.appendChild(h("li", null, [link(r[0], r[1]), r[2] ? h("span", { "class": "hint", text: " — " + r[2] }) : null])); });
    cF.appendChild(ol);
    /* sources du reste de l’entreprise (onglet Comparaison) */
    cF.appendChild(h("h3", { "class": "h3", text: "Sources du reste de l’entreprise (onglet Comparaison)", style: "margin-top:8px" }));
    var ol2 = h("ol", { "class": "src-list", start: SRC.length + 1 });
    M.BASE_SOURCES.forEach(function (r) { ol2.appendChild(h("li", null, [link(r[0], r[1]), r[2] ? h("span", { "class": "hint", text: " — " + r[2] }) : null])); });
    cF.appendChild(ol2);
    root.appendChild(cF);
    root.appendChild(h("p", { "class": "foot", text: nb("Les sources marquées comme lues par un résumé n’ont pas été consultées directement, et leurs valeurs doivent être vérifiées avant d’être reprises dans un document destiné à un client.") }));
  },
  update: function () {
    var S = A.S(), mc = A.MC();
    this.sels.forEach(function (x) { if (x.el !== document.activeElement) x.el.value = S.fixed[x.id] || ""; });
    /* contrôles de cohérence */
    var box = this.checkBox; A.clear(box);
    box.appendChild(h("h3", { "class": "h3", text: "Contrôles de cohérence avec la littérature" }));
    box.appendChild(para("Ces comparaisons montrent comment le modèle, avec les paramètres actuels, se situe par rapport aux valeurs qui ont servi à le caler. Elles utilisent le périmètre du site de calcul, qui est celui de la plupart des sources, quel que soit le périmètre choisi dans le scénario.", "muted small"));
    var T = M.TASKS.length, prep = mc.prep;
    var sRef = M.stats(mc.Eref), sDay = M.stats(mc.Ecode);
    var opus = new Float64Array(mc.N), whd = new Float64Array(mc.N), ti = M.taskIndex("feature_heavy");
    var cost = M.taskCostUSD(prep, ti);
    for (var k = 0; k < mc.N; k++) { opus[k] = mc.Ecode[k] * mc.mOpus[k]; whd[k] = mc.Unit[k * T + ti] / cost; }
    var sOp = M.stats(opus), sWd = M.stats(whd);
    function rng(st, ind) { return fv(ind, st.p50) + " (" + M.fmtRange(ind, st.p5, st.p95, 2) + ")"; }
    var rows = [
      ["Requête de référence (130 jetons d’entrée, 530 de sortie), sur Sonnet", rng(sRef, 0), "Google 0,24 Wh · Epoch 0,3 Wh · Microsoft 0,31 Wh · Jegham et al. 0,95 Wh"],
      ["Journée de développement assisté sur Sonnet (1,2 M de jetons frais, 20 M relus, 150 000 en sortie)", rng(sDay, 0), "Couch 1,3 kWh · Anthropic 13 $ par jour, soit environ 1 kWh"],
      ["La même journée sur Opus", rng(sOp, 0), "Hausfather 3,0 kWh par jour (1,2 à 5,9)"],
      ["Énergie par dollar d’API, fonctionnalité lourde en mode code (mélange du scénario)", fn(sWd.p50, 2) + " Wh/$ (" + fn(sWd.p5, 2) + " – " + fn(sWd.p95, 2) + ")", "Couch 75,5 Wh par dollar"]
    ];
    box.appendChild(A.tableEl({ head: ["Contrôle", "Outil : médiane (90 % des tirages)", "Littérature"], rows: rows.map(function (r) { return r.map(nb); }), num: [false, false, false], stack: [12, 12, 12] }));
    var where = sRef.p50 < 0.24 ? "en dessous des mesures en production (0,24 à 0,31 Wh)" : sRef.p50 <= 0.31 ? "au niveau des mesures en production (0,24 à 0,31 Wh)" : sRef.p50 <= 0.95 ? "entre les mesures en production (0,24 à 0,31 Wh) et l’estimation de Jegham et al. pour Claude 3.7 Sonnet (0,95 Wh)" : "au-dessus de l’estimation de Jegham et al. pour Claude 3.7 Sonnet (0,95 Wh)";
    var ratio = sWd.p50 / 75.5, inWd = 75.5 >= sWd.p5 && 75.5 <= sWd.p95;
    box.appendChild(para("La médiane de l’outil pour la requête de référence se situe " + where + ". Par dollar d’API, l’outil donne " + fn(ratio >= 1 ? ratio : 1 / ratio, 2) + " fois " + (ratio >= 1 ? "plus" : "moins") + " d’énergie que Couch (75,5 Wh par dollar), et la valeur de Couch " + (inWd ? "reste dans" : "sort de") + " l’intervalle à 90 % de l’outil.", "muted small"));
  }
};

})();
