import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTeam, useTeamPath } from '../context/TeamContext';
import { joinTeam } from '../lib/api';
import { trackTeam } from '../lib/teams';
import { KilroyMark } from '../components/KilroyMark';

export function JoinView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const team = useTeam();
  const tp = useTeamPath();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'validating' | 'success' | 'error'>('validating');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('No token provided. Ask your team admin for the join link.');
      return;
    }

    joinTeam(team, token)
      .then((d) => {
        trackTeam(team);
        setData(d);
        setStatus('success');
      })
      .catch((e) => {
        setStatus('error');
        setError(e.message || 'Invalid token');
      });
  }, [token, team]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  if (status === 'validating') {
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

  if (status === 'error') {
    return (
      <div className="app">
        <div className="landing">
          <div className="landing-header">
            <KilroyMark size={36} />
            <h1 className="landing-title">Kilroy</h1>
          </div>
          <p className="landing-desc">Unable to join. {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="landing">
        <div className="landing-header">
          <KilroyMark size={36} />
          <h1 className="landing-title">Kilroy <span className="landing-tagline">&mdash; you're in.</span></h1>
        </div>

        <p className="landing-desc">
          Welcome to <strong style={{ color: 'var(--text)' }}>{team}</strong>.
          Now let's connect your agent so it can read and write to this team's shared knowledge.
        </p>

        {/* Zone 1: Install command with explanation */}
        <div className="join-section">
          <div className="join-section-label">Set up your agent</div>
          <p className="join-section-desc">
            This installs the Kilroy plugin for Claude Code. It connects your agent
            to <strong>{team}</strong> so anything it learns gets shared with the team.
          </p>
          <p className="join-instruction">Run in your project directory:</p>

          {data?.install_command && (
            <div className="join-command">
              <code>{data.install_command}</code>
              <button
                className="btn"
                onClick={() => handleCopy(data.install_command, 'install')}
              >
                {copied === 'install' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}

          <p className="join-hint">Then start a new Claude Code session. That's it.</p>
        </div>

        {/* Zone 2: Invite link */}
        <div className="join-section">
          <div className="join-section-label">Invite teammates</div>
          <p className="join-section-desc">
            Anyone with this link can join <strong>{team}</strong> and connect their own agents.
          </p>
          <div className="join-command">
            <code>{window.location.href}</code>
            <button
              className="btn"
              onClick={() => handleCopy(window.location.href, 'invite')}
            >
              {copied === 'invite' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Zone 3: Browse */}
        <a
          className="join-browse"
          href={tp('/')}
          onClick={(e) => { e.preventDefault(); navigate(tp('/')); }}
        >
          Browse {team} <span className="join-browse-arrow">&rarr;</span>
        </a>
      </div>
    </div>
  );
}
