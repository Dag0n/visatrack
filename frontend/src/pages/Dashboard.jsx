import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { fetchCustom, isAbortError } from "../lib/api";
import GroupBarChart from "../components/GroupBarChart";
import CountryTable from "../components/CountryTable";
import MonthlyTable from "../components/MonthlyTable";
import StatCards from "../components/StatCards";
import { PRIORITY_LABELS, VISA_TYPE_LABELS } from "../lib/labels";
import { formatApprovalRate } from "../lib/format";

export default function Dashboard() {
  const { isLoggedIn } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [countryPriority, setCountryPriority] = useState("none");

  useEffect(() => {
    const controller = new AbortController();
    fetchCustom(`/stats?countryPriority=${countryPriority}`, { signal: controller.signal })
      .then(setStats)
      .catch((err) => {
        if (!isAbortError(err)) setError("Couldn't load stats right now.");
      });
    return () => controller.abort();
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
  return (
    <div className="dashboard-page">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="live-dot" />
            Built with the r/SpouseVisaUk community
          </span>
          <h1>Real visa timelines, shared by applicants.</h1>
          <p>
            See how long UK spouse and partner visa applications are taking,
            compare similar routes, and share your own milestones as they happen.
          </p>
          <div className="hero-actions">
            <Link className="button primary-button" to="/applications">
              Browse timelines
            </Link>
            <Link className="button secondary-button" to={isLoggedIn ? "/my-application" : "/login"}>
              {isLoggedIn ? "View my timeline" : "Share my timeline"}
            </Link>
          </div>
          <span className="hero-footnote">
            Independent and unofficial · Community-reported data · Not immigration advice
          </span>
        </div>
      </section>

      <div className="section-heading">
        <div>
          <span className="eyebrow plain">At a glance</span>
          <h2>The community right now</h2>
        </div>
        <span className="data-note">Based on self-reported timelines</span>
      </div>

      <StatCards
        items={[
          { icon: "↗", iconClass: "blue", value: stats.total, label: "Timelines shared" },
          { icon: "◷", iconClass: "amber", value: pending, label: "Currently waiting" },
          {
            icon: "✓",
            iconClass: "green",
            value: formatApprovalRate(approved, approved + rejected),
            label: "Self-reported approval share",
            meta: `${approved} approved · ${rejected} rejected`,
          },
        ]}
      />

      <div className="section-heading compact">
        <div>
          <span className="eyebrow plain">Compare routes</span>
          <h2>See what shapes the wait</h2>
        </div>
      </div>
      <div className="chart-grid">
        <GroupBarChart
          title="By visa type"
          data={stats.byVisaType ?? {}}
          labels={VISA_TYPE_LABELS}
        />
        <GroupBarChart
          title="By service level"
          data={stats.byPriority ?? {}}
          labels={PRIORITY_LABELS}
        />
      </div>
      <CountryTable
        data={stats.byCountry ?? []}
        priorityFilter={countryPriority}
        onPriorityFilterChange={setCountryPriority}
        limit={10}
      />
      <MonthlyTable data={stats.byMonth ?? {}} />

      <section className="contribution-banner">
        <div className="contribution-mark">＋</div>
        <div>
          <span className="eyebrow inverse">Make the picture clearer</span>
          <h2>Your timeline can help the next applicant</h2>
          <p>It takes a couple of minutes and you can update milestones as they happen.</p>
        </div>
        <Link className="button light-button" to={isLoggedIn ? "/my-application" : "/login"}>
          Share my timeline
        </Link>
      </section>
    </div>
  );
}
