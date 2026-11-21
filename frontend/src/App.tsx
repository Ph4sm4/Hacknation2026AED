import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Seo } from "./components/Seo";
import { AuthProvider } from "./lib/auth";
import MapPage from "./pages/MapPage";

const DataPage = lazy(() => import("./pages/DataPage"));
const StandardPage = lazy(() => import("./pages/StandardPage"));
const HolderPage = lazy(() => import("./pages/HolderPage"));
const CampaignPage = lazy(() => import("./pages/CampaignPage"));
const CoveragePage = lazy(() => import("./pages/CoveragePage"));
const ModerationPage = lazy(() => import("./pages/ModerationPage"));
const GuidePage = lazy(() => import("./pages/GuidePage"));

function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="text-3xl font-extrabold">Nie znaleziono strony</h1>
      <p className="mt-3 text-muted">Sprawdź adres albo przejdź do jednej z sekcji serwisu.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <a href="/" className="btn btn-primary">Wróć do mapy AED</a>
        <a href="/jak-uzyc-aed" className="btn btn-outline">Jak użyć AED</a>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Seo />
        <Suspense fallback={<div className="p-10 text-center text-muted">Ładowanie…</div>}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<MapPage />} />
              <Route path="dane" element={<DataPage />} />
              <Route path="standard" element={<StandardPage />} />
              <Route path="dysponent" element={<HolderPage />} />
              <Route path="akcja" element={<CampaignPage />} />
              <Route path="pokrycie" element={<CoveragePage />} />
              <Route path="moderacja" element={<ModerationPage />} />
              <Route path="jak-uzyc-aed" element={<GuidePage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
