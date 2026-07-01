import { useState } from "react";
import { Link } from "react-router-dom";

const PRIORITY_FILTERS = [
  { value: "none", label: "Standard" },
  { value: "priority", label: "Priority" },
  { value: "super_priority", label: "Super priority" },
  { value: "all", label: "All combined" },
];

export default function CountryTable({ data, priorityFilter, onPriorityFilterChange }) {
  const [search, setSearch] = useState("");

  const filtered = data.filter((row) =>
    row.key.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="chart-card">
      <h3>Countries and visa waiting times</h3>
      <p className="optional-hint">
        Priority and super priority cases resolve much faster, so they're split out
        here to avoid skewing standard processing times.
      </p>

      <div className="filter-row">
        {PRIORITY_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={priorityFilter === f.value ? "filter-button active" : "filter-button"}
            onClick={() => onPriorityFilterChange(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <input
        type="text"
        className="table-search"
        placeholder="Search country…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
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
              <th>Approval rate</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.key}>
                <td>
                    <Link to={`/country/${encodeURIComponent(row.key)}`}>{row.key}</Link>
                  </td>
                <td>{row.count}</td>
                <td>{Math.round(row.avgDays * 10) / 10}</td>
                <td>{Math.round((row.approved / row.count) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
