import { useEffect, useMemo, useState } from "react";
import { fetchCustom, isAbortError } from "../lib/api";
import { CHART_COMPARE, CHART_PRIMARY, LOW_SAMPLE } from "../lib/chartTheme";
import { formatRateValue } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";
import FilterButtonGroup from "../components/FilterButtonGroup";
import StatLineChart from "../components/StatLineChart";

// Synthetic aggregate of nationalities the Home Office records outside the
// country list (other/unknown, stateless, refugee, historical states). It is
// included in the year totals but not listed as a country.
const OTHER_BUCKET = "Other / unknown";

function rate(issued, refused) {
  const decided = issued + refused;
  if (!decided) return null;
  return Math.round((issued / decided) * 1000) / 10;
}

const SORT_COLUMNS = [
  { key: "country", label: "Country" },
  { key: "issued", label: "Issued" },
  { key: "refused", label: "Refused" },
  { key: "decided", label: "Decided" },
  { key: "withdrawnLapsed", label: "Withdrawn / lapsed" },
  { key: "rate", label: "Approval" },
];

const CHART_MODES = [
  { value: "rate", label: "Approval rate" },
  { value: "volume", label: "Volumes" },
];

export default function PartnerVisaStats() {
  usePageTitle("Approval rates");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("decided");
  const [sortDir, setSortDir] = useState("desc");
  const [chartMode, setChartMode] = useState("rate");
  const [showAllRows, setShowAllRows] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchCustom("/partner-visa-stats", { signal: controller.signal })
      .then(setData)
      .catch((err) => {
        if (!isAbortError(err)) setError("Couldn't load approval rates right now.");
      });
    return () => controller.abort();
  }, [retryKey]);

  const rows = useMemo(() => data?.rows ?? [], [data]);

  // The dataset is a "year ending March" release, so the newest calendar year
  // in it only covers January–March.
  const { minYear, maxYear } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const r of rows) {
      if (r.year < min) min = r.year;
      if (r.year > max) max = r.year;
    }
    return { minYear: Number.isFinite(min) ? min : null, maxYear: Number.isFinite(max) ? max : null };
  }, [rows]);

  const countries = useMemo(
    () => [...new Set(rows.map((r) => r.country))].filter((c) => c !== OTHER_BUCKET).sort(),
    [rows],
  );

  const chartData = useMemo(() => {
    const byYear = new Map();
    for (const r of rows) {
      if (!byYear.has(r.year)) {
        byYear.set(r.year, {
          year: r.year,
          label: r.year === maxYear ? `${r.year} (Q1)` : String(r.year),
          issued: 0,
          refused: 0,
          withdrawnLapsed: 0,
        });
      }
      const point = byYear.get(r.year);
      point.issued += r.issued;
      point.refused += r.refused;
      point.withdrawnLapsed += (r.withdrawn ?? 0) + (r.lapsed ?? 0);
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
  }, [rows, selectedCountry, maxYear]);

  const tableRows = useMemo(() => {
    const totals = new Map();
    for (const r of rows) {
      if (r.country === OTHER_BUCKET) continue;
      if (!totals.has(r.country)) {
        totals.set(r.country, { country: r.country, issued: 0, refused: 0, withdrawnLapsed: 0 });
      }
      const t = totals.get(r.country);
      t.issued += r.issued;
      t.refused += r.refused;
      t.withdrawnLapsed += (r.withdrawn ?? 0) + (r.lapsed ?? 0);
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
      if (sortKey !== "country") {
        const diff = (a[sortKey] ?? -1) - (b[sortKey] ?? -1);
        if (diff !== 0) return dir * diff;
      }
      // Country name as the (stable) tiebreaker for every sort key.
      return (sortKey === "country" ? dir : 1) * a.country.localeCompare(b.country);
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

  if (error) {
    return (
      <div className="inline-error" role="alert">
        <span>{error}</span>
        <button
          type="button"
          className="small-button"
          onClick={() => {
            setData(null);
            setError("");
            setRetryKey((key) => key + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }
  if (!data) return <p className="empty-hint" role="status">Loading approval rates…</p>;

  const yearRange = minYear === null ? "" : `${minYear}–${maxYear}`;

  const volumeLines = selectedCountry
    ? [
        { key: "countryIssued", name: "issued", color: CHART_PRIMARY, strokeWidth: 2 },
        { key: "countryRefused", name: "refused", color: CHART_COMPARE, strokeWidth: 2 },
      ]
    : [
        { key: "issued", name: "issued", color: CHART_PRIMARY, strokeWidth: 2 },
        { key: "refused", name: "refused", color: CHART_COMPARE, strokeWidth: 2 },
      ];

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
        <h3>{chartMode === "rate" ? "Approval rate by year" : "Application volumes by year"}</h3>
        <p className="optional-hint" style={{ marginBottom: 8 }}>
          {chartMode === "rate"
            ? `Share of decided partner visa applications that were issued, ${yearRange}.`
            : selectedCountry
              ? `Issued and refused partner visa applications from ${selectedCountry} per year, ${yearRange}.`
              : `Issued and refused partner visa applications per year, ${yearRange}.`}
          {maxYear ? ` ${maxYear} covers January–March only.` : ""}
        </p>
        <FilterButtonGroup
          options={CHART_MODES}
          value={chartMode}
          onChange={setChartMode}
          label="Chart measure"
        />
        {chartMode === "rate" ? (
          <StatLineChart
            data={chartData}
            height={300}
            yLabel="Approval %"
            yDomain={[0, 100]}
            summary={`Official partner visa approval rates by year${selectedCountry ? `, comparing all countries with ${selectedCountry}` : ""}`}
            tooltipFormatter={(value, name, item) => {
              const point = item?.payload ?? {};
              const issued = name === "country" ? point.countryIssued : point.issued;
              const refused = name === "country" ? point.countryRefused : point.refused;
              const label = name === "country" ? selectedCountry : "All countries";
              return [
                `${formatRateValue(value)} (${issued.toLocaleString()} issued, ${refused.toLocaleString()} refused)`,
                label,
              ];
            }}
            lines={[
              { key: "all", color: CHART_PRIMARY, strokeWidth: 2.5 },
              ...(selectedCountry
                ? [{ key: "country", color: CHART_COMPARE, strokeWidth: 1.5 }]
                : []),
            ]}
          />
        ) : (
          <StatLineChart
            data={chartData}
            height={300}
            yLabel="Applications"
            allowDecimals={false}
            summary={`Official partner visa issued and refused volumes by year${selectedCountry ? ` for ${selectedCountry}` : " across all countries"}`}
            tooltipFormatter={(value, name) => [
              value.toLocaleString(),
              name === "issued" ? "Issued" : "Refused",
            ]}
            lines={volumeLines}
          />
        )}
      </div>

      <div className="chart-card">
        <h3>Approval rate by country</h3>
        <p className="optional-hint">
          Totals across all years{yearRange ? ` (${yearRange})` : ""}. Click a row
          to plot that country on the chart above. Countries with fewer than{" "}
          {LOW_SAMPLE} decided applications are greyed out — treat those rates as
          anecdotal. Nationalities the Home Office records as other, unknown,
          stateless or refugee are included in the overall totals but not listed
          here.
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
          <>
          <div className="table-scroll">
            <table className="country-table">
              <thead>
                <tr>
                  {SORT_COLUMNS.map((col) => (
                    <th key={col.key} aria-sort={sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                      <button
                        type="button"
                        className="table-sort-button"
                        onClick={() => toggleSort(col.key)}
                      >
                        {col.label}
                        {sortKey === col.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(showAllRows || search.trim() ? tableRows : tableRows.slice(0, 30)).map((row) => (
                  <tr
                    key={row.country}
                    style={{
                      opacity: row.decided < LOW_SAMPLE ? 0.45 : 1,
                      background: row.country === selectedCountry ? "rgba(47, 111, 237, 0.08)" : undefined,
                    }}
                  >
                    <td>
                      <button
                        type="button"
                        className="table-row-link"
                        onClick={() => setSelectedCountry(row.country)}
                        aria-label={`Compare ${row.country} on the chart`}
                        aria-pressed={row.country === selectedCountry}
                      >
                        {row.country}
                      </button>
                    </td>
                    <td>{row.issued.toLocaleString()}</td>
                    <td>{row.refused.toLocaleString()}</td>
                    <td>{row.decided.toLocaleString()}</td>
                    <td>{row.withdrawnLapsed.toLocaleString()}</td>
                    <td>
                      {formatRateValue(row.rate)}
                      {row.decided < LOW_SAMPLE ? " *" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!search.trim() && tableRows.length > 30 && (
            <button
              type="button"
              className="filter-button"
              style={{ marginTop: 10 }}
              onClick={() => setShowAllRows((prev) => !prev)}
            >
              {showAllRows ? "Show top 30" : `Show all ${tableRows.length} countries`}
            </button>
          )}
          </>
        )}
      </div>

      <p className="optional-hint" style={{ marginTop: 16 }}>
        Source:{" "}
        <a href={data.sourceUrl} target="_blank" rel="noreferrer">
          {data.source}
        </a>
        . {data.note}.
      </p>
    </div>
  );
}
