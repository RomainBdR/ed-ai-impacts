# Empreinte IA Énergies Demain

Cet outil estime l’électricité, le carbone, l’eau et la matière mobilisés par l’usage de Claude à Énergies Demain, puis situe ces résultats par rapport au reste des activités de l’entreprise. Il s’agit d’une page web autonome qui s’exécute entièrement dans le navigateur : elle ne charge aucune ressource externe, ne transmet aucune donnée et mémorise les réglages localement lorsque le navigateur l’autorise.

**Page en ligne : <https://romainbdr.github.io/ed-ai-impacts/>**

## Ce que fait l’outil

Anthropic n’ayant publié aucune mesure de l’énergie consommée par Claude, l’outil transpose les mesures et les estimations publiées pour d’autres services d’IA générative. Il propage les incertitudes de ces sources par simulation de Monte-Carlo (2 500 tirages à chaque calcul), de sorte que chaque résultat s’exprime par une médiane et par un intervalle contenant 90 % des tirages. Les études disponibles divergent de plus d’un ordre de grandeur, et l’intervalle rend cette incertitude lisible plutôt que de la masquer.

Les quatre indicateurs sont l’électricité (Wh), les émissions de carbone (g CO₂e), l’eau évaporée (mL) et l’épuisement des ressources minérales (mg Sb éq.). Ils sont calculés sur le cycle de vie, en séparant l’exploitation des centres de calcul, le refroidissement, la fabrication du matériel et l’entraînement amorti.

## Contenu des onglets

| Onglet | Ce qu’on y trouve |
| --- | --- |
| Synthèse | Les résultats pour une année d’usage, leur répartition par étape du cycle de vie et des repères unitaires par tâche. |
| Scénario | Les effectifs par profil et par intensité d’usage, les jours travaillés, le mélange de modèles, le niveau d’effort, le périmètre et le réseau électrique. Le scénario peut être exporté et importé sous forme de texte. |
| Comparaison | La part de l’IA dans l’électricité, l’énergie finale, le carbone et l’eau de l’entreprise, le reste d’Énergies Demain étant estimé par postes (locaux, télétravail, déplacements, achats, numérique hors IA), et l’effet d’une augmentation de l’usage. |
| Décomposition | La répartition des résultats entre tâches, métiers, modèles et étapes du cycle de vie. |
| Tâches | L’impact d’une tâche unitaire, décrite par un budget de jetons que des mesures réelles peuvent remplacer. |
| Journées types | L’impact d’une journée d’usage pour chaque combinaison de métier et d’intensité, avec la composition de la journée. |
| Incertitudes et leviers | Les paramètres de la littérature qui pèsent le plus sur l’incertitude, et les choix (modèles, raisonnement, intensité) qui réduiraient l’impact. |
| Littérature | La position de l’outil parmi les valeurs publiées. |
| Autres impacts | Ce que l’outil ne mesure pas, ou mesure mal. |
| Hypothèses et sources | Les formules, les paramètres avec leur justification, et les sources. |

## Précautions de lecture

Les résultats sont des ordres de grandeur. Ils ne remplacent ni une mesure ni un bilan environnemental, et ils dépendent des hypothèses du scénario, que chaque personne peut modifier.

Dans l’onglet Comparaison, le reste d’Énergies Demain repose sur des valeurs par défaut génériques (28 personnes, 400 m² de locaux, 30 % du temps de travail à domicile) et sur des repères publiés, avec leurs propres incertitudes. Il convient de les remplacer par les factures d’électricité et de gaz et par le bilan carbone de l’entreprise dès que ces données sont disponibles, car la part de l’IA est très sensible à ce périmètre.

La part de l’eau tend à être surestimée : l’outil compte, pour l’IA, l’eau évaporée sur le site de calcul, pour produire l’électricité et pour fabriquer le matériel, alors que l’eau du reste de l’entreprise se limite à celle qui sert à produire son électricité. La matière n’est pas comparée, faute d’estimation pour le reste de l’entreprise.

Les effets de substitution et de rebond (ce que l’IA évite ou provoque par ailleurs) ne sont pas modélisés.

## Reconstruire la page

Node.js 18 ou plus récent suffit, sans aucune dépendance à installer.

```sh
node build.js              # écrit index.html à partir de src/
node tests/check.js        # contrôles automatiques du modèle
node tests/calibrage.js    # rapport : le modèle face aux valeurs publiées
```

La page publiée est le fichier `index.html` situé à la racine, que GitHub Pages sert depuis la branche `main`. Après une modification de `src/`, il faut reconstruire la page puis enregistrer `index.html` avec les sources.

```
index.html        page autonome générée (publiée par GitHub Pages)
src/              sources : model.js (modèle), ui-*.js et panels-*.js (interface), style.css, body.html
fonts/            polices hébergées avec leurs licences
assets/           image d’aperçu affichée lorsque le lien est partagé
tests/            contrôles du modèle
scripts/          scripts annexes (génération de l’image d’aperçu)
build.js          assemblage de la page
```

La commande `node build.js --artefact` écrit en outre `dist/artefact.html`, un fragment destiné à être publié comme artefact Claude, qui utilise les polices Google Fonts au lieu des polices hébergées.

## Polices et licences

Les polices IBM Plex Sans, IBM Plex Mono et Source Serif 4 sont distribuées sous licence SIL Open Font License 1.1 (voir `fonts/`). Elles sont hébergées dans le dépôt afin que la page n’adresse aucune requête à un service tiers.

Aucune licence n’est précisée à ce stade pour le code et les textes de l’outil : en l’absence de licence, tous droits sont réservés. Énergies Demain peut en choisir une avant toute réutilisation par des tiers.

## Origine

L’outil a été construit avec Claude (Anthropic) dans le cadre du projet « IA à Énergies Demain », à partir de la littérature publiée disponible au 25 octobre 2026.
