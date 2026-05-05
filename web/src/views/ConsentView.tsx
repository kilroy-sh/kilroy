import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { KilroyMark } from '../components/KilroyMark';
import { oauthConsent } from '../lib/api';

export function ConsentView() {
  const { user, account, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConsent = async () => {
    setSubmitting(true);
    setError('');
    try {
      const data = await oauthConsent({
        accept: true,
        oauth_query: window.location.search.slice(1),
      });

      const redirectUrl = data.url || data.redirectTo;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        setError('No redirect URL in response');
        setSubmitting(false);
      }
    } catch (e: any) {
      setError(e?.message || 'Network error');
      setSubmitting(false);
    }
  };

  if (loading) return null;

  if (!user || !account) {
    window.location.href = `/login?callbackURL=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return null;
  }

  return (
    <div className="app">
      <div className="landing">
        <div className="landing-header">
          <KilroyMark size={28} />
          <h1 className="consent-title">Connect to Kilroy</h1>
        </div>

        <p className="landing-desc">
          Allow your agent to read and write to your Kilroy projects.
        </p>

        {error && <p className="landing-error consent-error">{error}</p>}

        <button
          className="login-btn login-btn-github consent-submit"
          onClick={handleConsent}
          disabled={submitting}
        >
          {submitting ? 'Connecting...' : 'Allow'}
        </button>
      </div>
    </div>
  );
}
