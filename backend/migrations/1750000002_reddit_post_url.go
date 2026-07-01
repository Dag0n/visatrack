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
			Name: "reddit_post_url",
			Max:  300,
		})

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("applications")
		if err != nil {
			return err
		}

		collection.Fields.RemoveByName("reddit_post_url")

		return app.Save(collection)
	})
}
