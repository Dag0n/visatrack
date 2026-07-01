package migrations

import (
	"github.com/pocketbase/pocketbase/core"
)

func init() {
	core.AppMigrations.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("applications")
		if err != nil {
			return err
		}

		collection.Fields.Add(&core.TextField{
			Name: "rejection_reason",
			Max:  1000,
		})

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("applications")
		if err != nil {
			return err
		}

		collection.Fields.RemoveByName("rejection_reason")

		return app.Save(collection)
	})
}
