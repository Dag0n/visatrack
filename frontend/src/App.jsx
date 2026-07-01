import { useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth.jsx";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import MyApplication from "./pages/MyApplication";
import Applications from "./pages/Applications";
import Settings from "./pages/Settings";
import CountryStats from "./pages/CountryStats";
import Countries from "./pages/Countries";
import logo from "./assets/logo.png";
import "./App.css";

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
          <img src={logo} alt="VisaTrack UK" className="app-logo" />
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
            <NavLink to="/my-application" onClick={closeMenu}>My applications</NavLink>
            {isLoggedIn ? (
              <>
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
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>

      <footer className="app-footer">
        <div className="app-footer-inner">
          <span>VisaTrack UK is an independent, unofficial community project.</span>
          <a
            href="https://www.reddit.com/r/SpouseVisaUk"
            target="_blank"
            rel="noreferrer"
          >
            r/SpouseVisaUk
          </a>
        </div>
      </footer>
    </div>
  );
}
