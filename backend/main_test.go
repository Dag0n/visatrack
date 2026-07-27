package main

import (
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
