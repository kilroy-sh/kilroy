// Matches both absolute and relative object URLs:
//   /srijan/kdfd/o/019e...                          (relative)
//   https://kilroy.sh/srijan/kdfd/o/019e...         (absolute, same origin)
//   https://other-host/srijan/kdfd/o/019e...        (absolute, other origin)
//
// We don't try to identify cross-origin Kilroy objects — only same-origin
// or path-relative URLs are treated as attachments. Anything else is left
// as a plain link.
const PATH_RE = /^\/([^/]+)\/([^/]+)\/o\/([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

export interface ParsedObjectUrl {
  accountSlug: string;
  projectSlug: string;
  objectId: string;
}

export function parseObjectUrl(href: string): ParsedObjectUrl | null {
  let path = href;
  if (/^https?:\/\//i.test(href)) {
    try {
      const u = new URL(href);
      if (u.origin !== window.location.origin) return null;
      path = u.pathname;
    } catch {
      return null;
    }
  }
  const m = PATH_RE.exec(path);
  if (!m) return null;
  return { accountSlug: m[1]!, projectSlug: m[2]!, objectId: m[3]!.toLowerCase() };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
