import { useEffect, useState } from "react";
import { pb } from "../lib/pb";

let cachedCountries = null;

async function fetchCountries() {
  if (cachedCountries) return cachedCountries;
  const records = await pb.collection("countries").getFullList({ sort: "name", requestKey: null });
  cachedCountries = records.map((r) => ({ id: r.id, name: r.name }));
  return cachedCountries;
}

export default function CountrySelect({ value, onChange, required }) {
  const [countries, setCountries] = useState([]);
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCountries()
      .then((items) => {
        if (active) setCountries(items);
      })
      .catch(() => {
        if (active) setCountries([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedName = countries.find((country) => country.id === value)?.name ?? "";
  const displayText = touched ? text : selectedName;

  function handleChange(e) {
    setTouched(true);
    const name = e.target.value;
    setText(name);
    const match = countries.find((c) => c.name === name);
    onChange(match ? match.id : "");
  }

  return (
    <>
      <input
        type="text"
        list="country-options"
        autoComplete="off"
        placeholder="Start typing a country…"
        required={required}
        value={displayText}
        onChange={handleChange}
      />
      <datalist id="country-options">
        {countries.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
    </>
  );
}
