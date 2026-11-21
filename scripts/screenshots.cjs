// Captures presentation screenshots of the running app (default http://localhost:8000).
//   node scripts/screenshots.cjs [baseUrl]
const { chromium, devices } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = process.argv[2] || "http://localhost:8000";
const OUT = path.join(__dirname, "..", "docs", "screenshots");
const SAMPLE = path.join(__dirname, "..", "data", "sources", "danegovpl_marki.csv");
fs.mkdirSync(OUT, { recursive: true });

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined;
const WARSZAWA_CENTRALNA = { latitude: 52.2289, longitude: 21.0034 };

async function waitTiles(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
}

(async () => {
  const browser = await chromium.launch({ proxy });
  const shot = (page, name, full = false) => page.screenshot({ path: path.join(OUT, name), fullPage: full });

  // ---------------------------------------------------------------- desktop
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    geolocation: WARSZAWA_CENTRALNA,
    permissions: ["geolocation"],
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
  });
  const page = await ctx.newPage();
  await page.goto(BASE + "/");
  await page.waitForResponse((r) => r.url().includes("/api/aed/points"));
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/aed/nearest") && r.url().includes("lat=52.228")),
    page.getByRole("button", { name: "Użyj mojej lokalizacji" }).click(),
  ]);
  await waitTiles(page);
  await shot(page, "01-mapa-najblizsze-aed.png");
  await page.locator("ol li button").first().click();
  await page.waitForSelector("section[aria-label^='Szczegóły']");
  await waitTiles(page);
  await shot(page, "02-mapa-szczegoly-aed.png");
  await page.getByRole("button", { name: /Zgłoś problem/ }).click();
  await page.locator("section[aria-label^='Szczegóły']").evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await shot(page, "03-zgloszenie-problemu.png");

  // zoomed-out national view
  await page.goto(BASE + "/");
  await page.waitForSelector("ol li button");
  await page.waitForTimeout(1500);
  for (let i = 0; i < 9; i++) {
    await page.locator(".leaflet-control-zoom-out").click().catch(() => {});
    await page.waitForTimeout(350);
  }
  await waitTiles(page);
  await shot(page, "04-mapa-polska.png");

  for (const [route, name] of [["/dane", "05-dane-otwarte.png"], ["/standard", "06-wzorcowy-zakres.png"], ["/akcja", "07-akcja-gdzieaed.png"]]) {
    await page.goto(BASE + route);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    await shot(page, name, true);
  }

  // holder portal: register (password eye toggle), validate a real dane.gov.pl file, publish
  await page.goto(BASE + "/dysponent");
  await page.getByRole("tab", { name: "Załóż konto" }).click();
  await page.getByLabel("Nazwa instytucji (dysponent)").fill("Gmina Miasto Marki");
  await page.getByLabel("REGON").fill("013269071");
  await page.getByLabel("E-mail służbowy").fill(`aed+${Date.now()}@marki.example.pl`);
  await page.getByLabel("Hasło", { exact: true }).fill("BezpieczneHaslo2026!");
  await page.getByLabel("Powtórz hasło").fill("BezpieczneHaslo2026!");
  await page.getByRole("button", { name: "Pokaż hasło" }).first().click();
  await shot(page, "08-dysponent-rejestracja.png");
  await page.getByRole("button", { name: "Załóż konto" }).last().click();
  await page.waitForSelector("text=Zalogowano jako");
  await page.setInputFiles("input[type=file]", SAMPLE);
  await page.waitForSelector("text=Mapowanie kolumn");
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "09-dysponent-raport-walidacji.png", true);
  await page.selectOption("#d-dostepnosc", "publiczny");
  await page.selectOption("#d-status", "aktywny");
  await page.fill("#d-godziny_dostepnosci", "Mo-Fr 08:00-16:00");
  await page.fill("#d-data_weryfikacji", "2026-11-20");
  await page.getByRole("button", { name: "Sprawdź ponownie" }).click();
  await page.waitForSelector("text=Plik jest w pełni zgodny");
  await page.getByRole("button", { name: /Przekaż/ }).click();
  await page.waitForSelector("text=Zbiór przekazany");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await shot(page, "10-dysponent-publikacja.png", true);

  await page.goto(BASE + "/api/docs");
  await page.waitForSelector(".swagger-ui .opblock", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  await shot(page, "11-api-openapi.png");
  await ctx.close();

  // ---------------------------------------------------------------- mobile
  const m = await browser.newContext({ ...devices["iPhone 13"], geolocation: WARSZAWA_CENTRALNA, permissions: ["geolocation"], locale: "pl-PL", timezoneId: "Europe/Warsaw" });
  const mp = await m.newPage();
  await mp.goto(BASE + "/");
  await mp.waitForResponse((r) => r.url().includes("/api/aed/points"));
  await Promise.all([
    mp.waitForResponse((r) => r.url().includes("/api/aed/nearest") && r.url().includes("lat=52.228")),
    mp.getByRole("button", { name: "Użyj mojej lokalizacji" }).click(),
  ]);
  await mp.waitForTimeout(500);
  await shot(mp, "12-mobile-lista.png");
  await mp.locator("ol li button").first().click();
  await mp.waitForSelector("section[aria-label^='Szczegóły']");
  await waitTiles(mp);
  await shot(mp, "13-mobile-szczegoly.png");
  await mp.goto(BASE + "/akcja");
  await mp.waitForLoadState("networkidle");
  await shot(mp, "14-mobile-akcja.png");
  await mp.goto(BASE + "/dysponent");
  await mp.waitForLoadState("networkidle");
  await mp.getByLabel("Hasło", { exact: true }).fill("tajnehaslo");
  await mp.getByRole("button", { name: "Pokaż hasło" }).click();
  await shot(mp, "15-mobile-logowanie.png");
  await browser.close();
  console.log("Screenshots saved to", OUT);
})();
