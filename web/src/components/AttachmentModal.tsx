import { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';

interface Props {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  downloadHref: string;
  downloadName: string | null;
}

export function AttachmentModal({ title, children, onClose, downloadHref, downloadName }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div className="attachment-modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="attachment-modal"
        role="dialog"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="attachment-modal-header">
          <h2 className="attachment-modal-title">{title}</h2>
          <div className="attachment-modal-actions">
            <a className="text-action" href={downloadHref} download={downloadName ?? undefined}>
              <Icon icon="mdi:download" /> Download
            </a>
            <button className="text-action" onClick={onClose} aria-label="Close">
              <Icon icon="mdi:close" />
            </button>
          </div>
        </header>
        <div className="attachment-modal-body">{children}</div>
      </div>
    </div>
  );
}
