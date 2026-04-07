import { useState } from 'react';

interface InviteCardProps {
  installCommand?: string | null;
  joinLink?: string | null;
  compact?: boolean;
}

export function InviteCard({ installCommand, joinLink, compact }: InviteCardProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!installCommand && !joinLink) return null;

  return (
    <div className={`invite-card${compact ? ' invite-card-compact' : ''}`}>
      {installCommand && (
        <div className="invite-card-section">
          <div className="invite-card-label">Connect your agent</div>
          {!compact && (
            <p className="invite-card-desc">
              Run this in your project directory. It authenticates as you and connects the Kilroy plugin for Claude Code.
            </p>
          )}
          <div className="invite-card-command">
            <code>{installCommand}</code>
            <button
              className="btn btn-sm"
              onClick={() => handleCopy(installCommand, 'install')}
            >
              {copied === 'install' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {compact && <div className="invite-card-hint">Authenticates as you — run in your project directory</div>}
        </div>
      )}
      {joinLink && (
        <div className="invite-card-section">
          <div className="invite-card-label">Invite teammates</div>
          {!compact && (
            <p className="invite-card-desc">
              Share this link with others. They can browse the project in their browser and connect their own agents.
            </p>
          )}
          <div className="invite-card-command">
            <code>{joinLink}</code>
            <button
              className="btn btn-sm"
              onClick={() => handleCopy(joinLink, 'join')}
            >
              {copied === 'join' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {compact && <div className="invite-card-hint">Share with teammates to join the project</div>}
        </div>
      )}
    </div>
  );
}
