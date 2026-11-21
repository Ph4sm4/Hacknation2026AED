import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { fullTitle, routeMeta, structuredData } from "../lib/seo";

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

/**
 * Keeps <head> in sync with the current route on client-side navigation: title, description, canonical
 * (query string dropped, so /?aed=… deep links fold into /), Open Graph / Twitter, robots and JSON-LD.
 * The first load already gets the same tags from the pre-rendered HTML of each route.
 */
export function Seo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const r = routeMeta(pathname);
    const base = window.location.origin;
    const url = `${base}${r.path || pathname}`;
    const title = fullTitle(r);

    document.title = title;
    setMeta("name", "description", r.description);
    setMeta("name", "robots", r.noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1");
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", r.description);
    setMeta("property", "og:url", url);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", r.description);
    if (r.noindex) document.head.querySelector('link[rel="canonical"]')?.remove();
    else setCanonical(url);

    let ld = document.getElementById("ld-json") as HTMLScriptElement | null;
    if (!ld) {
      ld = document.createElement("script");
      ld.type = "application/ld+json";
      ld.id = "ld-json";
      document.head.appendChild(ld);
    }
    ld.textContent = r.noindex ? "" : JSON.stringify(structuredData(r, base));

    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
