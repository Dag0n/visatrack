// Central chart palette — every recharts color comes from here so series
// keep the same identity across pages.
export const CHART_PRIMARY = "#2f6fed";
export const CHART_COMPARE = "#e06c75";

// Below this many decided applications, treat an aggregate as anecdotal:
// tables and bars render it faded.
export const LOW_SAMPLE = 10;

export const SERIES_COLORS = {
  all: CHART_PRIMARY,
  spouse: "#e06c75",
  fiance: "#e5c07b",
  unmarried_partner: "#98c379",
  extension: "#c678dd",
  other: "#56b6c2",
};
