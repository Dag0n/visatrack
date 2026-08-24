import { LOW_SAMPLE } from "../lib/chartTheme";
import { round1 } from "../lib/format";

const MILESTONES = [
  { key: "rfi", label: "RFI", description: "a request for further information" },
  { key: "nsf", label: "NSF email", description: "a 'not straightforward' email" },
];

// Shows how much longer decided cases took when they hit an RFI or NSF
// milestone — measurable in the data but previously never surfaced.
export default function MilestoneImpact({ impact }) {
  if (!impact) return null;
  const rows = MILESTONES.filter(({ key }) => impact[key]?.withCount > 0);
  if (rows.length === 0) return null;

  return (
    <div className="chart-card">
      <h3>Does an RFI or NSF email change the wait?</h3>
      <p className="optional-hint">
        Median working days to decision for cases with and without each milestone.
      </p>
      <ul className="impact-list">
        {rows.map(({ key, label, description }) => {
          const stat = impact[key];
          const delta = round1(stat.withMedian - stat.withoutMedian);
          return (
            <li key={key}>
              <div className="impact-heading">
                <strong>{label}</strong>
                <span className={delta > 0 ? "impact-delta slower" : "impact-delta"}>
                  {delta > 0 ? `+${delta} WD` : `${delta} WD`}
                </span>
              </div>
              <p>
                Cases that received {description} took a median {round1(stat.withMedian)} WD,
                against {round1(stat.withoutMedian)} WD without one, across {stat.withCount}{" "}
                reported case{stat.withCount === 1 ? "" : "s"}.
                {stat.withCount < LOW_SAMPLE ? " Small sample — treat as anecdotal." : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
