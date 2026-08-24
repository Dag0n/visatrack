package main

import (
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/go-ozzo/ozzo-validation/v4"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
	"github.com/pocketbase/pocketbase/tools/types"

	_ "ukvi/backend/migrations"
)

type groupStat struct {
	Key     string  `json:"key"`
	Count   int     `json:"count"`
	AvgDays float64 `json:"avgDays"`
}

type countryStat struct {
	Key      string  `json:"key"`
	Count    int     `json:"count"`
	AvgDays  float64 `json:"avgDays"`
	Approved int     `json:"approved"`
}

type monthStat struct {
	Month         string  `json:"month"`
	Count         int     `json:"count"`
	AvgDays       float64 `json:"avgDays"`
	MedianDays    float64 `json:"medianDays"`
	LowerQuartile float64 `json:"lowerQuartile"`
	UpperQuartile float64 `json:"upperQuartile"`
}

type statsResponse struct {
	Total      int                    `json:"total"`
	Outcomes   map[string]int         `json:"outcomes"`
	ByVisaType map[string][]groupStat `json:"byVisaType"`
	ByPriority map[string][]groupStat `json:"byPriority"`
	ByCountry  []countryStat          `json:"byCountry"`
	ByMonth    map[string][]monthStat `json:"byMonth"`
}

type countryMonthRow struct {
	Month           string  `json:"month"`
	VisaType        string  `json:"visa_type"`
	PriorityService string  `json:"priority_service"`
	Count           int     `json:"count"`
	MeasuredCount   int     `json:"measured_count"`
	AvgDays         float64 `json:"avg_days"`
}

// countryPrioritySummary is an all-time rollup of one country's applications
// for one priority-service key ("all" plus each service level).
type countryPrioritySummary struct {
	Total         int     `json:"total"`
	Pending       int     `json:"pending"`
	Decided       int     `json:"decided"`
	Approved      int     `json:"approved"`
	Measured      int     `json:"measured"`
	AvgDays       float64 `json:"avgDays"`
	MedianDays    float64 `json:"medianDays"`
	LowerQuartile float64 `json:"lowerQuartile"`
	UpperQuartile float64 `json:"upperQuartile"`
}

type countryStatsResponse struct {
	Country string                            `json:"country"`
	Rows    []countryMonthRow                 `json:"rows"`
	Summary map[string]countryPrioritySummary `json:"summary"`
}

type rawCountryApp struct {
	VisaType        string `db:"visa_type"`
	PriorityService string `db:"priority_service"`
	Outcome         string `db:"outcome"`
	BiometricsDate  string `db:"biometrics_date"`
	DecisionDate    string `db:"decision_date"`
}

type explorerFilters struct {
	Status    string
	Visa      string
	Service   string
	Milestone string
	Country   string
	BioFrom   string
	BioTo     string
}

type rawExplorerApp struct {
	Outcome        string `db:"outcome"`
	BiometricsDate string `db:"biometrics_date"`
	DecisionDate   string `db:"decision_date"`
}

type explorerDaySummary struct {
	Measured int     `json:"measured"`
	Average  float64 `json:"average"`
	Median   float64 `json:"median"`
}

type explorerSummaryResponse struct {
	Total     int                `json:"total"`
	Pending   explorerDaySummary `json:"pending"`
	Completed explorerDaySummary `json:"completed"`
}

type partnerVisaStatRow struct {
	Country   string `json:"country" db:"country"`
	Year      int    `json:"year" db:"year"`
	Issued    int    `json:"issued" db:"issued"`
	Refused   int    `json:"refused" db:"refused"`
	Withdrawn int    `json:"withdrawn" db:"withdrawn"`
	Lapsed    int    `json:"lapsed" db:"lapsed"`
}

type partnerVisaStatsResponse struct {
	Source    string               `json:"source"`
	SourceURL string               `json:"sourceUrl"`
	Note      string               `json:"note"`
	Rows      []partnerVisaStatRow `json:"rows"`
}

type cohortResponse struct {
	Count         int     `json:"count"`
	MedianDays    float64 `json:"medianDays"`
	LowerQuartile float64 `json:"lowerQuartile"`
	UpperQuartile float64 `json:"upperQuartile"`
	DecidedByNow  int     `json:"decidedByNow"`
	Scope         string  `json:"scope"`
	Country       string  `json:"country"`
}

type rawCohortApp struct {
	CountryID      string `db:"country_id"`
	Country        string `db:"country"`
	BiometricsDate string `db:"biometrics_date"`
	DecisionDate   string `db:"decision_date"`
}

// rollingWindows maps the window keys exposed to the frontend to how many
// months back from now they cover. "all" has no cutoff.
var rollingWindows = []string{"1", "3", "6", "all"}

func windowCutoff(window string, now time.Time) (time.Time, bool) {
	switch window {
	case "1":
		return now.AddDate(0, -1, 0), true
	case "3":
		return now.AddDate(0, -3, 0), true
	case "6":
		return now.AddDate(0, -6, 0), true
	default:
		return time.Time{}, false
	}
}

func main() {
	app := pocketbase.New()

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: false,
	})

	// Keep private notes and the owner's record id out of public API responses.
	// The owner can still retrieve both when editing their own application.
	app.OnRecordEnrich("applications").BindFunc(func(e *core.RecordEnrichEvent) error {
		isOwner := e.RequestInfo.Auth != nil &&
			e.Record.GetString("user") == e.RequestInfo.Auth.Id
		if !isOwner {
			e.Record.Hide("notes", "user")
		}
		if e.RequestInfo.Auth == nil {
			username := e.Record.GetString("reddit_username")
			if username != "" {
				e.Record.Set("reddit_username", maskRedditUsername(username))
			}
		}
		return e.Next()
	})

	validateApplicationRequest := func(e *core.RecordRequestEvent) error {
		if errs := validateApplicationTimeline(e.Record, time.Now()); len(errs) > 0 {
			return errs
		}
		return e.Next()
	}
	app.OnRecordCreateRequest("applications").BindFunc(validateApplicationRequest)
	app.OnRecordUpdateRequest("applications").BindFunc(validateApplicationRequest)

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/custom/application-summary", func(e *core.RequestEvent) error {
			filters, err := parseExplorerFilters(e.Request.URL.Query())
			if err != nil {
				return e.BadRequestError(err.Error(), nil)
			}

			summary, err := buildExplorerSummary(e.App, filters, time.Now())
			if err != nil {
				return e.InternalServerError("failed to build application summary", err)
			}
			return e.JSON(http.StatusOK, summary)
		})

		se.Router.GET("/api/custom/stats", func(e *core.RequestEvent) error {
			countryPriority := e.Request.URL.Query().Get("countryPriority")

			stats, err := buildStats(e.App, countryPriority)
			if err != nil {
				return e.InternalServerError("failed to build stats", err)
			}

			return e.JSON(http.StatusOK, stats)
		})

		se.Router.GET("/api/custom/country-stats", func(e *core.RequestEvent) error {
			country := strings.TrimSpace(e.Request.URL.Query().Get("country"))
			if country == "" {
				return e.BadRequestError("country parameter is required", nil)
			}

			cutoff := time.Now().AddDate(0, -12, 0)

			// All applications for the country: the monthly rows below keep
			// the 12-month decided window, while the summary rolls up all time.
			var raw []rawCountryApp
			err := e.App.DB().NewQuery(
				`SELECT a.visa_type, a.priority_service, a.outcome, a.biometrics_date, a.decision_date
					 FROM applications a
					 LEFT JOIN countries c ON c.id = a.country_id
					 WHERE c.name = {:country}`,
			).Bind(dbx.Params{"country": country}).All(&raw)
			if err != nil {
				return e.InternalServerError("failed to query country stats", err)
			}

			type aggKey struct {
				Month           string
				VisaType        string
				PriorityService string
			}
			type countryMonthAgg struct {
				decided  int
				measured int
				sum      float64
			}
			aggs := map[aggKey]*countryMonthAgg{}
			summaries := map[string]*countryPrioritySummary{}
			summaryAggs := map[string]*dayAgg{}

			for _, r := range raw {
				days, hasDays := processingDays(rawApplication{
					BiometricsDate: r.BiometricsDate,
					DecisionDate:   r.DecisionDate,
				})
				decided := r.Outcome == "approved" || r.Outcome == "rejected"
				approved := r.Outcome == "approved"

				for _, key := range []string{"all", r.PriorityService} {
					if summaries[key] == nil {
						summaries[key] = &countryPrioritySummary{}
					}
					s := summaries[key]
					s.Total++
					if r.Outcome == "pending" {
						s.Pending++
					}
					if decided {
						s.Decided++
						if approved {
							s.Approved++
						}
						if hasDays {
							s.Measured++
							if summaryAggs[key] == nil {
								summaryAggs[key] = &dayAgg{}
							}
							summaryAggs[key].add(days, approved)
						}
					}
				}

				if !decided {
					continue
				}
				decision, ok := parseDate(r.DecisionDate)
				if !ok || decision.Before(cutoff) {
					continue
				}
				month := decision.Format("2006-01")
				key := aggKey{month, r.VisaType, r.PriorityService}
				if aggs[key] == nil {
					aggs[key] = &countryMonthAgg{}
				}
				aggs[key].decided++
				if hasDays {
					aggs[key].measured++
					aggs[key].sum += days
				}
			}

			rows := []countryMonthRow{}
			for key, agg := range aggs {
				avgDays := 0.0
				if agg.measured > 0 {
					avgDays = math.Round(agg.sum/float64(agg.measured)*10) / 10
				}
				rows = append(rows, countryMonthRow{
					Month:           key.Month,
					VisaType:        key.VisaType,
					PriorityService: key.PriorityService,
					Count:           agg.decided,
					MeasuredCount:   agg.measured,
					AvgDays:         avgDays,
				})
			}
			sort.Slice(rows, func(i, j int) bool {
				if rows[i].Month != rows[j].Month {
					return rows[i].Month < rows[j].Month
				}
				return rows[i].VisaType < rows[j].VisaType
			})

			summary := map[string]countryPrioritySummary{}
			for key, s := range summaries {
				if agg := summaryAggs[key]; agg != nil {
					sortedDays := append([]float64{}, agg.days...)
					sort.Float64s(sortedDays)
					s.AvgDays = math.Round(agg.avg()*10) / 10
					s.MedianDays = math.Round(agg.median()*10) / 10
					s.LowerQuartile = math.Round(percentile(sortedDays, 0.25)*10) / 10
					s.UpperQuartile = math.Round(percentile(sortedDays, 0.75)*10) / 10
				}
				summary[key] = *s
			}

			return e.JSON(http.StatusOK, countryStatsResponse{Country: country, Rows: rows, Summary: summary})
		})

		se.Router.GET("/api/custom/partner-visa-stats", func(e *core.RequestEvent) error {
			rows := []partnerVisaStatRow{}
			err := e.App.DB().NewQuery(
				`SELECT COALESCE(c.name, 'Other / unknown') AS country, s.year, s.issued, s.refused, s.withdrawn, s.lapsed
					 FROM partner_visa_stats s
					 LEFT JOIN countries c ON c.id = s.country
					 ORDER BY country, s.year`,
			).All(&rows)
			if err != nil {
				return e.InternalServerError("failed to query partner visa stats", err)
			}

			return e.JSON(http.StatusOK, partnerVisaStatsResponse{
				Source:    "Home Office, Immigration system statistics — entry clearance visa applications and outcomes detailed dataset, year ending March 2026",
				SourceURL: "https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables",
				Note:      "2026 covers Q1 only (year ending March 2026 release)",
				Rows:      rows,
			})
		})

		se.Router.GET("/api/custom/cohort", func(e *core.RequestEvent) error {
			countryID := strings.TrimSpace(e.Request.URL.Query().Get("country"))
			visaType := strings.TrimSpace(e.Request.URL.Query().Get("visaType"))
			priority := strings.TrimSpace(e.Request.URL.Query().Get("priority"))
			elapsed := 0
			if _, err := fmt.Sscanf(e.Request.URL.Query().Get("elapsed"), "%d", &elapsed); err != nil {
				elapsed = 0
			}
			if countryID == "" || visaType == "" || !validPriorities[priority] {
				return e.BadRequestError("country, visaType and priority are required", nil)
			}

			stats, err := buildCohort(e.App, countryID, visaType, priority, elapsed)
			if err != nil {
				return e.InternalServerError("failed to build cohort", err)
			}
			return e.JSON(http.StatusOK, stats)
		})

		findClaimable := func(e *core.RequestEvent, username string) ([]*core.Record, error) {
			records := []*core.Record{}
			err := e.App.RecordQuery("applications").
				AndWhere(dbx.NewExp(
					"LOWER(reddit_username) = LOWER({:username})",
					dbx.Params{"username": username},
				)).
				AndWhere(dbx.NewExp("(user = '' OR user IS NULL)")).
				All(&records)
			return records, err
		}

		// Lets a logged-in user check whether the Reddit import already holds
		// their timeline before committing the username to their profile.
		se.Router.GET("/api/custom/claim/preview", func(e *core.RequestEvent) error {
			if e.Auth == nil {
				return e.UnauthorizedError("authentication required", nil)
			}

			username := strings.TrimSpace(e.Request.URL.Query().Get("username"))
			if username == "" {
				username = strings.TrimSpace(e.Auth.GetString("reddit_username"))
			}
			if username == "" {
				return e.BadRequestError("provide a reddit username", nil)
			}

			records, err := findClaimable(e, username)
			if err != nil {
				return e.InternalServerError("failed to search for claimable entries", err)
			}
			return e.JSON(http.StatusOK, map[string]int{"matches": len(records)})
		})

		se.Router.POST("/api/custom/claim", func(e *core.RequestEvent) error {
			if e.Auth == nil {
				return e.UnauthorizedError("authentication required", nil)
			}

			redditUsername := strings.TrimSpace(e.Auth.GetString("reddit_username"))
			if redditUsername == "" {
				return e.BadRequestError("set a reddit username on your profile first", nil)
			}

			records, err := findClaimable(e, redditUsername)
			if err != nil {
				return e.InternalServerError("failed to search for claimable entries", err)
			}

			for _, record := range records {
				record.Set("user", e.Auth.Id)
				if err := e.App.Save(record); err != nil {
					return e.InternalServerError("failed to claim entry", err)
				}
			}

			return e.JSON(http.StatusOK, map[string]int{"claimed": len(records)})
		})

		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

var validPriorities = map[string]bool{
	"none":           true,
	"priority":       true,
	"super_priority": true,
}

var validVisaTypes = map[string]bool{
	"spouse":            true,
	"fiance":            true,
	"unmarried_partner": true,
	"extension":         true,
	"other":             true,
}

var validExplorerStatuses = map[string]bool{
	"pending":  true,
	"approved": true,
	"rejected": true,
	"all":      true,
}

var validExplorerMilestones = map[string]bool{
	"all":  true,
	"eco":  true,
	"rfi":  true,
	"nsf":  true,
	"none": true,
}

func explorerOption(values url.Values, key, fallback string, allowed map[string]bool) (string, error) {
	value := strings.TrimSpace(values.Get(key))
	if value == "" {
		return fallback, nil
	}
	if !allowed[value] {
		return "", fmt.Errorf("invalid %s parameter", key)
	}
	return value, nil
}

func explorerDate(values url.Values, key string) (string, error) {
	value := strings.TrimSpace(values.Get(key))
	if value == "" {
		return "", nil
	}
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil || parsed.Format("2006-01-02") != value {
		return "", fmt.Errorf("invalid %s parameter", key)
	}
	return value, nil
}

func parseExplorerFilters(values url.Values) (explorerFilters, error) {
	filters := explorerFilters{Country: strings.TrimSpace(values.Get("country"))}
	var err error

	if filters.Status, err = explorerOption(values, "status", "pending", validExplorerStatuses); err != nil {
		return explorerFilters{}, err
	}
	visaOptions := map[string]bool{"all": true}
	for value := range validVisaTypes {
		visaOptions[value] = true
	}
	if filters.Visa, err = explorerOption(values, "visa", "all", visaOptions); err != nil {
		return explorerFilters{}, err
	}
	serviceOptions := map[string]bool{"all": true}
	for value := range validPriorities {
		serviceOptions[value] = true
	}
	if filters.Service, err = explorerOption(values, "service", "all", serviceOptions); err != nil {
		return explorerFilters{}, err
	}
	if filters.Milestone, err = explorerOption(values, "milestone", "all", validExplorerMilestones); err != nil {
		return explorerFilters{}, err
	}
	if filters.BioFrom, err = explorerDate(values, "bioFrom"); err != nil {
		return explorerFilters{}, err
	}
	if filters.BioTo, err = explorerDate(values, "bioTo"); err != nil {
		return explorerFilters{}, err
	}
	if filters.BioFrom != "" && filters.BioTo != "" && filters.BioFrom > filters.BioTo {
		return explorerFilters{}, fmt.Errorf("bioFrom must be on or before bioTo")
	}

	return filters, nil
}

func buildExplorerSummary(app core.App, filters explorerFilters, now time.Time) (*explorerSummaryResponse, error) {
	query := `SELECT a.outcome, a.biometrics_date, a.decision_date
		FROM applications a
		LEFT JOIN countries c ON c.id = a.country_id
		WHERE 1 = 1`
	params := dbx.Params{}

	if filters.Status != "all" {
		query += " AND a.outcome = {:outcome}"
		params["outcome"] = filters.Status
	}
	if filters.Visa != "all" {
		query += " AND a.visa_type = {:visa}"
		params["visa"] = filters.Visa
	}
	if filters.Service != "all" {
		query += " AND a.priority_service = {:service}"
		params["service"] = filters.Service
	}
	switch filters.Milestone {
	case "eco":
		query += " AND COALESCE(a.eco_email_date, '') != ''"
	case "rfi":
		query += " AND COALESCE(a.rfi_date, '') != ''"
	case "nsf":
		query += " AND COALESCE(a.nsf_email_date, '') != ''"
	case "none":
		query += ` AND COALESCE(a.eco_email_date, '') = ''
			AND COALESCE(a.rfi_date, '') = ''
			AND COALESCE(a.nsf_email_date, '') = ''`
	}
	if filters.Country != "" {
		query += " AND INSTR(LOWER(COALESCE(c.name, '')), LOWER({:country})) > 0"
		params["country"] = filters.Country
	}
	if filters.BioFrom != "" {
		query += " AND a.biometrics_date >= {:bioFrom}"
		params["bioFrom"] = filters.BioFrom + " 00:00:00.000Z"
	}
	if filters.BioTo != "" {
		query += " AND a.biometrics_date <= {:bioTo}"
		params["bioTo"] = filters.BioTo + " 23:59:59.999Z"
	}

	var rows []rawExplorerApp
	if err := app.DB().NewQuery(query).Bind(params).All(&rows); err != nil {
		return nil, err
	}

	return summariseExplorerRows(rows, now), nil
}

func summariseExplorerRows(rows []rawExplorerApp, now time.Time) *explorerSummaryResponse {
	pending := &dayAgg{}
	completed := &dayAgg{}

	for _, row := range rows {
		application := rawApplication{
			Outcome:        row.Outcome,
			BiometricsDate: row.BiometricsDate,
			DecisionDate:   row.DecisionDate,
		}
		switch row.Outcome {
		case "pending":
			if start, ok := processingStart(application); ok {
				pending.add(workingDaysBetween(start, now), false)
			}
		case "approved", "rejected":
			if days, ok := processingDays(application); ok {
				completed.add(days, row.Outcome == "approved")
			}
		}
	}

	return &explorerSummaryResponse{
		Total: len(rows),
		Pending: explorerDaySummary{
			Measured: pending.count,
			Average:  pending.avg(),
			Median:   pending.median(),
		},
		Completed: explorerDaySummary{
			Measured: completed.count,
			Average:  completed.avg(),
			Median:   completed.median(),
		},
	}
}

// maskRedditUsername hides the middle of a username (e.g. "johnsmith" ->
// "j***h") without revealing its real length.
func maskRedditUsername(username string) string {
	runes := []rune(username)
	if len(runes) <= 2 {
		return strings.Repeat("*", len(runes))
	}
	return string(runes[0]) + "***" + string(runes[len(runes)-1])
}

func validateApplicationTimeline(record *core.Record, now time.Time) validation.Errors {
	errs := validation.Errors{}
	dateFields := []string{
		"application_date",
		"biometrics_date",
		"eco_email_date",
		"rfi_date",
		"nsf_email_date",
		"decision_date",
	}
	dates := map[string]time.Time{}
	todayEnd := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, now.Location())

	for _, field := range dateFields {
		raw := record.GetString(field)
		if raw == "" {
			continue
		}
		parsed, ok := parseDate(raw)
		if !ok {
			continue
		}
		dates[field] = parsed
		if parsed.After(todayEnd) {
			errs[field] = validation.NewError("future_date", "Date cannot be in the future.")
		}
	}

	application, hasApplication := dates["application_date"]
	biometrics, hasBiometrics := dates["biometrics_date"]
	if hasApplication && hasBiometrics && biometrics.Before(application) {
		errs["biometrics_date"] = validation.NewError(
			"invalid_timeline",
			"Biometrics cannot be before the application date.",
		)
	}

	if hasBiometrics {
		for _, field := range []string{"eco_email_date", "rfi_date", "nsf_email_date", "decision_date"} {
			if date, ok := dates[field]; ok && date.Before(biometrics) {
				errs[field] = validation.NewError(
					"invalid_timeline",
					"Milestone cannot be before the biometrics date.",
				)
			}
		}
	}

	outcome := record.GetString("outcome")
	_, hasDecision := dates["decision_date"]
	if outcome == "pending" && hasDecision {
		errs["decision_date"] = validation.NewError(
			"pending_with_decision",
			"Remove the decision date or change the outcome.",
		)
	}
	if (outcome == "approved" || outcome == "rejected") && !hasDecision {
		errs["decision_date"] = validation.NewError(
			"decision_required",
			"A decision date is required for a decided application.",
		)
	}

	return errs
}

type rawApplication struct {
	Country         string `db:"country"`
	VisaType        string `db:"visa_type"`
	PriorityService string `db:"priority_service"`
	Outcome         string `db:"outcome"`
	ApplicationDate string `db:"application_date"`
	BiometricsDate  string `db:"biometrics_date"`
	DecisionDate    string `db:"decision_date"`
}

func parseDate(s string) (time.Time, bool) {
	if s == "" {
		return time.Time{}, false
	}
	dt, err := types.ParseDateTime(s)
	if err != nil {
		return time.Time{}, false
	}
	return dt.Time(), true
}

func isWeekend(t time.Time) bool {
	wd := t.Weekday()
	return wd == time.Sunday || wd == time.Saturday
}

// firstWorkingDayAfter mirrors the frontend's lib/processingDays.js: UKVI
// counts "Day 1" of processing time as the first working day after the
// biometrics appointment.
func firstWorkingDayAfter(t time.Time) time.Time {
	d := t.AddDate(0, 0, 1)
	for isNonWorkingDay(d) {
		d = d.AddDate(0, 0, 1)
	}
	return d
}

// processingStart returns the Day-1 anchor for an application: the first
// working day after biometrics. Processing time is undefined until
// biometrics has happened — there is no fallback to the application date.
func processingStart(a rawApplication) (time.Time, bool) {
	bio, ok := parseDate(a.BiometricsDate)
	if !ok {
		return time.Time{}, false
	}
	return firstWorkingDayAfter(bio), true
}

func workingDaysBetween(from, to time.Time) float64 {
	if to.Before(from) {
		return 0
	}

	count := 0
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		if !isNonWorkingDay(d) {
			count++
		}
	}
	return float64(count)
}

// processingDays returns the number of UK working days from the Day-1 anchor
// to the decision date, or ok=false if either endpoint is missing.
func processingDays(a rawApplication) (float64, bool) {
	start, ok := processingStart(a)
	if !ok {
		return 0, false
	}
	decision, ok := parseDate(a.DecisionDate)
	if !ok {
		return 0, false
	}
	return workingDaysBetween(start, decision), true
}

type dayAgg struct {
	count    int
	sum      float64
	min      float64
	max      float64
	days     []float64
	approved int
}

func (a *dayAgg) add(days float64, approved bool) {
	if a.count == 0 || days < a.min {
		a.min = days
	}
	if a.count == 0 || days > a.max {
		a.max = days
	}
	a.count++
	a.sum += days
	a.days = append(a.days, days)
	if approved {
		a.approved++
	}
}

func (a *dayAgg) avg() float64 {
	if a.count == 0 {
		return 0
	}
	return a.sum / float64(a.count)
}

func (a *dayAgg) median() float64 {
	n := len(a.days)
	if n == 0 {
		return 0
	}
	sorted := append([]float64{}, a.days...)
	sort.Float64s(sorted)
	if n%2 == 1 {
		return sorted[n/2]
	}
	return (sorted[n/2-1] + sorted[n/2]) / 2
}

func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	if len(sorted) == 1 {
		return sorted[0]
	}
	position := p * float64(len(sorted)-1)
	lower := int(math.Floor(position))
	upper := int(math.Ceil(position))
	if lower == upper {
		return sorted[lower]
	}
	weight := position - float64(lower)
	return sorted[lower] + (sorted[upper]-sorted[lower])*weight
}

func buildCohort(
	app core.App,
	countryID string,
	visaType string,
	priority string,
	elapsed int,
) (*cohortResponse, error) {
	// Keep the comparison recent enough to reflect current processing patterns,
	// while using a full year so smaller country/route cohorts remain useful.
	// Only applications with a reported decision are included.
	cutoff := time.Now().AddDate(0, -12, 0).Format("2006-01-02")
	var rows []rawCohortApp
	err := app.DB().NewQuery(
		`SELECT a.country_id, c.name as country, a.biometrics_date, a.decision_date
		 FROM applications a
		 LEFT JOIN countries c ON c.id = a.country_id
		 WHERE a.visa_type = {:visaType}
		   AND a.priority_service = {:priority}
		   AND a.outcome IN ('approved', 'rejected')
		   AND a.decision_date >= {:cutoff}
		   AND a.biometrics_date != ''`,
	).Bind(dbx.Params{
		"visaType": visaType,
		"priority": priority,
		"cutoff":   cutoff,
	}).All(&rows)
	if err != nil {
		return nil, err
	}

	countryName := ""
	exactDays := []float64{}
	broaderDays := []float64{}
	for _, row := range rows {
		days, ok := processingDays(rawApplication{
			BiometricsDate: row.BiometricsDate,
			DecisionDate:   row.DecisionDate,
		})
		if !ok {
			continue
		}
		broaderDays = append(broaderDays, days)
		if row.CountryID == countryID {
			countryName = row.Country
			exactDays = append(exactDays, days)
		}
	}

	scope := "country"
	selected := exactDays
	if len(selected) < 5 {
		scope = "all_countries"
		selected = broaderDays
	}
	sort.Float64s(selected)

	response := &cohortResponse{
		Count:   len(selected),
		Scope:   scope,
		Country: countryName,
	}
	if len(selected) == 0 {
		return response, nil
	}

	response.LowerQuartile = math.Round(percentile(selected, 0.25)*10) / 10
	response.MedianDays = math.Round(percentile(selected, 0.5)*10) / 10
	response.UpperQuartile = math.Round(percentile(selected, 0.75)*10) / 10
	decided := 0
	for _, days := range selected {
		if days <= float64(elapsed) {
			decided++
		}
	}
	response.DecidedByNow = int(math.Round(float64(decided) / float64(len(selected)) * 100))
	return response, nil
}

type decidedEntry struct {
	VisaType        string
	PriorityService string
	Days            float64
	Approved        bool
	DecisionTime    time.Time
}

func groupByWindow(entries []decidedEntry, keyOf func(decidedEntry) string) map[string][]groupStat {
	now := time.Now()
	result := map[string][]groupStat{}

	for _, window := range rollingWindows {
		cutoff, hasCutoff := windowCutoff(window, now)
		groups := map[string]*dayAgg{}

		for _, entry := range entries {
			if hasCutoff && entry.DecisionTime.Before(cutoff) {
				continue
			}
			key := keyOf(entry)
			if groups[key] == nil {
				groups[key] = &dayAgg{}
			}
			groups[key].add(entry.Days, entry.Approved)
		}

		var stats []groupStat
		for key, agg := range groups {
			stats = append(stats, groupStat{Key: key, Count: agg.count, AvgDays: agg.avg()})
		}
		sort.Slice(stats, func(i, j int) bool { return stats[i].Key < stats[j].Key })
		result[window] = stats
	}

	return result
}

func buildStats(app core.App, countryPriority string) (*statsResponse, error) {
	resp := &statsResponse{
		Outcomes: map[string]int{},
		ByMonth:  map[string][]monthStat{},
	}

	var rows []rawApplication
	if err := app.DB().NewQuery(
		`SELECT c.name as country, a.visa_type, a.priority_service, a.outcome, a.application_date, a.biometrics_date, a.decision_date
		 FROM applications a
		 LEFT JOIN countries c ON c.id = a.country_id`,
	).All(&rows); err != nil {
		return nil, err
	}

	var decidedEntries []decidedEntry
	byCountry := map[string]*dayAgg{}
	byMonth := map[string]map[string]*dayAgg{
		"all":            {},
		"none":           {},
		"priority":       {},
		"super_priority": {},
	}

	filterByCountryPriority := validPriorities[countryPriority]

	for _, row := range rows {
		resp.Outcomes[row.Outcome]++
		resp.Total++

		decided := row.Outcome == "approved" || row.Outcome == "rejected"
		if !decided {
			continue
		}

		days, ok := processingDays(row)
		if !ok {
			continue
		}
		approved := row.Outcome == "approved"

		decisionTime, ok := parseDate(row.DecisionDate)
		if !ok {
			continue
		}
		decidedEntries = append(decidedEntries, decidedEntry{
			VisaType:        row.VisaType,
			PriorityService: row.PriorityService,
			Days:            days,
			Approved:        approved,
			DecisionTime:    decisionTime,
		})

		if !filterByCountryPriority || row.PriorityService == countryPriority {
			if byCountry[row.Country] == nil {
				byCountry[row.Country] = &dayAgg{}
			}
			byCountry[row.Country].add(days, approved)
		}

		if approved {
			if decision, ok := parseDate(row.DecisionDate); ok {
				month := decision.Format("2006-01")
				for _, service := range []string{"all", row.PriorityService} {
					if byMonth[service][month] == nil {
						byMonth[service][month] = &dayAgg{}
					}
					byMonth[service][month].add(days, approved)
				}
			}
		}
	}

	resp.ByVisaType = groupByWindow(decidedEntries, func(e decidedEntry) string { return e.VisaType })
	resp.ByPriority = groupByWindow(decidedEntries, func(e decidedEntry) string { return e.PriorityService })

	for key, agg := range byCountry {
		resp.ByCountry = append(resp.ByCountry, countryStat{Key: key, Count: agg.count, AvgDays: agg.avg(), Approved: agg.approved})
	}
	for service, months := range byMonth {
		for month, agg := range months {
			sortedDays := append([]float64{}, agg.days...)
			sort.Float64s(sortedDays)
			resp.ByMonth[service] = append(resp.ByMonth[service], monthStat{
				Month:         month,
				Count:         agg.count,
				AvgDays:       agg.avg(),
				MedianDays:    agg.median(),
				LowerQuartile: percentile(sortedDays, 0.25),
				UpperQuartile: percentile(sortedDays, 0.75),
			})
		}
		sort.Slice(resp.ByMonth[service], func(i, j int) bool {
			return resp.ByMonth[service][i].Month < resp.ByMonth[service][j].Month
		})
	}

	sort.Slice(resp.ByCountry, func(i, j int) bool {
		if resp.ByCountry[i].Count != resp.ByCountry[j].Count {
			return resp.ByCountry[i].Count > resp.ByCountry[j].Count
		}
		return resp.ByCountry[i].Key < resp.ByCountry[j].Key
	})
	return resp, nil
}
