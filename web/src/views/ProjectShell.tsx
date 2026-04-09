import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useParams, Navigate } from 'react-router-dom';
import { ProjectProvider } from '../context/ProjectContext';
import { trackProject } from '../lib/projects';
import { Omnibar } from '../components/Omnibar';
import { TagSidebar } from '../components/TagSidebar';
import { AuthorPrompt } from '../components/AuthorPrompt';
import { InvitePopover } from '../components/InvitePopover';
import { Navbar } from '../components/Navbar';
import { FeedView } from './FeedView';
import { PostView } from './PostView';
import { SearchView } from './SearchView';
import { PostEditorView } from './NewPostView';
import { JoinView } from './JoinView';
import { ProjectSettingsView } from './ProjectSettingsView';

function useSidebarState(key: string) {
  const storageKey = `kilroy:sidebar:${key}`;
  const [expanded, setExpanded] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored === null ? true : stored === 'true';
  });

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      localStorage.setItem(storageKey, String(!prev));
      return !prev;
    });
  }, [storageKey]);

  return { expanded, toggle };
}

export function ProjectShell() {
  const { account, project } = useParams();

  useEffect(() => {
    if (account && project) trackProject(account, project);
  }, [account, project]);

  if (!account || !project) return null;

  return (
    <ProjectProvider accountSlug={account} projectSlug={project}>
      <Routes>
        <Route path="join" element={<JoinView />} />
        <Route path="*" element={
          <ProjectLayout
            key={`${account}/${project}`}
            account={account}
            project={project}
          />
        } />
      </Routes>
    </ProjectProvider>
  );
}

function ProjectLayout({ account, project }: {
  account: string;
  project: string;
}) {
  const { expanded, toggle } = useSidebarState(`${account}/${project}`);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Keyboard shortcut: Cmd+\ or Ctrl+\ to toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '\\' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  const addTag = useCallback((tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev : [...prev, tag]);
  }, []);

  const removeTag = useCallback((tag: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
  }, []);

  return (
    <div className="app">
      <AuthorPrompt />
      <Navbar actions={<InvitePopover />}>
        <button
          className={`sidebar-toggle-btn${expanded ? ' sidebar-open' : ''}`}
          onClick={toggle}
          title={expanded ? 'Collapse sidebar (⌘\\)' : 'Expand sidebar (⌘\\)'}
          aria-label="Toggle sidebar"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="1" y="2" width="16" height="14" rx="2" />
            <line x1="6.5" y1="2" x2="6.5" y2="16" />
            <line x1="3" y1="7" x2="5" y2="7" />
            <line x1="3" y1="10" x2="5" y2="10" />
          </svg>
        </button>
        <Omnibar selectedTags={selectedTags} onTagSelect={addTag} onTagRemove={removeTag} />
      </Navbar>
      <div className="project-layout">
        {expanded && (
          <div className="sidebar-region">
            <div className="sidebar-backdrop" onClick={toggle} />
            <aside className="sidebar">
              <div className="sidebar-header">
                <span className="sidebar-title">{account}/{project}</span>
                <button className="sidebar-toggle" onClick={toggle} title="Collapse sidebar (⌘\)">«</button>
              </div>
              <div className="sidebar-tree">
                <TagSidebar selectedTags={selectedTags} onTagsChange={setSelectedTags} />
              </div>
            </aside>
          </div>
        )}
        <div className="project-content">
          <Routes>
            <Route path="post/:id/edit" element={<PostEditorView />} />
            <Route path="post/:id" element={<PostView />} />
            <Route path="post/new" element={<PostEditorView />} />
            <Route path="search" element={<SearchView />} />
            <Route path="settings" element={<ProjectSettingsView />} />
            <Route path="browse/*" element={<Navigate to=".." replace />} />
            <Route path="" element={<FeedView selectedTags={selectedTags} />} />
            <Route path="*" element={<Navigate to="" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
