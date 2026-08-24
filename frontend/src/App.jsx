import { Component, lazy, Suspense, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useParams } from "react-router-dom";
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
  const location = useLocation();
  return isLoggedIn ? children : <Navigate to="/login" state={{ from: location }} replace />;
}

class RouteErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="empty-state compact-error-state" role="alert">
          <h2>This page couldn't load</h2>
          <p>The connection may have dropped, or a newer version of the site may be available.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function CountryStatsRoute() {
  const { country } = useParams();
  return <CountryStats key={country} />;
}

// Route objects live beside the lazy page declarations they use.
// eslint-disable-next-line react-refresh/only-export-components
export const appRoutes = [
  { index: true, element: <Dashboard /> },
  { path: "applications", element: <Applications /> },
  { path: "login", element: <Login /> },
  {
    path: "my-application",
    element: (
      <ProtectedRoute>
        <MyApplication />
      </ProtectedRoute>
    ),
  },
  { path: "countries", element: <Countries /> },
  { path: "country/:country", element: <CountryStatsRoute /> },
  { path: "approval-rates", element: <PartnerVisaStats /> },
  {
    path: "settings",
    element: (
      <ProtectedRoute>
        <Settings />
      </ProtectedRoute>
    ),
  },
  {
    path: "*",
    element: (
      <div className="page-heading">
        <div>
          <h1>Page not found</h1>
          <p>
            That page doesn't exist. <NavLink to="/">Back to the dashboard</NavLink>.
          </p>
        </div>
      </div>
    ),
  },
];

export default function App() {
  const { isLoggedIn, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

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
        <RouteErrorBoundary key={location.pathname}>
          <Suspense fallback={<p className="empty-hint" role="status">Loading page…</p>}>
            <Outlet />
          </Suspense>
        </RouteErrorBoundary>
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
