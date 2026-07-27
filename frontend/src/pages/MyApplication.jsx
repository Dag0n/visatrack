import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { pb } from "../lib/pb";
import { useAuth } from "../lib/auth.jsx";
import CountrySelect from "../components/CountrySelect";
import { PRIORITY_LABELS, VISA_TYPE_LABELS } from "../lib/labels";
import { processingStartDate, workingDaysBetween } from "../lib/processingDays";
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

function OptionalDateField({ id, label, value, onChange }) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label} (optional)</label>
      <div className="date-input-row">
        <input
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button
            type="button"
            className="link-button clear-date-button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => onChange("")}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
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
      payload[field] = "";
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

function shortDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function CohortInsight({ application }) {
  const [cohort, setCohort] = useState(null);
  const [failed, setFailed] = useState(false);
  const start = processingStartDate(application);
  const end = application.decision_date ? new Date(application.decision_date) : new Date();
  const elapsed = start ? workingDaysBetween(start, end) : 0;

  useEffect(() => {
    if (!application.country_id || !application.biometrics_date) return;
    const base = pb.baseURL.replace(/\/$/, "");
    const params = new URLSearchParams({
      country: application.country_id,
      visaType: application.visa_type,
      priority: application.priority_service,
      elapsed: String(elapsed),
    });
    fetch(`${base}/api/custom/cohort?${params}`)
      .then((response) => {
        if (!response.ok) throw new Error("Cohort request failed");
        return response.json();
      })
      .then(setCohort)
      .catch(() => setFailed(true));
  }, [
    application.country_id,
    application.biometrics_date,
    application.visa_type,
    application.priority_service,
    elapsed,
  ]);

  if (!application.biometrics_date) {
    return (
      <div className="cohort-empty">
        Add your biometrics date to unlock a comparison with similar applications.
      </div>
    );
  }
  if (failed || (cohort && cohort.count === 0)) {
    return (
      <div className="cohort-empty">
        There are not enough recent applications on this route for a comparison yet.
      </div>
    );
  }
  if (!cohort) return <div className="cohort-empty">Building your comparison…</div>;

  const progress = Math.min(100, Math.round((elapsed / Math.max(cohort.upperQuartile, 1)) * 100));
  return (
    <div className="cohort-insight">
      <div className="cohort-topline">
        <div>
          <span className="cohort-kicker">Your wait</span>
          <strong>Working day {elapsed}</strong>
        </div>
        <div className="cohort-percent">
          <strong>{cohort.decidedByNow}%</strong>
          <span>decided by now</span>
        </div>
      </div>
      <div className="cohort-track" aria-label={`Working day ${elapsed}`}>
        <span style={{ width: `${progress}%` }} />
        <i style={{ left: `${progress}%` }} />
      </div>
      <div className="cohort-range">
        <span>Middle half: {cohort.lowerQuartile}–{cohort.upperQuartile} WD</span>
        <strong>Median {cohort.medianDays} WD</strong>
      </div>
      <p>
        Compared with {cohort.count} recent {PRIORITY_LABELS[application.priority_service]?.toLowerCase()}{" "}
        {VISA_TYPE_LABELS[application.visa_type]?.toLowerCase()} decisions
        {cohort.scope === "country" ? ` from ${cohort.country}` : " across all countries"}.
      </p>
    </div>
  );
}

function ApplicationCard({ application, onEdit, onDelete }) {
  const milestones = [
    { label: "Applied", date: application.application_date },
    { label: "Biometrics", date: application.biometrics_date },
    { label: "ECO", date: application.eco_email_date },
    { label: "Decision", date: application.decision_date },
  ];

  return (
    <article className="application-card">
      <div className="application-card-header">
        <div>
          <div className="application-card-title">
            <h3>{VISA_TYPE_LABELS[application.visa_type] ?? application.visa_type}</h3>
            <StatusBadge outcome={application.outcome} />
          </div>
          <p>
            {application.expand?.country_id?.name ?? "Country not set"}
            <span>·</span>
            {PRIORITY_LABELS[application.priority_service] ?? application.priority_service}
          </p>
        </div>
        <div className="card-actions">
          <button type="button" className="small-button" onClick={() => onEdit(application)}>
            Edit timeline
          </button>
          <button type="button" className="icon-button danger" aria-label="Delete application" onClick={() => onDelete(application.id)}>
            ×
          </button>
        </div>
      </div>

      <div className="milestone-timeline">
        {milestones.map((milestone, index) => (
          <div className={milestone.date ? "milestone complete" : "milestone"} key={milestone.label}>
            <span className="milestone-dot">{milestone.date ? "✓" : index + 1}</span>
            <span className="milestone-label">{milestone.label}</span>
            <span className="milestone-date">{shortDate(milestone.date) ?? "Not yet"}</span>
          </div>
        ))}
      </div>

      <CohortInsight application={application} />
    </article>
  );
}

export default function MyApplication() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("");
  const [validationError, setValidationError] = useState("");

  const loadApplications = useCallback(() => {
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
  }, [user.id]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

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

    const datedFields = [
      ["application_date", "Application date"],
      ["biometrics_date", "Biometrics date"],
      ["eco_email_date", "ECO email date"],
      ["rfi_date", "RFI date"],
      ["nsf_email_date", "NSF email date"],
      ["decision_date", "Decision date"],
    ];
    const today = new Date().toISOString().slice(0, 10);
    const futureField = datedFields.find(([field]) => form[field] > today);
    if (futureField) {
      setValidationError(`${futureField[1]} cannot be in the future.`);
      return;
    }
    if (form.biometrics_date && form.application_date > form.biometrics_date) {
      setValidationError("Biometrics date cannot be before the application date.");
      return;
    }
    const invalidMilestone = datedFields
      .slice(2)
      .find(([field]) => form[field] && form.biometrics_date && form[field] < form.biometrics_date);
    if (invalidMilestone) {
      setValidationError(`${invalidMilestone[1]} cannot be before biometrics.`);
      return;
    }
    if (form.outcome === "pending" && form.decision_date) {
      setValidationError("Remove the decision date or change the outcome.");
      return;
    }
    if (form.outcome !== "pending" && !form.decision_date) {
      setValidationError("Add the decision date for an approved or rejected application.");
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
    <div className="my-applications-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow plain">Your visa journey</span>
          <h1>My applications</h1>
          <p>
            Keep milestones current to see how your wait compares. Set your Reddit
            username in <Link to="/settings">Settings</Link> to link existing entries.
          </p>
        </div>
        {!showForm && (
          <button type="button" className="primary-button button" onClick={startNew}>
            + Add application
          </button>
        )}
      </div>

      {applications.length > 0 && (
        <div className="application-card-list">
          {applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              onEdit={startEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {!showForm && applications.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">⌁</span>
          <h2>Start your first timeline</h2>
          <p>Add the dates you know now. You can return whenever a new milestone happens.</p>
          <button type="button" className="button primary-button" onClick={startNew}>
            Add my application
          </button>
        </div>
      )}

      {showForm && (
        <div className="form-card application-form">
          <h3>{editingId ? "Edit application" : "New application"}</h3>
          <p className="optional-hint">Fields marked * are required.</p>
          <form onSubmit={handleSubmit}>
            <label>
              Link to your r/SpouseVisaUk post (optional, public)
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
                <option value="none">Standard</option>
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
            <OptionalDateField
              id="biometrics-date"
              label="Biometrics date"
              value={form.biometrics_date}
              onChange={(value) => update("biometrics_date", value)}
            />
            <OptionalDateField
              id="eco-email-date"
              label="ECO email received"
              value={form.eco_email_date}
              onChange={(value) => update("eco_email_date", value)}
            />
            <OptionalDateField
              id="rfi-date"
              label="RFI received"
              value={form.rfi_date}
              onChange={(value) => update("rfi_date", value)}
            />
            <OptionalDateField
              id="nsf-email-date"
              label="NSF (Not Straightforward) email received"
              value={form.nsf_email_date}
              onChange={(value) => update("nsf_email_date", value)}
            />
            <OptionalDateField
              id="decision-date"
              label="Decision date"
              value={form.decision_date}
              onChange={(value) => update("decision_date", value)}
            />
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
              Private notes (optional, only visible to you)
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
