import { useEffect, useState } from 'react';
import { Markdown } from '../Markdown';

interface Props { src: string; }

export function MarkdownPreview({ src }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(src, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to fetch markdown: ${res.status}`);
        return res.text();
      })
      .then((text) => { if (!cancelled) setContent(text); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [src]);

  if (error) return <div className="error">{error}</div>;
  if (content === null) return <div className="attachment-loading">Loading…</div>;
  return <Markdown content={content} className="prose" />;
}
