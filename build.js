#!/usr/bin/env node
/* Assemble la page de l’outil à partir des fichiers du dossier src/.

   Usage :
     node build.js              écrit index.html (page publiée sur GitHub Pages ; polices hébergées dans fonts/)
     node build.js --artefact   écrit dist/artefact.html (fragment destiné à un artefact Claude ; polices Google Fonts)

   La page est un fichier HTML unique : le style et le code y sont inclus, et aucune bibliothèque externe n’est utilisée. */
"use strict";
const fs = require("fs");
const path = require("path");

const root = __dirname;
const read = (f) => fs.readFileSync(path.join(root, "src", f), "utf8");

const SITE_URL = "https://romainbdr.github.io/ed-ai-impacts/";
const TITLE = "Empreinte IA Énergies Demain";
const DESCRIPTION = "Estimation de l’électricité, du carbone, de l’eau et de la matière mobilisés par l’usage de Claude à Énergies Demain, avec leurs incertitudes, et comparaison avec le reste des impacts de l’entreprise.";
const IMAGE_ALT = "Aperçu de l’outil : la question « Quelle empreinte laisse notre usage de l’IA ? » et trois entrées pour commencer.";

/* ordre de chargement : le modèle, puis le noyau de l’interface, les graphiques, les onglets et le démarrage */
const SCRIPTS = [
  "model.js", "ui-core.js", "ui-charts.js",
  "panels-synthese-scenario.js", "panels-analyse.js", "panels-sources.js", "panels-comparaison.js",
  "ui-boot.js"
];

for (const f of SCRIPTS) {
  try { new Function(read(f)); } catch (e) { console.error("Erreur de syntaxe dans " + f + " : " + e.message); process.exit(1); }
}
const js = SCRIPTS.map(read).join("\n;\n");
if (/<\/script/i.test(js)) { console.error("Une balise </script> figure dans le code : elle fermerait le script de la page."); process.exit(1); }

const css = read("style.css");
const body = read("body.html").replace("/*JS*/", () => js);

/* polices hébergées : sous-ensemble latin des familles IBM Plex Sans, IBM Plex Mono et Source Serif 4 (licence SIL OFL, voir fonts/) */
const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const face = (family, weight, file) =>
  `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(fonts/${file}) format("woff2");unicode-range:${LATIN}}`;
const fontFaces = [
  face("IBM Plex Sans", 400, "ibm-plex-sans-latin-400-normal.woff2"),
  face("IBM Plex Sans", 500, "ibm-plex-sans-latin-500-normal.woff2"),
  face("IBM Plex Sans", 600, "ibm-plex-sans-latin-600-normal.woff2"),
  face("IBM Plex Mono", 400, "ibm-plex-mono-latin-400-normal.woff2"),
  face("IBM Plex Mono", 500, "ibm-plex-mono-latin-500-normal.woff2"),
  /* police variable (graisse et corps optique) : la graisse 600 sert aux titres */
  face("Source Serif 4", "200 900", "source-serif-4-latin-opsz-normal.woff2")
].join("\n");

const favicon = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#11303d"/>' +
  '<circle cx="21" cy="11" r="5" fill="#f3b94d"/><g stroke="#f4f9fa" stroke-width="3" stroke-linecap="round" stroke-opacity=".85">' +
  '<line x1="6" y1="19" x2="20" y2="19"/><line x1="6" y1="25" x2="14" y2="25"/></g></svg>');

function standalone() {
  const preload = ["ibm-plex-sans-latin-400-normal.woff2", "ibm-plex-sans-latin-600-normal.woff2", "source-serif-4-latin-opsz-normal.woff2"]
    .map((f) => `<link rel="preload" href="fonts/${f}" as="font" type="font/woff2" crossorigin>`).join("\n");
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#edf0f1">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b1217">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="Énergies Demain">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:url" content="${SITE_URL}">
<meta property="og:image" content="${SITE_URL}assets/apercu.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${IMAGE_ALT}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${favicon}">
${preload}
<style>
:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}
img{max-width:100%}
[hidden]{display:none!important}
${fontFaces}
${css}
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

/* fragment pour un artefact Claude : l’enveloppe (doctype, viewport, remise à zéro) est ajoutée à la publication ; seules les polices Google sont autorisées */
function artefact() {
  return `<title>${TITLE}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,600&display=swap">
<style>
${css}
</style>

${body}`;
}

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + " Ko";
if (process.argv.includes("--artefact")) {
  fs.mkdirSync(path.join(root, "dist"), { recursive: true });
  const out = artefact();
  fs.writeFileSync(path.join(root, "dist", "artefact.html"), out);
  console.log("dist/artefact.html : " + kb(out));
} else {
  const out = standalone();
  fs.writeFileSync(path.join(root, "index.html"), out);
  console.log("index.html : " + kb(out));
}
