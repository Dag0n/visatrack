import { OUTCOME_LABELS } from "../lib/labels";

export default function StatusBadge({ outcome }) {
  return (
    <span className={`status-badge status-${outcome}`}>
      {OUTCOME_LABELS[outcome] ?? outcome}
    </span>
  );
}
