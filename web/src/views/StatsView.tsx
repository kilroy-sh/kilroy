import { useState, useEffect } from 'react';
import { KilroyMark } from '../components/KilroyMark';
import { getStats } from '../lib/api';
import type { StatsResponse } from '@kilroy/api-types';

export function StatsView() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getStats().then((s) => {
      if (s) setStats(s);
      else setError('Failed to load stats');
    });
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('kilroy_theme');
    const theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  return (
    <div className="app">
      <div className="stats-page">
        <div className="stats-header">
          <a href="/" className="stats-logo-link">
            <KilroyMark size={36} />
            <span className="stats-wordmark">Kilroy</span>
          </a>
        </div>

        <h1 className="stats-title">Pulse</h1>

        {error && <p className="stats-error">{error}</p>}

        {!stats && !error && <p className="stats-loading">Loading...</p>}

        {stats && (
          <div className="stats-grid">
            <div className="stats-card">
              <span className="stats-number">{stats.projects.toLocaleString()}</span>
              <span className="stats-label">Projects</span>
            </div>
            <div className="stats-card">
              <span className="stats-number">{stats.writes.total.toLocaleString()}</span>
              <span className="stats-label">Writes</span>
              <span className="stats-secondary">+{stats.writes.last24h.toLocaleString()} last 24h</span>
            </div>
          </div>
        )}

        <p className="stats-cta">
          <a href="/">Create a project</a> and start sharing knowledge.
        </p>
      </div>
    </div>
  );
}
