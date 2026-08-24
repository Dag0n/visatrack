import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Shared line-chart shell: one place for the grid/axis/tooltip styling used
// by every time-series chart. `lines` is [{ key, color, strokeWidth?, name? }].
export default function StatLineChart({
  data,
  lines,
  xKey = "label",
  yLabel,
  yDomain,
  allowDecimals = true,
  tooltipFormatter,
  height = 280,
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} interval="preserveStartEnd" />
        <YAxis
          domain={yDomain}
          allowDecimals={allowDecimals}
          tick={{ fontSize: 12 }}
          label={{ value: yLabel, angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
          width={50}
        />
        <Tooltip formatter={tooltipFormatter} />
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name ?? line.key}
            stroke={line.color}
            strokeWidth={line.strokeWidth ?? 1.5}
            isAnimationActive={false}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
