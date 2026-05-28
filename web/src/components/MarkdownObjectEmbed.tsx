import { useEffect, useState } from 'react';
import type { ObjectMeta } from '@kilroy/api-types';
import { headObject } from '../lib/api';
import { MarkdownImage } from './MarkdownImage';
import { WidgetEmbed } from './WidgetEmbed';
import { AttachmentChip } from './AttachmentChip';

interface Props {
  accountSlug: string;
  projectSlug: string;
  objectId: string;
  href: string;
  alt: string;
  title: string | null;
}

// Dispatcher for image-syntax markdown pointing at a Kilroy object URL.
// HEADs the object to learn its mime, then routes:
//   text/html  → WidgetEmbed   (sandboxed iframe + expand-to-modal)
//   image/*    → MarkdownImage (inline <img> + zoom modal)
//   other      → AttachmentChip (fallback to the chip+preview path)
//
// While the HEAD is in flight we render nothing — the request is small and
// avoids a flash-of-wrong-component for the common case.
export function MarkdownObjectEmbed({
  accountSlug,
  projectSlug,
  objectId,
  href,
  alt,
  title,
}: Props) {
  const [meta, setMeta] = useState<ObjectMeta | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    headObject(accountSlug, projectSlug, objectId)
      .then((m) => { if (!cancelled) setMeta(m); })
      .catch(() => { if (!cancelled) setErrored(true); });
    return () => { cancelled = true; };
  }, [accountSlug, projectSlug, objectId]);

  if (errored) {
    return (
      <AttachmentChip
        accountSlug={accountSlug}
        projectSlug={projectSlug}
        objectId={objectId}
        href={href}
        label={alt || null}
      />
    );
  }
  if (!meta) return null;

  const mime = meta.mime.toLowerCase();
  if (mime === 'text/html' || mime.startsWith('text/html;')) {
    return <WidgetEmbed href={href} label={alt || title || meta.filename} />;
  }
  if (mime.startsWith('image/')) {
    return <MarkdownImage src={href} alt={alt} title={title} />;
  }
  return (
    <AttachmentChip
      accountSlug={accountSlug}
      projectSlug={projectSlug}
      objectId={objectId}
      href={href}
      label={alt || null}
    />
  );
}
