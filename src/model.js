/* ============================================================================
   Modèle d’empreinte de l’usage de Claude — Énergies Demain
   Partie calcul, sans accès au DOM.
   Unités internes : énergie en Wh, carbone en g CO2e, eau en mL, matière en mg Sb éq.
   ========================================================================== */
(function (root) {
"use strict";

var Z95 = 1.6448536269514722;

/* ------------------------------------------------------------------ données */

var INDICATORS = [
  { id: "elec",   label: "Électricité", unitBase: "Wh" },
  { id: "co2",    label: "Carbone",     unitBase: "g" },
  { id: "water",  label: "Eau",         unitBase: "mL" },
  { id: "matter", label: "Matière",     unitBase: "mg" }
];

/* Étapes du cycle de vie (parts d’énergie : Google, Elsworth et al. 2025) */
var PHASES = [
  { id: "acc",   label: "Puces d’IA",                      long: "Puces spécialisées (GPU, TPU, Trainium) qui exécutent les calculs du modèle", share: 0.58 },
  { id: "host",  label: "Serveurs et réserve",             long: "Processeurs, mémoire et réseau des serveurs qui hébergent les puces, et machines tenues en réserve pour absorber les pointes de demande", share: 0.34 },
  { id: "site",  label: "Refroidissement et alimentation", long: "Refroidissement, distribution et conversion de l’électricité dans le centre de données", share: 0.08 },
  { id: "hw",    label: "Fabrication du matériel",         long: "Fabrication des serveurs et des puces, part imputée à l’usage", share: 0 },
  { id: "train", label: "Entraînement amorti",             long: "Entraînement et développement des modèles, amortis sur l’usage",   share: 0 }
];

var SCOPES = [
  { id: "acc",  label: "Puces d’IA seules",                         mask: [1, 0, 0, 0, 0], note: "Périmètre étroit : seule l’énergie des puces d’IA est comptée." },
  { id: "site", label: "Site de calcul complet",                    mask: [1, 1, 1, 0, 0], note: "Périmètre de l’étude de Google : puces d’IA, serveurs, capacité de réserve, refroidissement et alimentation du site." },
  { id: "acv",  label: "Cycle de vie de l’inférence",               mask: [1, 1, 1, 1, 0], note: "Ajoute la fabrication du matériel, comme dans l’analyse de cycle de vie de Mistral." },
  { id: "full", label: "Cycle de vie avec entraînement amorti",     mask: [1, 1, 1, 1, 1], note: "Ajoute l’entraînement et le développement des modèles, rapportés à l’usage." }
];

var GRIDS = [
  { id: "us_lb",    label: "États-Unis, réseau moyen",     lc: "la moyenne du réseau des États-Unis",             method: "location-based", cif: 0.345,
    note: "Facteur moyen de Google en 2024 (345 g/kWh). Jegham et al. retiennent 287 g/kWh pour AWS et Ember donne 384 g/kWh pour la moyenne américaine de 2024." },
  { id: "hyper_mb", label: "Hyperscaleur décarboné",       lc: "les achats d’électricité décarbonée d’un hyperscaleur", method: "market-based",  cif: 0.094,
    note: "Facteur market-based de Google en 2024 (94 g/kWh). Il traduit des contrats d’achat et non l’électricité physiquement consommée." },
  { id: "eu",       label: "Union européenne, moyenne",    lc: "la moyenne de l’Union européenne",                method: "location-based", cif: 0.24,
    note: "Ordre de grandeur de 200 à 275 g/kWh selon l’année et le périmètre retenus." },
  { id: "fr",       label: "France continentale",          lc: "la France continentale",                          method: "location-based", cif: 0.052, wsrc: 0.25,
    note: "ADEME, Base Empreinte : mix moyen de la France continentale en 2024, 51,9 g/kWh. L’eau consommée pour produire l’électricité est alors ramenée à environ 1 L/kWh (SDES, RTE), soit le quart de la valeur retenue pour les réseaux américains." },
  { id: "coal",     label: "Réseau très carboné",          lc: "un réseau très carboné",                          method: "location-based", cif: 0.80,
    note: "Test de sensibilité : ordre de grandeur d’un réseau à dominante charbon, qui encadre le résultat sans prétendre décrire un site réel." },
  { id: "custom",   label: "Valeur personnalisée",         lc: "une valeur personnalisée",                        method: "au choix",       cif: 0.30,
    note: "Valeur saisie ci-dessous, en g CO₂e par kWh." }
];

/* Paramètres globaux incertains : P5 / P50 / P95 (loi log-normale asymétrique). */
var PARAMS = [
  { id: "e_out", group: "energie", label: "Énergie par jeton de sortie", unit: "mWh/jeton", p5: 0.25, p50: 0.8, p95: 3.0, conf: 1, digits: 2,
    src: "Sonnet, contexte court, site complet. Recoupe 0,24 Wh par requête médiane (Google), 0,3 Wh pour 500 jetons (Epoch), 0,31 Wh pour 300 jetons (Microsoft) et 0,95 Wh pour 300 jetons (Jegham et al., Claude 3.7 Sonnet). Anthropic ne publie aucune mesure." },
  { id: "r_in", group: "energie", label: "Jeton d’entrée frais, rapporté au jeton de sortie", unit: "×", p5: 0.07, p50: 0.2, p95: 0.5, conf: 2, digits: 2,
    src: "Le traitement d’un jeton d’entrée (phase de pré-remplissage) coûte nettement moins que la génération d’un jeton de sortie : environ 0,2 d’après Couch (2026) et jusqu’à 1/15 d’après l’analyse de Muxup pour quelques milliers de jetons." },
  { id: "r_cache", group: "energie", label: "Jeton lu en cache, rapporté au jeton d’entrée frais", unit: "×", p5: 0.03, p50: 0.1, p95: 0.3, conf: 2, digits: 2,
    src: "Anthropic facture la lecture du cache à 0,1 fois le prix d’entrée ; Couch retient le même rapport (39 contre 390 Wh par million de jetons) et Hausfather fait l’hypothèse centrale de 10 %." },
  { id: "c0", group: "energie", label: "Longueur de contexte qui double le coût par jeton", unit: "k jetons", p5: 20, p50: 40, p95: 100, conf: 1, digits: 0,
    src: "Le coût par jeton croît avec la longueur du contexte (attention quadratique, cache de clés et de valeurs). Le calage reproduit les valeurs de Couch à 60 k jetons de contexte (1,95 mWh par jeton de sortie)." },
  { id: "m_opus", group: "energie", label: "Opus, rapporté à Sonnet", unit: "×", p5: 1.0, p50: 1.8, p95: 4.0, conf: 1, digits: 2,
    src: "Anthropic ne publie pas la taille des modèles. CLEER (Sustainable AI Group, 2026) estime les variantes de pointe à environ quatre fois les variantes légères, et Hausfather indique 5 à 7 fois pour les tâches simples. Les prix (5 et 25 $ contre 3 et 15 $ par million de jetons) vont dans le même sens." },
  { id: "m_haiku", group: "energie", label: "Haiku, rapporté à Sonnet", unit: "×", p5: 0.15, p50: 0.35, p95: 0.7, conf: 1, digits: 2,
    src: "Même base que ci-dessus. Haiku n’est qu’une part marginale dans les usages décrits par Énergies Demain." },
  { id: "k_train", group: "cycle", label: "Entraînement et développement, part de l’énergie d’inférence", unit: "×", p5: 0.1, p50: 0.4, p95: 1.5, conf: 1, digits: 2,
    src: "Epoch AI estime un rapport proche de 0,5 sur un an ; Jegham et al. considèrent que l’inférence représente jusqu’à 90 % du total ; Google exclut l’entraînement. Les usages agentiques en forte croissance tendent à augmenter la part de l’inférence." },
  { id: "emb_c", group: "cycle", label: "Fabrication du matériel, carbone par kWh d’exploitation", unit: "g CO2e/kWh", p5: 20, p50: 45, p95: 90, conf: 2, digits: 0,
    src: "Google rapporte 0,010 g pour 0,24 Wh, soit environ 42 g/kWh. L’analyse de cycle de vie de Mistral attribue 11 % des émissions au matériel contre 85,5 % à l’exploitation, ce qui donne un ordre de grandeur voisin." },
  { id: "cif_f", group: "cycle", label: "Incertitude sur le facteur d’émission du réseau", unit: "×", p5: 0.75, p50: 1.0, p95: 1.3, conf: 2, digits: 2,
    src: "Multiplicateur appliqué au facteur retenu dans le scénario. Anthropic ne publie pas le lieu où s’exécutent les calculs de ses applications ; pour l’API, sa documentation indique une inférence « dans n’importe quelle zone géographique disponible » par défaut, avec une option réservée aux États-Unis. Ses partenaires d’infrastructure connus (AWS, Google Cloud, Microsoft Azure) et les sites annoncés (Texas, New York) sont américains. L’intervalle couvre une part de calculs réalisés en Europe sans la rendre dominante." },
  { id: "wue_site", group: "eau", label: "Eau consommée sur site par kWh", unit: "L/kWh", p5: 0.1, p50: 0.4, p95: 1.2, conf: 2, digits: 2,
    src: "0,18 L/kWh pour AWS et 0,30 pour Azure (Jegham et al.), 1,15 pour la flotte de Google. Il s’agit d’eau consommée (évaporée), non prélevée." },
  { id: "wue_src", group: "eau", label: "Eau consommée pour produire l’électricité par kWh", unit: "L/kWh", p5: 1.0, p50: 4.0, p95: 7.0, conf: 1, digits: 1,
    src: "5,11 L/kWh (AWS) et 4,35 (Azure) d’après Jegham et al. ; la valeur dépend fortement de la filière (thermique avec tours, hydraulique, éolien, photovoltaïque) et de la méthode. Lorsque le réseau français est choisi dans le scénario, la valeur est multipliée par 0,25, ce qui ramène la médiane à environ 1 L/kWh, ordre de grandeur de l’eau évaporée par les centrales françaises d’après le SDES." },
  { id: "emb_w", group: "eau", label: "Fabrication du matériel, eau par kWh d’exploitation", unit: "L/kWh", p5: 0.1, p50: 0.25, p95: 0.6, conf: 1, digits: 2,
    src: "Dérivé de l’analyse de cycle de vie de Mistral : la fabrication du matériel représente environ 5 % de l’eau, contre 91 % pour l’exploitation." },
  { id: "adpe", group: "matiere", label: "Épuisement des ressources minérales par kWh", unit: "mg Sb éq./kWh", p5: 30, p50: 90, p95: 270, conf: 0, digits: 0,
    src: "Dérivé de Mistral (0,16 mg Sb éq. pour une réponse de 400 jetons) ; 61 % viennent du matériel et 29 % de l’exploitation. C’est le paramètre le moins bien documenté de l’outil." },
  { id: "vol_tok", group: "volume", label: "Taille réelle des tâches par rapport à nos budgets de jetons", unit: "×", p5: 0.6, p50: 1.0, p95: 1.7, conf: 1, digits: 2,
    src: "Erreur systématique possible sur l’ensemble des budgets de jetons de la grille de tâches, qui reposent sur des cas d’usage typiques et non sur des journaux réels." },
  { id: "vol_freq", group: "volume", label: "Fréquence réelle d’usage par rapport au scénario", unit: "×", p5: 0.7, p50: 1.0, p95: 1.4, conf: 1, digits: 2,
    src: "Erreur systématique possible sur le nombre de tâches par jour décrit dans les journées types." }
];

var PARAM_GROUPS = {
  energie: "Énergie par jeton",
  cycle: "Cycle de vie",
  eau: "Eau",
  matiere: "Matière",
  volume: "Volumes d’usage"
};

/* Catégories de tâches (couleur = ordre fixe de la palette catégorielle) */
var CATS = [
  { id: "echanges",   label: "Échanges et rédaction courte" },
  { id: "lecture",    label: "Lecture de documents" },
  { id: "recherche",  label: "Recherche en ligne" },
  { id: "production", label: "Production documentaire" },
  { id: "donnees",    label: "Données et modélisation" },
  { id: "code",       label: "Outils et développement" }
];

/* Budgets de jetons par tâche.
   nin = jetons d’entrée frais (entrée + écriture du cache), ncache = jetons relus dans le cache,
   nout = jetons de sortie y compris raisonnement, ctx = longueur moyenne du contexte. */
var TASKS = [
  { id: "q_simple",      cat: "echanges",   label: "Question simple",                         desc: "Question ponctuelle, réponse courte, raisonnement léger.",
    nin: 300,     ncache: 0,        nout: 900,    ctx: 500,    vol: [0.5, 2.5] },
  { id: "chat_multi",    cat: "echanges",   label: "Conversation de travail",                 desc: "Dix à quinze échanges sur un même sujet, avec un contexte qui s’allonge.",
    nin: 8000,    ncache: 60000,    nout: 8000,   ctx: 8000,   vol: [0.5, 2.5] },
  { id: "write_short",   cat: "echanges",   label: "Rédaction courte",                        desc: "Courriel, note, compte rendu, reformulation d’un texte.",
    nin: 4000,    ncache: 10000,    nout: 3000,   ctx: 3000,   vol: [0.5, 2.0] },
  { id: "pdf_read",      cat: "lecture",    label: "Lecture d’un PDF de 50 pages",            desc: "Lecture, synthèse et trois ou quatre questions de suivi sur le même document.",
    nin: 85000,   ncache: 200000,   nout: 5000,   ctx: 85000,  vol: [0.5, 2.5] },
  { id: "corpus",        cat: "lecture",    label: "Corpus de 30 à 50 documents",             desc: "Lecture d’un dossier entier, extraction des informations et tableau de synthèse.",
    nin: 800000,  ncache: 2500000,  nout: 40000,  ctx: 60000,  vol: [0.35, 2.8] },
  { id: "deep_research", cat: "recherche",  label: "Recherche approfondie en ligne",          desc: "Plusieurs dizaines de pages web lues par des sous-agents, rapport sourcé.",
    nin: 400000,  ncache: 800000,   nout: 30000,  ctx: 50000,  vol: [0.4, 2.5] },
  { id: "docx",          cat: "production", label: "Rapport .docx de 30 à 60 pages",          desc: "Rédaction et mise en forme d’une version complète du rapport.",
    nin: 150000,  ncache: 400000,   nout: 70000,  ctx: 60000,  vol: [0.5, 2.5] },
  { id: "pptx",          cat: "production", label: "Présentation .pptx de 30 à 50 diapositives", desc: "Structure, texte, mise en page et contrôle visuel des diapositives.",
    nin: 180000,  ncache: 600000,   nout: 60000,  ctx: 60000,  vol: [0.5, 2.5] },
  { id: "doc_rev",       cat: "production", label: "Révision d’un document existant",         desc: "Nouvelle itération sur un rapport ou une présentation déjà produits.",
    nin: 80000,   ncache: 300000,   nout: 25000,  ctx: 50000,  vol: [0.5, 2.2] },
  { id: "data_analysis", cat: "donnees",    label: "Analyse de données",                      desc: "Fichier tabulaire, traitements, graphiques et commentaires.",
    nin: 40000,   ncache: 300000,   nout: 15000,  ctx: 40000,  vol: [0.5, 2.5] },
  { id: "model_build",   cat: "donnees",    label: "Construction d’un modèle",                desc: "Modèle Python ou Excel construit ou modifié au cours d’une séance de travail.",
    nin: 100000,  ncache: 1500000,  nout: 40000,  ctx: 60000,  vol: [0.5, 2.5] },
  { id: "small_tool",    cat: "code",       label: "Petit outil ou script",                   desc: "Script, page web ou macro, quelques itérations (environ une heure).",
    nin: 40000,   ncache: 300000,   nout: 15000,  ctx: 40000,  vol: [0.4, 2.5] },
  { id: "feature_light", cat: "code",       label: "Fonctionnalité légère (mode code)",       desc: "Évolution ciblée d’un outil métier, une à deux heures de travail.",
    nin: 150000,  ncache: 2500000,  nout: 25000,  ctx: 60000,  vol: [0.4, 2.5] },
  { id: "feature_heavy", cat: "code",       label: "Fonctionnalité lourde (mode code)",       desc: "Chantier d’une journée dans un outil métier, nombreux fichiers modifiés.",
    nin: 1200000, ncache: 20000000, nout: 150000, ctx: 60000,  vol: [0.5, 2.2] }
];

var PERSONAS = [
  { id: "conseil",      label: "Conseil et études",             short: "Conseil",       desc: "Chargé(e)s d’études et consultant(e)s, travail surtout documentaire." },
  { id: "modelisation", label: "Modélisation et données",       short: "Modélisation",  desc: "Modèles, bases de données, scripts d’analyse." },
  { id: "dev",          label: "Développement d’outils métier", short: "Développement", desc: "Code et maintenance des outils internes." },
  { id: "commercial",   label: "Commercial et appels d’offres", short: "Commercial",    desc: "Réponses aux consultations, propositions, veille sur les clients." },
  { id: "projet",       label: "Direction de projet",           short: "Direction",     desc: "Profils mixtes : pilotage, rédaction, analyses ponctuelles." }
];

var INTENSITIES = [
  { id: "faible",  label: "Faible",     desc: "Quelques questions par jour, un document de temps en temps ; usage compatible avec un compte gratuit." },
  { id: "moyenne", label: "Moyenne",    desc: "Usage régulier : échanges, lecture de documents, recherches ponctuelles." },
  { id: "forte",   label: "Forte",      desc: "Usage quotidien soutenu, productions documentaires ou code chaque semaine." },
  { id: "tres",    label: "Très forte", desc: "Usage quasi continu, agents de code ou productions multiples chaque jour." }
];

/* Niveaux du sélecteur d’effort de Claude, exprimés en facteur sur les jetons de sortie (réflexion, appels d’outils et texte).
   Moyen, niveau par défaut de Sonnet 5.5 et d’Opus 5.5, sert de référence (×1) : les budgets de jetons des tâches sont calés sur lui.
   Seul le rapport entre Élevé et Moyen s’appuie sur un chiffre publié (Opus 4.5) ; les autres facteurs sont des ordres de grandeur. */
var EFFORTS = [
  { id: "low",    fr: "Faible",     en: "Low",        f: 0.5,
    note: "Réponses plus directes, moins de réflexion et moins d’appels d’outils ; adapté aux questions simples et aux tâches routinières. Facteur supposé : Anthropic annonce des économies de jetons significatives sans les chiffrer." },
  { id: "medium", fr: "Moyen",      en: "Medium",     f: 1,
    note: "Niveau par défaut de Sonnet 5.5 et d’Opus 5.5 ; c’est le niveau supposé par les budgets de jetons des tâches." },
  { id: "high",   fr: "Élevé",      en: "High",       f: 2,
    note: "Réflexion plus longue et davantage de vérifications. Sur un test de programmation, les chiffres publiés pour Opus 4.5 (76 % de jetons de sortie en moins que Sonnet 4.5 en effort moyen, 48 % de moins en effort élevé) correspondent à environ 2,2 fois plus de jetons en effort élevé qu’en effort moyen." },
  { id: "xhigh",  fr: "Très élevé", en: "Extra high", f: 3,
    note: "Prévu pour les travaux longs de code et d’agents, avec des budgets de jetons pouvant atteindre plusieurs millions. Facteur supposé, non publié." },
  { id: "max",    fr: "Maximal",    en: "Max",        f: 4,
    note: "Aucune limite de dépense en jetons ; la documentation de Claude Code signale des rendements décroissants et un risque de sur-réflexion. Facteur supposé, non publié." }
];

/* Tâches par jour d’usage : [persona][intensité] */
var DEFAULT_PERDAY_SPARSE = {
  conseil: [
    { q_simple: 4, chat_multi: 0.5, write_short: 1, pdf_read: 0.2 },
    { q_simple: 8, chat_multi: 2, write_short: 2, pdf_read: 0.6, corpus: 0.05, deep_research: 0.3, docx: 0.1, pptx: 0.05, doc_rev: 0.3 },
    { q_simple: 15, chat_multi: 4, write_short: 4, pdf_read: 1.5, corpus: 0.2, deep_research: 0.8, docx: 0.3, pptx: 0.2, doc_rev: 1 },
    { q_simple: 25, chat_multi: 6, write_short: 6, pdf_read: 3, corpus: 0.4, deep_research: 1.5, docx: 0.6, pptx: 0.4, doc_rev: 2, data_analysis: 0.3 }
  ],
  modelisation: [
    { q_simple: 4, chat_multi: 1, data_analysis: 0.1, small_tool: 0.1 },
    { q_simple: 8, chat_multi: 2, pdf_read: 0.2, data_analysis: 0.5, model_build: 0.2, small_tool: 0.3 },
    { q_simple: 12, chat_multi: 3, pdf_read: 0.5, deep_research: 0.2, data_analysis: 1, model_build: 0.5, small_tool: 0.6, feature_light: 0.2 },
    { q_simple: 15, chat_multi: 4, pdf_read: 0.5, deep_research: 0.3, data_analysis: 1.5, model_build: 1, small_tool: 1, feature_light: 0.5, feature_heavy: 0.3 }
  ],
  dev: [
    { q_simple: 5, chat_multi: 1, small_tool: 0.2, feature_light: 0.1 },
    { q_simple: 8, chat_multi: 2, small_tool: 0.4, feature_light: 0.5 },
    { q_simple: 10, chat_multi: 2, small_tool: 0.5, feature_light: 1, feature_heavy: 0.4 },
    { q_simple: 10, chat_multi: 2, small_tool: 0.5, feature_light: 1, feature_heavy: 0.8 }
  ],
  commercial: [
    { q_simple: 3, chat_multi: 0.3, write_short: 2 },
    { q_simple: 6, chat_multi: 1, write_short: 3, pdf_read: 0.5, deep_research: 0.2 },
    { q_simple: 10, chat_multi: 2, write_short: 5, pdf_read: 1, corpus: 0.15, deep_research: 0.5, docx: 0.3, pptx: 0.2, doc_rev: 0.8 },
    { q_simple: 15, chat_multi: 3, write_short: 7, pdf_read: 2, corpus: 0.3, deep_research: 1, docx: 0.5, pptx: 0.4, doc_rev: 1.5 }
  ],
  projet: [
    { q_simple: 4, chat_multi: 0.5, write_short: 1 },
    { q_simple: 8, chat_multi: 2, write_short: 2, pdf_read: 0.5, deep_research: 0.2, docx: 0.1, doc_rev: 0.3, data_analysis: 0.2 },
    { q_simple: 12, chat_multi: 3, write_short: 3, pdf_read: 1, corpus: 0.1, deep_research: 0.5, docx: 0.25, pptx: 0.15, doc_rev: 0.7, data_analysis: 0.5, small_tool: 0.2 },
    { q_simple: 18, chat_multi: 5, write_short: 4, pdf_read: 2, corpus: 0.2, deep_research: 1, docx: 0.4, pptx: 0.3, doc_rev: 1.2, data_analysis: 0.8, model_build: 0.3, small_tool: 0.4, feature_light: 0.2 }
  ]
};

/* Tarifs API indicatifs (génération 4.x, en $ par million de jetons) : repère de plausibilité uniquement. */
var PRICES = { s: { in: 3, out: 15 }, o: { in: 5, out: 25 }, h: { in: 1, out: 5 }, cacheRead: 0.1, freshFactor: 1.15 };

/* Requête de référence (Google) et journée de développement assisté (Anthropic, Couch) */
var REF_QUERY = { nin: 130, ncache: 0, nout: 530, ctx: 660 };
var CODE_DAY  = { nin: 1200000, ncache: 20000000, nout: 150000, ctx: 60000 };

var EQUIV = {
  laptopYearWh: 70000,     // 40 W pendant 1 760 h
  phoneChargeWh: 13,
  carGPerKm: 200,
  showerMl: 60000,
  gpuHourWh: 1400
};

/* --------------------------------------------------------------- utilitaires */

function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng) {
  var u = rng(); if (u < 1e-12) u = 1e-12;
  var v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* Loi log-normale asymétrique ajustée sur P5, P50, P95. */
function splitLN(z, p5, p50, p95) {
  return z < 0 ? p50 * Math.pow(p5 / p50, -z / Z95) : p50 * Math.pow(p95 / p50, z / Z95);
}

function quantileSorted(a, q) {
  var n = a.length; if (!n) return NaN;
  var pos = (n - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}

function sortedCopy(arr) { var c = Float64Array.from(arr); c.sort(); return c; }

function stats(arr) {
  var s = sortedCopy(arr), n = s.length, m = 0;
  for (var i = 0; i < n; i++) m += s[i];
  return { p5: quantileSorted(s, 0.05), p25: quantileSorted(s, 0.25), p50: quantileSorted(s, 0.5),
           p75: quantileSorted(s, 0.75), p95: quantileSorted(s, 0.95), mean: m / n, min: s[0], max: s[n - 1] };
}

function paramById(id) { for (var i = 0; i < PARAMS.length; i++) if (PARAMS[i].id === id) return PARAMS[i]; return null; }
function taskIndex(id) { for (var i = 0; i < TASKS.length; i++) if (TASKS[i].id === id) return i; return -1; }
function gridById(id) { for (var i = 0; i < GRIDS.length; i++) if (GRIDS[i].id === id) return GRIDS[i]; return GRIDS[0]; }
function scopeById(id) { for (var i = 0; i < SCOPES.length; i++) if (SCOPES[i].id === id) return SCOPES[i]; return SCOPES[3]; }

/* ------------------------------------------------------------------- état */

function defaultPerDay() {
  var out = [];
  for (var p = 0; p < PERSONAS.length; p++) {
    var row = [];
    for (var i = 0; i < INTENSITIES.length; i++) {
      var sparse = DEFAULT_PERDAY_SPARSE[PERSONAS[p].id][i], arr = [];
      for (var t = 0; t < TASKS.length; t++) arr.push(sparse[TASKS[t].id] || 0);
      row.push(arr);
    }
    out.push(row);
  }
  return out;
}

function defaultState() {
  return {
    v: 1,
    headcount: [[3, 3, 1, 0], [1, 2, 1, 0], [0, 2, 1, 0], [1, 2, 0, 0], [2, 1, 0, 0]],
    workdays: 200,
    activeRate: [0.35, 0.70, 0.90, 1.00],
    perDay: defaultPerDay(),
    budgets: {},
    mix: { s: 0.60, o: 0.35, h: 0.05 },
    effort: 1,
    scope: "full",
    grid: "us_lb",
    customCif: 0.30,
    volUnc: true,
    fixed: {},
    orgFootprint: null,
    base: defaultBase(),
    ref: null
  };
}

function num(x, d, lo, hi) {
  x = +x; if (!isFinite(x)) x = d;
  if (lo != null && x < lo) x = lo;
  if (hi != null && x > hi) x = hi;
  return x;
}

/* Valeur saisie facultative : null si le champ est vide ou invalide, zéro accepté. */
function numOrNull(x, hi) {
  if (x === null || x === undefined || x === "") return null;
  x = +x;
  if (!isFinite(x) || x < 0) return null;
  return hi != null && x > hi ? hi : x;
}

/* Fusionne un objet quelconque (JSON collé, localStorage) avec l’état par défaut, en nettoyant les valeurs. */
function sanitizeState(src) {
  var d = defaultState();
  if (!src || typeof src !== "object") return d;
  var P = PERSONAS.length, I = INTENSITIES.length, T = TASKS.length, p, i, t;
  if (Array.isArray(src.headcount)) for (p = 0; p < P; p++) for (i = 0; i < I; i++)
    if (src.headcount[p] && src.headcount[p][i] != null) d.headcount[p][i] = num(src.headcount[p][i], d.headcount[p][i], 0, 5000);
  d.workdays = num(src.workdays, d.workdays, 1, 366);
  if (Array.isArray(src.activeRate)) for (i = 0; i < I; i++) d.activeRate[i] = num(src.activeRate[i], d.activeRate[i], 0, 1);
  if (Array.isArray(src.perDay)) for (p = 0; p < P; p++) for (i = 0; i < I; i++) for (t = 0; t < T; t++)
    if (src.perDay[p] && src.perDay[p][i] && src.perDay[p][i][t] != null) d.perDay[p][i][t] = num(src.perDay[p][i][t], 0, 0, 1000);
  if (src.budgets && typeof src.budgets === "object") {
    for (t = 0; t < T; t++) {
      var b = src.budgets[TASKS[t].id];
      if (b && typeof b === "object") {
        var o = {};
        ["nin", "ncache", "nout", "ctx"].forEach(function (k) { if (b[k] != null) o[k] = num(b[k], TASKS[t][k], 0, 1e9); });
        d.budgets[TASKS[t].id] = o;
      }
    }
  }
  if (src.mix && typeof src.mix === "object") {
    var s = num(src.mix.s, d.mix.s, 0, 1), o2 = num(src.mix.o, d.mix.o, 0, 1), h = num(src.mix.h, d.mix.h, 0, 1), sum = s + o2 + h;
    if (sum > 0) d.mix = { s: s / sum, o: o2 / sum, h: h / sum };
  }
  d.effort = num(src.effort, d.effort, 0.1, 5);
  if (scopeById(src.scope).id === src.scope) d.scope = src.scope;
  if (gridById(src.grid).id === src.grid) d.grid = src.grid;
  d.customCif = num(src.customCif, d.customCif, 0, 2);
  d.volUnc = src.volUnc !== false;
  if (src.fixed && typeof src.fixed === "object") {
    PARAMS.forEach(function (q) { var f = src.fixed[q.id]; if (f === "p5" || f === "p50" || f === "p95") d.fixed[q.id] = f; });
  }
  d.orgFootprint = (src.orgFootprint != null && isFinite(+src.orgFootprint) && +src.orgFootprint > 0) ? +src.orgFootprint : null;
  if (src.base && typeof src.base === "object") {
    d.base.staff = Math.round(num(src.base.staff, d.base.staff, 1, 100000));
    d.base.area = num(src.base.area, d.base.area, 0, 1e7);
    d.base.homeShare = num(src.base.homeShare, d.base.homeShare, 0, 1);
    d.base.elecKWh = numOrNull(src.base.elecKWh, 1e10);
    d.base.gasKWh = numOrNull(src.base.gasKWh, 1e10);
  }
  if (src.ref && Array.isArray(src.ref.kpi) && src.ref.kpi.length === 4) d.ref = src.ref;
  return d;
}

/* ------------------------------------------------------- préparation du scénario */

function cifOf(scn) {
  var g = gridById(scn.grid);
  return scn.grid === "custom" ? scn.customCif : g.cif;
}

/* Multiplicateur de l’eau consommée pour produire l’électricité, selon le réseau (1 par défaut). */
function wsrcOf(scn) {
  var g = gridById(scn.grid);
  return g.wsrc != null ? g.wsrc : 1;
}

function prepare(scn) {
  var P = PERSONAS.length, I = INTENSITIES.length, T = TASKS.length, p, i, t, c;
  var cnt = new Float64Array(P * T), cellPer = new Float64Array(P * I * T), hc = new Float64Array(P * I);
  var days = [];
  for (i = 0; i < I; i++) days.push(scn.workdays * scn.activeRate[i]);
  for (p = 0; p < P; p++) for (i = 0; i < I; i++) {
    c = p * I + i; hc[c] = scn.headcount[p][i];
    for (t = 0; t < T; t++) {
      var v = scn.perDay[p][i][t] || 0;
      cellPer[c * T + t] = v;
      cnt[p * T + t] += hc[c] * days[i] * v;
    }
  }
  var nin = new Float64Array(T), nca = new Float64Array(T), nout = new Float64Array(T), ctx = new Float64Array(T);
  for (t = 0; t < T; t++) {
    var b = scn.budgets && scn.budgets[TASKS[t].id] || {};
    nin[t] = b.nin != null ? b.nin : TASKS[t].nin;
    nca[t] = b.ncache != null ? b.ncache : TASKS[t].ncache;
    nout[t] = b.nout != null ? b.nout : TASKS[t].nout;
    ctx[t] = b.ctx != null ? b.ctx : TASKS[t].ctx;
  }
  var m = scn.mix, sum = m.s + m.o + m.h; if (!(sum > 0)) sum = 1;
  return { T: T, P: P, I: I, cnt: cnt, cellPer: cellPer, hc: hc, days: days,
           nin: nin, nca: nca, nout: nout, ctx: ctx,
           mix: { s: m.s / sum, o: m.o / sum, h: m.h / sum }, effort: scn.effort, cif: cifOf(scn), wsrc: wsrcOf(scn), scn: scn };
}

function makeBuf(prep) {
  var T = prep.T;
  return {
    unit: new Float64Array(T), uIn: new Float64Array(T), uCa: new Float64Array(T), uOu: new Float64Array(T),
    Et: new Float64Array(T), Ep: new Float64Array(prep.P), Ecell: new Float64Array(prep.P * prep.I),
    Eday: new Float64Array(prep.P * prep.I), Em: new Float64Array(3), Etok: new Float64Array(3),
    A: new Float64Array(20), Etot: 0, eref: 0, erefMix: 0, ecode: 0, mm: 1, wsiteFrac: 0
  };
}

function singleTaskWh(nin, nca, nout, ctx, P, effort) {
  var f = 1 + ctx / (P.c0 * 1000), eIn = P.e_out * P.r_in, eCa = eIn * P.r_cache;
  return f * (nin * eIn + nca * eCa + nout * effort * P.e_out) / 1000;
}

/* Évalue le scénario pour un jeu de paramètres donné.
   volT[t] : facteur de taille par tâche ; volTok, freq : facteurs systématiques. */
function evaluateInto(prep, P, volT, volTok, freq, b) {
  var T = prep.T, NP = prep.P, NI = prep.I, t, p, c, i, j;
  var eOut = P.e_out, eIn = eOut * P.r_in, eCa = eIn * P.r_cache, c0 = P.c0 * 1000;
  var mS = prep.mix.s, mO = prep.mix.o * P.m_opus, mH = prep.mix.h * P.m_haiku, mm = mS + mO + mH;
  var effort = prep.effort;
  for (t = 0; t < T; t++) {
    var f = 1 + prep.ctx[t] / c0, v = volT[t] * volTok;
    var wi = f * prep.nin[t] * eIn * v / 1000, wc = f * prep.nca[t] * eCa * v / 1000, wo = f * prep.nout[t] * effort * eOut * v / 1000;
    b.uIn[t] = wi * mm; b.uCa[t] = wc * mm; b.uOu[t] = wo * mm;
    b.unit[t] = b.uIn[t] + b.uCa[t] + b.uOu[t];
  }
  var Etot = 0, tin = 0, tca = 0, tou = 0;
  for (t = 0; t < T; t++) b.Et[t] = 0;
  for (p = 0; p < NP; p++) {
    var ep = 0;
    for (t = 0; t < T; t++) {
      var cn = prep.cnt[p * T + t];
      if (cn) {
        var e = cn * b.unit[t];
        ep += e; b.Et[t] += e;
        tin += cn * b.uIn[t]; tca += cn * b.uCa[t]; tou += cn * b.uOu[t];
      }
    }
    b.Ep[p] = ep * freq; Etot += ep * freq;
  }
  for (t = 0; t < T; t++) b.Et[t] *= freq;
  b.Etot = Etot; b.Etok[0] = tin * freq; b.Etok[1] = tca * freq; b.Etok[2] = tou * freq;
  var es = mm > 0 ? Etot / mm : 0;
  b.Em[0] = mS * es; b.Em[1] = mO * es; b.Em[2] = mH * es; b.mm = mm;
  for (p = 0; p < NP; p++) for (i = 0; i < NI; i++) {
    c = p * NI + i;
    var ed = 0;
    for (t = 0; t < T; t++) { var q = prep.cellPer[c * T + t]; if (q) ed += q * b.unit[t]; }
    b.Eday[c] = ed;
    b.Ecell[c] = ed * prep.hc[c] * prep.days[i] * freq;
  }
  /* références (modèle Sonnet seul, raisonnement standard) */
  b.eref = singleTaskWh(REF_QUERY.nin, REF_QUERY.ncache, REF_QUERY.nout, REF_QUERY.ctx, P, 1);
  b.erefMix = singleTaskWh(REF_QUERY.nin, REF_QUERY.ncache, REF_QUERY.nout, REF_QUERY.ctx, P, effort) * mm;
  b.ecode = singleTaskWh(CODE_DAY.nin, CODE_DAY.ncache, CODE_DAY.nout, CODE_DAY.ctx, P, 1);
  /* coefficients par étape, pour chaque Wh d’énergie d’inférence */
  var cif = prep.cif * P.cif_f, w = P.wue_site + P.wue_src * prep.wsrc, k = P.k_train;
  var s0 = PHASES[0].share, s1 = PHASES[1].share, s2 = PHASES[2].share;
  var ao = P.adpe * 0.39 / 1000, ae = P.adpe * 0.61 / 1000, A = b.A;
  A[0] = s0; A[1] = s1; A[2] = s2; A[3] = 0; A[4] = k;
  A[5] = s0 * cif; A[6] = s1 * cif; A[7] = s2 * cif; A[8] = (1 + k) * P.emb_c / 1000; A[9] = k * cif;
  A[10] = s0 * w; A[11] = s1 * w; A[12] = s2 * w; A[13] = (1 + k) * P.emb_w; A[14] = k * w;
  A[15] = s0 * ao; A[16] = s1 * ao; A[17] = s2 * ao; A[18] = (1 + k) * ae; A[19] = k * ao;
  b.wsiteFrac = P.wue_site / w;
  return b;
}

function centralParams(fixed) {
  var P = {};
  PARAMS.forEach(function (q) { var f = fixed && fixed[q.id]; P[q.id] = f ? q[f] : q.p50; });
  return P;
}

/* ------------------------------------------------------------- Monte-Carlo */

function runMC(scn, opts) {
  opts = opts || {};
  var N = opts.N || 2500, seed = opts.seed || 20261025;
  var prep = prepare(scn), T = prep.T, NP = prep.P, NC = prep.P * prep.I;
  var rng = mulberry32(seed), b = makeBuf(prep);
  var fixed = scn.fixed || {}, volUnc = scn.volUnc !== false, taskVolSampled = volUnc && !fixed.vol_tok;
  var NPAR = PARAMS.length;
  var zs = new Float64Array(NPAR), zt = new Float64Array(T), volT = new Float64Array(T), P = {};
  var mc = {
    N: N, scn: scn, prep: prep,
    Etot: new Float64Array(N), Ep: new Float64Array(N * NP), Ecell: new Float64Array(N * NC), Et: new Float64Array(N * T),
    Em: new Float64Array(N * 3), Etok: new Float64Array(N * 3), Unit: new Float64Array(N * T), Eday: new Float64Array(N * NC),
    Eref: new Float64Array(N), ErefMix: new Float64Array(N), Ecode: new Float64Array(N), mOpus: new Float64Array(N),
    A: new Float64Array(N * 20), wsite: new Float64Array(N), cache: {}
  };
  var k, j, t, q, f, v;
  for (k = 0; k < N; k++) {
    for (j = 0; j < NPAR; j++) zs[j] = gauss(rng);
    for (t = 0; t < T; t++) zt[t] = gauss(rng);
    for (j = 0; j < NPAR; j++) {
      q = PARAMS[j]; f = fixed[q.id];
      if (f) v = q[f];
      else if (q.group === "volume" && !volUnc) v = q.p50;
      else v = splitLN(zs[j], q.p5, q.p50, q.p95);
      P[q.id] = v;
    }
    for (t = 0; t < T; t++) volT[t] = taskVolSampled ? splitLN(zt[t], TASKS[t].vol[0], 1, TASKS[t].vol[1]) : 1;
    evaluateInto(prep, P, volT, P.vol_tok, P.vol_freq, b);
    mc.Etot[k] = b.Etot;
    for (j = 0; j < NP; j++) mc.Ep[k * NP + j] = b.Ep[j];
    for (j = 0; j < NC; j++) { mc.Ecell[k * NC + j] = b.Ecell[j]; mc.Eday[k * NC + j] = b.Eday[j]; }
    for (t = 0; t < T; t++) { mc.Et[k * T + t] = b.Et[t]; mc.Unit[k * T + t] = b.unit[t]; }
    for (j = 0; j < 3; j++) { mc.Em[k * 3 + j] = b.Em[j]; mc.Etok[k * 3 + j] = b.Etok[j]; }
    mc.Eref[k] = b.eref; mc.ErefMix[k] = b.erefMix; mc.Ecode[k] = b.ecode; mc.mOpus[k] = P.m_opus;
    for (j = 0; j < 20; j++) mc.A[k * 20 + j] = b.A[j];
    mc.wsite[k] = b.wsiteFrac;
  }
  return mc;
}

/* Calcul déterministe aux valeurs centrales (ou fixées), pour la sensibilité et les leviers. */
function evalCentral(scn, paramOverrides, mask) {
  var prep = prepare(scn), b = makeBuf(prep), P = centralParams(scn.fixed);
  if (paramOverrides) for (var k in paramOverrides) P[k] = paramOverrides[k];
  var volT = new Float64Array(prep.T); volT.fill(1);
  evaluateInto(prep, P, volT, P.vol_tok, P.vol_freq, b);
  mask = mask || scopeById(scn.scope).mask;
  var res = { Etot: b.Etot, tot: [0, 0, 0, 0], buf: b, P: P };
  for (var i = 0; i < 4; i++) { var a = 0; for (var j = 0; j < 5; j++) if (mask[j]) a += b.A[i * 5 + j]; res.tot[i] = a * b.Etot; }
  return res;
}

/* --------------------------------------------------------- lecture des résultats */

function maskOf(mc) { return scopeById(mc.scn.scope).mask; }

function coefTot(mc, ind, k, mask) {
  var a = 0; for (var j = 0; j < 5; j++) if (mask[j]) a += mc.A[k * 20 + ind * 5 + j];
  return a;
}

/* Série N valeurs : total annuel de l’indicateur ind. */
function totalSeries(mc, ind, mask) {
  mask = mask || maskOf(mc);
  var key = "tot" + ind + mask.join(""); if (mc.cache[key]) return mc.cache[key];
  var out = new Float64Array(mc.N);
  for (var k = 0; k < mc.N; k++) out[k] = coefTot(mc, ind, k, mask) * mc.Etot[k];
  mc.cache[key] = out; return out;
}

function totalStats(mc, ind, mask) {
  mask = mask || maskOf(mc);
  var key = "ts" + ind + mask.join(""); if (mc.cache[key]) return mc.cache[key];
  var s = stats(totalSeries(mc, ind, mask)); mc.cache[key] = s; return s;
}

/* Part (0–1) de chaque étape dans le total de l’indicateur, avec dispersion. */
function phaseShares(mc, ind, mask) {
  mask = mask || maskOf(mc);
  var key = "ps" + ind + mask.join(""); if (mc.cache[key]) return mc.cache[key];
  var N = mc.N, res = [];
  for (var j = 0; j < 5; j++) {
    var sh = new Float64Array(N), val = new Float64Array(N);
    for (var k = 0; k < N; k++) {
      var tot = coefTot(mc, ind, k, mask);
      var a = mask[j] ? mc.A[k * 20 + ind * 5 + j] : 0;
      sh[k] = tot > 0 ? a / tot : 0; val[k] = a * mc.Etot[k];
    }
    var ss = stats(sh), sv = stats(val);
    res.push({ share: ss, value: sv, active: !!mask[j] });
  }
  /* normalise les parts moyennes pour qu’elles somment à 1 */
  var sum = 0; res.forEach(function (r) { sum += r.share.mean; });
  res.forEach(function (r) { r.frac = sum > 0 ? r.share.mean / sum : 0; });
  mc.cache[key] = res; return res;
}

/* Part de chaque composante d’une dimension (tâche, métier, modèle, jeton, cellule). */
function componentShares(mc, arr, n, name) {
  var key = "cs" + name; if (mc.cache[key]) return mc.cache[key];
  var res = [];
  for (var c = 0; c < n; c++) {
    var sh = new Float64Array(mc.N);
    for (var k = 0; k < mc.N; k++) { var tot = mc.Etot[k]; sh[k] = tot > 0 ? arr[k * n + c] / tot : 0; }
    var s = stats(sh); res.push({ share: s, frac: s.mean });
  }
  var sum = 0; res.forEach(function (r) { sum += r.frac; });
  res.forEach(function (r) { r.frac = sum > 0 ? r.frac / sum : 0; });
  mc.cache[key] = res; return res;
}

function componentValueStats(mc, arr, n, c, ind, mask) {
  mask = mask || maskOf(mc);
  var out = new Float64Array(mc.N);
  for (var k = 0; k < mc.N; k++) out[k] = coefTot(mc, ind, k, mask) * arr[k * n + c];
  return stats(out);
}

/* Impact unitaire d’une tâche (Wh → indicateur), statistiques. */
function unitStats(mc, t, ind, mask) {
  mask = mask || maskOf(mc);
  var key = "us" + t + "_" + ind + mask.join(""); if (mc.cache[key]) return mc.cache[key];
  var T = TASKS.length, out = new Float64Array(mc.N);
  for (var k = 0; k < mc.N; k++) out[k] = coefTot(mc, ind, k, mask) * mc.Unit[k * T + t];
  var s = stats(out); mc.cache[key] = s; return s;
}

function unitRatioStats(mc, t) {
  var key = "ur" + t; if (mc.cache[key]) return mc.cache[key];
  var T = TASKS.length, out = new Float64Array(mc.N);
  for (var k = 0; k < mc.N; k++) out[k] = mc.ErefMix[k] > 0 ? mc.Unit[k * T + t] / mc.ErefMix[k] : 0;
  var s = stats(out); mc.cache[key] = s; return s;
}

function dayStats(mc, cell, ind, mask) {
  mask = mask || maskOf(mc);
  var NC = mc.prep.P * mc.prep.I, out = new Float64Array(mc.N);
  for (var k = 0; k < mc.N; k++) out[k] = coefTot(mc, ind, k, mask) * mc.Eday[k * NC + cell];
  return stats(out);
}

function cellAnnualStats(mc, cell, ind, mask) {
  return componentValueStats(mc, mc.Ecell, mc.prep.P * mc.prep.I, cell, ind, mask);
}

/* Sensibilité : variation du total de l’indicateur ind quand un paramètre passe de P5 à P95, les autres restant centraux. */
function tornado(scn, ind) {
  var base = evalCentral(scn).tot[ind], rows = [];
  PARAMS.forEach(function (q) {
    if (q.group === "volume" && scn.volUnc === false) return;
    if (scn.fixed && scn.fixed[q.id]) return;
    var o5 = {}, o95 = {}; o5[q.id] = q.p5; o95[q.id] = q.p95;
    var lo = evalCentral(scn, o5).tot[ind], hi = evalCentral(scn, o95).tot[ind];
    rows.push({ id: q.id, label: q.label, unit: q.unit, group: q.group, lo: lo, hi: hi, base: base, swing: Math.abs(Math.log((hi || 1e-30) / (lo || 1e-30))) });
  });
  rows = rows.filter(function (r) { return r.swing > 1e-6; });
  rows.sort(function (a, b) { return b.swing - a.swing; });
  return rows;
}

/* Leviers de scénario : variation relative du total central de l’indicateur ind. */
function levers(scn, ind) {
  var base = evalCentral(scn).tot[ind];
  var list = [];
  function add(id, label, group, mod) {
    var s = deepCopy(scn); mod(s);
    var v = evalCentral(s).tot[ind];
    list.push({ id: id, label: label, group: group, value: v, delta: base > 0 ? v / base - 1 : 0 });
  }
  add("all_sonnet", "Tout sur Sonnet", "Modèle", function (s) { s.mix = { s: 1, o: 0, h: 0 }; });
  add("all_opus", "Tout sur Opus", "Modèle", function (s) { s.mix = { s: 0, o: 1, h: 0 }; });
  add("effort_low", "Niveau Faible (Low), ×0,5", "Effort", function (s) { s.effort = 0.5; });
  add("effort_high", "Niveau Élevé (High), ×2", "Effort", function (s) { s.effort = 2; });
  add("down", "Chaque personne descend d’un niveau d’intensité", "Intensité", function (s) {
    for (var p = 0; p < s.headcount.length; p++) {
      var h = s.headcount[p], n = [h[0] + h[1], h[2], h[3], 0];
      s.headcount[p] = n;
    }
  });
  add("up", "Chaque personne monte d’un niveau d’intensité", "Intensité", function (s) {
    for (var p = 0; p < s.headcount.length; p++) {
      var h = s.headcount[p], n = [0, h[0], h[1], h[2] + h[3]];
      s.headcount[p] = n;
    }
  });
  add("no_heavy", "Sans corpus, recherche approfondie ni chantier lourd", "Tâches", function (s) {
    var idx = [taskIndex("corpus"), taskIndex("deep_research"), taskIndex("feature_heavy")];
    for (var p = 0; p < s.perDay.length; p++) for (var i = 0; i < s.perDay[p].length; i++) idx.forEach(function (t) { s.perDay[p][i][t] = 0; });
  });
  if (scn.grid !== "fr") add("grid_fr", "Électricité du réseau français", "Réseau", function (s) { s.grid = "fr"; });
  if (scn.grid !== "coal") add("grid_coal", "Réseau très carboné", "Réseau", function (s) { s.grid = "coal"; });
  return { base: base, list: list };
}

/* Coût API indicatif d’une tâche, en dollars (mélange de modèles du scénario). */
function taskCostUSD(prep, t) {
  var m = prep.mix, e = prep.effort, pr = PRICES, total = 0;
  [["s", m.s], ["o", m.o], ["h", m.h]].forEach(function (x) {
    var price = pr[x[0]], share = x[1];
    total += share * (prep.nin[t] * price.in * pr.freshFactor + prep.nca[t] * price.in * pr.cacheRead + prep.nout[t] * e * price.out) / 1e6;
  });
  return total;
}

/* ====================================================================
   Reste de l’entreprise : estimation par postes et comparaison avec l’IA.
   Unités internes de cette partie : énergie en Wh, carbone en g CO2e, eau en mL.
   ================================================================== */

/* Valeurs de départ, à remplacer par celles d’Énergies Demain : effectif de 25 à 30 personnes selon la période. */
function defaultBase() {
  return { staff: 28, area: 400, homeShare: 0.3, elecKWh: null, gasKWh: null };
}

var BASE_GROUPS = {
  locaux: "Locaux et télétravail",
  facteurs: "Facteurs d’émission et d’eau",
  postes: "Autres postes d’émissions, par personne et par an",
  saisie: "Incertitude des valeurs saisies"
};

/* Paramètres incertains du reste de l’entreprise : P5 / P50 / P95, même loi que pour l’IA. */
var BASE_PARAMS = [
  { id: "b_int", group: "locaux", label: "Énergie finale des locaux par m² et par an, toutes énergies", unit: "kWh/m²/an", p5: 90, p50: 140, p95: 200, conf: 1, digits: 0,
    src: "Le baromètre 2022 de l’Observatoire de l’immobilier durable (OID) donne en moyenne 146 kWh/m² par an pour les immeubles de bureaux. L’intervalle retenu, de 90 à 200 kWh/m², est un choix de l’outil qui traduit l’écart entre un plateau récent ou rénové et un immeuble ancien ; il est à remplacer par les factures réelles." },
  { id: "b_gas", group: "locaux", label: "Part du gaz dans l’énergie finale des locaux", unit: "%", pct: true, p5: 0.05, p50: 0.22, p95: 0.45, conf: 0, digits: 0,
    src: "Hypothèse propre à Énergies Demain, dont une partie des locaux est chauffée au gaz et une partie à l’électricité. Si la moitié des surfaces est chauffée au gaz et que le chauffage pèse de l’ordre de 40 à 45 % de l’énergie finale d’un bureau, le gaz représente environ 22 % de cette énergie. L’intervalle est large faute de relevé." },
  { id: "b_tw", group: "locaux", label: "Énergie supplémentaire consommée à domicile par jour de télétravail", unit: "kWh/jour", p5: 0.7, p50: 1.4, p95: 2.5, conf: 1, digits: 1,
    src: "Premiers résultats (avril 2023) de l’étude de l’ADEME et de l’IFPEB menée auprès d’une centaine d’agents volontaires : l’effet rebond à domicile atteint en moyenne 1,4 kWh par jour de télétravail, qualifié de très faible ampleur. La valeur varie avec le chauffage du logement et la saison." },
  { id: "b_cif_e", group: "facteurs", label: "Émissions de l’électricité consommée en France", unit: "g CO2e/kWh", p5: 40, p50: 52, p95: 80, conf: 2, digits: 0,
    src: "ADEME, Base Empreinte : 51,9 g CO₂e/kWh pour l’électricité de la France continentale en 2024, analyse de cycle de vie comprise. Le contenu carbone de l’électricité varie au cours de l’année et tend à monter lors des pointes hivernales, d’où la borne haute à 80 g." },
  { id: "b_cif_g", group: "facteurs", label: "Émissions du gaz naturel", unit: "g CO2e/kWh", p5: 200, p50: 227, p95: 250, conf: 2, digits: 0,
    src: "ADEME, Base Empreinte : environ 227 g CO₂e par kWh (PCI) pour le gaz naturel distribué, amont compris, et environ 198 g pour la seule combustion." },
  { id: "b_wue", group: "facteurs", label: "Eau consommée pour produire un kWh d’électricité en France", unit: "L/kWh", p5: 0.5, p50: 1.0, p95: 2.5, conf: 1, digits: 1,
    src: "Le SDES estime à 0,5 milliard de m³ par an l’eau consommée (évaporée) par le refroidissement des centrales, soit 12 % de la consommation d’eau douce, après une première estimation de 1,7 milliard. Rapportée aux 539 TWh produits en 2024 (RTE), cette valeur donne environ 0,9 L/kWh, et environ 3 L/kWh avec l’ancienne estimation. L’évaporation des retenues hydrauliques n’est pas comptée." },
  { id: "b_mob", group: "postes", label: "Déplacements professionnels et trajets domicile-travail", unit: "kg CO2e/pers./an", p5: 25, p50: 80, p95: 300, conf: 0, digits: 0,
    src: "Énergies Demain n’utilise quasiment aucun véhicule motorisé individuel : les trajets se font à vélo, à pied et en transports en commun, et les déplacements professionnels surtout en train. À titre de comparaison, l’I4CE (41 équivalents temps plein) attribue 13 % de ses 141 t CO₂e de 2024 aux déplacements professionnels, soit 0,44 t par personne. La valeur centrale est un choix de l’outil, et la borne haute admet quelques trajets plus émetteurs." },
  { id: "b_purch", group: "postes", label: "Achats de services, de matériel et de fournitures, repas", unit: "kg CO2e/pers./an", p5: 1000, p50: 2400, p95: 3800, conf: 0, digits: 0,
    src: "Le bilan 2024 de l’I4CE, institut de recherche sur l’économie du climat de 41 équivalents temps plein, attribue 91 à 95 t CO₂e à l’achat de services et 11 t à l’alimentation, soit environ 2,5 t par personne. L’I4CE précise que ces postes reposent sur des ratios monétaires de l’ADEME, source d’incertitude importante ; les achats d’Énergies Demain peuvent différer sensiblement." },
  { id: "b_dig", group: "postes", label: "Numérique hors IA (matériel, réseaux, services en ligne)", unit: "kg CO2e/pers./an", p5: 50, p50: 130, p95: 350, conf: 0, digits: 0,
    src: "Le bilan 2024 de l’I4CE attribue 5 t CO₂e au numérique (3 % du total), soit environ 0,12 t par personne. Dans cet outil, ce poste ne comprend pas l’usage de l’IA, qui est compté séparément." },
  { id: "b_bilan_u", group: "saisie", label: "Incertitude d’un bilan carbone saisi", unit: "×", p5: 0.8, p50: 1.0, p95: 1.25, conf: 1, digits: 2,
    src: "Choix de l’outil : à défaut d’incertitude publiée pour un bilan donné, le total saisi est supposé connu à −20 % et +25 % (P5 et P95), ce qui rejoint la réserve de l’I4CE sur les ratios monétaires. Ce paramètre ne joue que si un bilan est saisi." },
  { id: "b_meas_u", group: "saisie", label: "Incertitude d’une consommation saisie d’après les factures", unit: "×", p5: 0.95, p50: 1.0, p95: 1.05, conf: 2, digits: 2,
    src: "Choix de l’outil : une consommation relevée sur facture est connue à quelques pour cent près. Ce paramètre ne joue que si une consommation est saisie." }
];

/* Postes du reste de l’entreprise : le rang de couleur (palette catégorielle) est fixé par poste. */
var BASE_ITEMS = {
  elecOff: { label: "Électricité des locaux", slot: 1 },
  gasOff:  { label: "Gaz des locaux", slot: 2 },
  home:    { label: "Télétravail", slot: 3 },
  mob:     { label: "Déplacements", slot: 4 },
  purch:   { label: "Achats, services et repas", slot: 5 },
  dig:     { label: "Numérique hors IA", slot: 6 },
  bilan:   { label: "Bilan carbone saisi", slot: 7 }
};

/* Lignes de la comparaison : indicateur de l’IA (rang dans INDICATORS) et postes du reste de l’entreprise. */
var CMP_ROWS = [
  { id: "elec",   ind: 0, label: "Électricité",                         short: "Électricité" },
  { id: "energy", ind: 0, label: "Énergie finale (électricité et gaz)", short: "Énergie finale" },
  { id: "co2",    ind: 1, label: "Carbone",                             short: "Carbone" },
  { id: "water",  ind: 2, label: "Eau liée à l’énergie",                short: "Eau" }
];

/* Eau potable des bureaux (APUR, bureaux parisiens en 2017) : prélevée puis rendue au réseau d’assainissement, donc non comparable à l’eau évaporée. */
var OFFICE_WATER_L_PER_DAY = 38;

var BASE_SOURCES = [
  ["OID, baromètre 2022 de la performance énergétique et environnementale des bâtiments (146 kWh/m² en moyenne pour les bureaux), relayé par Batiweb", "https://www.batiweb.com/actualites/developpement-durable/le-barometre-2022-de-la-performance-energetique-et-environnementale-des-batiments-devoile-41635", "article de presse ; baromètre complet non consulté"],
  ["ADEME et IFPEB, étude sur le télétravail et les consommations d’énergie (résultats préliminaires d’avril 2023), relayée par L’Info durable", "https://www.linfodurable.fr/vie-quotidienne/teletravail-un-reel-potentiel-deconomies-denergie-sous-conditions-37760", "article de presse ; rapport complet non consulté"],
  ["SDES, L’eau en France : ressource et utilisation (synthèse des connaissances en 2023)", "https://www.statistiques.developpement-durable.gouv.fr/leau-en-france-ressource-et-utilisation-synthese-des-connaissances-en-2023", ""],
  ["Connaissance des énergies (AFP), révision par le SDES de la consommation d’eau des centrales : 0,5 milliard de m³ au lieu de 1,7", "https://www.connaissancedesenergies.org/afp/la-consommation-deau-douce-des-centrales-nucleaires-divisee-par-trois-dans-une-nouvelle-estimation-de-lexecutif-230329", "article de presse"],
  ["RTE, Bilan électrique 2024 : principaux résultats (production de 539 TWh, consommation de 449 TWh)", "https://assets.rte-france.com/analyse-et-donnees/2025-09/BE2024%20-%20Principaux%20R%C3%A9sultats.pdf", ""],
  ["I4CE, bilan carbone 2024 (141 t CO₂e pour 41 équivalents temps plein)", "https://www.i4ce.org/wp-content/uploads/2026/01/Bilan-carbone-VF-2024.pdf", "le document donne deux valeurs pour les achats de services, 91 et 95 t"],
  ["APUR, consommation d’eau potable des bureaux parisiens (38 litres par salarié et par jour en 2017)", "https://www.apur.org/en/climate-environment/soil-water/drinking-water-facts-about-rate-use-buildings", ""]
];

/* Clé de mise en cache : tout ce dont dépend l’estimation du reste de l’entreprise. */
function baseKey(scn) {
  var b = scn.base || defaultBase();
  return [b.staff, b.area, b.homeShare, b.elecKWh, b.gasKWh, scn.orgFootprint, scn.workdays].join("|");
}

/* Simulation de Monte-Carlo du reste de l’entreprise, tirages indépendants de ceux de l’IA. */
function runBase(scn, opts) {
  opts = opts || {};
  var N = opts.N || 2500, seed = opts.seed || 20261028;
  var B = scn.base || defaultBase(), rng = mulberry32(seed);
  var NPAR = BASE_PARAMS.length, zs = new Float64Array(NPAR), P = {};
  var homeDays = B.staff * scn.workdays * B.homeShare;
  var hasBilan = scn.orgFootprint != null && scn.orgFootprint > 0;
  var names = ["elecOff", "elecHome", "gasOff", "gasHome", "homeEnergy", "cElecOff", "cGasOff", "cHome", "cMob", "cPurch", "cDig", "cBilan", "wOff", "wHome"];
  var a = {}; names.forEach(function (nm) { a[nm] = new Float64Array(N); });
  var k, j, q;
  for (k = 0; k < N; k++) {
    for (j = 0; j < NPAR; j++) zs[j] = gauss(rng);
    for (j = 0; j < NPAR; j++) { q = BASE_PARAMS[j]; P[q.id] = splitLN(zs[j], q.p5, q.p50, q.p95); }
    var g = Math.min(0.95, P.b_gas);
    var fin = B.area * P.b_int;                                                  /* kWh d’énergie finale des locaux */
    var eOff = B.elecKWh != null ? B.elecKWh * P.b_meas_u : fin * (1 - g);
    var gOff = B.gasKWh != null ? B.gasKWh * P.b_meas_u : fin * g;
    var home = homeDays * P.b_tw, eHome = home * (1 - g), gHome = home * g;
    a.elecOff[k] = eOff * 1000; a.elecHome[k] = eHome * 1000; a.gasOff[k] = gOff * 1000; a.gasHome[k] = gHome * 1000;
    a.homeEnergy[k] = (eHome + gHome) * 1000;
    a.cElecOff[k] = eOff * P.b_cif_e; a.cGasOff[k] = gOff * P.b_cif_g;
    a.cHome[k] = eHome * P.b_cif_e + gHome * P.b_cif_g;
    a.cMob[k] = B.staff * P.b_mob * 1000; a.cPurch[k] = B.staff * P.b_purch * 1000; a.cDig[k] = B.staff * P.b_dig * 1000;
    a.cBilan[k] = hasBilan ? scn.orgFootprint * 1e6 * P.b_bilan_u : 0;
    a.wOff[k] = eOff * P.b_wue * 1000; a.wHome[k] = eHome * P.b_wue * 1000;
  }
  return { N: N, scn: scn, key: baseKey(scn), hasBilan: hasBilan, homeDays: homeDays, a: a, cache: {} };
}

/* Postes de chaque ligne de comparaison, avec la série de tirages de chacun. */
function cmpItems(rowId, mcb) {
  var a = mcb.a;
  function it(key, arr, label) { return { key: key, label: label || BASE_ITEMS[key].label, slot: BASE_ITEMS[key].slot, arr: arr }; }
  if (rowId === "elec") return [it("elecOff", a.elecOff), it("home", a.elecHome, "Télétravail (électricité à domicile)")];
  if (rowId === "energy") return [it("elecOff", a.elecOff), it("gasOff", a.gasOff), it("home", a.homeEnergy, "Télétravail (électricité et gaz à domicile)")];
  if (rowId === "water") return [it("elecOff", a.wOff, "Électricité des locaux"), it("home", a.wHome, "Télétravail (électricité à domicile)")];
  if (mcb.hasBilan) return [it("bilan", a.cBilan)];
  return [it("elecOff", a.cElecOff), it("gasOff", a.cGasOff), it("home", a.cHome, "Télétravail (énergie à domicile)"),
          it("mob", a.cMob), it("purch", a.cPurch), it("dig", a.cDig)];
}

/* Compare, tirage par tirage, l’usage de l’IA et le reste de l’entreprise. */
function compare(mc, mcb) {
  var c = mc.cache.cmp;
  if (c && c.mcb === mcb) return c.rows;
  var N = mc.N, out = [];
  CMP_ROWS.forEach(function (def) {
    var ai = totalSeries(mc, def.ind), items = cmpItems(def.id, mcb), base = new Float64Array(N);
    var ratio = new Float64Array(N), share = new Float64Array(N), k, i;
    for (k = 0; k < N; k++) {
      var t = 0; for (i = 0; i < items.length; i++) t += items[i].arr[k];
      base[k] = t;
      var b = t > 1e-12 ? t : 1e-12, tot = ai[k] + b;
      ratio[k] = ai[k] / b; share[k] = tot > 0 ? ai[k] / tot : 0;
    }
    var aiSt = stats(ai), its = items.map(function (x) { return { key: x.key, label: x.label, slot: x.slot, stats: stats(x.arr) }; });
    /* composition au centre de la distribution : valeurs médianes de chaque poste rapportées à leur somme */
    var den = aiSt.p50; its.forEach(function (x) { den += x.stats.p50; });
    its.forEach(function (x) { x.frac = den > 0 ? x.stats.p50 / den : 0; });
    out.push({
      id: def.id, ind: def.ind, label: def.label, short: def.short,
      ai: aiSt, base: stats(base), share: stats(share), ratio: stats(ratio), aiFrac: den > 0 ? aiSt.p50 / den : 0, items: its
    });
  });
  mc.cache.cmp = { mcb: mcb, rows: out };
  return out;
}

/* Part de l’IA (quantiles) si l’usage était multiplié par m : x / (1 + x) est croissant en x, donc les quantiles se transportent. */
function shareAt(row, m) {
  function f(r) { var x = m * r; return x / (1 + x); }
  return { p5: f(row.ratio.p5), p50: f(row.ratio.p50), p95: f(row.ratio.p95) };
}

/* Multiplicateur de l’usage pour que la part de l’IA atteigne f, au quantile q du rapport IA / reste de l’entreprise. */
function multiplierFor(row, f, q) {
  var r = row.ratio[q || "p50"];
  return r > 0 ? (f / (1 - f)) / r : Infinity;
}

/* --------------------------------------------------------------- formatage */

var NBSP = " ", NNBSP = " ";

function roundSig(x, d) {
  if (!isFinite(x) || x === 0) return x;
  var m = Math.pow(10, d - 1 - Math.floor(Math.log10(Math.abs(x))));
  return Math.round(x * m) / m;
}

function fmtNum(x, d) {
  if (!isFinite(x)) return "–";
  d = d || 2;
  var r = roundSig(x, d);
  var mag = r === 0 ? 0 : Math.floor(Math.log10(Math.abs(r)));
  var dec = Math.max(0, d - 1 - mag);
  var s = r.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: Math.min(dec, 6) });
  return s;
}

function fmtPct(x, d) {
  if (!isFinite(x)) return "–";
  var v = x * 100, a = Math.abs(v);
  var dec = d != null ? d : (a < 10 ? 1 : 0);
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: dec }) + NNBSP + "%";
}

var UNITS = {
  elec:   [{ u: "mWh", div: 1e-3, max: 0.1 }, { u: "Wh", div: 1, max: 1e3 }, { u: "kWh", div: 1e3, max: 1e6 }, { u: "MWh", div: 1e6, max: 1e9 }, { u: "GWh", div: 1e9, max: Infinity }],
  co2:    [{ u: "mg CO₂e", div: 1e-3, max: 0.1 }, { u: "g CO₂e", div: 1, max: 1e3 }, { u: "kg CO₂e", div: 1e3, max: 1e6 }, { u: "t CO₂e", div: 1e6, max: Infinity }],
  water:  [{ u: "mL", div: 1, max: 1e3 }, { u: "L", div: 1e3, max: 1e6 }, { u: "m³", div: 1e6, max: Infinity }],
  matter: [{ u: "µg Sb éq.", div: 1e-3, max: 0.1 }, { u: "mg Sb éq.", div: 1, max: 1e3 }, { u: "g Sb éq.", div: 1e3, max: 1e6 }, { u: "kg Sb éq.", div: 1e6, max: Infinity }]
};

/* Choisit l’unité d’après une valeur de référence ; renvoie {u, div}. */
function unitFor(ind, ref) {
  var list = UNITS[INDICATORS[ind].id], a = Math.abs(ref);
  if (!(a > 0)) return list[1];
  for (var i = 0; i < list.length; i++) if (a < list[i].max) return list[i];
  return list[list.length - 1];
}

function fmtVal(ind, x, d, unit) {
  if (!isFinite(x)) return "–";
  var un = unit || unitFor(ind, x);
  return fmtNum(x / un.div, d || 2) + NBSP + un.u;
}

function fmtRange(ind, lo, hi, d) {
  var un = unitFor(ind, hi);
  return fmtNum(lo / un.div, d || 2) + " – " + fmtNum(hi / un.div, d || 2) + NBSP + un.u;
}

/* ------------------------------------------------------------ équivalences */

function equivalences(ind, x) {
  var out = [];
  if (ind === 0) {
    out.push({ n: x / EQUIV.laptopYearWh, text: "ordinateurs portables utilisés pendant une année de travail (40 W, 1 760 h)" });
    out.push({ n: x / EQUIV.phoneChargeWh, text: "recharges complètes d’un smartphone (13 Wh)" });
  } else if (ind === 1) {
    out.push({ n: x / EQUIV.carGPerKm, text: "kilomètres en voiture thermique moyenne (0,2 kg CO₂e par km)" });
  } else if (ind === 2) {
    out.push({ n: x / EQUIV.showerMl, text: "douches de 60 litres" });
  }
  return out;
}

var API = {
  INDICATORS: INDICATORS, PHASES: PHASES, SCOPES: SCOPES, GRIDS: GRIDS, PARAMS: PARAMS, PARAM_GROUPS: PARAM_GROUPS,
  CATS: CATS, TASKS: TASKS, PERSONAS: PERSONAS, INTENSITIES: INTENSITIES, EFFORTS: EFFORTS, PRICES: PRICES, REF_QUERY: REF_QUERY, CODE_DAY: CODE_DAY,
  EQUIV: EQUIV, UNITS: UNITS,
  BASE_PARAMS: BASE_PARAMS, BASE_GROUPS: BASE_GROUPS, BASE_ITEMS: BASE_ITEMS, BASE_SOURCES: BASE_SOURCES, CMP_ROWS: CMP_ROWS, OFFICE_WATER_L_PER_DAY: OFFICE_WATER_L_PER_DAY,
  defaultBase: defaultBase, baseKey: baseKey, runBase: runBase, compare: compare, shareAt: shareAt, multiplierFor: multiplierFor, wsrcOf: wsrcOf,
  defaultState: defaultState, sanitizeState: sanitizeState, deepCopy: deepCopy, prepare: prepare, runMC: runMC, evalCentral: evalCentral,
  centralParams: centralParams, singleTaskWh: singleTaskWh,
  totalSeries: totalSeries, totalStats: totalStats, phaseShares: phaseShares, componentShares: componentShares,
  componentValueStats: componentValueStats, unitStats: unitStats, unitRatioStats: unitRatioStats, dayStats: dayStats,
  cellAnnualStats: cellAnnualStats, tornado: tornado, levers: levers, taskCostUSD: taskCostUSD,
  stats: stats, quantileSorted: quantileSorted, sortedCopy: sortedCopy, coefTot: coefTot, maskOf: maskOf,
  fmtNum: fmtNum, fmtPct: fmtPct, fmtVal: fmtVal, fmtRange: fmtRange, unitFor: unitFor, equivalences: equivalences,
  paramById: paramById, gridById: gridById, scopeById: scopeById, taskIndex: taskIndex, cifOf: cifOf, splitLN: splitLN,
  mulberry32: mulberry32, gauss: gauss, NBSP: NBSP, NNBSP: NNBSP
};

if (typeof module !== "undefined" && module.exports) module.exports = API; else root.EDM = API;
})(typeof window !== "undefined" ? window : this);
