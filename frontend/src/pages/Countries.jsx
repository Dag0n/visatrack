import { useEffect, useState } from "react";
import { fetchCustom, isAbortError } from "../lib/api";
import CountryTable from "../components/CountryTable";

export default function Countries() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [countryPriority, setCountryPriority] = useState("none");

  useEffect(() => {
    const controller = new AbortController();
    fetchCustom(`/stats?countryPriority=${countryPriority}`, { signal: controller.signal })
      .then(setStats)
      .catch((err) => {
        if (!isAbortError(err)) setError("Couldn't load countries right now.");
      });
    return () => controller.abort();
  }, [countryPriority]);

  if (error) return <p className="empty-hint">{error}</p>;
  if (!stats) return <p className="empty-hint">Loading…</p>;

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
      <CountryTable
        data={stats.byCountry ?? []}
        priorityFilter={countryPriority}
        onPriorityFilterChange={setCountryPriority}
      />
    </div>
  );
}
