import { Menu, Phone, X, LogOut, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Logo } from "./Logo";

const NAV = [
  { to: "/", label: "Znajdź AED", end: true },
  { to: "/dane", label: "Dane otwarte" },
  { to: "/pokrycie", label: "Pokrycie" },
  { to: "/standard", label: "Wzorcowy zakres" },
  { to: "/dysponent", label: "Dla dysponentów" },
  { to: "/akcja", label: "O akcji" },
];

export function Layout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const loc = useLocation();
  const fullBleed = loc.pathname === "/";

  useEffect(() => setOpen(false), [loc.pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[2000] focus:bg-white focus:p-3 focus:font-semibold">
        Przejdź do treści
      </a>

      {/* Emergency strip – always visible */}
      <div className="bg-brand text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-sm">
          <p className="font-medium tracking-[-0.01em]">
            <span className="font-extrabold uppercase tracking-[0.06em]">Zatrzymanie krążenia?</span>
            <span className="mx-2 hidden opacity-60 sm:inline" aria-hidden>/</span>
            <span className="hidden sm:inline">Dzwoń 112, uciskaj klatkę piersiową, poproś kogoś o AED.</span>
          </p>
          <a href="tel:112" className="inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-ink px-3 py-1.5 font-black tracking-[-0.02em] text-white hover:bg-white hover:text-brand">
            <Phone className="h-4 w-4" aria-hidden /> 112
          </a>
        </div>
      </div>

      <header className="sticky top-0 z-[1000] border-b border-ink/15 bg-white">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4">
          <Link to="/" aria-label="GdzieAED – strona główna">
            <Logo />
          </Link>
          <nav aria-label="Główna nawigacja" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV.map((n) => (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) =>
                      `relative block px-3 py-2 text-[15px] font-bold tracking-[-0.01em] transition-colors ${
                        isActive ? "text-ink after:absolute after:inset-x-3 after:-bottom-[17px] after:h-1 after:bg-brand" : "text-ink/60 hover:text-ink"
                      }`
                    }
                  >
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            {user ? (
              <>
                {user.is_moderator && (
                  <Link to="/moderacja" className="btn btn-outline py-2">
                    Moderacja
                  </Link>
                )}
                <Link to="/dysponent" className="flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-brand">
                  <UserRound className="h-4 w-4" aria-hidden />
                  <span className="max-w-[180px] truncate">{user.organization}</span>
                </Link>
                <button onClick={logout} className="btn btn-ghost px-2" aria-label="Wyloguj">
                  <LogOut className="h-4 w-4" aria-hidden />
                </button>
              </>
            ) : (
              <Link to="/dysponent" className="btn btn-navy py-2">
                Zaloguj dysponenta
              </Link>
            )}
          </div>
          <button className="btn btn-outline px-3 lg:hidden" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            <span className="sr-only">Menu</span>
          </button>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label="Menu mobilne" className="border-t border-line bg-white lg:hidden">
            <ul className="mx-auto max-w-7xl px-4 py-2">
              {NAV.map((n) => (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) =>
                      `block border-l-4 px-3 py-3 text-lg font-bold tracking-[-0.02em] ${isActive ? "border-brand text-ink" : "border-transparent text-ink/60"}`
                    }
                  >
                    {n.label}
                  </NavLink>
                </li>
              ))}
              {user?.is_moderator && (
                <li>
                  <NavLink
                    to="/moderacja"
                    className={({ isActive }) =>
                      `block border-l-4 px-3 py-3 text-lg font-bold tracking-[-0.02em] ${isActive ? "border-brand text-ink" : "border-transparent text-ink/60"}`
                    }
                  >
                    Moderacja zgłoszeń
                  </NavLink>
                </li>
              )}
              <li className="mt-2 border-t border-line pt-2">
                {user ? (
                  <button onClick={logout} className="btn btn-outline w-full">
                    Wyloguj ({user.organization})
                  </button>
                ) : (
                  <Link to="/dysponent" className="btn btn-navy w-full">
                    Zaloguj dysponenta
                  </Link>
                )}
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main id="main" className="flex-1" tabIndex={-1}>
        <Outlet />
      </main>

      {!fullBleed && <Footer />}
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-24 bg-ink text-white/70">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-14">
        <p className="max-w-4xl text-4xl font-black leading-[0.95] tracking-[-0.045em] text-white sm:text-6xl">
          GdzieAED? <span className="text-brand">Każda minuta się liczy.</span>
        </p>
        <div className="mt-14 grid gap-10 border-t border-white/20 pt-8 text-sm md:grid-cols-12">
          <div className="md:col-span-6">
            <Logo inverted />
            <p className="mt-4 max-w-md leading-relaxed">
              Akcja zachęcająca dysponentów defibrylatorów do udostępniania danych w portalu{" "}
              <a className="font-semibold text-white underline underline-offset-4" href="https://dane.gov.pl" target="_blank" rel="noreferrer">
                dane.gov.pl
              </a>{" "}
              w jednolitym, wzorcowym zakresie. Prototyp przygotowany na HackNation 2026.
            </p>
          </div>
          <div className="md:col-span-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white">Dane</h2>
            <ul className="mt-3 space-y-2">
              <li><Link className="hover:text-white" to="/dane">Pobierz zbiór</Link></li>
              <li><Link className="hover:text-white" to="/pokrycie">Pokrycie i białe plamy</Link></li>
              <li><Link className="hover:text-white" to="/standard">Wzorcowy zakres danych</Link></li>
              <li><a className="hover:text-white" href="/api/docs">API (OpenAPI)</a></li>
            </ul>
          </div>
          <div className="md:col-span-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white">Źródła i licencje</h2>
            <p className="mt-3 leading-relaxed">
              Dane dysponentów: CC0 / CC BY 4.0 (dane.gov.pl). Dane mapy: © współtwórcy{" "}
              <a className="underline underline-offset-4 hover:text-white" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                OpenStreetMap
              </a>{" "}
              (ODbL). Adresy i granice: PRG GUGiK. Ludność: GUS.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
