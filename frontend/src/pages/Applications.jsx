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

const SORT_OPTIONS = [
  { value: "-application_date", label: "Newest applied first" },
  { value: "application_date", label: "Oldest applied first" },
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
  const [country, setCountry] = useState("");
  const [sort, setSort] = useState("-application_date");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [ownItems, setOwnItems] = useState([]);

  const pbFilter = useMemo(() => {
    const clauses = [];
    if (filter !== "all") clauses.push(pb.filter("outcome = {:outcome}", { outcome: filter }));
    if (visaType !== "all") clauses.push(pb.filter("visa_type = {:visaType}", { visaType }));
    if (country.trim()) clauses.push(pb.filter("country_id.name ~ {:country}", { country: country.trim() }));
    return clauses.join(" && ");
  }, [filter, visaType, country]);

  useEffect(() => {
    setPage(1);
  }, [pbFilter, sort]);

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
    <div>
      <h2>Applications</h2>
      <p className="optional-hint">
        Day 1 of processing time is the first working day after the biometrics
        appointment. Entries without a biometrics date yet show no processing time.
        ECO email / RFI / NSF email columns show days elapsed since biometrics.
      </p>

      <div className="filter-row">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={filter === f.value ? "filter-button active" : "filter-button"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="filter-row">
        <input
          type="text"
          className="table-search"
          placeholder="Search country…"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        />
        <select value={visaType} onChange={(e) => setVisaType(e.target.value)}>
          {VISA_TYPE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {summary && summary.measured > 0 && (
        <p className="optional-hint">
          Avg processing for these results: {round1(summary.avgWD)} WD (median{" "}
          {round1(summary.medianWD)} WD) across {summary.measured} of {summary.total}{" "}
          matching entries with biometrics recorded.
        </p>
      )}

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
