import { useEffect, useId, useMemo, useRef, useState } from "react";
import { pb } from "../lib/pb";

let cachedCountries = null;

async function fetchCountries() {
  if (cachedCountries) return cachedCountries;
  const records = await pb.collection("countries").getFullList({ sort: "name", requestKey: null });
  cachedCountries = records.map((r) => ({ id: r.id, name: r.name }));
  return cachedCountries;
}

export default function CountrySelect({ id, value, onChange, required }) {
  const generatedId = useId();
  const inputId = id ?? `country-${generatedId}`;
  const listId = `${inputId}-options`;
  const inputRef = useRef(null);
  const [countries, setCountries] = useState([]);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetchCountries()
      .then((items) => {
        if (active) setCountries(items);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const selectedName = countries.find((country) => country.id === value)?.name ?? "";
  const displayText = value ? selectedName : text;

  const suggestions = useMemo(() => {
    const query = displayText.trim().toLocaleLowerCase();
    const matches = query
      ? countries.filter((country) => country.name.toLocaleLowerCase().includes(query))
      : countries;
    return matches.slice(0, 12);
  }, [countries, displayText]);

  useEffect(() => {
    inputRef.current?.setCustomValidity(
      required && !value ? "Choose a country from the list." : "",
    );
  }, [required, value, text]);

  function choose(country) {
    setText(country.name);
    onChange(country.id);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleChange(e) {
    const nextText = e.target.value;
    setText(nextText);
    const exact = countries.find(
      (country) => country.name.toLocaleLowerCase() === nextText.trim().toLocaleLowerCase(),
    );
    onChange(exact?.id ?? "");
    setOpen(true);
    setActiveIndex(-1);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        if (!suggestions.length) return -1;
        if (current < 0) return direction > 0 ? 0 : suggestions.length - 1;
        return (current + direction + suggestions.length) % suggestions.length;
      });
    } else if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      choose(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="country-combobox">
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        placeholder={loading ? "Loading countries…" : "Start typing a country…"}
        required={required}
        disabled={loading}
        value={displayText}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      {open && !loading && !failed && (
        <ul id={listId} role="listbox" className="country-options">
          {suggestions.map((country, index) => (
            <li
              id={`${listId}-${index}`}
              key={country.id}
              role="option"
              aria-selected={country.id === value}
              className={index === activeIndex ? "active" : ""}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(country)}
            >
              {country.name}
            </li>
          ))}
          {suggestions.length === 0 && <li className="no-options">No matching country</li>}
        </ul>
      )}
      {failed && (
        <p className="field-error" role="alert">
          Countries couldn't load.{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setLoading(true);
              setFailed(false);
              setReloadKey((key) => key + 1);
            }}
          >
            Try again
          </button>
        </p>
      )}
    </div>
  );
}
