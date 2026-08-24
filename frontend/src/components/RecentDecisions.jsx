import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { pb } from "../lib/pb";
import { VISA_TYPE_LABELS } from "../lib/labels";
import { formatDate } from "../lib/format";
import { processingStartDate, workingDaysBetween } from "../lib/processingDays";
import StatusBadge from "./StatusBadge";

// The freshest reported outcomes, so the dashboard shows movement — not just
// long-run averages.
export default function RecentDecisions() {
  const [items, setItems] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    pb.collection("applications")
      .getList(1, 8, {
        filter: 'outcome != "pending"',
        sort: "-decision_date",
        expand: "country_id",
        requestKey: null,
      })
      .then((result) => setItems(result.items))
      .catch((err) => {
        if (!err?.isAbort) setFailed(true);
      });
  }, []);

  return (
    <div className="chart-card">
      <h3>Latest reported decisions</h3>
      <p className="optional-hint">Fresh outcomes from the community, newest first.</p>
      {failed && <p className="empty-hint">Couldn't load recent decisions right now.</p>}
      {!failed && !items && <p className="empty-hint" role="status">Loading…</p>}
      {!failed && items?.length === 0 && <p className="empty-hint">No decisions reported yet.</p>}
      {!failed && items?.length > 0 && (
        <>
          <ul className="recent-decisions">
            {items.map((item) => {
              const start = processingStartDate(item);
              const days =
                start && item.decision_date ? workingDaysBetween(start, item.decision_date) : null;
              const name = item.expand?.country_id?.name;
              return (
                <li key={item.id}>
                  <span className="recent-route">
                    {name ? (
                      <Link to={`/country/${encodeURIComponent(name)}`}>{name}</Link>
                    ) : (
                      "—"
                    )}
                    <small>{VISA_TYPE_LABELS[item.visa_type] ?? item.visa_type}</small>
                  </span>
                  <span className="recent-days">{days != null ? `${days} WD` : "—"}</span>
                  <span className="recent-date">{formatDate(item.decision_date)}</span>
                  <StatusBadge outcome={item.outcome} />
                </li>
              );
            })}
          </ul>
          <p className="optional-hint" style={{ marginBottom: 0 }}>
            <Link to="/applications?status=all&sort=-decision_date">
              See all decided timelines →
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
