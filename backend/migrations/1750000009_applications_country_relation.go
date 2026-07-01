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

		appsCollection, err := app.FindCollectionByNameOrId("applications")
		if err != nil {
			return err
		}

		appsCollection.Fields.Add(
			&core.RelationField{
				Name:         "country_id",
				Required:     false,
				CollectionId: countriesCollection.Id,
				MaxSelect:    1,
			},
		)

		if err := app.Save(appsCollection); err != nil {
			return err
		}

		// Build name→id map for all countries.
		countryRecords, err := app.FindRecordsByFilter("countries", "", "", 0, 0, nil)
		if err != nil {
			return err
		}
		nameToID := make(map[string]string, len(countryRecords))
		for _, r := range countryRecords {
			nameToID[r.GetString("name")] = r.Id
		}

		// Backfill country_id on every application that has a country name.
		appRecords, err := app.FindRecordsByFilter("applications", "country != ''", "", 0, 0, nil)
		if err != nil {
			return err
		}
		for _, record := range appRecords {
			name := record.GetString("country")
			if id, ok := nameToID[name]; ok {
				record.Set("country_id", id)
				if err := app.Save(record); err != nil {
					return err
				}
			}
		}

		// Remove the old text field.
		appsCollection, err = app.FindCollectionByNameOrId("applications")
		if err != nil {
			return err
		}
		appsCollection.Fields.RemoveByName("country")
		return app.Save(appsCollection)
	}, func(app core.App) error {
		appsCollection, err := app.FindCollectionByNameOrId("applications")
		if err != nil {
			return err
		}

		// Restore the text field.
		appsCollection.Fields.Add(
			&core.TextField{
				Name:     "country",
				Required: false,
				Max:      100,
			},
		)
		if err := app.Save(appsCollection); err != nil {
			return err
		}

		// Build id→name map.
		countryRecords, err := app.FindRecordsByFilter("countries", "", "", 0, 0, nil)
		if err != nil {
			return err
		}
		idToName := make(map[string]string, len(countryRecords))
		for _, r := range countryRecords {
			idToName[r.Id] = r.GetString("name")
		}

		// Copy country name back.
		appRecords, err := app.FindRecordsByFilter("applications", "country_id != ''", "", 0, 0, nil)
		if err != nil {
			return err
		}
		for _, record := range appRecords {
			cid := record.GetString("country_id")
			if name, ok := idToName[cid]; ok {
				record.Set("country", name)
				if err := app.Save(record); err != nil {
					return err
				}
			}
		}

		// Remove the relation field.
		appsCollection, err = app.FindCollectionByNameOrId("applications")
		if err != nil {
			return err
		}
		appsCollection.Fields.RemoveByName("country_id")
		return app.Save(appsCollection)
	})
}
