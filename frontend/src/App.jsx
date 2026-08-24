import { lazy, Suspense, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth.jsx";
import logo from "./assets/logo-header.webp";
import "./App.css";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Login = lazy(() => import("./pages/Login"));
const MyApplication = lazy(() => import("./pages/MyApplication"));
const Applications = lazy(() => import("./pages/Applications"));
const Settings = lazy(() => import("./pages/Settings"));
const CountryStats = lazy(() => import("./pages/CountryStats"));
const Countries = lazy(() => import("./pages/Countries"));
const PartnerVisaStats = lazy(() => import("./pages/PartnerVisaStats"));

function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Login />;
}

export default function App() {
  const { isLoggedIn, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <NavLink to="/" className="logo-link" onClick={closeMenu} aria-label="VisaTrack UK home">
            <img src={logo} alt="VisaTrack UK" className="app-logo" />
          </NavLink>
          <button
            type="button"
            className="nav-toggle"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <nav className={menuOpen ? "nav-open" : ""}>
            <NavLink to="/" onClick={closeMenu}>Dashboard</NavLink>
            <NavLink to="/applications" onClick={closeMenu}>Applications</NavLink>
            <NavLink to="/countries" onClick={closeMenu}>Countries</NavLink>
            <NavLink to="/approval-rates" onClick={closeMenu}>Approval rates</NavLink>
            {isLoggedIn ? (
              <>
                <NavLink
                  to="/my-application"
                  className={({ isActive }) => `nav-cta${isActive ? " active" : ""}`}
                  onClick={closeMenu}
                >
                  My timeline
                </NavLink>
                <NavLink to="/settings" onClick={closeMenu}>Settings</NavLink>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    logout();
                    closeMenu();
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <NavLink to="/login" onClick={closeMenu}>Log in</NavLink>
            )}
          </nav>
        </div>
      </header>

      <main className="app-main">
        <Suspense fallback={<p className="empty-hint">Loading page…</p>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/my-application"
              element={
                <ProtectedRoute>
                  <MyApplication />
                </ProtectedRoute>
              }
            />
            <Route path="/countries" element={<Countries />} />
            <Route path="/country/:country" element={<CountryStats />} />
            <Route path="/approval-rates" element={<PartnerVisaStats />} />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="*"
              element={
                <div className="page-heading">
                  <div>
                    <h1>Page not found</h1>
                    <p>
                      That page doesn't exist. <NavLink to="/">Back to the dashboard</NavLink>.
                    </p>
                  </div>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </main>

      <footer className="app-footer">
        <div className="app-footer-inner">
          <div>
            <strong>VisaTrack UK</strong>
            <span>Independent community data—not immigration advice.</span>
          </div>
          <div className="footer-links">
            <NavLink to="/countries">Country data</NavLink>
            <a
              href="https://www.reddit.com/r/SpouseVisaUk"
              target="_blank"
              rel="noreferrer"
            >
              r/SpouseVisaUk
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
