import { lazy, Suspense, useState } from 'react';
import { AttachmentModal } from './AttachmentModal';

const ImagePreview = lazy(() => import('./previews/ImagePreview').then((m) => ({ default: m.ImagePreview })));

interface Props {
  src: string;
  alt: string;
  title: string | null;
}

export function MarkdownImage({ src, alt, title }: Props) {
  const [open, setOpen] = useState(false);
  const displayTitle = title || alt || 'Image';
  return (
    <>
      <img
        src={src}
        alt={alt}
        title={title ?? undefined}
        className="markdown-image"
        onClick={() => setOpen(true)}
      />
      {open && (
        <AttachmentModal
          title={displayTitle}
          onClose={() => setOpen(false)}
          downloadHref={src}
          downloadName={null}
        >
          <Suspense fallback={<div className="attachment-loading">Loading preview…</div>}>
            <ImagePreview src={src} alt={alt} />
          </Suspense>
        </AttachmentModal>
      )}
    </>
  );
}
