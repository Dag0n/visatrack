export const VISA_TYPE_LABELS = {
  spouse: "Spouse",
  fiance: "Fiancé(e)",
  unmarried_partner: "Unmarried partner",
  extension: "Extension",
  other: "Other",
};

export const PRIORITY_LABELS = {
  none: "Standard",
  priority: "Priority",
  super_priority: "Super priority",
};

// Shared option list for the Standard / Priority / Super priority / All
// filter used on the Dashboard tables and country pages.
export const PRIORITY_FILTER_OPTIONS = [
  ...Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label })),
  { value: "all", label: "All combined" },
];

export const OUTCOME_LABELS = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};
