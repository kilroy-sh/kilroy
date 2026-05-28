import { useState } from 'react';
import { Icon } from '@iconify/react';
import { AttachmentModal } from './AttachmentModal';

interface Props {
  href: string;
  label: string | null;
}

// Sandboxed iframe embedding an HTML attachment. Intentionally no
// allow-same-origin — the iframe runs in an opaque origin and cannot reach
// the host page's cookies, storage, or DOM. The server also returns
// `Content-Security-Policy: sandbox allow-scripts allow-forms allow-popups`
// on text/html objects so direct navigation is sandboxed too.
const SANDBOX = 'allow-scripts allow-forms allow-popups';

export function WidgetEmbed({ href, label }: Props) {
  const [open, setOpen] = useState(false);
  const title = label && label.trim() ? label : 'Widget';

  return (
    <>
      <div className="widget-embed">
        <iframe
          src={href}
          sandbox={SANDBOX}
          title={title}
          className="widget-embed-frame"
          loading="lazy"
        />
        <button
          type="button"
          className="widget-embed-expand"
          onClick={() => setOpen(true)}
          aria-label="Expand widget"
          title="Expand"
        >
          <Icon icon="mdi:arrow-expand" />
        </button>
      </div>
      {open && (
        <AttachmentModal
          title={title}
          onClose={() => setOpen(false)}
          downloadHref={href}
          downloadName={null}
        >
          <iframe
            src={href}
            sandbox={SANDBOX}
            title={title}
            className="widget-embed-frame-modal"
          />
        </AttachmentModal>
      )}
    </>
  );
}
