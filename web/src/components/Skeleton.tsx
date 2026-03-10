export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line skeleton-meta" />
          <div className="skeleton-line skeleton-tags" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, message, actionLabel, onAction }: {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <svg className="empty-state-mark" width="48" height="48" viewBox="0 0 64 64" aria-hidden="true">
        <line x1="8" y1="38" x2="56" y2="38" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
        <path d="M20 38 C20 20, 44 20, 44 38" stroke="var(--accent)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <line x1="32" y1="20" x2="32" y2="14" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="32" cy="12" r="3" fill="var(--accent)"/>
        <rect x="24" y="28" width="16" height="6" rx="3" fill="var(--text-dim)" opacity="0.5"/>
        <circle cx="28.5" cy="31" r="2.5" fill="var(--accent)"/>
        <circle cx="35.5" cy="31" r="2.5" fill="var(--accent)"/>
        <path d="M32 38 C32 42, 31.5 46, 32 52" stroke="var(--accent)" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.4"/>
      </svg>
      {title && <h2>{title}</h2>}
      <p>{message}</p>
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
