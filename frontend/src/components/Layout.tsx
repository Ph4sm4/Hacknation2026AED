import { Menu, Phone, X, LogOut, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Logo } from "./Logo";

const NAV = [
  { to: "/", label: "Znajdź AED", end: true },
  { to: "/dane", label: "Dane otwarte" },
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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-1.5 text-sm">
          <p className="font-medium">
            <span className="font-bold">Nagłe zatrzymanie krążenia?</span>{" "}
            <span className="hidden sm:inline">Dzwoń pod 112, zacznij uciskanie klatki piersiowej, poproś kogoś o AED.</span>
          </p>
          <a href="tel:112" className="inline-flex shrink-0 items-center gap-1.5 rounded bg-white px-2.5 py-1 font-bold text-brand hover:bg-brand-soft">
            <Phone className="h-4 w-4" aria-hidden /> 112
          </a>
        </div>
      </div>

      <header className="sticky top-0 z-[1000] border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
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
                      `relative block px-3 py-2 text-sm font-semibold transition-colors ${
                        isActive ? "text-brand after:absolute after:inset-x-3 after:-bottom-[13px] after:h-[3px] after:bg-brand" : "text-ink hover:text-navy"
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
                <Link to="/dysponent" className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy">
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
                      `block border-l-4 px-3 py-3 font-semibold ${isActive ? "border-brand bg-brand-soft text-brand" : "border-transparent text-ink"}`
                    }
                  >
                    {n.label}
                  </NavLink>
                </li>
              ))}
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
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-muted md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-md">
            Akcja zachęcająca dysponentów defibrylatorów do udostępniania danych w portalu{" "}
            <a className="font-semibold text-navy underline" href="https://dane.gov.pl" target="_blank" rel="noreferrer">
              dane.gov.pl
            </a>{" "}
            w jednolitym, wzorcowym zakresie. Prototyp przygotowany na HackNation 2026.
          </p>
        </div>
        <div>
          <h2 className="font-bold text-ink">Dane</h2>
          <ul className="mt-2 space-y-1.5">
            <li><Link className="hover:text-navy" to="/dane">Pobierz zbiór</Link></li>
            <li><Link className="hover:text-navy" to="/standard">Wzorcowy zakres danych</Link></li>
            <li><a className="hover:text-navy" href="/api/docs">API (OpenAPI)</a></li>
          </ul>
        </div>
        <div>
          <h2 className="font-bold text-ink">Źródła i licencje</h2>
          <p className="mt-2">
            Dane dysponentów: CC0 / CC BY 4.0 (dane.gov.pl). Dane mapy: © współtwórcy{" "}
            <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap
            </a>{" "}
            (ODbL).
          </p>
        </div>
      </div>
    </footer>
  );
}
