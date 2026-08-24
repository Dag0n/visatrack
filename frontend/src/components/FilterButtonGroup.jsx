export default function FilterButtonGroup({ options, value, onChange, className, style, label = "Filter options" }) {
  return (
    <div
      className={className ? `filter-row ${className}` : "filter-row"}
      style={style}
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={value === option.value ? "filter-button active" : "filter-button"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
