import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const WINDOW_OPTIONS = [
  { value: "1", label: "1 month" },
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "all", label: "All time" },
];

export default function GroupBarChart({ title, data, labels = {} }) {
  const [selectedWindow, setSelectedWindow] = useState("all");

  const windowed = data && !Array.isArray(data);
  const rows = windowed ? data[selectedWindow] ?? [] : data;

  const chartData = rows.map((row) => ({
    ...row,
    key: labels[row.key] ?? row.key,
    avgDays: Math.round(row.avgDays * 10) / 10,
  }));

  return (
    <div className="chart-card">
      <h3>{title}</h3>
      {windowed && (
        <div className="filter-row">
          {WINDOW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === selectedWindow ? "filter-button active" : "filter-button"}
              onClick={() => setSelectedWindow(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {chartData.length === 0 ? (
        <p className="empty-hint">Not enough decided applications yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="key" />
            <YAxis
              label={{
                value: "Avg days",
                angle: -90,
                position: "insideLeft",
              }}
            />
            <Tooltip
              formatter={(value, name) =>
                name === "avgDays" ? [`${value} days`, "Avg processing"] : [value, name]
              }
            />
            <Bar dataKey="avgDays" fill="#2f6fed" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
