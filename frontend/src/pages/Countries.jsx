import { useEffect, useState } from "react";
import { pb } from "../lib/pb";
import CountryTable from "../components/CountryTable";

export default function Countries() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [countryPriority, setCountryPriority] = useState("none");

  useEffect(() => {
    const base = pb.baseURL.replace(/\/$/, "");
    fetch(`${base}/api/custom/stats?countryPriority=${countryPriority}`)
      .then((res) => res.json())
      .then(setStats)
      .catch(() => setError("Couldn't load countries right now."));
  }, [countryPriority]);

  if (error) return <p className="empty-hint">{error}</p>;
  if (!stats) return <p className="empty-hint">Loading…</p>;

  return (
    <div>
      <h2>Countries</h2>
      <CountryTable
        data={stats.byCountry ?? []}
        priorityFilter={countryPriority}
        onPriorityFilterChange={setCountryPriority}
      />
    </div>
  );
}
