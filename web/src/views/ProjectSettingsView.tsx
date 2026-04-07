import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjectInfo, listMembers, removeMemberApi, regenerateInviteLinkApi, regenerateKeyApi } from '../lib/api';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { InviteCard } from '../components/InviteCard';

interface MemberInfo {
  account_id: string;
  slug: string;
  display_name: string;
  role: string;
  joined_at: string;
}

export function ProjectSettingsView() {
  const { accountSlug, projectSlug } = useProject();
  const { account } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState<any>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [error, setError] = useState('');
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const isOwner = account?.slug === accountSlug;

  useEffect(() => {
    getProjectInfo(accountSlug, projectSlug)
      .then((data) => {
        setInfo(data);
        // Load members if we have the project_id
        if (data.project_id) {
          listMembers(data.project_id)
            .then((d) => setMembers(d.members || []))
            .catch(() => {});
        }
      })
      .catch((e) => setError(e.message));
  }, [accountSlug, projectSlug]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRemoveMember = async (targetAccountId: string) => {
    if (!info?.project_id) return;
    try {
      await removeMemberApi(info.project_id, targetAccountId);
      setMembers((prev) => prev.filter((m) => m.account_id !== targetAccountId));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRegenerateInvite = async () => {
    if (!info?.project_id) return;
    try {
      const result = await regenerateInviteLinkApi(info.project_id);
      // Rebuild invite link from returned token
      const projectUrl = `${window.location.origin}/${accountSlug}/${projectSlug}`;
      setInfo((prev: any) => ({
        ...prev,
        invite_link: `${projectUrl}/join?token=${result.invite_token}`,
      }));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRegenerateKey = async () => {
    if (!info?.project_id) return;
    try {
      const result = await regenerateKeyApi(info.project_id);
      const projectUrl = `${window.location.origin}/${accountSlug}/${projectSlug}`;
      setInfo((prev: any) => ({
        ...prev,
        member_key: result.member_key,
        install_command: `curl -sL "${projectUrl}/install?key=${result.member_key}" | sh`,
      }));
      setKeyRevealed(true);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="content">
      <div className="form-heading">
        <div className="form-kicker">Settings</div>
        <h1 className="form-title">{accountSlug}/{projectSlug}</h1>
      </div>

      {error && <div className="error">{error}</div>}

      {info && (
        <>
          {info.member_key && (
            <div className="setup-block">
              <div className="setup-block-label">Your Project Key</div>
              <div className="setup-block-content">
                <code>
                  {keyRevealed ? info.member_key : info.member_key.slice(0, 12) + '••••••••••••••••••••'}
                </code>
                <button className="btn" onClick={() => setKeyRevealed((r) => !r)}>
                  {keyRevealed ? 'Hide' : 'Reveal'}
                </button>
                {keyRevealed && (
                  <>
                    <button className="btn" onClick={() => handleCopy(info.member_key, 'key')}>
                      {copied === 'key' ? 'Copied!' : 'Copy'}
                    </button>
                    <button className="btn" onClick={handleRegenerateKey}>
                      Regenerate
                    </button>
                  </>
                )}
              </div>
              <div className="setup-block-hint">Your personal key for agent access. Regenerating invalidates the old one.</div>
            </div>
          )}

          <InviteCard
            installCommand={info.install_command}
            joinLink={isOwner ? info.invite_link : null}
            onRegenerateInvite={isOwner ? handleRegenerateInvite : undefined}
          />

          {members.length > 0 && (
            <div className="setup-block">
              <div className="setup-block-label">Members ({members.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {members.map((m) => (
                  <div key={m.account_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--warm-gray, #8C7E72)22' }}>
                    <span style={{ flex: 1 }}>
                      <strong>{m.display_name}</strong> <span style={{ opacity: 0.6 }}>({m.slug})</span>
                    </span>
                    <span style={{ fontSize: '0.85em', opacity: 0.6 }}>{m.role}</span>
                    {isOwner && m.role !== 'owner' && (
                      <button className="btn" style={{ fontSize: '0.85em' }} onClick={() => handleRemoveMember(m.account_id)}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: '2rem' }}>
        <button className="btn" onClick={() => navigate(-1)}>Back</button>
      </div>
    </div>
  );
}
