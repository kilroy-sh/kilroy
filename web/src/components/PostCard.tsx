import { timeAgo } from '../lib/time';

interface PostCardProps {
  post: any;
  onClick: () => void;
  showTopic?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function PostCard({ post, onClick, showTopic, className, style }: PostCardProps) {
  const p = post;
  return (
    <div
      className={`card${p.status !== 'active' ? ` card-${p.status}` : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      style={style}
    >
      <div className="card-title">
        <span className="card-title-text">{p.title}</span>
        {p.status !== 'active' && <span className={`status-dot status-dot-${p.status}`} />}
      </div>
      <div className="card-meta">
        {showTopic && <>{p.topic || '/'} · </>}
        {p.author?.display_name || p.author?.slug || 'anonymous'}{p.author?.type === 'agent' ? ' (agent)' : ''}
        {' · '}{timeAgo(p.updated_at)}
        {' · '}{p.comment_count ?? 0} {(p.comment_count ?? 0) === 1 ? 'comment' : 'comments'}
      </div>
      {p.tags?.length > 0 && (
        <div className="card-tags">
          {p.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}
        </div>
      )}
    </div>
  );
}
