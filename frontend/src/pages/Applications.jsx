import { useEffect, useMemo, useState } from "react";
import { pb } from "../lib/pb";
import { useAuth } from "../lib/auth.jsx";
import { PRIORITY_LABELS, VISA_TYPE_LABELS } from "../lib/labels";
import { formatRedditUsername } from "../lib/format";
import { calendarDaysBetween, processingStartDate, workingDaysBetween } from "../lib/processingDays";
import StatusBadge from "../components/StatusBadge";

const PER_PAGE = 20;

const FILTERS = [
  { value: "pending", label: "In progress" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const VISA_TYPE_FILTERS = [
  { value: "all", label: "All visa types" },
  ...Object.entries(VISA_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

const PRIORITY_FILTERS = [
  { value: "all", label: "All services" },
  ...Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label })),
];

const MILESTONE_FILTERS = [
  { value: "all", label: "Any milestones" },
  { value: "eco", label: "Has ECO email" },
  { value: "rfi", label: "Has RFI" },
  { value: "nsf", label: "Has NSF email" },
  { value: "none", label: "No milestone emails" },
];

const MILESTONE_CLAUSES = {
  eco: 'eco_email_date != ""',
  rfi: 'rfi_date != ""',
  nsf: 'nsf_email_date != ""',
  none: 'eco_email_date = "" && rfi_date = "" && nsf_email_date = ""',
};

const SORT_OPTIONS = [
  { value: "-application_date", label: "Newest applied first" },
  { value: "application_date", label: "Oldest applied first" },
  { value: "-biometrics_date", label: "Newest biometrics first" },
  { value: "biometrics_date", label: "Oldest biometrics first" },
  { value: "-decision_date", label: "Newest decision first" },
  { value: "decision_date", label: "Oldest decision first" },
];

function ownComboKey(item) {
  return `${item.country_id}::${item.visa_type}::${item.priority_service}`;
}

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function DaysCell({ start, end }) {
  if (!start || !end) return "—";

  const calendarDays = calendarDaysBetween(start, end);
  const workingDays = workingDaysBetween(start, end);
  return (
    <span className="days-cell">
      <span className="days-main">{workingDays} WD</span>
      <span className="days-sub">{calendarDays}d total</span>
    </span>
  );
}

function processingEnd(item) {
  if (item.outcome === "pending") return new Date();
  return item.decision_date ? new Date(item.decision_date) : null;
}

export default function Applications() {
  const { user, isLoggedIn } = useAuth();
  const [filter, setFilter] = useState("pending");
  const [visaType, setVisaType] = useState("all");
  const [priority, setPriority] = useState("all");
  const [milestone, setMilestone] = useState("all");
  const [country, setCountry] = useState("");
  const [bioFrom, setBioFrom] = useState("");
  const [bioTo, setBioTo] = useState("");
  const [sort, setSort] = useState("-application_date");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [ownItems, setOwnItems] = useState([]);

  const hasExtraFilters =
    priority !== "all" || milestone !== "all" || bioFrom !== "" || bioTo !== "";

  const pbFilter = useMemo(() => {
    const clauses = [];
    if (filter !== "all") clauses.push(pb.filter("outcome = {:outcome}", { outcome: filter }));
    if (visaType !== "all") clauses.push(pb.filter("visa_type = {:visaType}", { visaType }));
    if (priority !== "all") clauses.push(pb.filter("priority_service = {:priority}", { priority }));
    if (milestone !== "all") clauses.push(MILESTONE_CLAUSES[milestone]);
    if (country.trim()) clauses.push(pb.filter("country_id.name ~ {:country}", { country: country.trim() }));
    if (bioFrom) clauses.push(pb.filter("biometrics_date >= {:from}", { from: `${bioFrom} 00:00:00.000Z` }));
    if (bioTo) clauses.push(pb.filter("biometrics_date <= {:to}", { to: `${bioTo} 23:59:59.999Z` }));
    return clauses.join(" && ");
  }, [filter, visaType, priority, milestone, country, bioFrom, bioTo]);

  function clearExtraFilters() {
    setPriority("all");
    setMilestone("all");
    setBioFrom("");
    setBioTo("");
    setPage(1);
  }

  useEffect(() => {
    pb.collection("applications")
      .getList(page, PER_PAGE, {
        filter: pbFilter,
        sort,
        expand: "country_id",
        requestKey: null,
      })
      .then(setResult)
      .catch((err) => {
        if (err?.isAbort) return;
        setError("Couldn't load applications right now.");
      });
  }, [page, pbFilter, sort]);

  useEffect(() => {
    pb.collection("applications")
      .getFullList({
        filter: pbFilter,
        fields: "biometrics_date,decision_date,outcome",
        requestKey: null,
      })
      .then((items) => {
        const workingDays = items
          .map((item) => {
            const start = processingStartDate(item);
            const end = processingEnd(item);
            return start && end ? workingDaysBetween(start, end) : null;
          })
          .filter((days) => days !== null);
        setSummary({
          total: items.length,
          measured: workingDays.length,
          avgWD: average(workingDays),
          medianWD: median(workingDays),
        });
      })
      .catch((err) => {
        if (err?.isAbort) return;
        setSummary(null);
      });
  }, [pbFilter]);

  useEffect(() => {
    if (!isLoggedIn) return;
    pb.collection("applications")
      .getFullList({
        filter: pb.filter("user = {:userId}", { userId: user.id }),
        fields: "country_id,visa_type,priority_service",
        requestKey: null,
      })
      .then(setOwnItems)
      .catch((err) => {
        if (err?.isAbort) return;
        setOwnItems([]);
      });
  }, [isLoggedIn, user?.id]);

  const ownCombos = useMemo(() => {
    if (!isLoggedIn) return new Set();
    return new Set(ownItems.map(ownComboKey));
  }, [isLoggedIn, ownItems]);

  return (
    <div className="applications-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow plain">Timeline explorer</span>
          <h1>Community applications</h1>
          <p>
            Find people on a similar route and see each milestone in context.
            Processing starts on the first working day after biometrics.
          </p>
        </div>
      </div>

      <div className="explorer-panel">
        <div className="filter-row status-filters">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={filter === f.value ? "filter-button active" : "filter-button"}
              onClick={() => {
                setFilter(f.value);
                setPage(1);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="filter-row explorer-controls">
          <input
            type="text"
            className="table-search"
            placeholder="Search by country…"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Visa type"
            value={visaType}
            onChange={(e) => {
              setVisaType(e.target.value);
              setPage(1);
            }}
          >
            {VISA_TYPE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort applications"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-row explorer-controls">
          <select
            aria-label="Priority service"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
          >
            {PRIORITY_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Milestone emails"
            value={milestone}
            onChange={(e) => {
              setMilestone(e.target.value);
              setPage(1);
            }}
          >
            {MILESTONE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <label className="date-field">
            <span>Biometrics from</span>
            <input
              type="date"
              value={bioFrom}
              onChange={(e) => {
                setBioFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="date-field">
            <span>to</span>
            <input
              type="date"
              value={bioTo}
              onChange={(e) => {
                setBioTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
          {hasExtraFilters && (
            <button type="button" className="clear-filters" onClick={clearExtraFilters}>
              Clear
            </button>
          )}
        </div>

        {summary && (
          <div className="result-summary">
            <div><strong>{summary.total}</strong><span>Matching timelines</span></div>
            <div><strong>{summary.measured > 0 ? `${round1(summary.medianWD)} WD` : "—"}</strong><span>Median duration</span></div>
            <div><strong>{summary.measured > 0 ? `${round1(summary.avgWD)} WD` : "—"}</strong><span>Average duration</span></div>
            <p>{summary.measured} entries have enough dates to measure.</p>
          </div>
        )}
      </div>

      {ownCombos.size > 0 && (
        <p className="optional-hint">
          Highlighted rows match your own application's country, visa type, and priority
          service.
        </p>
      )}

      {error && <p className="empty-hint">{error}</p>}

      {!error && !result && <p className="empty-hint">Loading…</p>}

      {!error && result && result.items.length === 0 && (
        <p className="empty-hint">No applications match this filter yet.</p>
      )}

      {!error && result && result.items.length > 0 && (
        <>
          <div className="table-scroll">
          <table className="waiting-table applications-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Visa type</th>
                <th>Priority</th>
                <th>Outcome</th>
                <th>Applied on</th>
                <th>Bio on</th>
                <th>From bio</th>
                <th>ECO email</th>
                <th>RFI</th>
                <th>NSF email</th>
                <th>Reason</th>
                <th>Post</th>
                <th>Redditor</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                  <tr
                    key={item.id}
                    className={ownCombos.has(ownComboKey(item)) ? "row-highlight" : undefined}
                  >
                    <td>{item.expand?.country_id?.name ?? "—"}</td>
                    <td>{VISA_TYPE_LABELS[item.visa_type] ?? item.visa_type}</td>
                    <td>{PRIORITY_LABELS[item.priority_service] ?? item.priority_service}</td>
                    <td><StatusBadge outcome={item.outcome} /></td>
                    <td>{item.application_date?.slice(0, 10) || "—"}</td>
                    <td>{item.biometrics_date?.slice(0, 10) || "—"}</td>
                    <td>
                      <DaysCell start={processingStartDate(item)} end={processingEnd(item)} />
                    </td>
                    <td>
                      <DaysCell
                        start={processingStartDate(item)}
                        end={item.eco_email_date ? new Date(item.eco_email_date) : null}
                      />
                    </td>
                    <td>
                      <DaysCell
                        start={processingStartDate(item)}
                        end={item.rfi_date ? new Date(item.rfi_date) : null}
                      />
                    </td>
                    <td>
                      <DaysCell
                        start={processingStartDate(item)}
                        end={item.nsf_email_date ? new Date(item.nsf_email_date) : null}
                      />
                    </td>
                    <td>{item.outcome === "rejected" ? item.rejection_reason || "—" : "—"}</td>
                    <td>
                      {item.reddit_post_url ? (
                        <a href={item.reddit_post_url} target="_blank" rel="noreferrer">
                          View post
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{formatRedditUsername(item.reddit_username)}</td>
                  </tr>
              ))}
            </tbody>
          </table>
          </div>

          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              Page {result.page} of {Math.max(1, result.totalPages)}
            </span>
            <button
              disabled={page >= result.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
