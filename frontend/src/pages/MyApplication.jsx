import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import { pb } from "../lib/pb";
import { useAuth } from "../lib/auth.jsx";
import CountrySelect from "../components/CountrySelect";
import { fetchCustom, isAbortError } from "../lib/api";
import { formatDate, localToday, stripRedditPrefix } from "../lib/format";
import { PRIORITY_LABELS, VISA_TYPE_LABELS } from "../lib/labels";
import { usePageTitle } from "../lib/usePageTitle";
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

const FIELD_LABELS = {
  country_id: "Country",
  application_date: "Application date",
  biometrics_date: "Biometrics date",
  eco_email_date: "ECO email date",
  rfi_date: "RFI date",
  nsf_email_date: "NSF email date",
  decision_date: "Decision date",
  outcome: "Outcome",
  visa_type: "Visa type",
  priority_service: "Priority service",
  reddit_post_url: "Reddit post link",
  rejection_reason: "Rejection reason",
  notes: "Notes",
};

// Turns a PocketBase error into user-readable messages, one per failed field.
function validationMessages(err) {
  const fallback = err?.response?.message || err?.message || "Something went wrong saving your application.";
  const data = err?.response?.data;
  if (!data || Object.keys(data).length === 0) return [fallback];

  const details = Object.entries(data).map(
    ([field, value]) => `${FIELD_LABELS[field] ?? field}: ${value?.message || "invalid value"}`,
  );
  return details.length > 0 ? details : [fallback];
}

const shortDate = formatDate;

function CohortInsight({ application }) {
  const [cohort, setCohort] = useState(null);
  const [failed, setFailed] = useState(false);
  const start = processingStartDate(application);
  const end = application.decision_date ? new Date(application.decision_date) : new Date();
  const elapsed = start ? workingDaysBetween(start, end) : 0;

  useEffect(() => {
    if (!application.country_id || !application.biometrics_date) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      country: application.country_id,
      visaType: application.visa_type,
      priority: application.priority_service,
      elapsed: String(elapsed),
    });
    fetchCustom(`/cohort?${params}`, { signal: controller.signal })
      .then(setCohort)
      .catch((err) => {
        if (!isAbortError(err)) setFailed(true);
      });
    return () => controller.abort();
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
          <span>of completed cases finished by this working day</span>
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
        Based on {cohort.count} reported completed {PRIORITY_LABELS[application.priority_service]?.toLowerCase()}{" "}
        {VISA_TYPE_LABELS[application.visa_type]?.toLowerCase()} cases decided in the last 12 months
        {cohort.scope === "country" ? ` from ${cohort.country}` : " across all countries"}. Only cases
        with a reported outcome are included; this is not a forecast.
      </p>
    </div>
  );
}

function ClaimCallout({ hasApplications, onClaimed }) {
  const { user, updateProfile, claimEntries, previewClaim } = useAuth();
  const [username, setUsername] = useState(user.reddit_username || "");
  const [matches, setMatches] = useState(null);
  const [checkedName, setCheckedName] = useState("");
  const [stage, setStage] = useState("idle");
  const [claimed, setClaimed] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(
    async (name) => {
      const cleaned = stripRedditPrefix(name).trim();
      if (!cleaned) return;
      setStage("checking");
      try {
        const res = await previewClaim(cleaned);
        setMatches(res.matches);
        setCheckedName(cleaned);
        setStage("checked");
      } catch {
        setStage("error");
      }
    },
    [previewClaim],
  );

  useEffect(() => {
    if (!user.reddit_username) return;
    // Run the automatic lookup once, on first render, deferred so the
    // initial render commits before any state updates.
    const savedUsername = user.reddit_username;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) check(savedUsername);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleClaim() {
    setStage("claiming");
    try {
      if (stripRedditPrefix(username).trim() !== (user.reddit_username || "")) {
        await updateProfile({ reddit_username: checkedName });
      }
      const res = await claimEntries();
      setClaimed(res.claimed);
      setStage("claimed");
      onClaimed();
    } catch {
      setStage("error");
    }
  }

  if (dismissed) return null;
  // With applications already on the account, only speak up when there is
  // genuinely something to claim.
  if (hasApplications && !(stage === "checked" && matches > 0) && stage !== "claimed") {
    return null;
  }

  if (stage === "claimed") {
    return (
      <div className="claim-callout success">
        <strong>
          Linked {claimed} timeline{claimed === 1 ? "" : "s"} to your account.
        </strong>
        <p>It's yours to keep updated now — new milestones improve everyone's stats.</p>
      </div>
    );
  }

  return (
    <div className="claim-callout">
      <div className="claim-callout-text">
        <strong>Posted on r/SpouseVisaUk already?</strong>
        <p>
          We import timelines from the subreddit, so yours may already be here.
          Enter your Reddit username to find and claim it.
        </p>
      </div>
      <form
        className="claim-callout-controls"
        onSubmit={(e) => {
          e.preventDefault();
          check(username);
        }}
      >
        <input
          type="text"
          placeholder="Reddit username (no u/ needed)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button type="submit" disabled={stage === "checking" || !username.trim()}>
          {stage === "checking" ? "Checking…" : "Find my timeline"}
        </button>
      </form>
      {stage === "checked" && matches > 0 && (
        <div className="claim-callout-result">
          <span>
            Found <strong>{matches}</strong> unclaimed timeline{matches === 1 ? "" : "s"} for
            u/{checkedName}.
          </span>
          <button type="button" className="primary-button button" onClick={handleClaim}>
            Claim {matches === 1 ? "it" : "them"}
          </button>
        </div>
      )}
      {stage === "checked" && matches === 0 && (
        <p className="optional-hint">
          Nothing imported for u/{checkedName} yet — add your timeline below instead.
        </p>
      )}
      {stage === "claiming" && <p className="optional-hint">Linking your entries…</p>}
      {stage === "error" && (
        <p className="error-text">Couldn't check right now. You can also claim later from Settings.</p>
      )}
      {!hasApplications && (
        <button type="button" className="link-button claim-dismiss" onClick={() => setDismissed(true)}>
          I haven't posted there
        </button>
      )}
    </div>
  );
}

function ApplicationCard({ application, onEdit, onDelete }) {
  const milestones = [
    { label: "Applied", date: application.application_date },
    { label: "Biometrics", date: application.biometrics_date },
    { label: "ECO", date: application.eco_email_date },
    // RFI and NSF only happen on some applications — show them only once dated
    // so the timeline doesn't imply everyone should expect them.
    ...(application.rfi_date ? [{ label: "RFI", date: application.rfi_date }] : []),
    ...(application.nsf_email_date ? [{ label: "NSF", date: application.nsf_email_date }] : []),
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

      <div className="milestone-timeline" style={{ "--milestone-count": milestones.length }}>
        {milestones.map((milestone, index) => (
          <div className={milestone.date ? "milestone complete" : "milestone"} key={milestone.label}>
            <span className="milestone-dot">{milestone.date ? "✓" : index + 1}</span>
            <span className="milestone-label">{milestone.label}</span>
            <span className="milestone-date">{shortDate(milestone.date) ?? "Not yet"}</span>
          </div>
        ))}
      </div>

      {application.notes && <p className="application-notes">{application.notes}</p>}

      <CohortInsight application={application} />
    </article>
  );
}

export default function MyApplication() {
  usePageTitle("My timeline");
  const { user } = useAuth();
  const [applicationsState, setApplicationsState] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formBaseline, setFormBaseline] = useState(null);
  const [status, setStatus] = useState("");
  const [validationErrors, setValidationErrors] = useState([]);
  const validationRef = useRef(null);

  const loadApplications = useCallback(async (signal) => {
    try {
      const records = await pb.collection("applications")
      .getFullList({
        filter: pb.filter("user = {:userId}", { userId: user.id }),
        sort: "-application_date",
        expand: "country_id",
        requestKey: null,
        signal,
      });
      if (!signal?.aborted) {
        setApplicationsState({ userId: user.id, items: records });
        setLoadError("");
      }
    } catch (err) {
      if (err?.isAbort || signal?.aborted) return;
      setLoadError("Couldn't load your applications right now.");
    }
  }, [user.id]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) loadApplications(controller.signal);
    });
    return () => controller.abort();
  }, [loadApplications]);

  const applications = applicationsState?.userId === user.id ? applicationsState.items : null;

  const isDirty = useMemo(
    () => showForm && formBaseline !== null && JSON.stringify(form) !== formBaseline,
    [form, formBaseline, showForm],
  );
  const blocker = useBlocker(isDirty && status !== "saving");

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("Discard your unsaved application changes?")) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!isDirty) return;
        event.preventDefault();
        event.returnValue = "";
      },
      [isDirty],
    ),
  );

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function startNew() {
    const nextForm = { ...emptyForm };
    setForm(nextForm);
    setFormBaseline(JSON.stringify(nextForm));
    setEditingId(null);
    setStatus("");
    setValidationErrors([]);
    setShowForm(true);
  }

  function startEdit(record) {
    if (isDirty && !window.confirm("Discard your unsaved application changes?")) return;
    const nextForm = toFormState(record);
    setForm(nextForm);
    setFormBaseline(JSON.stringify(nextForm));
    setEditingId(record.id);
    setStatus("");
    setValidationErrors([]);
    setShowForm(true);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this application entry?")) return;
    try {
      await pb.collection("applications").delete(id);
      if (editingId === id) {
        setShowForm(false);
        setEditingId(null);
        setFormBaseline(null);
      }
      await loadApplications();
    } catch {
      setLoadError("Couldn't delete that application. Please try again.");
    }
  }

  function cancelForm() {
    if (isDirty && !window.confirm("Discard your unsaved application changes?")) return;
    setShowForm(false);
    setEditingId(null);
    setFormBaseline(null);
    setValidationErrors([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setValidationErrors([]);

    if (!pb.authStore.isValid || !user?.id) {
      setStatus("error");
      setValidationErrors(["Please log in again before saving your application."]);
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
    // Collect every failed check so the user fixes the form in one pass.
    const problems = [];
    const today = localToday();
    for (const [field, label] of datedFields) {
      if (form[field] > today) problems.push(`${label} cannot be in the future.`);
    }
    if (form.biometrics_date && form.application_date > form.biometrics_date) {
      problems.push("Biometrics date cannot be before the application date.");
    }
    for (const [field, label] of datedFields.slice(2)) {
      if (form[field] && form.biometrics_date && form[field] < form.biometrics_date) {
        problems.push(`${label} cannot be before biometrics.`);
      }
    }
    if (form.outcome === "pending" && form.decision_date) {
      problems.push("Remove the decision date or change the outcome.");
    }
    if (form.outcome !== "pending" && !form.decision_date) {
      problems.push("Add the decision date for an approved or rejected application.");
    }
    if (problems.length > 0) {
      setValidationErrors(problems);
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
      setFormBaseline(null);
      await loadApplications();
    } catch (err) {
      console.error("Application save failed", err);
      setStatus("error");
      setValidationErrors(validationMessages(err));
    }
  }

  // Bring the error summary into view when a submit fails — the form is tall
  // enough that errors rendered off-screen read as "nothing happened".
  useEffect(() => {
    if (validationErrors.length === 0) return;
    validationRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    validationRef.current?.focus({ preventScroll: true });
  }, [validationErrors]);

  // Auto-dismiss the save confirmation.
  useEffect(() => {
    if (status !== "saved") return undefined;
    const timer = setTimeout(() => setStatus(""), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div className="my-applications-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow plain">Your visa journey</span>
          <h1>My applications</h1>
          <p>Keep milestones current to see how your wait compares.</p>
        </div>
        {!showForm && (
          <button type="button" className="primary-button button" onClick={startNew}>
            + Add application
          </button>
        )}
      </div>

      {status === "saved" && (
        <p className="success-text" role="status">
          Application saved.
        </p>
      )}

      {applications && (
        <ClaimCallout
          key={user.id}
          hasApplications={applications.length > 0}
          onClaimed={loadApplications}
        />
      )}

      {applications === null && !loadError && (
        <p className="empty-hint" role="status">Loading your applications…</p>
      )}

      {loadError && (
        <div className="inline-error" role="alert">
          <span>{loadError}</span>
          <button
            type="button"
            className="small-button"
            onClick={() => {
              setLoadError("");
              loadApplications();
            }}
          >
            Try again
          </button>
        </div>
      )}

      {applications?.length > 0 && (
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

      {!showForm && applications?.length === 0 && !loadError && (
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
          {validationErrors.length > 0 && (
            <div className="form-error-summary" role="alert" tabIndex={-1} ref={validationRef}>
              <strong>Please fix the following:</strong>
              <ul>
                {validationErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}
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
            <div className="form-field">
              <label htmlFor="application-country">
                Country applying from
                <Required />
              </label>
              <CountrySelect
                id="application-country"
                value={form.country_id}
                onChange={(id) => update("country_id", id)}
                required
              />
            </div>
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

            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" disabled={status === "saving"}>
                {status === "saving" ? "Saving…" : editingId ? "Update" : "Submit"}
              </button>
              <button type="button" className="link-button" onClick={cancelForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
