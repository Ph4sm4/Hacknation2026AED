/**
 * Search-engine and social metadata – one source for:
 *  - the in-app head manager (components/Seo.tsx),
 *  - the build step that writes a pre-filled HTML file per route + dist/seo-routes.json (vite.config.ts),
 *  - robots.txt and sitemap.xml served by the API (backend/aed/api/main.py reads seo-routes.json).
 * Plain data, no browser APIs: it runs in Node during the build.
 */
import { GUIDE_INTRO, GUIDE_STEPS } from "./aedGuide";

export const SITE_NAME = "GdzieAED";
export const SITE_TAGLINE = "Każda minuta się liczy.";
/** replaced with the public origin by the API when it serves the HTML (PUBLIC_BASE_URL or the request host) */
export const SITE_URL_PLACEHOLDER = "__SITE_URL__";
export const OG_IMAGE = "/og-image.png";

export type RouteMeta = {
  path: string;
  /** <title> without the site name suffix */
  title: string;
  description: string;
  /** sitemap hints */
  priority: number;
  changefreq: "daily" | "weekly" | "monthly";
  /** page content follows the AED dataset (lastmod = data build date) */
  dataDriven?: boolean;
  noindex?: boolean;
};

export const ROUTES: RouteMeta[] = [
  {
    path: "/",
    title: "Znajdź najbliższy defibrylator AED – mapa",
    description:
      "Mapa defibrylatorów AED w Polsce. Sprawdź, gdzie jest najbliższy AED, czy jest dostępny teraz i jak do niego dojść. Każda minuta się liczy.",
    priority: 1,
    changefreq: "daily",
    dataDriven: true,
  },
  {
    path: "/jak-uzyc-aed",
    title: "Jak użyć defibrylatora AED – instrukcja w 5 krokach",
    description:
      "Krótka instrukcja obsługi defibrylatora AED z rysunkami: włącz, naklej elektrody, nie dotykaj, wyładowanie, uciskaj dalej. Najpierw zadzwoń 112.",
    priority: 0.9,
    changefreq: "monthly",
  },
  {
    path: "/dane",
    title: "Otwarte dane o defibrylatorach AED – pobierz zbiór",
    description:
      "Ogólnopolski zbiór danych o defibrylatorach AED do pobrania w CSV, XLSX, GeoJSON i JSON oraz przez API. Dane dysponentów trafiają do dane.gov.pl.",
    priority: 0.8,
    changefreq: "daily",
    dataDriven: true,
  },
  {
    path: "/pokrycie",
    title: "Pokrycie AED w gminach i powiatach – białe plamy",
    description:
      "Ile defibrylatorów AED przypada na 10 tys. mieszkańców w każdej gminie i powiecie. Ranking gmin i mapa miejsc, w których AED brakuje.",
    priority: 0.7,
    changefreq: "weekly",
    dataDriven: true,
  },
  {
    path: "/standard",
    title: "Wzorcowy zakres danych o AED",
    description:
      "Jeden standard danych o defibrylatorach AED dla całej Polski: opis pól, słowniki, szablony CSV i XLSX, Table Schema i JSON Schema.",
    priority: 0.6,
    changefreq: "monthly",
  },
  {
    path: "/dysponent",
    title: "Portal dysponenta AED – udostępnij dane",
    description:
      "Masz defibrylator AED? Sprawdź plik z danymi, popraw błędy i opublikuj zbiór w dane.gov.pl w wzorcowym zakresie danych.",
    priority: 0.6,
    changefreq: "monthly",
  },
  {
    path: "/akcja",
    title: "O akcji GdzieAED",
    description:
      "GdzieAED to akcja zachęcająca dysponentów defibrylatorów do udostępniania danych w dane.gov.pl, żeby każdy mógł szybko znaleźć najbliższy AED.",
    priority: 0.5,
    changefreq: "monthly",
  },
  {
    path: "/moderacja",
    title: "Moderacja zgłoszeń",
    description: "Panel moderacji zgłoszeń mieszkańców.",
    priority: 0,
    changefreq: "monthly",
    noindex: true,
  },
];

export const NOT_FOUND: RouteMeta = {
  path: "",
  title: "Nie znaleziono strony",
  description: "Ta strona nie istnieje. Wróć do mapy defibrylatorów AED.",
  priority: 0,
  changefreq: "monthly",
  noindex: true,
};

export function routeMeta(pathname: string): RouteMeta {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return ROUTES.find((r) => r.path === p) ?? NOT_FOUND;
}

export function fullTitle(r: RouteMeta): string {
  return r.path === "/" ? `${SITE_NAME} – znajdź najbliższy defibrylator AED` : `${r.title} · ${SITE_NAME}`;
}

/** schema.org JSON-LD for a route; `base` is the public origin (or the placeholder at build time). */
export function structuredData(r: RouteMeta, base: string): object[] {
  const site = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${base}/#website`,
    name: SITE_NAME,
    alternateName: "Gdzie AED",
    url: `${base}/`,
    inLanguage: "pl-PL",
    description: ROUTES[0].description,
  };
  const page = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${base}${r.path}#webpage`,
    url: `${base}${r.path}`,
    name: r.title,
    description: r.description,
    inLanguage: "pl-PL",
    isPartOf: { "@id": `${base}/#website` },
    primaryImageOfPage: `${base}${OG_IMAGE}`,
  };
  const out: object[] = [site, page];

  if (r.path === "/jak-uzyc-aed") {
    out.push({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "Jak użyć defibrylatora AED",
      description: `${GUIDE_INTRO} Defibrylator prowadzi głosem krok po kroku.`,
      inLanguage: "pl-PL",
      totalTime: "PT1M",
      tool: [{ "@type": "HowToTool", name: "Automatyczny defibrylator zewnętrzny (AED)" }],
      step: GUIDE_STEPS.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.title,
        text: s.text,
        url: `${base}${r.path}#krok-${i + 1}`,
      })),
    });
  }

  if (r.path === "/dane") {
    const file = (name: string, format: string) => ({
      "@type": "DataDownload",
      encodingFormat: format,
      contentUrl: `${base}/api/download/${name}`,
    });
    const common = {
      "@context": "https://schema.org",
      "@type": "Dataset",
      inLanguage: "pl-PL",
      isAccessibleForFree: true,
      keywords: ["AED", "defibrylator", "automatyczny defibrylator zewnętrzny", "pierwsza pomoc", "otwarte dane", "Polska"],
      spatialCoverage: { "@type": "Place", name: "Polska", geo: { "@type": "GeoShape", box: "49.0 14.1 54.9 24.2" } },
      creator: { "@type": "Organization", name: SITE_NAME, url: `${base}/` },
      url: `${base}/dane`,
    };
    out.push(
      {
        ...common,
        "@id": `${base}/dane#dane-dysponentow`,
        name: "Defibrylatory AED w Polsce – dane dysponentów",
        description:
          "Lokalizacje defibrylatorów AED z oficjalnych zbiorów gmin i dysponentów, w wzorcowym zakresie danych: adres, opis miejsca, godziny i zasady dostępu.",
        license: "https://creativecommons.org/licenses/by/4.0/",
        distribution: [file("oficjalne.csv", "text/csv"), file("oficjalne.geojson", "application/geo+json"), file("oficjalne.json", "application/json")],
      },
      {
        ...common,
        "@id": `${base}/dane#zbior-zintegrowany`,
        name: "Defibrylatory AED w Polsce – zbiór zintegrowany (dane dysponentów i OpenStreetMap)",
        description:
          "Zintegrowany zbiór lokalizacji defibrylatorów AED: dane dysponentów połączone z OpenStreetMap, z identyfikatorem krajowym, źródłami i wskaźnikiem jakości.",
        license: "https://opendatacommons.org/licenses/odbl/1-0/",
        distribution: [
          file("aed_polska.csv", "text/csv"),
          file("aed_polska.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
          file("aed_polska.geojson", "application/geo+json"),
          file("aed_polska.json", "application/json"),
        ],
      },
    );
  }
  return out;
}
