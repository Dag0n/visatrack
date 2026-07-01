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

		field, ok := collection.Fields.GetByName("user").(*core.RelationField)
		if !ok {
			return errors.New("applications.user is not a relation field")
		}
		field.Required = false

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("applications")
		if err != nil {
			return err
		}

		field, ok := collection.Fields.GetByName("user").(*core.RelationField)
		if !ok {
			return errors.New("applications.user is not a relation field")
		}
		field.Required = true

		return app.Save(collection)
	})
}
