// Renders raster/PDF versions of the logo family and the brand book (księga znaku) PDF.
//   node branding/render.cjs        (after: python branding/build_logo.py)
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out");
const LOGOS = [
  ["pokaz-aed-logo", "#FFFFFF"],
  ["pokaz-aed-logo-pionowe", "#FFFFFF"],
  ["pokaz-aed-logo-negatyw", "#C8102E"],
  ["pokaz-aed-logo-mono", "#FFFFFF"],
  ["pokaz-aed-znak", "#FFFFFF"],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, bg] of LOGOS) {
    const svg = fs.readFileSync(path.join(OUT, `${name}.svg`), "utf8");
    const [, w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
    const pad = 0.12;
    const W = 2000;
    const scale = W / (w * (1 + 2 * pad));
    const H = Math.round(h * scale + w * scale * 2 * pad);
    const html = (background) =>
      `<html><body style="margin:0;background:${background}"><div style="width:${W}px;height:${H}px;display:flex;align-items:center;justify-content:center">` +
      `<img style="width:${Math.round(w * scale)}px" src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"></div></body></html>`;
    await page.setViewportSize({ width: W, height: H });
    await page.setContent(html(bg === "#FFFFFF" ? "transparent" : bg));
    await page.screenshot({ path: path.join(OUT, `${name}.png`), omitBackground: bg === "#FFFFFF" });
    await page.setContent(html(bg));
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 95 });
    // vector PDF, page sized to the artwork + clear space
    const pw = w * (1 + 2 * pad), ph = h + w * 2 * pad;
    await page.setContent(
      `<html><head><style>@page{size:${pw}px ${ph}px;margin:0}body{margin:0;background:${bg};-webkit-print-color-adjust:exact}</style></head>` +
        `<body><div style="width:${pw}px;height:${ph}px;display:flex;align-items:center;justify-content:center">${svg}</div></body></html>`,
    );
    await page.pdf({ path: path.join(OUT, `${name}.pdf`), width: `${pw}px`, height: `${ph}px`, printBackground: true });
    console.log("✓", name, "png/jpg/pdf");
  }
  await page.goto("file://" + path.join(__dirname, "ksiega-znaku.html"));
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(OUT, "pokaz-aed-ksiega-znaku.pdf"), format: "A4", landscape: true, printBackground: true, preferCSSPageSize: true });
  console.log("✓ pokaz-aed-ksiega-znaku.pdf");
  await browser.close();
})();
