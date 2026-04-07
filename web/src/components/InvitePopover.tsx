import { useState, useEffect, useRef } from 'react';
import { getProjectInfo } from '../lib/api';
import { useProject } from '../context/ProjectContext';
import { InviteCard } from './InviteCard';

export function InvitePopover() {
  const { accountSlug, projectSlug } = useProject();
  const [joinLink, setJoinLink] = useState<string | null>(null);
  const [installCommand, setInstallCommand] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const inviteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getProjectInfo(accountSlug, projectSlug)
      .then((info) => {
        setJoinLink(info?.invite_link || null);
        setInstallCommand(info?.install_command || null);
      })
      .catch(() => {});
  }, [accountSlug, projectSlug]);

  useEffect(() => {
    if (!inviteOpen) return;
    const handler = (e: MouseEvent) => {
      if (inviteRef.current && !inviteRef.current.contains(e.target as Node)) {
        setInviteOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [inviteOpen]);

  if (!joinLink && !installCommand) return null;

  return (
    <div className="invite-wrapper" ref={inviteRef}>
      <button
        className="invite-btn"
        onClick={() => setInviteOpen((o) => !o)}
        title="Invite others"
      >
        + Invite
      </button>
      {inviteOpen && (
        <div className="invite-popover">
          <InviteCard installCommand={installCommand} joinLink={joinLink} />
        </div>
      )}
    </div>
  );
}
