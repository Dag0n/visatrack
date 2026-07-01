import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { pb } from "../lib/pb";
import { VISA_TYPE_LABELS } from "../lib/labels";

const VISA_TYPES = Object.keys(VISA_TYPE_LABELS);

const LINE_COLORS = {
  all: "#2f6fed",
  spouse: "#e06c75",
  fiance: "#e5c07b",
  unmarried_partner: "#98c379",
  extension: "#c678dd",
  other: "#56b6c2",
};

const PRIORITY_FILTERS = [
  { value: "all", label: "All" },
  { value: "none", label: "Standard" },
  { value: "priority", label: "Priority" },
  { value: "super_priority", label: "Super priority" },
];

function getLast12Months() {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function formatMonth(ym) {
  const [year, month] = ym.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function buildChartData(rows, months, priorityFilter) {
  return months.map((month) => {
    const relevant = rows.filter(
      (r) =>
        r.month === month &&
        (priorityFilter === "all" || r.priority_service === priorityFilter),
    );

    const countPoint = { month, label: formatMonth(month), all: 0 };
    const daysPoint = { month, label: formatMonth(month) };
    const daySums = { all: 0 };
    const dayCounts = { all: 0 };

    for (const vt of VISA_TYPES) {
      countPoint[vt] = 0;
      daySums[vt] = 0;
      dayCounts[vt] = 0;
    }

    for (const r of relevant) {
      countPoint.all += r.count;
      daySums.all += r.avg_days * r.count;
      dayCounts.all += r.count;
      if (VISA_TYPES.includes(r.visa_type)) {
        countPoint[r.visa_type] += r.count;
        daySums[r.visa_type] += r.avg_days * r.count;
        dayCounts[r.visa_type] += r.count;
      }
    }

    daysPoint.all = dayCounts.all > 0 ? Math.round((daySums.all / dayCounts.all) * 10) / 10 : null;
    for (const vt of VISA_TYPES) {
      daysPoint[vt] = dayCounts[vt] > 0 ? Math.round((daySums[vt] / dayCounts[vt]) * 10) / 10 : null;
    }

    return { countPoint, daysPoint };
  });
}

function Chart({ data, dataKey, hiddenLines, lines, lineLabel, yLabel, allowDecimals = true }) {
  const isEmpty = data.every((d) => lines.every((k) => d[k] == null || d[k] === 0));
  if (isEmpty) return <p className="empty-hint">Not enough data for this selection.</p>;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis
          allowDecimals={allowDecimals}
          tick={{ fontSize: 12 }}
          label={{ value: yLabel, angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
          width={50}
        />
        <Tooltip
          formatter={(value, name) => [value, lineLabel(name)]}
          labelFormatter={(label) => label}
        />
        {lines.map((key) =>
          hiddenLines.has(key) ? null : (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={key}
              stroke={LINE_COLORS[key]}
              strokeWidth={key === "all" ? 2.5 : 1.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          ),
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function CountryStats() {
  const { country } = useParams();
  const countryName = decodeURIComponent(country);

  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [hiddenLines, setHiddenLines] = useState(new Set());

  useEffect(() => {
    const base = pb.baseURL.replace(/\/$/, "");
    fetch(`${base}/api/custom/country-stats?country=${encodeURIComponent(countryName)}`)
      .then((res) => res.json())
      .then((data) => setRows(data.rows ?? []))
      .catch(() => setError("Couldn't load country stats right now."));
  }, [countryName]);

  const months = getLast12Months();
  const lines = ["all", ...VISA_TYPES];

  const built = useMemo(
    () => (rows ? buildChartData(rows, months, priorityFilter) : []),
    [rows, priorityFilter, months],
  );

  const countData = built.map((b) => b.countPoint);
  const daysData = built.map((b) => b.daysPoint);

  function toggleLine(key) {
    setHiddenLines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const lineLabel = (key) => (key === "all" ? "All" : VISA_TYPE_LABELS[key] ?? key);

  return (
    <div>
      <Link to="/countries" className="back-link">← Countries</Link>
      <h2>{countryName}</h2>

      {error && <p className="empty-hint">{error}</p>}
      {!error && !rows && <p className="empty-hint">Loading…</p>}

      {!error && rows && (
        <>
          <div className="filter-row" style={{ marginBottom: 8 }}>
            {PRIORITY_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={priorityFilter === f.value ? "filter-button active" : "filter-button"}
                onClick={() => setPriorityFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="filter-row" style={{ flexWrap: "wrap", marginBottom: 16 }}>
            {lines.map((key) => (
              <button
                key={key}
                type="button"
                className={hiddenLines.has(key) ? "filter-button" : "filter-button active"}
                style={{
                  borderColor: LINE_COLORS[key],
                  color: hiddenLines.has(key) ? undefined : LINE_COLORS[key],
                  background: hiddenLines.has(key) ? undefined : `${LINE_COLORS[key]}18`,
                }}
                onClick={() => toggleLine(key)}
              >
                {lineLabel(key)}
              </button>
            ))}
          </div>

          <div className="chart-card">
            <h3>Applications decided per month</h3>
            <p className="optional-hint" style={{ marginBottom: 8 }}>
              Decisions (approved + rejected) by month over the last 12 months.
            </p>
            <Chart
              data={countData}
              hiddenLines={hiddenLines}
              lines={lines}
              lineLabel={lineLabel}
              yLabel="Decisions"
              allowDecimals={false}
            />
          </div>

          <div className="chart-card">
            <h3>Avg. processing days per month</h3>
            <p className="optional-hint" style={{ marginBottom: 8 }}>
              Average working days from biometrics to decision, by month of decision.
            </p>
            <Chart
              data={daysData}
              hiddenLines={hiddenLines}
              lines={lines}
              lineLabel={lineLabel}
              yLabel="Avg days"
            />
          </div>
        </>
      )}
    </div>
  );
}
