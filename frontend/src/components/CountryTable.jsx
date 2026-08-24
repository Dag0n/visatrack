import { useState } from "react";
import { Link } from "react-router-dom";
import FilterButtonGroup from "./FilterButtonGroup";
import { PRIORITY_FILTER_OPTIONS } from "../lib/labels";
import { formatApprovalRate, round1 } from "../lib/format";
import { LOW_SAMPLE } from "../lib/chartTheme";

// `limit` renders a compact teaser (top N rows, no search) with a link to the
// full Countries page — used on the Dashboard. Without it, the full searchable
// table is shown.
export default function CountryTable({ data, priorityFilter, onPriorityFilterChange, limit }) {
  const [search, setSearch] = useState("");

  const matching = limit
    ? data
    : data.filter((row) => row.key.toLowerCase().includes(search.toLowerCase()));
  const filtered = limit ? matching.slice(0, limit) : matching;

  return (
    <div className="chart-card">
      <h3>{limit ? "Top countries by reported decisions" : "Countries and visa waiting times"}</h3>
      <p className="optional-hint">
        Priority and super priority cases resolve much faster, so they're split out
        here to avoid skewing standard processing times. Approval figures are
        self-reported and may not represent all outcomes.
      </p>

      <FilterButtonGroup
        options={PRIORITY_FILTER_OPTIONS}
        value={priorityFilter}
        onChange={onPriorityFilterChange}
        label="Country service level"
      />

      {!limit && (
        <input
          type="text"
          className="table-search"
          placeholder="Search country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      {filtered.length === 0 ? (
        <p className="empty-hint">No matching countries with decided applications yet.</p>
      ) : (
        <div className="table-scroll">
        <table className="country-table">
          <thead>
            <tr>
              <th>Country</th>
              <th>Decided</th>
              <th>Avg. days</th>
              <th>Reported approved</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.key} className={row.count < LOW_SAMPLE ? "low-sample-row" : undefined}>
                <td>
                    <Link to={`/country/${encodeURIComponent(row.key)}`}>{row.key}</Link>
                    {row.count < LOW_SAMPLE && <span className="low-sample-label">Small sample</span>}
                  </td>
                <td>{row.count}</td>
                <td>{round1(row.avgDays)}</td>
                <td>{formatApprovalRate(row.approved, row.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
      {filtered.some((row) => row.count < LOW_SAMPLE) && (
        <p className="optional-hint low-sample-note">
          Faded rows have fewer than {LOW_SAMPLE} reported decisions; treat their averages and approval shares as anecdotal.
        </p>
      )}
      {limit && data.length > limit && (
        <p className="optional-hint" style={{ marginTop: 10, marginBottom: 0 }}>
          <Link to="/countries">View all {data.length} countries →</Link>
        </p>
      )}
    </div>
  );
}
