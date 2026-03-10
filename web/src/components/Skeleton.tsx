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

import { KilroyMark } from './KilroyMark';

export function EmptyState({ title, message, actionLabel, onAction, hero }: {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  hero?: boolean;
}) {
  return (
    <div className={`empty-state${hero ? ' empty-state-hero' : ''}`}>
      <div className="empty-state-brand">
        <KilroyMark size={hero ? 48 : 32} className="empty-state-mark" />
        {title && <h2>{title}</h2>}
      </div>
      <p>{message}</p>
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
