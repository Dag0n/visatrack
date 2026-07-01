import { useEffect, useState } from "react";
import { pb } from "../lib/pb";
import GroupBarChart from "../components/GroupBarChart";
import CountryTable from "../components/CountryTable";
import MonthlyTable from "../components/MonthlyTable";
import { PRIORITY_LABELS, VISA_TYPE_LABELS } from "../lib/labels";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [countryPriority, setCountryPriority] = useState("none");

  useEffect(() => {
    const base = pb.baseURL.replace(/\/$/, "");
    fetch(`${base}/api/custom/stats?countryPriority=${countryPriority}`)
      .then((res) => res.json())
      .then(setStats)
      .catch(() => setError("Couldn't load stats right now."));
  }, [countryPriority]);

  if (error) {
    return <p className="empty-hint">{error}</p>;
  }

  if (!stats) {
    return <p className="empty-hint">Loading stats…</p>;
  }

  const outcomes = stats.outcomes ?? {};
  const approved = outcomes.approved ?? 0;
  const rejected = outcomes.rejected ?? 0;
  const pending = outcomes.pending ?? 0;
  const decided = approved + rejected;
  const approvalRate = decided > 0 ? Math.round((approved / decided) * 100) : null;

  return (
    <div>
      <div className="summary-row">
        <div className="summary-card">
          <span className="summary-value">{stats.total}</span>
          <span className="summary-label">Total submissions</span>
        </div>
        <div className="summary-card">
          <span className="summary-value">{pending}</span>
          <span className="summary-label">Currently waiting</span>
        </div>
        <div className="summary-card">
          <span className="summary-value">
            {approvalRate === null ? "—" : `${approvalRate}%`}
          </span>
          <span className="summary-label">Approval rate ({decided} decided)</span>
        </div>
      </div>

      <GroupBarChart
        title="Avg. processing days by visa type"
        data={stats.byVisaType ?? []}
        labels={VISA_TYPE_LABELS}
      />
      <GroupBarChart
        title="Avg. processing days by priority service"
        data={stats.byPriority ?? []}
        labels={PRIORITY_LABELS}
      />
      <CountryTable
        data={stats.byCountry ?? []}
        priorityFilter={countryPriority}
        onPriorityFilterChange={setCountryPriority}
      />
      <MonthlyTable data={stats.byMonth ?? []} />
    </div>
  );
}
