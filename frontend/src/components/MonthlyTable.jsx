import { useState } from "react";

function round1(n) {
  return Math.round(n * 10) / 10;
}

export default function MonthlyTable({ data }) {
  const [service, setService] = useState("none");
  const legacyData = Array.isArray(data);
  const rows = legacyData ? data : data[service] ?? [];
  const services = [
    { value: "none", label: "Standard" },
    { value: "priority", label: "Priority" },
    { value: "super_priority", label: "Super priority" },
    { value: "all", label: "All combined" },
  ];

  return (
    <div className="chart-card">
      <h3>Typical approval times by month</h3>
      <p className="optional-hint">
        Median and middle-half range by decision month. Working days start after
        biometrics and exclude UK bank holidays.
      </p>
      {!legacyData && (
        <div className="filter-row">
          {services.map((option) => (
            <button
              key={option.value}
              type="button"
              className={service === option.value ? "filter-button active" : "filter-button"}
              onClick={() => setService(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="empty-hint">Not enough approved applications yet.</p>
      ) : (
        <div className="table-scroll">
        <table className="country-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Approved</th>
              <th>Mean</th>
              <th>Median</th>
              <th>Middle 50%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.month}>
                <td>{row.month}</td>
                <td>{row.count}</td>
                <td>{round1(row.avgDays)}d</td>
                <td>{round1(row.medianDays)}d</td>
                <td>
                  {row.lowerQuartile == null
                    ? "—"
                    : `${round1(row.lowerQuartile)}–${round1(row.upperQuartile)}d`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
