import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { KilroyMark } from '../components/KilroyMark';
import { InviteCard } from '../components/InviteCard';
import { getJoinInfo } from '../lib/api';

type JoinState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'requires_login' }
  | { kind: 'requires_onboarding' }
  | { kind: 'member'; joined: boolean; install_command: string };

export function JoinView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { accountSlug, projectSlug } = useProject();
  const token = searchParams.get('token');

  const [state, setState] = useState<JoinState>({ kind: 'loading' });

  useEffect(() => {
    if (!token) {
      setState({ kind: 'error', message: 'No token provided. Ask your project admin for the join link.' });
      return;
    }

    getJoinInfo(accountSlug, projectSlug, token)
      .then((d) => {
        if ('requires_login' in d && d.requires_login) {
          sessionStorage.setItem('joinReturnTo', window.location.pathname + window.location.search);
          setState({ kind: 'requires_login' });
        } else if ('requires_onboarding' in d && d.requires_onboarding) {
          sessionStorage.setItem('joinReturnTo', window.location.pathname + window.location.search);
          setState({ kind: 'requires_onboarding' });
        } else if ('already_member' in d && d.already_member) {
          setState({ kind: 'member', joined: false, install_command: d.install_command });
        } else if ('joined' in d && d.joined) {
          setState({ kind: 'member', joined: true, install_command: d.install_command });
        } else {
          throw new Error('Unexpected response from server');
        }
      })
      .catch((e) => {
        setState({ kind: 'error', message: e?.message || 'Something went wrong' });
      });
  }, [token, accountSlug, projectSlug]);

  // Requires onboarding — redirect
  useEffect(() => {
    if (state.kind === 'requires_onboarding') {
      navigate('/onboarding');
    }
  }, [state, navigate]);

  if (state.kind === 'requires_onboarding') {
    return null;
  }

  // Loading
  if (state.kind === 'loading') {
    return (
      <div className="app">
        <div className="landing">
          <div className="landing-header">
            <KilroyMark size={36} />
            <h1 className="landing-title">Kilroy</h1>
          </div>
          <p className="landing-desc">Validating your access...</p>
        </div>
      </div>
    );
  }

  // Error
  if (state.kind === 'error') {
    return (
      <div className="app">
        <div className="landing">
          <div className="landing-header">
            <KilroyMark size={36} />
            <h1 className="landing-title">Kilroy</h1>
          </div>
          <p className="landing-desc">Unable to join. {state.message}</p>
        </div>
      </div>
    );
  }

  // Requires login
  if (state.kind === 'requires_login') {
    return (
      <div className="app">
        <div className="landing">
          <div className="landing-header">
            <KilroyMark size={36} />
            <h1 className="landing-title">Kilroy</h1>
          </div>
          <p className="landing-desc">
            Sign in to join <strong style={{ color: 'var(--text)' }}>{accountSlug}/{projectSlug}</strong>.
          </p>
          <a className="btn" href="/login">Sign in to join</a>
        </div>
      </div>
    );
  }

  // Joined or already a member
  return (
    <div className="app">
      <div className="landing">
        <div className="landing-header">
          <KilroyMark size={36} />
          <h1 className="landing-title">Kilroy</h1>
        </div>

        <div className="join-section">
          <div className="join-section-label">
            {state.joined ? "You've joined!" : "You're already a member"}
          </div>
          <p className="join-section-desc">
            <strong style={{ color: 'var(--text)' }}>{accountSlug}/{projectSlug}</strong>
          </p>

          <InviteCard installCommand={state.install_command} compact />

          <a href={`/${accountSlug}/${projectSlug}/`} className="btn" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Browse project
          </a>
        </div>
      </div>
    </div>
  );
}
