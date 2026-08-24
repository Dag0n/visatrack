import { useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import FilterButtonGroup from "./FilterButtonGroup";
import { PRIORITY_FILTER_OPTIONS } from "../lib/labels";
import { CHART_PRIMARY } from "../lib/chartTheme";
import { formatMonth, round1 } from "../lib/format";

const TABLE_MONTHS = 12;

export default function MonthlyTable({ data }) {
  const [service, setService] = useState("none");
  const [showAll, setShowAll] = useState(false);
  // Backend sends months oldest-first: keep that order for the chart
  // (time flows left to right) and reverse it for the table (most recent
  // month on top).
  const months = data[service] ?? [];
  const allRows = [...months].reverse();
  const tableRows = showAll ? allRows : allRows.slice(0, TABLE_MONTHS);

  // The chart shows a rolling window of the most recent 12 months; the table
  // below can still expand to the full history.
  const chartRows = months.slice(-TABLE_MONTHS).map((row) => ({
    label: formatMonth(row.month),
    medianDays: round1(row.medianDays),
    band:
      row.lowerQuartile == null
        ? null
        : [round1(row.lowerQuartile), round1(row.upperQuartile)],
    count: row.count,
  }));

  return (
    <div className="chart-card">
      <h3>Typical approval times by month</h3>
      <p className="optional-hint">
        Median and middle-half range by decision month over the last 12 months.
        Working days start after biometrics and exclude UK bank holidays.
      </p>
      <FilterButtonGroup
        options={PRIORITY_FILTER_OPTIONS}
        value={service}
        onChange={setService}
      />
      {months.length === 0 ? (
        <p className="empty-hint">Not enough approved applications yet.</p>
      ) : (
        <>
          {chartRows.length > 1 && (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={chartRows} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis
                  tick={{ fontSize: 12 }}
                  width={50}
                  label={{ value: "Working days", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
                />
                <Tooltip
                  formatter={(value, name, item) => {
                    if (name === "band") {
                      return Array.isArray(value) ? [`${value[0]}–${value[1]} WD`, "Middle 50%"] : null;
                    }
                    const count = item?.payload?.count;
                    return [`${value} WD (${count} approved)`, "Median"];
                  }}
                />
                <Area
                  dataKey="band"
                  name="band"
                  stroke="none"
                  fill={CHART_PRIMARY}
                  fillOpacity={0.14}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="medianDays"
                  name="medianDays"
                  type="monotone"
                  stroke={CHART_PRIMARY}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
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
              {tableRows.map((row) => (
                <tr key={row.month}>
                  <td>{formatMonth(row.month)}</td>
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
          {allRows.length > TABLE_MONTHS && (
            <button
              type="button"
              className="filter-button"
              style={{ marginTop: 10 }}
              onClick={() => setShowAll((prev) => !prev)}
            >
              {showAll ? `Show latest ${TABLE_MONTHS} months` : `Show all ${allRows.length} months`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
