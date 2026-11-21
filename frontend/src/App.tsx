import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AuthProvider } from "./lib/auth";
import MapPage from "./pages/MapPage";

const DataPage = lazy(() => import("./pages/DataPage"));
const StandardPage = lazy(() => import("./pages/StandardPage"));
const HolderPage = lazy(() => import("./pages/HolderPage"));
const CampaignPage = lazy(() => import("./pages/CampaignPage"));

const TITLES: Record<string, string> = {
  "/": "Znajdź AED",
  "/dane": "Dane otwarte",
  "/standard": "Wzorcowy zakres danych",
  "/dysponent": "Portal dysponenta",
  "/akcja": "O akcji",
};

function TitleSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${TITLES[pathname] ?? "Strona"} · GdzieAED`;
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="text-3xl font-extrabold">Nie znaleziono strony</h1>
      <a href="/" className="btn btn-primary mt-6">Wróć do mapy AED</a>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <TitleSync />
        <Suspense fallback={<div className="p-10 text-center text-muted">Ładowanie…</div>}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<MapPage />} />
              <Route path="dane" element={<DataPage />} />
              <Route path="standard" element={<StandardPage />} />
              <Route path="dysponent" element={<HolderPage />} />
              <Route path="akcja" element={<CampaignPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
