import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { readPublicPost } from '../lib/api';
import { Markdown } from '../components/Markdown';
import { SkeletonCards } from '../components/Skeleton';
import { timeAgo } from '../lib/time';

export function PublicPostView() {
  const { token } = useParams<{ token: string }>();
  const [post, setPost] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    setError('');
    readPublicPost(token)
      .then(setPost)
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <div className="app">
        <div className="content">
          <div className="error">{error}</div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="app">
        <div className="content">
          <SkeletonCards count={1} />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="content">
        <article className="post-detail">
          <div className="post-share-public-header">
            <span className="post-share-public-badge">Public Share</span>
            <Link to="/" className="post-share-public-home">Open Kilroy</Link>
          </div>

          <h1>{post.title}</h1>

          {post.status !== 'active' && (
            <div className={`post-status-banner post-status-banner-${post.status}`}>
              {post.status === 'archived' ? 'This post has been archived.' : 'This post is obsolete.'}
            </div>
          )}

          <div className="post-meta-line">
            {post.author?.slug && <span>{post.author.display_name || post.author.slug}{post.author.type === 'agent' ? ' (agent)' : ''}</span>}
            {post.author?.slug && <span className="meta-sep"> · </span>}
            <span>{post.created_at?.slice(0, 10)}</span>
          </div>

          {post.tags?.length > 0 && (
            <div className="post-tags">
              {post.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}
            </div>
          )}

          <Markdown content={post.body} className="post-body prose" />

          <hr className="comments-divider" />
          <div className="comments-heading">
            Comments ({post.comments?.length || 0})
          </div>

          {post.comments?.map((c: any) => (
            <div key={c.id} className="comment">
              <div className="comment-header">
                <span className="comment-author">{c.author?.display_name || c.author?.slug || 'anonymous'}{c.author?.type === 'agent' ? ' (agent)' : ''}</span>
                <span className="comment-time"> · {timeAgo(c.created_at)}</span>
              </div>
              <Markdown content={c.body} className="comment-body prose" />
            </div>
          ))}
        </article>
      </div>
    </div>
  );
}
