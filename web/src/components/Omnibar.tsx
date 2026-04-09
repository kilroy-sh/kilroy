import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { search, tags as fetchTags } from '../lib/api';
import { useProject, useProjectPath } from '../context/ProjectContext';
import { KilroyMark } from './KilroyMark';

interface OmnibarProps {
  selectedTags: string[];
  onTagSelect: (tag: string) => void;
  onTagRemove: (tag: string) => void;
}

export function Omnibar({ selectedTags, onTagSelect, onTagRemove }: OmnibarProps) {
  const navigate = useNavigate();
  const { accountSlug, projectSlug } = useProject();
  const pp = useProjectPath();
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState('');
  const [tagResults, setTagResults] = useState<Array<{tag: string; count: number}>>([]);
  const [postResults, setPostResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setTagResults([]);
      setPostResults([]);
      return;
    }

    const q = query.toLowerCase();

    // Fetch matching tags
    fetchTags(accountSlug, projectSlug)
      .then((data) => {
        const matched = (data.tags || [])
          .filter((t: any) => t.tag.toLowerCase().includes(q))
          .slice(0, 5);
        setTagResults(matched);
      })
      .catch(() => setTagResults([]));

    // Debounced search for posts
    const timer = setTimeout(() => {
      search(accountSlug, projectSlug, { query: query.trim(), status: 'all', limit: '5' })
        .then((data) => setPostResults(data.results || []))
        .catch(() => setPostResults([]));
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [tagResults, postResults]);

  const totalResults = tagResults.length + postResults.length;

  const activate = useCallback(() => {
    setActive(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const deactivate = useCallback(() => {
    setActive(false);
    setQuery('');
    setTagResults([]);
    setPostResults([]);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !active)) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        activate();
      }
      if (e.key === 'Escape' && active) {
        deactivate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, activate, deactivate]);

  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        deactivate();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [active, deactivate]);

  const handleSelect = (index: number) => {
    if (index < tagResults.length) {
      onTagSelect(tagResults[index].tag);
      navigate(pp('/'));
    } else {
      const post = postResults[index - tagResults.length];
      if (post) navigate(pp(`/post/${post.post_id}`));
    }
    deactivate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, totalResults - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0) {
        handleSelect(selectedIndex);
      } else if (query.trim()) {
        navigate(pp(`/search?q=${encodeURIComponent(query.trim())}`));
        deactivate();
      }
    }
  };

  return (
    <div className={`omnibar ${active ? 'active' : ''}`} ref={wrapperRef}>
      {active ? (
        <>
          <div className="omnibar-input-row">
            {selectedTags.map(tag => (
              <span key={tag} className="omnibar-chip" onClick={() => { onTagRemove(tag); }}>
                {tag} <span className="omnibar-chip-remove">✕</span>
              </span>
            ))}
            <input
              ref={inputRef}
              className="omnibar-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search posts or filter by tag..."
            />
          </div>
          {query.trim() && (tagResults.length > 0 || postResults.length > 0) && (
            <div className="omnibar-dropdown">
              {tagResults.length > 0 && (
                <div className="omnibar-results-group">
                  <div className="omnibar-group-label">Tags</div>
                  {tagResults.map((t, i) => (
                    <div
                      key={t.tag}
                      className={`omnibar-result-item ${selectedIndex === i ? 'selected' : ''}`}
                      onClick={() => handleSelect(i)}
                      onMouseEnter={() => setSelectedIndex(i)}
                    >
                      <span className="omnibar-result-icon">#</span>
                      <span className="omnibar-result-tag">{t.tag}</span>
                      <span className="omnibar-result-count">{t.count}</span>
                    </div>
                  ))}
                </div>
              )}
              {postResults.length > 0 && (
                <div className="omnibar-results-group">
                  <div className="omnibar-group-label">Posts</div>
                  {postResults.map((p, i) => (
                    <div
                      key={p.post_id}
                      className={`omnibar-result-item ${selectedIndex === tagResults.length + i ? 'selected' : ''}`}
                      onClick={() => handleSelect(tagResults.length + i)}
                      onMouseEnter={() => setSelectedIndex(tagResults.length + i)}
                    >
                      <span className="omnibar-result-title">{p.title}</span>
                      {p.tags && p.tags.length > 0 && (
                        <span className="omnibar-result-tags">
                          {p.tags.slice(0, 3).map((t: string) => (
                            <span key={t} className="omnibar-result-tag-chip">{t}</span>
                          ))}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="omnibar-resting" onClick={activate}>
          <Link to="/" className="omnibar-home" onClick={(e) => e.stopPropagation()} title="Kilroy — switch projects">
            <KilroyMark size={22} />
          </Link>
          <Link to={pp('/')} className="omnibar-wordmark" onClick={(e) => e.stopPropagation()}>
            {accountSlug}<span className="omnibar-sep">/</span>{projectSlug}
          </Link>
          {selectedTags.length > 0 && (
            <span className="omnibar-active-tags">
              {selectedTags.map(tag => (
                <span key={tag} className="omnibar-chip" onClick={(e) => { e.stopPropagation(); onTagRemove(tag); }}>
                  {tag} <span className="omnibar-chip-remove">✕</span>
                </span>
              ))}
            </span>
          )}
          <span className="omnibar-hint">
            <kbd>⌘K</kbd>
          </span>
        </div>
      )}
    </div>
  );
}
