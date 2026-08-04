package migrations

import (
	"github.com/pocketbase/pocketbase/core"
)

func init() {
	core.AppMigrations.Register(func(app core.App) error {
		countriesCollection, err := app.FindCollectionByNameOrId("countries")
		if err != nil {
			return err
		}

		if _, err := app.FindFirstRecordByFilter("countries", "name = 'Hong Kong'"); err == nil {
			return nil
		}

		record := core.NewRecord(countriesCollection)
		record.Set("name", "Hong Kong")
		return app.Save(record)
	}, func(app core.App) error {
		record, err := app.FindFirstRecordByFilter("countries", "name = 'Hong Kong'")
		if err != nil {
			return nil
		}
		return app.Delete(record)
	})
}
