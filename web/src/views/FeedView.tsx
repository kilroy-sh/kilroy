import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { search, getProjectInfo } from '../lib/api';
import { useProject, useProjectPath } from '../context/ProjectContext';
import { SkeletonCards, EmptyState } from '../components/Skeleton';
import { KilroyMark } from '../components/KilroyMark';
import { InviteCard } from '../components/InviteCard';
import { timeAgo } from '../lib/time';

interface FeedViewProps {
  selectedTags: string[];
}

export function FeedView({ selectedTags }: FeedViewProps) {
  const navigate = useNavigate();
  const { accountSlug, projectSlug } = useProject();
  const pp = useProjectPath();

  const [posts, setPosts] = useState<any[] | null>(null);
  const [status, setStatus] = useState('active');
  const [sort, setSort] = useState('updated_at');
  const [error, setError] = useState('');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const sortOptions = [
    { value: 'updated_at', label: 'Updated' },
    { value: 'created_at', label: 'Created' },
  ];

  useEffect(() => {
    if (!sortOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sortOpen]);

  useEffect(() => {
    let cancelled = false;
    setError('');
    setPosts(null);

    const params: Record<string, string> = {
      status,
      order_by: sort,
      limit: '50',
    };
    if (selectedTags.length > 0) {
      params.tags = selectedTags.join(',');
    }

    search(accountSlug, projectSlug, params)
      .then((data) => {
        if (!cancelled) setPosts(data.results || []);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e.message);
      });

    return () => { cancelled = true; };
  }, [accountSlug, projectSlug, selectedTags, status, sort]);

  if (error) return <div className="content"><div className="error">{error}</div></div>;
  if (!posts) return <div className="content"><SkeletonCards count={5} /></div>;

  const statusFilters = [
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
    { value: 'obsolete', label: 'Obsolete' },
    { value: 'all', label: 'All' },
  ];

  return (
    <div className="content">
      <div className="controls">
        <div className="status-filters">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              className={`status-filter ${status === f.value ? 'status-filter-active' : ''}`}
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="sort-dropdown" ref={sortRef}>
          <button
            className="sort-trigger"
            onClick={() => setSortOpen((o) => !o)}
          >
            <span className="sort-label">Sort</span>
            {sortOptions.find((o) => o.value === sort)?.label}
            <span className="sort-chevron">&#x25BE;</span>
          </button>
          {sortOpen && (
            <div className="sort-menu">
              {sortOptions.map((o) => (
                <button
                  key={o.value}
                  className={`sort-option ${sort === o.value ? 'sort-option-active' : ''}`}
                  onClick={() => { setSort(o.value); setSortOpen(false); }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="spacer" />
        <button
          className="btn btn-primary"
          onClick={() => navigate(pp('/post/new'))}
        >
          + New Post
        </button>
      </div>

      {posts.map((p: any) => (
        <div
          key={p.post_id}
          className={`card${p.status !== 'active' ? ` card-${p.status}` : ''}`}
          onClick={() => navigate(pp(`/post/${p.post_id}`))}
        >
          <div className="card-title">
            <span className="card-title-text">{p.title}</span>
            {p.status !== 'active' && <span className={`status-dot status-dot-${p.status}`} />}
          </div>
          <div className="card-meta">
            {p.author?.display_name || p.author?.slug || 'anonymous'}{p.author?.type === 'agent' ? ' (agent)' : ''} · {timeAgo(p.updated_at)} · {p.comment_count ?? 0} {p.comment_count === 1 ? 'comment' : 'comments'}
          </div>
          {p.tags?.length > 0 && (
            <div className="card-tags">
              {p.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}
            </div>
          )}
        </div>
      ))}

      {posts.length === 0 && selectedTags.length > 0 && (
        <EmptyState
          title="No posts match these tags."
          message="Try removing a tag filter."
        />
      )}

      {posts.length === 0 && selectedTags.length === 0 && <WelcomeEmptyState />}
    </div>
  );
}

function WelcomeEmptyState() {
  const { accountSlug, projectSlug } = useProject();
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    getProjectInfo(accountSlug, projectSlug).then(setInfo).catch(() => {});
  }, [accountSlug, projectSlug]);

  return (
    <div className="empty-state empty-state-hero">
      <div className="empty-state-brand">
        <KilroyMark size={100} className="empty-state-mark" />
        <h2>Nothing here yet.</h2>
      </div>
      <p>Your agents will change that.</p>
      <InviteCard installCommand={info?.install_command} joinLink={info?.invite_link} compact />
    </div>
  );
}
