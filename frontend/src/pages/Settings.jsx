import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { stripRedditPrefix } from "../lib/format";

export default function Settings() {
  const { user, updateProfile, deleteAccount, claimEntries } = useAuth();
  const [redditUsername, setRedditUsername] = useState(user.reddit_username || "");
  const [status, setStatus] = useState("");
  const [claimStatus, setClaimStatus] = useState("");
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  async function handleSaveProfile(e) {
    e.preventDefault();
    setStatus("saving");
    try {
      await updateProfile({ reddit_username: stripRedditPrefix(redditUsername) });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  async function handleClaim() {
    setClaimStatus("claiming");
    try {
      const res = await claimEntries();
      setClaimStatus(
        res.claimed > 0
          ? `Linked ${res.claimed} existing entr${res.claimed === 1 ? "y" : "ies"} to your account.`
          : "No unclaimed entries found for your Reddit username.",
      );
    } catch {
      setClaimStatus("Couldn't claim entries right now.");
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete your account? This also deletes any applications linked to it. This can't be undone.",
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount();
      navigate("/");
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div>
      <h2>Settings</h2>

      <div className="form-card" style={{ marginBottom: 20 }}>
        <h3>Reddit username</h3>
        <p className="optional-hint">
          Used to identify your entries publicly, and to link any data we may
          have manually added from your r/SpouseVisaUk post before you signed up.
        </p>
        <form onSubmit={handleSaveProfile}>
          <label>
            Reddit username (optional, no need for "u/")
            <input
              type="text"
              placeholder="yourname"
              value={redditUsername}
              onChange={(e) => setRedditUsername(e.target.value)}
            />
          </label>
          {status === "error" && <p className="error-text">Couldn't save.</p>}
          {status === "saved" && <p className="success-text">Saved.</p>}
          <button type="submit" disabled={status === "saving"}>
            Save
          </button>
        </form>

        <div style={{ marginTop: 16 }}>
          <button type="button" onClick={handleClaim} disabled={claimStatus === "claiming"}>
            Claim entries matching my Reddit username
          </button>
          {claimStatus && claimStatus !== "claiming" && (
            <p className="optional-hint">{claimStatus}</p>
          )}
        </div>
      </div>

      <div className="form-card">
        <h3>Delete account</h3>
        <p className="optional-hint">
          This permanently deletes your account and any applications linked to it.
        </p>
        <button
          type="button"
          className="link-button danger"
          onClick={handleDelete}
          disabled={deleting}
        >
          Delete my account
        </button>
      </div>
    </div>
  );
}
