package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	core.AppMigrations.Register(func(app core.App) error {
		countriesCollection, err := app.FindCollectionByNameOrId("countries")
		if err != nil {
			return err
		}

		collection := core.NewBaseCollection("partner_visa_stats")
		collection.ListRule = types.Pointer("")
		collection.ViewRule = types.Pointer("")
		collection.CreateRule = nil
		collection.UpdateRule = nil
		collection.DeleteRule = nil

		collection.Fields.Add(
			&core.RelationField{
				Name:         "country",
				Required:     true,
				CollectionId: countriesCollection.Id,
				MaxSelect:    1,
			},
			&core.NumberField{Name: "year", Required: true, OnlyInt: true},
			&core.NumberField{Name: "issued", OnlyInt: true},
			&core.NumberField{Name: "refused", OnlyInt: true},
			&core.NumberField{Name: "withdrawn", OnlyInt: true},
			&core.NumberField{Name: "lapsed", OnlyInt: true},
		)

		collection.AddIndex("idx_partner_visa_stats_country_year", true, "country, year", "")

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("partner_visa_stats")
		if err != nil {
			return err
		}
		return app.Delete(collection)
	})
}
