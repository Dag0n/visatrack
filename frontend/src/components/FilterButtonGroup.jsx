export default function FilterButtonGroup({ options, value, onChange, className, style }) {
  return (
    <div className={className ? `filter-row ${className}` : "filter-row"} style={style}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? "filter-button active" : "filter-button"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
