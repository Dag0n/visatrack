package main

import (
	"net/url"
	"testing"
	"time"
)

func mustDate(t *testing.T, value string) time.Time {
	t.Helper()
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		t.Fatal(err)
	}
	return parsed
}

func TestProcessingDaysCountsDayOne(t *testing.T) {
	tests := []struct {
		name     string
		bio      string
		decision string
		want     float64
	}{
		{name: "next weekday is day one", bio: "2026-07-27", decision: "2026-07-28", want: 1},
		{name: "weekend is skipped", bio: "2026-07-31", decision: "2026-08-03", want: 1},
		{name: "bank holiday is skipped", bio: "2026-08-28", decision: "2026-09-01", want: 1},
		{name: "full working week", bio: "2026-07-24", decision: "2026-07-31", want: 5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := processingDays(rawApplication{
				BiometricsDate: tt.bio,
				DecisionDate:   tt.decision,
			})
			if !ok {
				t.Fatal("processingDays returned ok=false")
			}
			if got != tt.want {
				t.Fatalf("processingDays() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestWorkingDaysBetweenReturnsZeroBeforeStart(t *testing.T) {
	from := mustDate(t, "2026-07-28")
	to := mustDate(t, "2026-07-27")
	if got := workingDaysBetween(from, to); got != 0 {
		t.Fatalf("workingDaysBetween() = %v, want 0", got)
	}
}

func TestPercentileInterpolates(t *testing.T) {
	values := []float64{10, 20, 30, 40}
	if got := percentile(values, 0.25); got != 17.5 {
		t.Fatalf("25th percentile = %v, want 17.5", got)
	}
	if got := percentile(values, 0.5); got != 25 {
		t.Fatalf("median = %v, want 25", got)
	}
	if got := percentile(values, 0.75); got != 32.5 {
		t.Fatalf("75th percentile = %v, want 32.5", got)
	}
}

func TestParseExplorerFilters(t *testing.T) {
	filters, err := parseExplorerFilters(url.Values{
		"status":    {"all"},
		"visa":      {"spouse"},
		"service":   {"priority"},
		"milestone": {"eco"},
		"country":   {"  France  "},
		"bioFrom":   {"2026-01-02"},
		"bioTo":     {"2026-03-04"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if filters.Status != "all" || filters.Visa != "spouse" || filters.Service != "priority" ||
		filters.Milestone != "eco" || filters.Country != "France" ||
		filters.BioFrom != "2026-01-02" || filters.BioTo != "2026-03-04" {
		t.Fatalf("parseExplorerFilters() = %#v", filters)
	}

	defaults, err := parseExplorerFilters(url.Values{})
	if err != nil {
		t.Fatal(err)
	}
	if defaults.Status != "pending" || defaults.Visa != "all" ||
		defaults.Service != "all" || defaults.Milestone != "all" {
		t.Fatalf("default filters = %#v", defaults)
	}
}

func TestParseExplorerFiltersRejectsInvalidValues(t *testing.T) {
	tests := []url.Values{
		{"status": {"waiting"}},
		{"visa": {"student"}},
		{"service": {"fast"}},
		{"milestone": {"decision"}},
		{"bioFrom": {"2026-02-30"}},
		{"bioTo": {"not-a-date"}},
		{"bioFrom": {"2026-03-02"}, "bioTo": {"2026-03-01"}},
	}

	for _, values := range tests {
		if _, err := parseExplorerFilters(values); err == nil {
			t.Fatalf("parseExplorerFilters(%v) returned no error", values)
		}
	}
}

func TestSummariseExplorerRowsSeparatesPendingAndCompleted(t *testing.T) {
	now := mustDate(t, "2026-07-31")
	rows := []rawExplorerApp{
		{Outcome: "pending", BiometricsDate: "2026-07-27"},
		{Outcome: "pending"},
		{Outcome: "approved", BiometricsDate: "2026-07-24", DecisionDate: "2026-07-31"},
		{Outcome: "rejected", BiometricsDate: "2026-07-27", DecisionDate: "2026-07-29"},
		{Outcome: "approved", DecisionDate: "2026-07-31"},
	}

	summary := summariseExplorerRows(rows, now)
	if summary.Total != 5 {
		t.Fatalf("total = %d, want 5", summary.Total)
	}
	if summary.Pending.Measured != 1 || summary.Pending.Average != 4 || summary.Pending.Median != 4 {
		t.Fatalf("pending summary = %#v", summary.Pending)
	}
	if summary.Completed.Measured != 2 || summary.Completed.Average != 3.5 || summary.Completed.Median != 3.5 {
		t.Fatalf("completed summary = %#v", summary.Completed)
	}
}
