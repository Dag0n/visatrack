package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

var allCountries = []string{
	"Afghanistan", "Albania", "Algeria", "Andorra", "Angola",
	"Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
	"Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados",
	"Belarus", "Belgium", "Belize", "Benin", "Bhutan",
	"Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei",
	"Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon",
	"Canada", "Cape Verde", "Central African Republic", "Chad", "Chile",
	"China", "Colombia", "Comoros", "Congo (Brazzaville)", "Congo (DRC)",
	"Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
	"Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador",
	"Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia",
	"Eswatini", "Ethiopia", "Fiji", "Finland", "France",
	"Gabon", "Gambia", "Georgia", "Germany", "Ghana",
	"Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau",
	"Guyana", "Haiti", "Honduras", "Hungary", "Iceland",
	"India", "Indonesia", "Iran", "Iraq", "Ireland",
	"Israel", "Italy", "Ivory Coast", "Jamaica", "Japan",
	"Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo",
	"Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon",
	"Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania",
	"Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives",
	"Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius",
	"Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia",
	"Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia",
	"Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua",
	"Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
	"Oman", "Pakistan", "Palau", "Palestine", "Panama",
	"Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
	"Portugal", "Qatar", "Romania", "Russia", "Rwanda",
	"Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines",
	"Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia",
	"Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
	"Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa",
	"South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan",
	"Suriname", "Sweden", "Switzerland", "Syria", "Taiwan",
	"Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo",
	"Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
	"Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
	"United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City",
	"Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
}

func init() {
	core.AppMigrations.Register(func(app core.App) error {
		collection := core.NewBaseCollection("countries")
		collection.ListRule = types.Pointer("")
		collection.ViewRule = types.Pointer("")
		collection.CreateRule = nil
		collection.UpdateRule = nil
		collection.DeleteRule = nil

		collection.Fields.Add(
			&core.TextField{
				Name:     "name",
				Required: true,
				Max:      100,
			},
		)

		if err := app.Save(collection); err != nil {
			return err
		}

		countriesCollection, err := app.FindCollectionByNameOrId("countries")
		if err != nil {
			return err
		}

		for _, name := range allCountries {
			record := core.NewRecord(countriesCollection)
			record.Set("name", name)
			if err := app.Save(record); err != nil {
				return err
			}
		}

		return nil
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("countries")
		if err != nil {
			return err
		}
		return app.Delete(collection)
	})
}
