interface Props {
  headers: string[];
  rows: string[][];
  truncatedAt?: number | null;
}

export function TablePreview({ headers, rows, truncatedAt }: Props) {
  return (
    <div className="table-preview-wrapper">
      <table className="table-preview">
        <thead>
          <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {truncatedAt != null && (
        <div className="table-preview-truncated">
          Showing first {truncatedAt} rows. Download to see all.
        </div>
      )}
    </div>
  );
}
