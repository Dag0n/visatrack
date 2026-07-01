import { useEffect, useRef, useState } from "react";
import { pb } from "../lib/pb";

let cachedCountries = null;

async function fetchCountries() {
  if (cachedCountries) return cachedCountries;
  const records = await pb.collection("countries").getFullList({ sort: "name", requestKey: "countries-list" });
  cachedCountries = records.map((r) => ({ id: r.id, name: r.name }));
  return cachedCountries;
}

export default function CountrySelect({ value, onChange, required }) {
  const [countries, setCountries] = useState([]);
  const [text, setText] = useState("");
  const didInit = useRef(false);

  useEffect(() => {
    fetchCountries().then(setCountries);
  }, []);

  // Sync display text when the value (ID) changes externally or countries load.
  useEffect(() => {
    if (!value) {
      if (!didInit.current) return;
      setText("");
      return;
    }
    const match = countries.find((c) => c.id === value);
    if (match) setText(match.name);
  }, [value, countries]);

  function handleChange(e) {
    didInit.current = true;
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
        value={text}
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
