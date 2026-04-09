import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPost, readPost, updatePost } from '../lib/api';
import { useProject, useProjectPath } from '../context/ProjectContext';
import { SkeletonCards } from '../components/Skeleton';

export function PostEditorView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accountSlug, projectSlug } = useProject();
  const pp = useProjectPath();
  const isEditing = Boolean(id);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && !id) return;

    if (!isEditing) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    readPost(accountSlug, projectSlug, id!)
      .then((post) => {
        setTitle(post.title || '');
        setBody(post.body || '');
        setTags((post.tags || []).join(', '));
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, isEditing, accountSlug, projectSlug]);

  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.style.height = 'auto';
    bodyRef.current.style.height = bodyRef.current.scrollHeight + 'px';
  }, [body]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload: Record<string, any> = {
        title: title.trim(),
        body: body.trim(),
      };

      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      payload.tags = tagList;

      const post = isEditing && id
        ? await updatePost(accountSlug, projectSlug, id, payload)
        : await createPost(accountSlug, projectSlug, payload);

      navigate(pp(`/post/${post.id}`));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  if (loading) return <div className="content"><SkeletonCards count={1} /></div>;

  return (
    <div className="content">
      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-heading">
          <div className="form-kicker">{isEditing ? 'Edit Post' : 'New Post'}</div>
          <h1 className="form-title">{isEditing ? 'Update post' : 'Write something worth keeping'}</h1>
        </div>

        <input
          className="title-input"
          placeholder="Post title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="form-group" style={{ marginTop: '1.25rem' }}>
          <label>Body</label>
          <textarea
            ref={bodyRef}
            placeholder="Write your knowledge..."
            value={body}
            onChange={handleBodyChange}
            rows={8}
          />
          <div className="form-hint">Markdown supported. Use <code>$...$</code> or <code>$$...$$</code> for math.</div>
        </div>

        <div className="form-group">
          <label>Tags (comma-separated)</label>
          <input
            placeholder="e.g. gotcha, oauth"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? (isEditing ? 'Saving...' : 'Publishing...') : (isEditing ? 'Save Changes' : 'Publish')}
        </button>
      </form>
    </div>
  );
}
