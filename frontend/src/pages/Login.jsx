import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";

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
    <div className="form-card">
      <h2>{mode === "login" ? "Log in" : "Create an account"}</h2>
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
        className="link-button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
      >
        {mode === "login"
          ? "Need an account? Sign up"
          : "Already have an account? Log in"}
      </button>

      <div className="oauth2-divider">or</div>

      <div className="oauth2-buttons">
        <button type="button" className="oauth2-button" onClick={() => handleOAuth2("google")}>
          Continue with Google
        </button>
        <button type="button" className="oauth2-button" onClick={() => handleOAuth2("apple")}>
          Continue with Apple
        </button>
      </div>
    </div>
  );
}
