import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.38l-3.24-2.53c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.63.39 3.18 1.04 4.53l3.35-2.61Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z"
      />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.05 12.54c.02 2.04 1.79 2.72 1.81 2.73-.01.05-.28.97-.93 1.92-.56.82-1.15 1.64-2.07 1.66-.9.02-1.2-.54-2.23-.54-1.04 0-1.36.52-2.22.56-.89.03-1.57-.9-2.14-1.72-1.16-1.68-2.05-4.75-.86-6.82a3.33 3.33 0 0 1 2.83-1.72c.88-.02 1.72.6 2.25.6.53 0 1.53-.74 2.58-.63.44.02 1.68.18 2.47 1.34-.06.04-1.48.87-1.49 2.62ZM15.38 7.47c.47-.57.79-1.37.7-2.17-.69.03-1.53.46-2.02 1.03-.44.5-.83 1.31-.72 2.09.77.06 1.56-.39 2.04-.95Z"
      />
    </svg>
  );
}

export default function Login() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, signup, loginWithOAuth2 } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      navigate("/my-application");
    } catch {
      setError(
        mode === "login"
          ? "Couldn't log in. Check your email/password."
          : "Couldn't sign up. Password needs to be at least 8 characters.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOAuth2(provider) {
    setError("");
    try {
      await loginWithOAuth2(provider);
      navigate("/my-application");
    } catch {
      setError(`Couldn't sign in with ${provider}.`);
    }
  }

  return (
    <div className="form-card auth-card">
      <div className="auth-heading">
        <span className="eyebrow plain">Your timeline</span>
        <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p>
          {mode === "login"
            ? "Sign in to update milestones and see your cohort comparison."
            : "Save your timeline and see how your wait compares with similar applications."}
        </p>
      </div>

      <div className="oauth2-buttons">
        <button
          type="button"
          className="oauth2-button google-button"
          onClick={() => handleOAuth2("google")}
        >
          <GoogleLogo />
          Continue with Google
        </button>
        <button
          type="button"
          className="oauth2-button apple-button"
          onClick={() => handleOAuth2("apple")}
        >
          <AppleLogo />
          Continue with Apple
        </button>
      </div>

      <div className="oauth2-divider">
        <span>or use email</span>
      </div>

      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={submitting}>
          {mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>
      <button
        type="button"
        className="link-button auth-mode-toggle"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
      >
        {mode === "login"
          ? "Need an account? Sign up"
          : "Already have an account? Log in"}
      </button>
    </div>
  );
}
