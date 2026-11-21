/**
 * Build-time SEO for the single-page app.
 *  - Fills <head> with the route's title, description, canonical, Open Graph / Twitter tags and JSON-LD
 *    (dev server: per request; build: one HTML file per route, dist/<route>/index.html).
 *  - Adds a <noscript> summary with links to every section, so crawlers without JavaScript still find all pages.
 *  - Writes dist/404.html (noindex) and dist/seo-routes.json – the API builds robots.txt and sitemap.xml from it.
 * Absolute URLs use the __SITE_URL__ placeholder; the API replaces it with the public origin when serving.
 */
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { NOT_FOUND, ROUTES, SITE_NAME, SITE_TAGLINE, SITE_URL_PLACEHOLDER, fullTitle, routeMeta, structuredData, type RouteMeta } from "./src/lib/seo";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function head(r: RouteMeta, base: string): string {
  const title = esc(fullTitle(r));
  const desc = esc(r.description);
  const url = `${base}${r.path}`;
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${desc}" />`,
    `<meta name="robots" content="${r.noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1"}" />`,
    r.noindex ? "" : `<link rel="canonical" href="${url}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    `<meta property="og:url" content="${r.noindex ? base + "/" : url}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${desc}" />`,
    process.env.GOOGLE_SITE_VERIFICATION ? `<meta name="google-site-verification" content="${esc(process.env.GOOGLE_SITE_VERIFICATION)}" />` : "",
    process.env.BING_SITE_VERIFICATION ? `<meta name="msvalidate.01" content="${esc(process.env.BING_SITE_VERIFICATION)}" />` : "",
    r.noindex
      ? ""
      : `<script type="application/ld+json" id="ld-json">${JSON.stringify(structuredData(r, base)).replace(/</g, "\\u003c")}</script>`,
  ];
  return tags.filter(Boolean).join("\n    ");
}

function body(r: RouteMeta): string {
  const links = ROUTES.filter((x) => !x.noindex)
    .map((x) => `<li><a href="${x.path}">${esc(x.title)}</a></li>`)
    .join("");
  return `<noscript><main style="font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px">
      <p><strong>${SITE_NAME}</strong> – ${SITE_TAGLINE} W nagłym wypadku dzwoń <a href="tel:112">112</a>.</p>
      <h1>${esc(r.title)}</h1>
      <p>${esc(r.description)}</p>
      <p>Mapa i wyszukiwarka wymagają włączonej obsługi JavaScriptu. Dane można też pobrać bezpośrednio: <a href="/api/download/aed_polska.csv">CSV</a>, <a href="/api/download/aed_polska.geojson">GeoJSON</a>.</p>
      <ul>${links}</ul>
    </main></noscript>`;
}

const render = (html: string, r: RouteMeta, base: string) =>
  html.replace("<!--seo:head-->", head(r, base)).replace("<!--seo:body-->", body(r));

export function seo(): Plugin {
  let outDir = "dist";
  let template = "";
  return {
    name: "gdzieaed-seo",
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir);
    },
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        if (ctx.server) {
          // dev: tags for the requested route, absolute URLs on the dev origin
          const port = ctx.server.config.server.port ?? 5173;
          const r = routeMeta(new URL(ctx.originalUrl ?? "/", "http://x").pathname);
          return render(html, r, `http://localhost:${port}`).replaceAll(SITE_URL_PLACEHOLDER, `http://localhost:${port}`);
        }
        template = html; // build: keep the markers, fill them per route in closeBundle
        return render(html, ROUTES[0], SITE_URL_PLACEHOLDER);
      },
    },
    closeBundle() {
      const index = path.join(outDir, "index.html");
      if (!template || !fs.existsSync(index)) return;
      // the built index.html has hashed asset tags; re-use it and swap only the SEO blocks
      const built = fs.readFileSync(index, "utf8");
      const startHead = built.indexOf("<title>");
      const endHead = built.indexOf("</script>", built.indexOf('id="ld-json"')) + "</script>".length;
      const startBody = built.indexOf("<noscript>");
      const endBody = built.indexOf("</noscript>") + "</noscript>".length;
      const shell =
        built.slice(0, startHead) + "<!--seo:head-->" + built.slice(endHead, startBody) + "<!--seo:body-->" + built.slice(endBody);

      for (const r of ROUTES) {
        if (r.path === "/") continue;
        const dir = path.join(outDir, r.path.slice(1));
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "index.html"), render(shell, r, SITE_URL_PLACEHOLDER));
      }
      fs.writeFileSync(path.join(outDir, "404.html"), render(shell, NOT_FOUND, SITE_URL_PLACEHOLDER));
      fs.writeFileSync(
        path.join(outDir, "seo-routes.json"),
        JSON.stringify(
          ROUTES.map(({ path: p, priority, changefreq, dataDriven, noindex }) => ({ path: p, priority, changefreq, dataDriven: !!dataDriven, noindex: !!noindex })),
          null,
          2,
        ),
      );
    },
  };
}
