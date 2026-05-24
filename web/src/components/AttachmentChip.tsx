import { lazy, Suspense, useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { Icon } from '@iconify/react';
import type { ObjectMeta } from '@kilroy/api-types';
import { headObject } from '../lib/api';
import { formatBytes } from '../lib/objectUrl';
import { AttachmentModal } from './AttachmentModal';

const PdfPreview = lazy(() => import('./previews/PdfPreview').then((m) => ({ default: m.PdfPreview })));
const MarkdownPreview = lazy(() => import('./previews/MarkdownPreview').then((m) => ({ default: m.MarkdownPreview })));
const CsvPreview = lazy(() => import('./previews/CsvPreview').then((m) => ({ default: m.CsvPreview })));
const XlsxPreview = lazy(() => import('./previews/XlsxPreview').then((m) => ({ default: m.XlsxPreview })));

type PreviewKind = 'pdf' | 'markdown' | 'csv' | 'xlsx' | 'download';

function extOf(filename: string | null): string {
  if (!filename) return '';
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
}

export function dispatchPreview(mime: string, filename: string | null): PreviewKind {
  const ext = extOf(filename);
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime === 'text/markdown' || ext === 'md' || ext === 'markdown') return 'markdown';
  if (mime === 'text/csv' || ext === 'csv' || ext === 'tsv') return 'csv';
  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel' ||
    ext === 'xlsx' ||
    ext === 'xls'
  )
    return 'xlsx';
  return 'download';
}

function iconFor(kind: PreviewKind): string {
  switch (kind) {
    case 'pdf': return 'mdi:file-pdf-box';
    case 'markdown': return 'mdi:language-markdown';
    case 'csv': return 'mdi:file-delimited-outline';
    case 'xlsx': return 'mdi:file-excel-outline';
    default: return 'mdi:file-outline';
  }
}

interface Props {
  accountSlug: string;
  projectSlug: string;
  objectId: string;
  href: string;
  label: string | null;
}

export function AttachmentChip({ accountSlug, projectSlug, objectId, href, label }: Props) {
  const [meta, setMeta] = useState<ObjectMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    headObject(accountSlug, projectSlug, objectId)
      .then((m) => { if (!cancelled) setMeta(m); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [accountSlug, projectSlug, objectId]);

  const kind = meta ? dispatchPreview(meta.mime, meta.filename) : 'download';
  const displayName = meta?.filename ?? label ?? `${objectId.slice(0, 8)}…`;

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!meta) return;
    if (kind === 'download') return; // let the anchor default download proceed
    e.preventDefault();
    setOpen(true);
  };

  return (
    <>
      <a
        href={href}
        className={`attachment-chip${error ? ' attachment-chip-error' : ''}`}
        onClick={handleClick}
        download={kind === 'download' ? (meta?.filename ?? undefined) : undefined}
        target={kind === 'download' ? undefined : '_self'}
        rel="noopener"
      >
        <Icon icon={iconFor(kind)} className="attachment-chip-icon" />
        <span className="attachment-chip-name">{displayName}</span>
        {meta && <span className="attachment-chip-meta">{formatBytes(meta.size_bytes)}</span>}
        {error && <span className="attachment-chip-meta">unavailable</span>}
      </a>
      {open && meta && (
        <AttachmentModal title={displayName} onClose={() => setOpen(false)} downloadHref={href} downloadName={meta.filename}>
          <Suspense fallback={<div className="attachment-loading">Loading preview…</div>}>
            {kind === 'pdf' && <PdfPreview src={href} />}
            {kind === 'markdown' && <MarkdownPreview src={href} />}
            {kind === 'csv' && <CsvPreview src={href} />}
            {kind === 'xlsx' && <XlsxPreview src={href} />}
          </Suspense>
        </AttachmentModal>
      )}
    </>
  );
}
