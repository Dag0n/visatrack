import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import FilterButtonGroup from "./FilterButtonGroup";
import { CHART_PRIMARY, LOW_SAMPLE } from "../lib/chartTheme";
import { round1 } from "../lib/format";

const WINDOW_OPTIONS = [
  { value: "1", label: "1 month" },
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "all", label: "All time" },
];

export default function GroupBarChart({ title, data, labels = {} }) {
  const [selectedWindow, setSelectedWindow] = useState("all");

  const rows = data?.[selectedWindow] ?? [];

  // The backend returns groups sorted by raw enum key; order bars by the
  // label map instead so the axis reads in a meaningful sequence
  // (e.g. Spouse first, Other last).
  const order = Object.keys(labels);
  const rank = (key) => {
    const index = order.indexOf(key);
    return index === -1 ? order.length : index;
  };
  const chartData = [...rows]
    .sort((a, b) => rank(a.key) - rank(b.key))
    .map((row) => ({
      ...row,
      key: labels[row.key] ?? row.key,
      avgDays: round1(row.avgDays),
    }));
  const sampleSize = rows.reduce((total, row) => total + row.count, 0);
  const hasLowSample = chartData.some((row) => row.count < LOW_SAMPLE);

  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <p className="chart-meta">
        {sampleSize} measurable decision{sampleSize === 1 ? "" : "s"} · UK working days
        {hasLowSample ? ` · bars from fewer than ${LOW_SAMPLE} decisions are faded` : ""}
      </p>
      <FilterButtonGroup
        options={WINDOW_OPTIONS}
        value={selectedWindow}
        onChange={setSelectedWindow}
      />
      {chartData.length === 0 ? (
        <p className="empty-hint">Not enough decided applications yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 18 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="key" interval={0} tick={{ fontSize: 11 }} />
            <YAxis
              label={{
                value: "Avg days",
                angle: -90,
                position: "insideLeft",
              }}
            />
            <Tooltip
              formatter={(value, name, item) =>
                name === "avgDays"
                  ? [`${value} days (from ${item?.payload?.count ?? "?"} reports)`, "Avg processing"]
                  : [value, name]
              }
            />
            <Bar dataKey="avgDays" fill={CHART_PRIMARY} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              <LabelList
                dataKey="count"
                position="top"
                formatter={(value) => `n=${value}`}
                style={{ fontSize: 11, fill: "#94a0ae" }}
              />
              {chartData.map((row) => (
                <Cell
                  key={row.key}
                  fill={CHART_PRIMARY}
                  fillOpacity={row.count < LOW_SAMPLE ? 0.35 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
