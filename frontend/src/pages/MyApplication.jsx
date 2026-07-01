import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { pb } from "../lib/pb";
import { useAuth } from "../lib/auth.jsx";
import CountrySelect from "../components/CountrySelect";
import { VISA_TYPE_LABELS } from "../lib/labels";
import StatusBadge from "../components/StatusBadge";

const emptyForm = {
  reddit_post_url: "",
  country_id: "",
  visa_type: "spouse",
  priority_service: "none",
  application_date: "",
  biometrics_date: "",
  eco_email_date: "",
  rfi_date: "",
  nsf_email_date: "",
  decision_date: "",
  outcome: "pending",
  rejection_reason: "",
  notes: "",
};

function Required() {
  return <span className="required-marker"> *</span>;
}

function toFormState(record) {
  return {
    reddit_post_url: record.reddit_post_url,
    country_id: record.country_id,
    visa_type: record.visa_type,
    priority_service: record.priority_service,
    application_date: record.application_date?.slice(0, 10) ?? "",
    biometrics_date: record.biometrics_date?.slice(0, 10) ?? "",
    eco_email_date: record.eco_email_date?.slice(0, 10) ?? "",
    rfi_date: record.rfi_date?.slice(0, 10) ?? "",
    nsf_email_date: record.nsf_email_date?.slice(0, 10) ?? "",
    decision_date: record.decision_date?.slice(0, 10) ?? "",
    outcome: record.outcome,
    rejection_reason: record.rejection_reason,
    notes: record.notes,
  };
}

function buildPayload(form, user, isEditing) {
  const payload = {
    reddit_post_url: form.reddit_post_url.trim(),
    country_id: form.country_id,
    visa_type: form.visa_type,
    priority_service: form.priority_service,
    application_date: form.application_date,
    outcome: form.outcome,
    rejection_reason: form.outcome === "rejected" ? form.rejection_reason.trim() : "",
    notes: form.notes.trim(),
    reddit_username: user.reddit_username || "",
    user: user.id,
  };

  [
    "biometrics_date",
    "eco_email_date",
    "rfi_date",
    "nsf_email_date",
    "decision_date",
  ].forEach((field) => {
    if (form[field]) {
      payload[field] = form[field];
    } else if (isEditing) {
      payload[field] = null;
    }
  });

  return payload;
}

function validationMessage(err) {
  const data = err?.response?.data;
  if (!data || Object.keys(data).length === 0) {
    return err?.response?.message || err?.message || "Something went wrong saving your application.";
  }

  const details = Object.entries(data)
    .map(([field, value]) => `${field}: ${value?.message || "invalid value"}`)
    .join(" ");

  return details || err?.response?.message || "Something went wrong saving your application.";
}

export default function MyApplication() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("");
  const [validationError, setValidationError] = useState("");

  function loadApplications() {
    pb.collection("applications")
      .getFullList({
        filter: `user = "${user.id}"`,
        sort: "-application_date",
        expand: "country_id",
        requestKey: null,
      })
      .then(setApplications)
      .catch((err) => {
        if (err?.isAbort) return;
        setApplications([]);
      });
  }

  useEffect(() => {
    loadApplications();
  }, [user.id]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function startNew() {
    setForm(emptyForm);
    setEditingId(null);
    setStatus("");
    setValidationError("");
    setShowForm(true);
  }

  function startEdit(record) {
    setForm(toFormState(record));
    setEditingId(record.id);
    setStatus("");
    setValidationError("");
    setShowForm(true);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this application entry?")) return;
    await pb.collection("applications").delete(id);
    if (editingId === id) {
      setShowForm(false);
      setEditingId(null);
    }
    loadApplications();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setValidationError("");

    if (!pb.authStore.isValid || !user?.id) {
      setStatus("error");
      setValidationError("Please log in again before saving your application.");
      return;
    }

    if (
      form.biometrics_date &&
      form.application_date &&
      form.application_date > form.biometrics_date
    ) {
      setValidationError("Application date must be before the biometrics date.");
      return;
    }

    setStatus("saving");
    const payload = buildPayload(form, user, !!editingId);
    try {
      if (editingId) {
        await pb.collection("applications").update(editingId, payload);
      } else {
        await pb.collection("applications").create(payload);
      }
      setStatus("saved");
      setShowForm(false);
      setEditingId(null);
      loadApplications();
    } catch (err) {
      console.error("Application save failed", err);
      setStatus("error");
      setValidationError(validationMessage(err));
    }
  }

  return (
    <div>
      <h2>My applications</h2>
      <p className="optional-hint">
        Track each stage separately, e.g. fiancé(e) visa → spouse visa → spouse visa
        extension. Set your Reddit username in{" "}
        <Link to="/settings">Settings</Link> to display it on your entries.
      </p>

      {applications.length > 0 && (
        <div className="table-scroll" style={{ marginBottom: 16 }}>
        <table className="waiting-table">
          <thead>
            <tr>
              <th>Country</th>
              <th>Visa type</th>
              <th>Applied on</th>
              <th>Outcome</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <tr key={app.id}>
                <td>{app.expand?.country_id?.name ?? "—"}</td>
                <td>{VISA_TYPE_LABELS[app.visa_type] ?? app.visa_type}</td>
                <td>{app.application_date?.slice(0, 10)}</td>
                <td><StatusBadge outcome={app.outcome} /></td>
                <td>
                  <button type="button" className="link-button" onClick={() => startEdit(app)}>
                    Edit
                  </button>{" "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => handleDelete(app.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {!showForm && (
        <button type="button" onClick={startNew}>
          + Add another application
        </button>
      )}

      {showForm && (
        <div className="form-card">
          <h3>{editingId ? "Edit application" : "New application"}</h3>
          <p className="optional-hint">Fields marked * are required.</p>
          <form onSubmit={handleSubmit}>
            <label>
              Link to your r/SpouseVisaUk post (optional)
              <input
                type="url"
                placeholder="https://reddit.com/r/SpouseVisaUk/..."
                value={form.reddit_post_url}
                onChange={(e) => update("reddit_post_url", e.target.value)}
              />
            </label>
            <label>
              Country applying from
              <Required />
              <CountrySelect
                value={form.country_id}
                onChange={(id) => update("country_id", id)}
                required
              />
            </label>
            <label>
              Visa type
              <Required />
              <select
                value={form.visa_type}
                onChange={(e) => update("visa_type", e.target.value)}
              >
                <option value="spouse">Spouse</option>
                <option value="fiance">Fiancé(e)</option>
                <option value="unmarried_partner">Unmarried partner</option>
                <option value="extension">Extension</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Priority service
              <Required />
              <select
                value={form.priority_service}
                onChange={(e) => update("priority_service", e.target.value)}
              >
                <option value="none">None</option>
                <option value="priority">Priority</option>
                <option value="super_priority">Super priority</option>
              </select>
            </label>
            <label>
              Application date
              <Required />
              <input
                type="date"
                required
                value={form.application_date}
                onChange={(e) => update("application_date", e.target.value)}
              />
            </label>
            <label>
              Biometrics date (optional)
              <input
                type="date"
                value={form.biometrics_date}
                onChange={(e) => update("biometrics_date", e.target.value)}
              />
            </label>
            <label>
              ECO email received (optional)
              <input
                type="date"
                value={form.eco_email_date}
                onChange={(e) => update("eco_email_date", e.target.value)}
              />
            </label>
            <label>
              RFI received (optional)
              <input
                type="date"
                value={form.rfi_date}
                onChange={(e) => update("rfi_date", e.target.value)}
              />
            </label>
            <label>
              NSF (Not Straightforward) email received (optional)
              <input
                type="date"
                value={form.nsf_email_date}
                onChange={(e) => update("nsf_email_date", e.target.value)}
              />
            </label>
            <label>
              Decision date (optional)
              <input
                type="date"
                value={form.decision_date}
                onChange={(e) => update("decision_date", e.target.value)}
              />
            </label>
            <label>
              Outcome
              <Required />
              <select
                value={form.outcome}
                onChange={(e) => update("outcome", e.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            {form.outcome === "rejected" && (
              <label>
                Rejection reason (optional)
                <textarea
                  placeholder="e.g. insufficient financial evidence"
                  value={form.rejection_reason}
                  onChange={(e) => update("rejection_reason", e.target.value)}
                />
              </label>
            )}
            <label>
              Notes (optional)
              <textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </label>

            {validationError && <p className="error-text">{validationError}</p>}
            {status === "error" && (
              <p className="error-text">Something went wrong saving your application.</p>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" disabled={status === "saving"}>
                {editingId ? "Update" : "Submit"}
              </button>
              <button type="button" className="link-button" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {status === "saved" && !showForm && <p className="success-text">Saved.</p>}
    </div>
  );
}
