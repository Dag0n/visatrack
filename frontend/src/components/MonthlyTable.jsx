function round1(n) {
  return Math.round(n * 10) / 10;
}

export default function MonthlyTable({ data }) {
  return (
    <div className="chart-card">
      <h3>Approval times by month</h3>
      <p className="optional-hint">
        Based on decision month, anchored to the first working day after
        biometrics (UK bank holidays excluded).
      </p>
      {data.length === 0 ? (
        <p className="empty-hint">Not enough approved applications yet.</p>
      ) : (
        <div className="table-scroll">
        <table className="country-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Approved</th>
              <th>Mean</th>
              <th>Median</th>
              <th>Fastest</th>
              <th>Longest</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.month}>
                <td>{row.month}</td>
                <td>{row.count}</td>
                <td>{round1(row.avgDays)}d</td>
                <td>{round1(row.medianDays)}d</td>
                <td>{round1(row.minDays)}d</td>
                <td>{round1(row.maxDays)}d</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
