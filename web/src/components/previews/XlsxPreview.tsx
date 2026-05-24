import { useEffect, useState } from 'react';
import { TablePreview } from './TablePreview';

interface Props { src: string; }

const MAX_ROWS = 500;

interface SheetData {
  name: string;
  headers: string[];
  rows: string[][];
  truncatedAt: number | null;
}

export function XlsxPreview({ src }: Props) {
  const [sheets, setSheets] = useState<SheetData[] | null>(null);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(src, { credentials: 'include' });
        if (!res.ok) throw new Error(`Failed to fetch XLSX: ${res.status}`);
        const buf = await res.arrayBuffer();
        // Dynamic import so the ~600KB xlsx bundle only ships when a user
        // actually opens an XLSX preview. Vite emits this as its own chunk.
        const XLSX = await import('xlsx');
        const wb = XLSX.read(buf, { type: 'array' });
        const result: SheetData[] = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name]!;
          const aoa = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false, defval: '' });
          if (aoa.length === 0) return { name, headers: [], rows: [], truncatedAt: null };
          const headers = (aoa[0] ?? []).map((v) => String(v ?? ''));
          const all = aoa.slice(1).map((r) => r.map((v) => String(v ?? '')));
          const truncated = all.length > MAX_ROWS;
          return { name, headers, rows: truncated ? all.slice(0, MAX_ROWS) : all, truncatedAt: truncated ? MAX_ROWS : null };
        });
        if (!cancelled) setSheets(result);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [src]);

  if (error) return <div className="error">{error}</div>;
  if (!sheets) return <div className="attachment-loading">Parsing spreadsheet…</div>;
  if (sheets.length === 0) return <div className="attachment-loading">Empty workbook.</div>;

  const sheet = sheets[active]!;
  return (
    <div>
      {sheets.length > 1 && (
        <div className="xlsx-tabs">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              className={`xlsx-tab${i === active ? ' xlsx-tab-active' : ''}`}
              onClick={() => setActive(i)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <TablePreview headers={sheet.headers} rows={sheet.rows} truncatedAt={sheet.truncatedAt} />
    </div>
  );
}
