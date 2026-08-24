import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCustom, isAbortError } from "../lib/api";
import { PRIORITY_FILTER_OPTIONS, VISA_TYPE_LABELS } from "../lib/labels";
import { CHART_PRIMARY, LOW_SAMPLE, SERIES_COLORS } from "../lib/chartTheme";
import { formatApprovalRate, formatMonth, formatRateValue, round1 } from "../lib/format";
import FilterButtonGroup from "../components/FilterButtonGroup";
import StatCards from "../components/StatCards";
import StatLineChart from "../components/StatLineChart";

const VISA_TYPES = Object.keys(VISA_TYPE_LABELS);

function getLast12Months() {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
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
      const measured = r.measured_count ?? r.count;
      daySums.all += r.avg_days * measured;
      dayCounts.all += measured;
      if (VISA_TYPES.includes(r.visa_type)) {
        countPoint[r.visa_type] += r.count;
        daySums[r.visa_type] += r.avg_days * measured;
        dayCounts[r.visa_type] += measured;
      }
    }

    daysPoint.all = dayCounts.all > 0 ? round1(daySums.all / dayCounts.all) : null;
    for (const vt of VISA_TYPES) {
      daysPoint[vt] = dayCounts[vt] > 0 ? round1(daySums[vt] / dayCounts[vt]) : null;
    }

    return { countPoint, daysPoint };
  });
}

function Chart({ data, hiddenLines, lines, lineLabel, yLabel, allowDecimals = true }) {
  const isEmpty = data.every((d) => lines.every((k) => d[k] == null || d[k] === 0));
  if (isEmpty) return <p className="empty-hint">Not enough data for this selection.</p>;

  return (
    <StatLineChart
      data={data}
      yLabel={yLabel}
      allowDecimals={allowDecimals}
      tooltipFormatter={(value, name) => [value, lineLabel(name)]}
      lines={lines
        .filter((key) => !hiddenLines.has(key))
        .map((key) => ({
          key,
          color: SERIES_COLORS[key],
          strokeWidth: key === "all" ? 2.5 : 1.5,
        }))}
    />
  );
}

export default function CountryStats() {
  const { country } = useParams();
  const countryName = decodeURIComponent(country);

  const [rows, setRows] = useState(null);
  const [summary, setSummary] = useState(null);
  const [officialRows, setOfficialRows] = useState(null);
  const [error, setError] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [hiddenLines, setHiddenLines] = useState(new Set());

  useEffect(() => {
    const controller = new AbortController();
    fetchCustom(`/country-stats?country=${encodeURIComponent(countryName)}`, {
      signal: controller.signal,
    })
      .then((data) => {
        setRows(data.rows ?? []);
        setSummary(data.summary ?? null);
      })
      .catch((err) => {
        if (!isAbortError(err)) setError("Couldn't load country stats right now.");
      });
    return () => controller.abort();
  }, [countryName]);

  // Official Home Office figures for this nationality (best effort — the
  // community charts render regardless).
  useEffect(() => {
    const controller = new AbortController();
    fetchCustom("/partner-visa-stats", { signal: controller.signal })
      .then((data) => setOfficialRows(data.rows ?? []))
      .catch((err) => {
        if (!isAbortError(err)) setOfficialRows([]);
      });
    return () => controller.abort();
  }, []);

  const official = useMemo(() => {
    if (!officialRows?.length) return null;
    const mine = officialRows.filter((r) => r.country === countryName);
    if (!mine.length) return null;
    const maxYear = Math.max(...officialRows.map((r) => r.year));
    let issued = 0;
    let refused = 0;
    const points = [...mine]
      .sort((a, b) => a.year - b.year)
      .map((r) => {
        issued += r.issued;
        refused += r.refused;
        const decided = r.issued + r.refused;
        return {
          label: r.year === maxYear ? `${r.year} (Q1)` : String(r.year),
          rate: decided ? Math.round((r.issued / decided) * 1000) / 10 : null,
          issued: r.issued,
          refused: r.refused,
        };
      });
    return { points, issued, refused, decided: issued + refused };
  }, [officialRows, countryName]);

  // Fixed 12-month window from the client clock, extended with any month the
  // server returned outside it (the server applies its own cutoff, so the two
  // can disagree near a month boundary).
  const months = useMemo(() => {
    const set = new Set(getLast12Months());
    for (const r of rows ?? []) set.add(r.month);
    return [...set].sort();
  }, [rows]);
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

  const active = summary?.[priorityFilter] ?? null;
  const priorityLabel =
    PRIORITY_FILTER_OPTIONS.find((option) => option.value === priorityFilter)?.label ?? "";

  return (
    <div>
      <Link to="/countries" className="back-link">← Countries</Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow plain">Country detail</span>
          <h1>{countryName}</h1>
          <p>
            Community-reported timelines from {countryName}, alongside the
            official Home Office approval figures for this nationality.
          </p>
        </div>
      </div>

      {error && <p className="empty-hint">{error}</p>}
      {!error && !rows && <p className="empty-hint">Loading…</p>}

      {!error && rows && (
        <>
          <FilterButtonGroup
            options={PRIORITY_FILTER_OPTIONS}
            value={priorityFilter}
            onChange={setPriorityFilter}
            style={{ marginBottom: 8 }}
          />

          {active && active.total > 0 && (
            <>
              <StatCards
                items={[
                  {
                    icon: "↗",
                    iconClass: "blue",
                    value: active.total,
                    label: `Timelines shared (${priorityLabel.toLowerCase()})`,
                    meta: `${active.decided} decided · all time`,
                  },
                  {
                    icon: "◷",
                    iconClass: "amber",
                    value: active.pending,
                    label: "Currently waiting",
                  },
                  {
                    icon: "⧗",
                    iconClass: "blue",
                    value: active.measured > 0 ? `${round1(active.medianDays)} WD` : "—",
                    label: "Median wait",
                    meta:
                      active.measured > 0
                        ? `Middle half ${round1(active.lowerQuartile)}–${round1(active.upperQuartile)} WD · ${active.measured} measured`
                        : "Not enough dated timelines yet",
                  },
                  {
                    icon: "✓",
                    iconClass: "green",
                    value: formatApprovalRate(active.approved, active.decided),
                    label: "Self-reported approval share",
                    meta: `${active.approved} approved · ${active.decided - active.approved} rejected`,
                  },
                ]}
              />
              {active.decided > 0 && active.decided < LOW_SAMPLE && (
                <p className="optional-hint" style={{ marginTop: -12 }}>
                  Based on only {active.decided} decided timeline{active.decided === 1 ? "" : "s"} —
                  treat these figures as anecdotal.
                </p>
              )}
            </>
          )}

          <div className="filter-row" style={{ flexWrap: "wrap", marginBottom: 16 }}>
            {lines.map((key) => (
              <button
                key={key}
                type="button"
                className={hiddenLines.has(key) ? "filter-button" : "filter-button active"}
                style={{
                  borderColor: SERIES_COLORS[key],
                  color: hiddenLines.has(key) ? undefined : SERIES_COLORS[key],
                  background: hiddenLines.has(key) ? undefined : `${SERIES_COLORS[key]}18`,
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

          {official && (
            <div className="chart-card">
              <h3>Official approval rate for {countryName}</h3>
              <p className="optional-hint" style={{ marginBottom: 8 }}>
                Home Office entry clearance partner visa decisions by nationality:{" "}
                {formatRateValue(
                  official.decided ? Math.round((official.issued / official.decided) * 1000) / 10 : null,
                )}{" "}
                approved overall ({official.issued.toLocaleString()} issued,{" "}
                {official.refused.toLocaleString()} refused since {official.points[0]?.label}).{" "}
                <Link to="/approval-rates">Compare all countries →</Link>
              </p>
              <StatLineChart
                data={official.points}
                height={240}
                yLabel="Approval %"
                yDomain={[0, 100]}
                tooltipFormatter={(value, name, item) => {
                  const point = item?.payload ?? {};
                  return [
                    `${formatRateValue(value)} (${point.issued.toLocaleString()} issued, ${point.refused.toLocaleString()} refused)`,
                    countryName,
                  ];
                }}
                lines={[{ key: "rate", color: CHART_PRIMARY, strokeWidth: 2.5 }]}
              />
            </div>
          )}

          {active && active.total > 0 && (
            <p className="optional-hint" style={{ marginTop: 16 }}>
              <Link
                to={`/applications?${new URLSearchParams({
                  country: countryName,
                  status: "all",
                  ...(priorityFilter !== "all" ? { service: priorityFilter } : {}),
                })}`}
              >
                Browse all {active.total}{" "}
                {priorityFilter === "all" ? "" : `${priorityLabel.toLowerCase()} `}
                timelines from {countryName} →
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
