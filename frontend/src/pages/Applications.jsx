import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { pb } from "../lib/pb";
import { fetchCustom, isAbortError } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";
import { PRIORITY_LABELS, VISA_TYPE_LABELS } from "../lib/labels";
import { formatRedditUsername, round1 } from "../lib/format";
import { calendarDaysBetween, processingStartDate, workingDaysBetween } from "../lib/processingDays";
import FilterButtonGroup from "../components/FilterButtonGroup";
import StatCards from "../components/StatCards";
import StatusBadge from "../components/StatusBadge";

const PER_PAGE = 20;
const COUNTRY_DEBOUNCE_MS = 300;
const LIST_REQUEST_KEY = "applications-explorer-list";
const OWN_ITEMS_REQUEST_KEY = "applications-explorer-own-items";

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

// URL query params double as the filter state so views can be linked,
// bookmarked, and undone with the back button. Defaults stay out of the URL.
const PARAM_DEFAULTS = {
  status: "pending",
  visa: "all",
  service: "all",
  milestone: "all",
  country: "",
  bioFrom: "",
  bioTo: "",
  sort: "-application_date",
};

function optionParam(searchParams, key, options) {
  const value = searchParams.get(key);
  return options.some((option) => option.value === value) ? value : PARAM_DEFAULTS[key];
}

function dateParam(searchParams, key) {
  const value = searchParams.get(key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return PARAM_DEFAULTS[key];

  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : PARAM_DEFAULTS[key];
}

function pageParam(value) {
  if (value === null) return { page: 1, isCanonical: true };

  const parsed = Number(value);
  const isValid = Number.isSafeInteger(parsed) && parsed >= 1;
  return {
    page: isValid ? parsed : 1,
    isCanonical: isValid && parsed > 1 && value === String(parsed),
  };
}

function useDebouncedValue(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [value, delay]);

  return debouncedValue;
}

function ownComboKey(item) {
  return `${item.country_id}::${item.visa_type}::${item.priority_service}`;
}

function formatWorkingDays(value, measured) {
  return measured > 0 ? `${round1(value)} WD` : "—";
}

function summaryPresentation(summary, status) {
  if (status === "pending") {
    return {
      items: [
        { value: summary.total, label: "Matching timelines" },
        {
          value: formatWorkingDays(summary.pending.median, summary.pending.measured),
          label: "Median current wait",
        },
        {
          value: formatWorkingDays(summary.pending.average, summary.pending.measured),
          label: "Average current wait",
        },
      ],
      footnote: `${summary.pending.measured} pending entries have biometrics dates to measure.`,
    };
  }

  if (status === "approved" || status === "rejected") {
    return {
      items: [
        { value: summary.total, label: "Matching timelines" },
        {
          value: formatWorkingDays(summary.completed.median, summary.completed.measured),
          label: "Median processing time",
        },
        {
          value: formatWorkingDays(summary.completed.average, summary.completed.measured),
          label: "Average processing time",
        },
      ],
      footnote: `${summary.completed.measured} completed entries have biometrics and decision dates to measure.`,
    };
  }

  return {
    items: [
      { value: summary.total, label: "Matching timelines" },
      {
        value: formatWorkingDays(summary.completed.median, summary.completed.measured),
        label: "Completed median",
      },
      {
        value: formatWorkingDays(summary.pending.median, summary.pending.measured),
        label: "Pending median wait",
      },
    ],
    footnote: `${summary.completed.measured} completed and ${summary.pending.measured} pending entries have enough dates to measure.`,
  };
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
  return item.decision_date || null;
}

export default function Applications() {
  const { user, isLoggedIn } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [resultState, setResultState] = useState(null);
  const [errorState, setErrorState] = useState(null);
  const [summaryState, setSummaryState] = useState(null);
  const [ownItemsState, setOwnItemsState] = useState(null);

  const filter = optionParam(searchParams, "status", FILTERS);
  const visaType = optionParam(searchParams, "visa", VISA_TYPE_FILTERS);
  const priority = optionParam(searchParams, "service", PRIORITY_FILTERS);
  const milestone = optionParam(searchParams, "milestone", MILESTONE_FILTERS);
  const country = searchParams.get("country") ?? PARAM_DEFAULTS.country;
  const debouncedCountry = useDebouncedValue(country, COUNTRY_DEBOUNCE_MS);
  const bioFrom = dateParam(searchParams, "bioFrom");
  const bioTo = dateParam(searchParams, "bioTo");
  const dateRangeIsValid = !bioFrom || !bioTo || bioFrom <= bioTo;
  const dateRangeError = dateRangeIsValid
    ? ""
    : "The biometrics ‘from’ date must be on or before the ‘to’ date.";
  const sort = optionParam(searchParams, "sort", SORT_OPTIONS);
  const { page, isCanonical: pageIsCanonical } = pageParam(searchParams.get("page"));

  function setParam(key, value, { replace = false } = {}) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === PARAM_DEFAULTS[key]) next.delete(key);
        else next.set(key, value);
        next.delete("page");
        return next;
      },
      { replace },
    );
  }

  function setPage(value) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value <= 1) next.delete("page");
      else next.set("page", String(value));
      return next;
    });
  }

  const hasExtraFilters =
    priority !== "all" || milestone !== "all" || bioFrom !== "" || bioTo !== "";

  const pbFilter = useMemo(() => {
    const clauses = [];
    if (filter !== "all") clauses.push(pb.filter("outcome = {:outcome}", { outcome: filter }));
    if (visaType !== "all") clauses.push(pb.filter("visa_type = {:visaType}", { visaType }));
    if (priority !== "all") clauses.push(pb.filter("priority_service = {:priority}", { priority }));
    if (milestone !== "all") clauses.push(MILESTONE_CLAUSES[milestone]);
    if (debouncedCountry.trim()) {
      clauses.push(pb.filter("country_id.name ~ {:country}", { country: debouncedCountry.trim() }));
    }
    if (bioFrom) clauses.push(pb.filter("biometrics_date >= {:from}", { from: `${bioFrom} 00:00:00.000Z` }));
    if (bioTo) clauses.push(pb.filter("biometrics_date <= {:to}", { to: `${bioTo} 23:59:59.999Z` }));
    return clauses.join(" && ");
  }, [filter, visaType, priority, milestone, debouncedCountry, bioFrom, bioTo]);

  const summaryQuery = useMemo(() => {
    const params = new URLSearchParams({
      status: filter,
      visa: visaType,
      service: priority,
      milestone,
    });
    if (debouncedCountry.trim()) params.set("country", debouncedCountry.trim());
    if (bioFrom) params.set("bioFrom", bioFrom);
    if (bioTo) params.set("bioTo", bioTo);
    return params.toString();
  }, [filter, visaType, priority, milestone, debouncedCountry, bioFrom, bioTo]);

  // Secondary sort key so records with an empty sort field (e.g. pending rows
  // sorted by decision date) keep a deterministic order.
  const pbSort = sort.includes("application_date") ? sort : `${sort},-application_date`;
  const effectiveFilterKey = JSON.stringify([
    filter,
    visaType,
    priority,
    milestone,
    debouncedCountry.trim(),
    bioFrom,
    bioTo,
  ]);
  const visibleFilterKey = JSON.stringify([
    filter,
    visaType,
    priority,
    milestone,
    country.trim(),
    bioFrom,
    bioTo,
  ]);
  const listRequestKey = JSON.stringify([effectiveFilterKey, page, pbSort]);
  const listVisibleKey = JSON.stringify([visibleFilterKey, page, pbSort]);
  const result = resultState?.queryKey === listVisibleKey ? resultState.data : null;
  const error = errorState?.queryKey === listVisibleKey ? errorState.message : "";
  const summary = summaryState?.queryKey === visibleFilterKey ? summaryState.data : null;

  function clearExtraFilters() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const key of ["service", "milestone", "bioFrom", "bioTo", "page"]) next.delete(key);
      return next;
    });
  }

  useEffect(() => {
    if (!dateRangeIsValid) return undefined;

    let ignore = false;

    pb.collection("applications")
      .getList(page, PER_PAGE, {
        filter: pbFilter,
        sort: pbSort,
        expand: "country_id",
        requestKey: LIST_REQUEST_KEY,
      })
      .then((data) => {
        if (ignore) return;

        const lastPage = Math.max(1, data.totalPages);
        if (!pageIsCanonical || page > lastPage) {
          const safePage = Math.min(page, lastPage);
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              if (safePage <= 1) next.delete("page");
              else next.set("page", String(safePage));
              return next;
            },
            { replace: true },
          );
          return;
        }

        setErrorState(null);
        setResultState({ queryKey: listRequestKey, data });
      })
      .catch((err) => {
        if (ignore || err?.isAbort) return;
        setResultState({ queryKey: listRequestKey, data: null });
        setErrorState({
          queryKey: listRequestKey,
          message: "Couldn't load applications right now.",
        });
      });

    return () => {
      ignore = true;
      pb.cancelRequest(LIST_REQUEST_KEY);
    };
  }, [dateRangeIsValid, page, pageIsCanonical, pbFilter, pbSort, listRequestKey, setSearchParams]);

  useEffect(() => {
    if (!dateRangeIsValid) return undefined;

    const controller = new AbortController();
    let ignore = false;

    fetchCustom(`/application-summary?${summaryQuery}`, { signal: controller.signal })
      .then((data) => {
        if (ignore) return;
        setSummaryState({ queryKey: effectiveFilterKey, data });
      })
      .catch((err) => {
        if (ignore || isAbortError(err)) return;
        setSummaryState({ queryKey: effectiveFilterKey, data: null });
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [dateRangeIsValid, summaryQuery, effectiveFilterKey]);

  useEffect(() => {
    const userId = user?.id;
    if (!isLoggedIn || !userId) return undefined;

    let ignore = false;

    pb.collection("applications")
      .getFullList({
        filter: pb.filter("user = {:userId}", { userId }),
        fields: "country_id,visa_type,priority_service",
        requestKey: OWN_ITEMS_REQUEST_KEY,
      })
      .then((items) => {
        if (ignore) return;
        setOwnItemsState({ userId, items });
      })
      .catch((err) => {
        if (ignore || err?.isAbort) return;
        setOwnItemsState({ userId, items: [] });
      });

    return () => {
      ignore = true;
      pb.cancelRequest(OWN_ITEMS_REQUEST_KEY);
    };
  }, [isLoggedIn, user?.id]);

  const ownCombos = useMemo(() => {
    if (!isLoggedIn || ownItemsState?.userId !== user?.id) return new Set();
    return new Set(ownItemsState.items.map(ownComboKey));
  }, [isLoggedIn, ownItemsState, user?.id]);

  const presentedSummary = summary ? summaryPresentation(summary, filter) : null;

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
        <FilterButtonGroup
          className="status-filters"
          options={FILTERS}
          value={filter}
          onChange={(value) => setParam("status", value)}
        />

        <div className="filter-row explorer-controls">
          <input
            type="text"
            className="table-search"
            placeholder="Search by country…"
            value={country}
            onChange={(e) => setParam("country", e.target.value, { replace: true })}
          />
          <select
            aria-label="Visa type"
            value={visaType}
            onChange={(e) => setParam("visa", e.target.value)}
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
            onChange={(e) => setParam("sort", e.target.value)}
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
            onChange={(e) => setParam("service", e.target.value)}
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
            onChange={(e) => setParam("milestone", e.target.value)}
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
              max={bioTo || undefined}
              aria-invalid={!dateRangeIsValid}
              aria-describedby={!dateRangeIsValid ? "biometrics-range-error" : undefined}
              onChange={(e) => setParam("bioFrom", e.target.value)}
            />
          </label>
          <label className="date-field">
            <span>to</span>
            <input
              type="date"
              value={bioTo}
              min={bioFrom || undefined}
              aria-invalid={!dateRangeIsValid}
              aria-describedby={!dateRangeIsValid ? "biometrics-range-error" : undefined}
              onChange={(e) => setParam("bioTo", e.target.value)}
            />
          </label>
          {hasExtraFilters && (
            <button type="button" className="clear-filters" onClick={clearExtraFilters}>
              Clear
            </button>
          )}
        </div>

        {dateRangeError && (
          <p id="biometrics-range-error" className="filter-error error-text" role="alert">
            {dateRangeError}
          </p>
        )}

        {dateRangeIsValid && presentedSummary && (
          <StatCards
            variant="result"
            items={presentedSummary.items}
            footnote={presentedSummary.footnote}
          />
        )}
      </div>

      {ownCombos.size > 0 && (
        <p className="optional-hint">
          Highlighted rows match your own application's country, visa type, and priority
          service.
        </p>
      )}

      {dateRangeIsValid && error && <p className="empty-hint">{error}</p>}

      {dateRangeIsValid && !error && !result && <p className="empty-hint">Loading…</p>}

      {dateRangeIsValid && !error && result && result.items.length === 0 && (
        <p className="empty-hint">No applications match this filter yet.</p>
      )}

      {dateRangeIsValid && !error && result && result.items.length > 0 && (
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
                        end={item.eco_email_date || null}
                      />
                    </td>
                    <td>
                      <DaysCell
                        start={processingStartDate(item)}
                        end={item.rfi_date || null}
                      />
                    </td>
                    <td>
                      <DaysCell
                        start={processingStartDate(item)}
                        end={item.nsf_email_date || null}
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
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>
              Page {result.page} of {Math.max(1, result.totalPages)}
            </span>
            <button
              disabled={page >= result.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
