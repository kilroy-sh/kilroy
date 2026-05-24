import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { TablePreview } from './TablePreview';

interface Props { src: string; }

const MAX_ROWS = 500;

export function CsvPreview({ src }: Props) {
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][]; truncatedAt: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(src, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
        const data = result.data;
        if (data.length === 0) {
          if (!cancelled) setParsed({ headers: [], rows: [], truncatedAt: null });
          return;
        }
        const headers = data[0]!;
        const all = data.slice(1);
        const truncated = all.length > MAX_ROWS;
        const rows = truncated ? all.slice(0, MAX_ROWS) : all;
        if (!cancelled) setParsed({ headers, rows, truncatedAt: truncated ? MAX_ROWS : null });
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [src]);

  if (error) return <div className="error">{error}</div>;
  if (!parsed) return <div className="attachment-loading">Parsing CSV…</div>;
  return <TablePreview headers={parsed.headers} rows={parsed.rows} truncatedAt={parsed.truncatedAt} />;
}
