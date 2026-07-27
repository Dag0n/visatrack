import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { pb } from "../lib/pb";
import { useAuth } from "../lib/auth.jsx";
import GroupBarChart from "../components/GroupBarChart";
import CountryTable from "../components/CountryTable";
import MonthlyTable from "../components/MonthlyTable";
import { PRIORITY_LABELS, VISA_TYPE_LABELS } from "../lib/labels";

export default function Dashboard() {
  const { isLoggedIn } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [countryPriority, setCountryPriority] = useState("none");

  useEffect(() => {
    const base = pb.baseURL.replace(/\/$/, "");
    fetch(`${base}/api/custom/stats?countryPriority=${countryPriority}`)
      .then((res) => {
        if (!res.ok) throw new Error("Stats request failed");
        return res.json();
      })
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
  const recentMonth = stats.byMonth?.none?.at(-1) ?? stats.byMonth?.all?.at(-1);

  return (
    <div className="dashboard-page">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="live-dot" />
            Community-powered UK partner visa data
          </span>
          <h1>Less guessing.<br />More clarity while you wait.</h1>
          <p>
            Explore real application timelines, compare people on a similar route,
            and understand where your wait sits in the community.
          </p>
          <div className="hero-actions">
            <Link className="button primary-button" to={isLoggedIn ? "/my-application" : "/login"}>
              {isLoggedIn ? "View my timeline" : "Add your timeline"}
            </Link>
            <Link className="button secondary-button" to="/applications">
              Explore applications
            </Link>
          </div>
          <span className="hero-footnote">Unofficial, anonymous and free to use.</span>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="route-card route-card-main">
            <span className="route-label">A typical journey</span>
            <div className="route-line">
              <span className="route-stop complete">✓</span>
              <span className="route-segment complete" />
              <span className="route-stop complete">✓</span>
              <span className="route-segment active" />
              <span className="route-stop active" />
              <span className="route-segment" />
              <span className="route-stop" />
            </div>
            <div className="route-names">
              <span>Applied</span>
              <span>Biometrics</span>
              <span>With UKVI</span>
              <span>Decision</span>
            </div>
          </div>
          <div className="floating-stat">
            <span className="floating-icon">⌁</span>
            <div>
              <strong>{recentMonth ? `${Math.round(recentMonth.medianDays)} days` : "Live data"}</strong>
              <span>{recentMonth ? "Recent median" : "Updated by applicants"}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="section-heading">
        <div>
          <span className="eyebrow plain">At a glance</span>
          <h2>The community right now</h2>
        </div>
        <span className="data-note">Based on self-reported timelines</span>
      </div>

      <div className="summary-row">
        <div className="summary-card">
          <span className="summary-icon blue">↗</span>
          <div>
            <span className="summary-value">{stats.total}</span>
            <span className="summary-label">Timelines shared</span>
          </div>
        </div>
        <div className="summary-card">
          <span className="summary-icon amber">◷</span>
          <div>
            <span className="summary-value">{pending}</span>
            <span className="summary-label">Currently waiting</span>
          </div>
        </div>
        <div className="summary-card">
          <span className="summary-icon green">✓</span>
          <div>
            <span className="summary-value">
              {approvalRate === null ? "—" : `${approvalRate}%`}
            </span>
            <span className="summary-label">Reported approvals</span>
            <span className="summary-meta">{decided} decisions shared</span>
          </div>
        </div>
      </div>

      <div className="section-heading compact">
        <div>
          <span className="eyebrow plain">Compare routes</span>
          <h2>See what shapes the wait</h2>
        </div>
      </div>
      <div className="chart-grid">
        <GroupBarChart
          title="By visa type"
          data={stats.byVisaType ?? []}
          labels={VISA_TYPE_LABELS}
        />
        <GroupBarChart
          title="By service level"
          data={stats.byPriority ?? []}
          labels={PRIORITY_LABELS}
        />
      </div>
      <CountryTable
        data={stats.byCountry ?? []}
        priorityFilter={countryPriority}
        onPriorityFilterChange={setCountryPriority}
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
