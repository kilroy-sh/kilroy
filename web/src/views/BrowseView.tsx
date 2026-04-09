import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { browse, getProjectInfo } from '../lib/api';
import { useProject, useProjectPath } from '../context/ProjectContext';
import { SkeletonCards, EmptyState } from '../components/Skeleton';
import { KilroyMark } from '../components/KilroyMark';
import { InviteCard } from '../components/InviteCard';
import { PostCard } from '../components/PostCard';
import { timeAgo } from '../lib/time';

export function BrowseView({ onTopicChange }: { onTopicChange: (t: string) => void }) {
  const params = useParams();
  const topic = (params['*'] || '').replace(/\/$/, '');
  const navigate = useNavigate();
  const { accountSlug, projectSlug } = useProject();
  const pp = useProjectPath();

  const [data, setData] = useState<any>(null);
  const [nestedPosts, setNestedPosts] = useState<any[] | null>(null);
  const [status, setStatus] = useState('active');
  const [sort, setSort] = useState('updated_at');
  const [error, setError] = useState('');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const sortOptions = [
    { value: 'updated_at', label: 'Updated' },
    { value: 'created_at', label: 'Created' },
    { value: 'title', label: 'Title' },
  ];

  useEffect(() => { onTopicChange(topic); }, [topic]);

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
    setData(null);
    setNestedPosts(null);

    const queryParams: Record<string, string> = {};
    if (topic) queryParams.topic = topic;
    if (status !== 'active') queryParams.status = status;
    if (sort !== 'updated_at') queryParams.order_by = sort;

    async function load() {
      try {
        const browseData = await browse(accountSlug, projectSlug, queryParams);
        if (cancelled) return;
        setData(browseData);

        const needsNestedPosts =
          (browseData.posts?.length || 0) === 0 &&
          (browseData.subtopics?.length || 0) > 0;

        if (!needsNestedPosts) return;

        try {
          const recursiveData = await browse(accountSlug, projectSlug, {
            ...queryParams,
            recursive: 'true',
            limit: '12',
          });
          if (cancelled) return;
          setNestedPosts(recursiveData.posts || []);
        } catch {
          if (cancelled) return;
          setNestedPosts([]);
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [accountSlug, projectSlug, topic, status, sort]);

  if (error) return <div className="content"><div className="error">{error}</div></div>;
  if (!data) return <div className="content"><SkeletonCards count={5} /></div>;

  const hasContent = (data.subtopics?.length || 0) + (data.posts?.length || 0) > 0;
  const nestedPostCount = nestedPosts?.length || 0;
  const showNestedPosts = nestedPostCount > 0;

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
          onClick={() => navigate(pp(`/post/new${topic ? `?topic=${encodeURIComponent(topic)}` : ''}`))}
        >
          + New Post
        </button>
      </div>

      {showNestedPosts && (
        <div className="browse-section-heading">
          Recent posts
        </div>
      )}

      {showNestedPosts && nestedPosts?.map((p: any) => (
        <PostCard
          key={p.id}
          post={p}
          onClick={() => navigate(pp(`/post/${p.id}`))}
          showTopic
        />
      ))}

      {data.posts?.map((p: any) => (
        <PostCard
          key={p.id}
          post={p}
          onClick={() => navigate(pp(`/post/${p.id}`))}
        />
      ))}

      {(data.subtopics?.length || 0) > 0 && (
        <div className="browse-section-heading">
          Topics
        </div>
      )}

      {data.subtopics?.map((st: any) => (
        <div
          key={st.name}
          className="card folder-card"
          onClick={() => navigate(pp(`/browse/${topic ? topic + '/' : ''}${st.name}/`))}
        >
          <div className="card-title">{st.name}/</div>
          <div className="card-meta">
            {st.post_count} {st.post_count === 1 ? 'post' : 'posts'}
            {' · '}
            {st.contributor_count} {st.contributor_count === 1 ? 'contributor' : 'contributors'}
            {st.updated_at && <> · {timeAgo(st.updated_at)}</>}
          </div>
          {st.tags?.length > 0 && (
            <div className="card-tags">
              {st.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}
            </div>
          )}
        </div>
      ))}

      {!hasContent && !topic && <WelcomeEmptyState />}
      {!hasContent && topic && (
        <EmptyState
          title="No one's been here yet."
          message="Be the first to leave a note."
          actionLabel="Create the first post"
          onAction={() => navigate(pp(`/post/new?topic=${encodeURIComponent(topic)}`))}
        />
      )}
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
