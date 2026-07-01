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

		collection.Fields.Add(
			&core.DateField{
				Name: "eco_email_date",
			},
			&core.DateField{
				Name: "rfi_date",
			},
			&core.DateField{
				Name: "nsf_email_date",
			},
		)

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("applications")
		if err != nil {
			return err
		}

		collection.Fields.RemoveByName("eco_email_date")
		collection.Fields.RemoveByName("rfi_date")
		collection.Fields.RemoveByName("nsf_email_date")

		return app.Save(collection)
	})
}
