#!/usr/bin/env node
/* Génère assets/apercu.jpg (1200 × 630 px), l’image affichée lorsque le lien de la page est partagé.
   Elle montre l’introduction de la page telle que la rend un navigateur, en thème clair.

   Ce script est facultatif : il nécessite le paquet playwright (npm install --no-save playwright, puis
   npx playwright install chromium) et la page construite (node build.js). */
"use strict";
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");

const root = path.join(__dirname, "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png" };

const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "/index.html"));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

server.listen(0, "127.0.0.1", async () => {
  const url = "http://127.0.0.1:" + server.address().port + "/";
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 720 }, colorScheme: "light", deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    /* l’introduction occupe 604 px de haut, à 26 px du bord : on garde une marge égale de 13 px au-dessus et au-dessous */
    const box = await page.locator(".hero").boundingBox();
    const top = Math.round(box.y + box.height / 2 - 315);
    fs.mkdirSync(path.join(root, "assets"), { recursive: true });
    await page.screenshot({ path: path.join(root, "assets", "apercu.jpg"), type: "jpeg", quality: 90, clip: { x: 0, y: top, width: 1200, height: 630 } });
    console.log("assets/apercu.jpg écrit (marge haute " + (Math.round(box.y) - top) + " px)");
  } finally {
    await browser.close(); server.close();
  }
});
