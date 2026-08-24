import { useEffect, useState } from "react";
import { fetchCustom, isAbortError } from "../lib/api";
import CountryTable from "../components/CountryTable";

export default function Countries() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [countryPriority, setCountryPriority] = useState("none");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchCustom(`/stats?countryPriority=${countryPriority}`, { signal: controller.signal })
      .then(setStats)
      .catch((err) => {
        if (!isAbortError(err)) setError("Couldn't load countries right now.");
      });
    return () => controller.abort();
  }, [countryPriority, retryKey]);

  function changeCountryPriority(value) {
    setStats(null);
    setError("");
    setCountryPriority(value);
  }

  function retry() {
    setStats(null);
    setError("");
    setRetryKey((key) => key + 1);
  }

  return (
    <div className="countries-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow plain">Country explorer</span>
          <h1>Waiting times around the world</h1>
          <p>
            Compare recent partner visa decisions by the applicant's country and
            service level. Small samples should be treated as directional.
          </p>
        </div>
      </div>
      {error && (
        <div className="inline-error" role="alert">
          <span>{error}</span>
          <button type="button" className="small-button" onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {!error && !stats && <p className="empty-hint" role="status">Loading countries…</p>}
      {!error && stats && (
        <CountryTable
          data={stats.byCountry ?? []}
          priorityFilter={countryPriority}
          onPriorityFilterChange={changeCountryPriority}
        />
      )}
    </div>
  );
}
