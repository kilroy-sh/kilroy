import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KilroyMark } from '../components/KilroyMark';

export function OnboardingView() {
  const { user, account, loading, refreshAccount } = useAuth();
  const navigate = useNavigate();
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/login'); return; }
    if (account) { navigate('/projects'); return; }

    // Fetch slug suggestion
    fetch('/api/account/slug-suggestion', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.suggestion) setSlug(d.suggestion); })
      .catch(() => {});
  }, [user, account, loading]);

  const slugPattern = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleaned = slug.trim().toLowerCase();

    if (!slugPattern.test(cleaned)) {
      setError('3-40 characters, lowercase letters, numbers, and hyphens.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug: cleaned }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create account');
        setSubmitting(false);
        return;
      }

      await refreshAccount();
      navigate('/projects');
    } catch {
      setError('Failed to connect to server');
      setSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className="app">
      <div className="landing">
        <div className="landing-header">
          <KilroyMark size={36} />
          <h1 className="landing-title">Choose your username</h1>
        </div>
        <p className="landing-desc">
          This will be your namespace for projects. Your projects will live at
          <code style={{ marginLeft: '0.25rem' }}>kilroy.sh/{slug || '...'}/project-name</code>
        </p>
        <form className="landing-bar" onSubmit={handleSubmit}>
          <input
            className="landing-bar-input"
            type="text"
            value={slug}
            onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setError(''); }}
            placeholder="your-username"
            autoComplete="off"
            spellCheck={false}
            disabled={submitting}
          />
          <button type="submit" className="landing-bar-btn" disabled={submitting || !slug.trim()}>
            {submitting ? 'Creating...' : 'Continue'}
          </button>
          {error && <p className="landing-error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
