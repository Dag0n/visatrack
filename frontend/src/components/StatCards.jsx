// "Big number + label" tile row used by the Dashboard hero stats and the
// Applications result summary. `variant` picks the existing visual style;
// items are { value, label, icon?, iconClass?, meta? }.
export default function StatCards({ items, footnote, variant = "summary" }) {
  if (variant === "result") {
    return (
      <div className="result-summary">
        {items.map((item) => (
          <div key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
        {footnote && <p>{footnote}</p>}
      </div>
    );
  }

  return (
    <div className="summary-row">
      {items.map((item) => (
        <div className="summary-card" key={item.label}>
          {item.icon && <span className={`summary-icon ${item.iconClass ?? ""}`}>{item.icon}</span>}
          <div>
            <span className="summary-value">{item.value}</span>
            <span className="summary-label">{item.label}</span>
            {item.meta && <span className="summary-meta">{item.meta}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
