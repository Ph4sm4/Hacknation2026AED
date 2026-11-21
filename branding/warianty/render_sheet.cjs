// Comparison sheet of GdzieAED logo variants → PNG + PDF.
//   node branding/warianty/render_sheet.cjs
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out");
const variants = JSON.parse(fs.readFileSync(path.join(OUT, "variants.json"), "utf8"));
const read = (f) => fs.readFileSync(path.join(OUT, f), "utf8");
const img = (f, style) => `<img style="${style}" src="data:image/svg+xml;base64,${Buffer.from(read(f)).toString("base64")}" alt="">`;

const rows = variants
  .map(
    (v) => `
  <section class="row">
    <div class="meta"><h2>${v.name}</h2><p>${v.concept}</p></div>
    <div class="cell pos">${img(`${v.key}-logo.svg`, "max-height:58px;max-width:100%")}</div>
    <div class="cell" style="background:${v.neg_bg}">${img(`${v.key}-negatyw.svg`, "max-height:64px;max-width:100%")}</div>
    <div class="cell icons">
      ${img(`${v.key}-ikona.svg`, "width:64px;height:64px")}
      ${img(`${v.key}-ikona.svg`, "width:32px;height:32px")}
      ${img(`${v.key}-ikona.svg`, "width:16px;height:16px")}
    </div>
    <div class="cell small">${img(`${v.key}-logo.svg`, "height:22px")}</div>
  </section>`,
  )
  .join("");

const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<style>
@font-face{font-family:Inter;font-weight:100 900;src:url("file://${path.join(__dirname, "../../frontend/node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2")}") format("woff2")}
@font-face{font-family:Inter;font-weight:100 900;src:url("file://${path.join(__dirname, "../../frontend/node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2")}") format("woff2");unicode-range:U+0100-024F}
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box}
body{margin:0;padding:28px 32px;font-family:Inter,sans-serif;color:#101828;background:#fff;width:1500px}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #C8102E;padding-bottom:12px;margin-bottom:6px}
header h1{margin:0;font-size:28px;font-weight:800;color:#0B3D91;letter-spacing:-.02em}
header p{margin:0;font-size:13px;color:#475467}
.cols{display:grid;grid-template-columns:300px 1.5fr 1.5fr 150px 170px;gap:12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#475467;padding:10px 0 6px}
.row{display:grid;grid-template-columns:300px 1.5fr 1.5fr 150px 170px;gap:12px;align-items:stretch;border-top:1px solid #D0D5DD;padding:12px 0}
.meta h2{margin:0 0 4px;font-size:17px;font-weight:800}
.meta p{margin:0;font-size:12px;line-height:1.45;color:#475467}
.cell{border:1px solid #D0D5DD;border-radius:4px;display:flex;align-items:center;justify-content:center;padding:14px;min-height:104px}
.cell.pos{background:#fff}
.icons{gap:14px;background:#F5F7FA}
.icons img{box-shadow:0 0 0 1px #D0D5DD}
.small{background:#fff}
</style></head><body>
<header><div><p>HackNation 2026 · Misja AED</p><h1>GdzieAED – warianty znaku</h1></div><p>Paleta: czerwień #C8102E · granat #0B3D91 · biel. Promień zaokrąglenia ≤ 4 px.</p></header>
<div class="cols"><span>Koncepcja</span><span>Wersja podstawowa</span><span>Negatyw</span><span>Ikona 64 / 32 / 16 px</span><span>Mały rozmiar</span></div>
${rows}
</body></html>`;

(async () => {
  fs.writeFileSync(path.join(OUT, "warianty.html"), html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1564, height: 900 }, deviceScaleFactor: 2 });
  await page.goto("file://" + path.join(OUT, "warianty.html"));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, "gdzieaed-warianty.png"), fullPage: true });
  await page.pdf({ path: path.join(OUT, "gdzieaed-warianty.pdf"), width: "1564px", height: `${await page.evaluate(() => document.body.scrollHeight + 56)}px`, printBackground: true });
  await browser.close();
  console.log("✓ gdzieaed-warianty.png / .pdf");
})();
