import { useEffect, useMemo, useState } from "react";
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

const LINE_COLORS = {
  all: "#2f6fed",
  country: "#e06c75",
};

const LOW_SAMPLE = 10;

function rate(issued, refused) {
  const decided = issued + refused;
  if (!decided) return null;
  return Math.round((issued / decided) * 1000) / 10;
}

function formatRate(value) {
  if (value == null) return "—";
  return `${value === 100 ? "100" : value.toFixed(1)}%`;
}

function formatYear(year) {
  return year === 2026 ? "2026 (Q1)" : String(year);
}

const SORT_COLUMNS = [
  { key: "country", label: "Country" },
  { key: "issued", label: "Issued" },
  { key: "refused", label: "Refused" },
  { key: "decided", label: "Decided" },
  { key: "rate", label: "Approval" },
];

export default function PartnerVisaStats() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("decided");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    const base = pb.baseURL.replace(/\/$/, "");
    fetch(`${base}/api/custom/partner-visa-stats`)
      .then((res) => {
        if (!res.ok) throw new Error("Partner visa stats request failed");
        return res.json();
      })
      .then(setData)
      .catch(() => setError("Couldn't load approval rates right now."));
  }, []);

  const rows = data?.rows ?? [];

  const countries = useMemo(
    () => [...new Set(rows.map((r) => r.country))].sort(),
    [rows],
  );

  const chartData = useMemo(() => {
    const byYear = new Map();
    for (const r of rows) {
      if (!byYear.has(r.year)) {
        byYear.set(r.year, { year: r.year, label: formatYear(r.year), issued: 0, refused: 0 });
      }
      const point = byYear.get(r.year);
      point.issued += r.issued;
      point.refused += r.refused;
    }
    const points = [...byYear.values()].sort((a, b) => a.year - b.year);
    for (const point of points) {
      point.all = rate(point.issued, point.refused);
      point.country = null;
      point.countryIssued = 0;
      point.countryRefused = 0;
    }
    if (selectedCountry) {
      for (const r of rows) {
        if (r.country !== selectedCountry) continue;
        const point = byYear.get(r.year);
        point.country = rate(r.issued, r.refused);
        point.countryIssued = r.issued;
        point.countryRefused = r.refused;
      }
    }
    return points;
  }, [rows, selectedCountry]);

  const tableRows = useMemo(() => {
    const totals = new Map();
    for (const r of rows) {
      if (!totals.has(r.country)) {
        totals.set(r.country, { country: r.country, issued: 0, refused: 0 });
      }
      const t = totals.get(r.country);
      t.issued += r.issued;
      t.refused += r.refused;
    }
    const list = [...totals.values()].map((t) => ({
      ...t,
      decided: t.issued + t.refused,
      rate: rate(t.issued, t.refused),
    }));
    const query = search.trim().toLowerCase();
    const filtered = query
      ? list.filter((t) => t.country.toLowerCase().includes(query))
      : list;
    const dir = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      if (sortKey === "country") return dir * a.country.localeCompare(b.country);
      return dir * ((a[sortKey] ?? -1) - (b[sortKey] ?? -1));
    });
  }, [rows, search, sortKey, sortDir]);

  function toggleSort(key) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "country" ? "asc" : "desc");
    }
  }

  if (error) return <p className="empty-hint">{error}</p>;
  if (!data) return <p className="empty-hint">Loading…</p>;

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow plain">Official statistics</span>
          <h1>Partner visa approval rates</h1>
          <p>
            Home Office decisions on entry clearance partner visa applications
            (applications made outside the UK), by the applicant's nationality.
            Approval rate is issued ÷ (issued + refused); withdrawn and lapsed
            applications are excluded. Rates from small samples are unreliable.
          </p>
        </div>
      </div>

      <div className="filter-row" style={{ marginBottom: 16 }}>
        <select
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
          aria-label="Compare a country"
        >
          <option value="">Compare a country…</option>
          {countries.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        {selectedCountry && (
          <button
            type="button"
            className="filter-button"
            onClick={() => setSelectedCountry("")}
          >
            Clear
          </button>
        )}
      </div>

      <div className="chart-card">
        <h3>Approval rate by year</h3>
        <p className="optional-hint" style={{ marginBottom: 8 }}>
          Share of decided partner visa applications that were issued, 2005–2026.
          2026 covers January–March only.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              label={{ value: "Approval %", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
              width={50}
            />
            <Tooltip
              formatter={(value, name, item) => {
                const point = item?.payload ?? {};
                const issued = name === "country" ? point.countryIssued : point.issued;
                const refused = name === "country" ? point.countryRefused : point.refused;
                const label = name === "country" ? selectedCountry : "All countries";
                return [`${formatRate(value)} (${issued.toLocaleString()} issued, ${refused.toLocaleString()} refused)`, label];
              }}
            />
            <Line
              type="monotone"
              dataKey="all"
              name="all"
              stroke={LINE_COLORS.all}
              strokeWidth={2.5}
              isAnimationActive={false}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
            {selectedCountry && (
              <Line
                type="monotone"
                dataKey="country"
                name="country"
                stroke={LINE_COLORS.country}
                strokeWidth={1.5}
                isAnimationActive={false}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Approval rate by country</h3>
        <p className="optional-hint">
          Totals across all years (2005–2026). Click a row to plot that country
          on the chart above. Countries with fewer than {LOW_SAMPLE} decided
          applications are greyed out — treat those rates as anecdotal.
        </p>
        <input
          type="text"
          className="table-search"
          placeholder="Search country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {tableRows.length === 0 ? (
          <p className="empty-hint">No matching countries.</p>
        ) : (
          <div className="table-scroll">
            <table className="country-table">
              <thead>
                <tr>
                  {SORT_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      style={{ cursor: "pointer", userSelect: "none" }}
                      aria-sort={sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                    >
                      {col.label}
                      {sortKey === col.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr
                    key={row.country}
                    onClick={() => setSelectedCountry(row.country)}
                    style={{
                      cursor: "pointer",
                      opacity: row.decided < LOW_SAMPLE ? 0.45 : 1,
                      background: row.country === selectedCountry ? "rgba(47, 111, 237, 0.08)" : undefined,
                    }}
                  >
                    <td>{row.country}</td>
                    <td>{row.issued.toLocaleString()}</td>
                    <td>{row.refused.toLocaleString()}</td>
                    <td>{row.decided.toLocaleString()}</td>
                    <td>
                      {formatRate(row.rate)}
                      {row.decided < LOW_SAMPLE ? " *" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="optional-hint" style={{ marginTop: 16 }}>
        Source:{" "}
        <a href={data.sourceUrl} target="_blank" rel="noreferrer">
          Home Office, Immigration system statistics data tables
        </a>{" "}
        — entry clearance visa applications and outcomes detailed dataset, year
        ending March 2026 (Family: Partner route). {data.note}.
      </p>
    </div>
  );
}
