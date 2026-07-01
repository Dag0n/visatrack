package migrations

import (
	"errors"

	"github.com/pocketbase/pocketbase/core"
)

func init() {
	core.AppMigrations.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("applications")
		if err != nil {
			return err
		}

		field, ok := collection.Fields.GetByName("visa_type").(*core.SelectField)
		if !ok {
			return errors.New("applications.visa_type is not a select field")
		}

		field.Values = append(field.Values, "extension")

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("applications")
		if err != nil {
			return err
		}

		field, ok := collection.Fields.GetByName("visa_type").(*core.SelectField)
		if !ok {
			return errors.New("applications.visa_type is not a select field")
		}

		field.Values = []string{"spouse", "fiance", "unmarried_partner", "other"}

		return app.Save(collection)
	})
}
