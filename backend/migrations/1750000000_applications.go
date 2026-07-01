package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	core.AppMigrations.Register(func(app core.App) error {
		usersCollection, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		collection := core.NewBaseCollection("applications")

		collection.ListRule = types.Pointer("")
		collection.ViewRule = types.Pointer("")
		collection.CreateRule = types.Pointer("@request.auth.id != ''")
		collection.UpdateRule = types.Pointer("@request.auth.id = user")
		collection.DeleteRule = types.Pointer("@request.auth.id = user")

		collection.Fields.Add(
			&core.RelationField{
				Name:          "user",
				Required:      true,
				CollectionId:  usersCollection.Id,
				CascadeDelete: true,
				MaxSelect:     1,
			},
			&core.TextField{
				Name:     "country",
				Required: true,
				Max:      100,
			},
			&core.TextField{
				Name: "reddit_username",
				Max:  50,
			},
			&core.SelectField{
				Name:     "visa_type",
				Required: true,
				Values:   []string{"spouse", "fiance", "unmarried_partner", "other"},
			},
			&core.SelectField{
				Name:     "priority_service",
				Required: true,
				Values:   []string{"none", "priority", "super_priority"},
			},
			&core.DateField{
				Name: "biometrics_date",
			},
			&core.DateField{
				Name:     "application_date",
				Required: true,
			},
			&core.DateField{
				Name: "decision_date",
			},
			&core.SelectField{
				Name:     "outcome",
				Required: true,
				Values:   []string{"pending", "approved", "rejected"},
			},
			&core.TextField{
				Name: "notes",
				Max:  2000,
			},
		)

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("applications")
		if err != nil {
			return err
		}

		return app.Delete(collection)
	})
}
