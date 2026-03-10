# Campfire Web UI Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Completely redesign the Kilroy web UI from cold dark dev tool to warm, reading-optimized "Campfire" aesthetic with omnibar navigation.

**Architecture:** Replace the sidebar two-panel layout with a centered single-column layout. The omnibar replaces both the sidebar and header search. All views are centered with constrained max-widths (720px reading, 960px browsing). CSS is a complete rewrite; every component is rewritten but the API layer (`lib/api.ts`) and utilities (`lib/time.ts`) are unchanged.

**Tech Stack:** React 19, TypeScript, vanilla CSS with custom properties, Vite, React Router v7. No new dependencies.

**Design doc:** `docs/plans/2026-03-08-campfire-redesign.md`

---

### Task 1: CSS Foundation — Complete Rewrite

Replace the entire stylesheet with the Campfire design system.

**Files:**
- Rewrite: `web/src/index.css` (complete replacement)
- Modify: `web/index.html` (swap Google Fonts)

**Step 1: Update index.html fonts**

Replace the current Google Fonts link (Instrument Sans + IBM Plex Mono) with Nunito Sans + JetBrains Mono:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Nunito+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
```

**Step 2: Rewrite index.css**

Complete replacement. The new stylesheet defines:

**CSS Variables (`:root`):**
```css
:root {
  --bg: #FAF6F1;
  --bg-surface: #F3EDE5;
  --bg-hover: #EBE3D9;
  --bg-inset: #F0E9E0;
  --text: #2C2520;
  --text-muted: #8C7E72;
  --text-dim: #B5A99B;
  --accent: #C8642A;
  --accent-hover: #A8511E;
  --accent-glow: rgba(200, 100, 42, 0.1);
  --border: #E2D9CE;
  --border-subtle: #EBE3D9;
  --status-active: #5A8A3C;
  --status-archived: #8C7E72;
  --status-obsolete: #C44B3F;
  --tag-bg: rgba(200, 100, 42, 0.08);
  --tag-text: #C8642A;
  --font-sans: 'Nunito Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
  --content-width: 960px;
  --reading-width: 720px;
}
```

**Global styles:**
- `body`: `font-family: var(--font-sans); background: var(--bg); color: var(--text); line-height: 1.6;`
- Remove the old noise texture `body::before` (or replace with a warmer, more visible one)
- `a`: `color: var(--accent);` with hover to `--accent-hover`

**Layout classes:**
- `.app`: flex column, min-height 100vh, align-items center
- `.content`: width 100%, max-width var(--content-width), margin 0 auto, padding 2rem 1.5rem
- `.content.reading`: max-width var(--reading-width) — used by PostView and NewPostView

**Omnibar classes (stubbed — component built in Task 2):**
- `.omnibar-wrapper`: sticky top, width 100%, display flex, justify center, padding, background with subtle blur
- `.omnibar`: max-width 640px, background var(--bg-surface), border, border-radius 10px, height ~44px
- `.omnibar.active`: elevated shadow, scale slight
- `.omnibar-dropdown`: positioned below omnibar, same max-width, background, shadow, border-radius
- `.omnibar-results-group`: section heading (TOPICS / POSTS) in small caps
- `.omnibar-result-item`: hover state, padding, cursor pointer

**Card classes:**
- `.card`: background var(--bg-surface), border 1px solid var(--border-subtle), border-radius 8px, padding 1rem 1.25rem, margin-bottom 0.75rem. No left colored border — cleaner.
- `.card:hover`: translateY(-2px), box-shadow warm (0 4px 12px rgba(44,37,32,0.08))
- `.card-title`: font-size 1rem, font-weight 700
- `.card-meta`: font-family mono, font-size 0.8rem, color text-muted, margin-top 0.3rem
- `.card .status-dot`: inline 8px circle before status text, colored by status
- `.folder-card`: border-left 3px solid var(--accent), lighter background
- `.tag`: background var(--tag-bg), color var(--tag-text), border-radius 4px, font-size 0.72rem, font-family mono, padding 0.1rem 0.45rem
- `.card-animate`: animation fadeUp 0.25s ease both

**Post detail classes:**
- `.post-detail h1`: font-size 1.75rem, font-weight 800, line-height 1.3, margin-bottom 0.75rem
- `.post-meta-line`: font-family mono, font-size 0.8rem, color text-muted. Single line, items separated by ` · `. No grid, no box.
- `.post-tags`: display flex, gap 0.3rem, margin-top 0.5rem
- `.post-actions`: margin-top 0.75rem, margin-bottom 1.5rem. Actions are text-styled links, not buttons: `color: var(--text-dim); font-size: 0.8rem; cursor: pointer;` with hover to accent
- `.post-body`: font-size 1.05rem, line-height 1.8, margin-bottom 2.5rem. No border-left decoration.
- `.comments-divider`: border-top 1px solid var(--border), margin 2rem 0 1.5rem
- `.comments-heading`: font-family mono, font-size 0.8rem, color text-dim, text-transform uppercase, letter-spacing 0.5px
- `.comment`: margin-bottom 1.25rem (no card, no border — just text)
- `.comment-header`: font-size 0.8rem. Author in accent color (mono, font-weight 600), timestamp in text-dim
- `.comment-body`: font-size 0.95rem, line-height 1.7

**Form classes:**
- `.form-group label`: font-family mono, font-size 0.72rem, text-transform uppercase, letter-spacing 0.5px, color text-muted, margin-bottom 0.35rem
- `.form-group input, textarea`: background var(--bg-inset), border 1px solid var(--border), border-radius 6px, padding 0.6rem 0.85rem, font-size 0.95rem, color text, outline none. Focus: border-color accent, box-shadow 0 0 0 3px accent-glow.
- `.form-group textarea`: font-family mono, font-size 0.88rem, line-height 1.6, min-height 160px, resize vertical
- `.title-input`: Large title-style input — font-size 1.4rem, font-weight 700, border none, background transparent, padding 0. Placeholder styled.

**Button classes:**
- `.btn`: padding 0.45rem 0.9rem, border-radius 6px, font-size 0.85rem, font-weight 600, cursor pointer, transition 0.15s
- `.btn-primary`: background accent, color white, border none. Hover: background accent-hover.
- `.btn:active`: transform scale(0.97)
- `.text-action`: no background, no border, color text-dim, font-size 0.8rem, font-family mono, cursor pointer. Hover: color accent. Used for archive/delete/restore.

**Status classes:**
- `.status-dot`: 8px inline-block circle. `.status-dot-active` bg status-active, `.status-dot-archived` bg status-archived, `.status-dot-obsolete` bg status-obsolete
- `.status-badge`: keep from old design but restyle — smaller, rounder

**Empty state:**
- `.empty-state`: text-align center, padding 4rem 2rem
- `.empty-state h2`: font-size 1.2rem, font-weight 700, margin-bottom 0.5rem
- `.empty-state p`: color text-muted, font-size 1rem, line-height 1.7, max-width 360px, margin 0 auto 1.5rem

**Search result specifics:**
- `.snippet`: font-size 0.85rem, color text-muted, margin-top 0.35rem, line-height 1.5
- `.snippet mark`: background rgba(200,100,42,0.15), color accent, padding 0 0.15rem, border-radius 2px, font-weight 600

**Animations:**
```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Author prompt:**
- `.author-prompt-overlay`: fixed inset 0, background rgba(44,37,32,0.4), backdrop-filter blur(4px)
- `.author-prompt`: background var(--bg), border-radius 12px, padding 2rem, width 380px, box-shadow
- `.author-prompt h3`: font-size 1.1rem, font-weight 700 (not mono, not accent-colored — just warm text)

**Controls:**
- `.controls`: display flex, align-items center, gap 0.75rem, margin-bottom 1.25rem
- `.controls select`: background var(--bg-inset), border, border-radius 4px, font-family mono, font-size 0.78rem, color text

**Step 3: Verify build**

```bash
cd /home/ubuntu/hearsay/web && npx tsc -b --noEmit && npx vite build
```

Expected: Build succeeds (CSS changes don't affect TypeScript, but font references in CSS should be valid).

**Step 4: Commit**

```bash
git add web/src/index.css web/index.html
git commit -m "style: replace dark theme with Campfire warm light design system"
```

---

### Task 2: Create Omnibar Component

The centerpiece of the new UI. Replaces sidebar + header search.

**Files:**
- Create: `web/src/components/Omnibar.tsx`
- Reference: `web/src/lib/api.ts` (uses `browse` and `search`)

**Step 1: Build the Omnibar component**

The component has three modes:
1. **Resting**: Shows wordmark + breadcrumb path + keyboard hint
2. **Active**: Input field, typing triggers fuzzy search
3. **Dropdown open**: Shows grouped results (Topics, Posts)

```tsx
// Omnibar.tsx — full implementation

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { browse, search } from '../lib/api';

interface OmnibarProps {
  currentTopic: string;
}

export function Omnibar({ currentTopic }: OmnibarProps) {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState('');
  const [topics, setTopics] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // All topic paths for fuzzy matching (fetched once)
  const [allTopics, setAllTopics] = useState<string[]>([]);

  useEffect(() => {
    browse({ recursive: 'true', status: 'all', limit: '200' })
      .then((data) => {
        const paths = new Set<string>();
        for (const p of data.posts || []) {
          const parts = p.topic.split('/');
          for (let i = 1; i <= parts.length; i++) {
            paths.add(parts.slice(0, i).join('/'));
          }
        }
        setAllTopics(Array.from(paths).sort());
      })
      .catch(() => {});
  }, []);

  // Fuzzy search on query change
  useEffect(() => {
    if (!query.trim()) {
      setTopics([]);
      setPosts([]);
      return;
    }

    const q = query.toLowerCase();

    // Filter topics by prefix/substring match
    const matchedTopics = allTopics
      .filter((t) => t.toLowerCase().includes(q))
      .slice(0, 5);
    setTopics(matchedTopics);

    // Search posts via API (debounced would be better, but keep simple for MVP)
    const timer = setTimeout(() => {
      search({ query: query.trim(), status: 'all', limit: '5' })
        .then((data) => setPosts(data.results || []))
        .catch(() => setPosts([]));
    }, 200);

    return () => clearTimeout(timer);
  }, [query, allTopics]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [topics, posts]);

  const totalResults = topics.length + posts.length;

  const activate = useCallback(() => {
    setActive(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const deactivate = useCallback(() => {
    setActive(false);
    setQuery('');
    setTopics([]);
    setPosts([]);
  }, []);

  // Global keyboard shortcut
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

  // Click outside to close
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
    if (index < topics.length) {
      navigate(`/${topics[index]}/`);
    } else {
      const post = posts[index - topics.length];
      if (post) navigate(`/post/${post.post_id}`);
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
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
        deactivate();
      }
    }
  };

  // Breadcrumb segments from current topic
  const segments = currentTopic ? currentTopic.split('/') : [];

  return (
    <div className="omnibar-wrapper">
      <div className={`omnibar ${active ? 'active' : ''}`} ref={wrapperRef}>
        {active ? (
          <>
            <input
              ref={inputRef}
              className="omnibar-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search posts or navigate to a topic..."
            />
            {query.trim() && (topics.length > 0 || posts.length > 0) && (
              <div className="omnibar-dropdown">
                {topics.length > 0 && (
                  <div className="omnibar-results-group">
                    <div className="omnibar-group-label">Topics</div>
                    {topics.map((t, i) => (
                      <div
                        key={t}
                        className={`omnibar-result-item ${selectedIndex === i ? 'selected' : ''}`}
                        onClick={() => handleSelect(i)}
                        onMouseEnter={() => setSelectedIndex(i)}
                      >
                        <span className="omnibar-result-icon">&#x2192;</span>
                        <span className="omnibar-result-path">{t}/</span>
                      </div>
                    ))}
                  </div>
                )}
                {posts.length > 0 && (
                  <div className="omnibar-results-group">
                    <div className="omnibar-group-label">Posts</div>
                    {posts.map((p, i) => (
                      <div
                        key={p.post_id}
                        className={`omnibar-result-item ${selectedIndex === topics.length + i ? 'selected' : ''}`}
                        onClick={() => handleSelect(topics.length + i)}
                        onMouseEnter={() => setSelectedIndex(topics.length + i)}
                      >
                        <span className="omnibar-result-title">{p.title}</span>
                        <span className="omnibar-result-topic">{p.topic}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="omnibar-resting" onClick={activate}>
            <Link to="/" className="omnibar-wordmark" onClick={(e) => e.stopPropagation()}>
              kilroy
            </Link>
            {segments.length > 0 && (
              <span className="omnibar-path">
                {segments.map((seg, i) => {
                  const path = segments.slice(0, i + 1).join('/');
                  return (
                    <span key={path}>
                      <span className="omnibar-sep">/</span>
                      <Link
                        to={`/${path}/`}
                        className="omnibar-segment"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {seg}
                      </Link>
                    </span>
                  );
                })}
              </span>
            )}
            <span className="omnibar-hint">
              <kbd>⌘K</kbd>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Add Omnibar CSS to index.css**

Append these rules to the stylesheet from Task 1:

```css
/* Omnibar */
.omnibar-wrapper {
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 1rem 1.5rem;
  background: linear-gradient(to bottom, var(--bg) 60%, transparent);
  pointer-events: none;
}

.omnibar {
  pointer-events: all;
  position: relative;
  width: 100%;
  max-width: 640px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.omnibar.active {
  box-shadow: 0 8px 32px rgba(44, 37, 32, 0.12);
  transform: scale(1.02);
}

.omnibar-resting {
  display: flex;
  align-items: center;
  padding: 0.6rem 1rem;
  cursor: pointer;
  gap: 0.15rem;
}

.omnibar-wordmark {
  font-family: var(--font-sans);
  font-weight: 800;
  font-size: 0.95rem;
  color: var(--text);
  text-decoration: none;
  letter-spacing: -0.01em;
}

.omnibar-wordmark:hover {
  color: var(--accent);
}

.omnibar-path {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--text-muted);
}

.omnibar-sep {
  color: var(--text-dim);
  margin: 0 0.15rem;
}

.omnibar-segment {
  color: var(--text-muted);
  text-decoration: none;
}

.omnibar-segment:hover {
  color: var(--accent);
}

.omnibar-hint {
  margin-left: auto;
}

.omnibar-hint kbd {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-dim);
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.15rem 0.4rem;
}

.omnibar-input {
  width: 100%;
  padding: 0.6rem 1rem;
  border: none;
  background: transparent;
  font-family: var(--font-mono);
  font-size: 0.95rem;
  color: var(--text);
  outline: none;
}

.omnibar-input::placeholder {
  color: var(--text-dim);
}

.omnibar-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(44, 37, 32, 0.12);
  max-height: 360px;
  overflow-y: auto;
  padding: 0.5rem 0;
  animation: fadeUp 0.12s ease;
}

.omnibar-group-label {
  font-family: var(--font-sans);
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-dim);
  padding: 0.5rem 1rem 0.25rem;
}

.omnibar-result-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 1rem;
  cursor: pointer;
  transition: background 0.1s;
}

.omnibar-result-item:hover,
.omnibar-result-item.selected {
  background: var(--bg-hover);
}

.omnibar-result-icon {
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.omnibar-result-path {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--text);
}

.omnibar-result-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.omnibar-result-topic {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-dim);
}
```

**Step 3: Verify build**

```bash
cd /home/ubuntu/hearsay/web && npx tsc -b --noEmit
```

Expected: Passes (new component, no external deps beyond what's already installed).

**Step 4: Commit**

```bash
git add web/src/components/Omnibar.tsx
git commit -m "feat(web): add Omnibar component — unified search, nav, and address bar"
```

---

### Task 3: Rewrite App.tsx — New Layout

Remove sidebar, wire up omnibar, centered layout.

**Files:**
- Rewrite: `web/src/App.tsx`
- Delete: `web/src/components/Sidebar.tsx` (no longer used)
- Delete: `web/src/components/Breadcrumb.tsx` (omnibar handles breadcrumbs)

**Step 1: Rewrite App.tsx**

```tsx
import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Omnibar } from './components/Omnibar';
import { BrowseView } from './views/BrowseView';
import { PostView } from './views/PostView';
import { SearchView } from './views/SearchView';
import { NewPostView } from './views/NewPostView';
import { AuthorPrompt } from './components/AuthorPrompt';

export default function App() {
  const [currentTopic, setCurrentTopic] = useState('');

  return (
    <div className="app">
      <AuthorPrompt />
      <Omnibar currentTopic={currentTopic} />
      <Routes>
        <Route path="/post/:id" element={<PostView onTopicChange={setCurrentTopic} />} />
        <Route path="/search" element={<SearchView />} />
        <Route path="/new" element={<NewPostView />} />
        <Route path="*" element={<BrowseView onTopicChange={setCurrentTopic} />} />
      </Routes>
    </div>
  );
}
```

**Step 2: Delete Sidebar.tsx and Breadcrumb.tsx**

```bash
rm web/src/components/Sidebar.tsx web/src/components/Breadcrumb.tsx
```

**Step 3: Remove Breadcrumb imports from views**

BrowseView, PostView both import Breadcrumb — remove those imports and `<Breadcrumb>` JSX. (Done in Tasks 4 and 5 when those views are rewritten, but if building incrementally, strip the imports now to avoid build errors.)

Temporarily stub the views to remove Breadcrumb references:

In `BrowseView.tsx`: Remove `import { Breadcrumb }` and `<Breadcrumb topic={cleanTopic} />` line.
In `PostView.tsx`: Remove `import { Breadcrumb }` and `<Breadcrumb topic={post.topic} />` line.

**Step 4: Verify build**

```bash
cd /home/ubuntu/hearsay/web && npx tsc -b --noEmit
```

Expected: Passes.

**Step 5: Commit**

```bash
git add -A web/src/
git commit -m "refactor(web): replace sidebar layout with centered omnibar layout"
```

---

### Task 4: Rewrite BrowseView

New card design, centered layout, no breadcrumb (omnibar handles it).

**Files:**
- Rewrite: `web/src/views/BrowseView.tsx`

**Step 1: Rewrite BrowseView.tsx**

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { browse } from '../lib/api';
import { SkeletonCards, EmptyState } from '../components/Skeleton';
import { timeAgo } from '../lib/time';

export function BrowseView({ onTopicChange }: { onTopicChange: (t: string) => void }) {
  const params = useParams();
  const topic = (params['*'] || '').replace(/\/$/, '');
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState('active');
  const [sort, setSort] = useState('updated_at');
  const [error, setError] = useState('');

  useEffect(() => { onTopicChange(topic); }, [topic]);

  useEffect(() => {
    setError('');
    setData(null);
    const params: Record<string, string> = {};
    if (topic) params.topic = topic;
    if (status !== 'active') params.status = status;
    if (sort !== 'updated_at') params.order_by = sort;

    browse(params)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [topic, status, sort]);

  if (error) return <div className="content"><div className="error">{error}</div></div>;
  if (!data) return <div className="content"><SkeletonCards count={5} /></div>;

  const hasContent = (data.subtopics?.length || 0) + (data.posts?.length || 0) > 0;

  return (
    <div className="content">
      {hasContent && (
        <div className="controls">
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="obsolete">Obsolete</option>
              <option value="all">All</option>
            </select>
          </label>
          <label>Sort
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="updated_at">Updated</option>
              <option value="created_at">Created</option>
              <option value="title">Title</option>
            </select>
          </label>
          <div className="spacer" />
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/new${topic ? `?topic=${encodeURIComponent(topic)}` : ''}`)}
          >
            + New Post
          </button>
        </div>
      )}

      {data.subtopics?.map((st: any, i: number) => (
        <div
          key={st.name}
          className="card folder-card card-animate"
          style={{ animationDelay: `${i * 30}ms` }}
          onClick={() => navigate(`/${topic ? topic + '/' : ''}${st.name}/`)}
        >
          <div className="card-title">{st.name}/</div>
          <div className="card-meta">
            {st.post_count} {st.post_count === 1 ? 'post' : 'posts'}
            {' · '}
            {st.contributor_count} {st.contributor_count === 1 ? 'contributor' : 'contributors'}
            {st.updated_at && <> · {timeAgo(st.updated_at)}</>}
          </div>
          {st.tags?.length > 0 && (
            <div className="card-tags">
              {st.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}
            </div>
          )}
        </div>
      ))}

      {data.posts?.map((p: any, i: number) => (
        <div
          key={p.id}
          className="card card-animate"
          style={{ animationDelay: `${(data.subtopics?.length || 0) * 30 + i * 30}ms` }}
          onClick={() => navigate(`/post/${p.id}`)}
        >
          <div className="card-title">
            <span className="card-title-text">{p.title}</span>
            <span className={`status-dot status-dot-${p.status}`} />
          </div>
          <div className="card-meta">
            {p.author || 'anonymous'} · {timeAgo(p.updated_at)} · {p.comment_count} {p.comment_count === 1 ? 'comment' : 'comments'}
          </div>
          {p.tags?.length > 0 && (
            <div className="card-tags">
              {p.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}
            </div>
          )}
        </div>
      ))}

      {!hasContent && (
        <EmptyState
          title="Welcome to Kilroy."
          message="Knowledge shared here persists across sessions — so the next agent (or human) doesn't start from zero."
          actionLabel="Create the first post"
          onAction={() => navigate(`/new${topic ? `?topic=${encodeURIComponent(topic)}` : ''}`)}
        />
      )}
    </div>
  );
}
```

**Step 2: Verify build**

```bash
cd /home/ubuntu/hearsay/web && npx tsc -b --noEmit
```

Note: This will fail until Skeleton.tsx is updated to accept the new `title` prop for EmptyState. That's Task 7.

**Step 3: Commit** (after Task 7 fixes Skeleton)

---

### Task 5: Rewrite PostView — Reading Layout

Centered at 720px, clean reading experience.

**Files:**
- Rewrite: `web/src/views/PostView.tsx`

**Step 1: Rewrite PostView.tsx**

```tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { readPost, createComment, updateStatus, deletePost } from '../lib/api';
import { SkeletonCards } from '../components/Skeleton';
import { timeAgo } from '../lib/time';

export function PostView({ onTopicChange }: { onTopicChange: (t: string) => void }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [post, setPost] = useState<any>(null);
  const [error, setError] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = () => {
    if (!id) return;
    setError('');
    readPost(id).then((data) => {
      setPost(data);
      onTopicChange(data.topic);
    }).catch((e) => setError(e.message));
  };

  useEffect(load, [id]);

  // Auto-grow textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommentBody(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  const handleComment = async () => {
    if (!commentBody.trim() || !id) return;
    setSubmitting(true);
    try {
      const author = localStorage.getItem('kilroy_author') || undefined;
      await createComment(id, { body: commentBody, author });
      setCommentBody('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatus = async (newStatus: string) => {
    if (!id) return;
    try {
      await updateStatus(id, newStatus);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Permanently delete this post?')) return;
    try {
      await deletePost(id);
      navigate(post?.topic ? `/${post.topic}/` : '/');
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (error) return <div className="content reading"><div className="error">{error}</div></div>;
  if (!post) return <div className="content reading"><SkeletonCards count={1} /></div>;

  return (
    <div className="content reading">
      <article className="post-detail">
        <h1>{post.title}</h1>

        <div className="post-meta-line">
          {post.author && <span>{post.author}</span>}
          {post.author && <span className="meta-sep"> · </span>}
          <span>{post.created_at?.slice(0, 10)}</span>
          <span className="meta-sep"> · </span>
          <span className={`status-dot status-dot-${post.status}`} />
          <span>{post.status}</span>
        </div>

        {post.tags?.length > 0 && (
          <div className="post-tags">
            {post.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}
          </div>
        )}

        <div className="post-actions">
          {post.status === 'active' && (
            <>
              <button className="text-action" onClick={() => handleStatus('archived')}>archive</button>
              <button className="text-action" onClick={() => handleStatus('obsolete')}>mark obsolete</button>
            </>
          )}
          {(post.status === 'archived' || post.status === 'obsolete') && (
            <button className="text-action" onClick={() => handleStatus('active')}>restore</button>
          )}
          <button className="text-action text-action-danger" onClick={handleDelete}>delete</button>
        </div>

        <div className="post-body">{post.body}</div>

        <hr className="comments-divider" />
        <div className="comments-heading">
          Comments ({post.comments?.length || 0})
        </div>

        {post.comments?.map((c: any) => (
          <div key={c.id} className="comment">
            <div className="comment-header">
              <span className="comment-author">{c.author || 'anonymous'}</span>
              <span className="comment-time"> · {timeAgo(c.created_at)}</span>
            </div>
            <div className="comment-body">{c.body}</div>
          </div>
        ))}

        <div className="comment-form">
          <textarea
            ref={textareaRef}
            placeholder="Add a comment..."
            value={commentBody}
            onChange={handleTextareaChange}
            rows={2}
          />
          <button
            className="btn btn-primary"
            onClick={handleComment}
            disabled={submitting || !commentBody.trim()}
          >
            {submitting ? 'Posting...' : 'Reply'}
          </button>
        </div>
      </article>
    </div>
  );
}
```

**Step 2: Add reading-width and post-specific CSS**

Ensure index.css includes:

```css
.content.reading {
  max-width: var(--reading-width);
}

.post-meta-line {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0.15rem;
  margin-bottom: 0.5rem;
}

.meta-sep {
  color: var(--text-dim);
}

.post-tags {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.post-actions {
  display: flex;
  gap: 1rem;
  margin-top: 0.75rem;
  margin-bottom: 1.75rem;
}

.text-action {
  background: none;
  border: none;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--text-dim);
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}

.text-action:hover {
  color: var(--accent);
}

.text-action-danger:hover {
  color: var(--status-obsolete);
}

.post-body {
  font-size: 1.05rem;
  line-height: 1.8;
  margin-bottom: 2.5rem;
  white-space: pre-wrap;
}

.comments-divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 2rem 0 1.5rem;
}

.comments-heading {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 1.25rem;
}

.comment {
  margin-bottom: 1.25rem;
}

.comment-header {
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}

.comment-author {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--accent);
}

.comment-time {
  font-family: var(--font-mono);
  color: var(--text-dim);
}

.comment-body {
  font-size: 0.95rem;
  line-height: 1.7;
  white-space: pre-wrap;
}

.comment-form {
  margin-top: 1.5rem;
}

.comment-form textarea {
  width: 100%;
  background: var(--bg-inset);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  color: var(--text);
  line-height: 1.6;
  outline: none;
  resize: none;
  overflow: hidden;
  min-height: 80px;
  transition: border-color 0.15s, box-shadow 0.15s;
  margin-bottom: 0.75rem;
}

.comment-form textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
```

**Step 3: Commit**

```bash
git add web/src/views/PostView.tsx web/src/index.css
git commit -m "feat(web): rewrite PostView with reading-optimized layout"
```

---

### Task 6: Rewrite SearchView

Cleaner search results, no duplicate search input (omnibar handles search entry).

**Files:**
- Rewrite: `web/src/views/SearchView.tsx`

**Step 1: Rewrite SearchView.tsx**

```tsx
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { search } from '../lib/api';
import { EmptyState } from '../components/Skeleton';
import { timeAgo } from '../lib/time';

function highlightSnippet(snippet: string, query: string) {
  if (!snippet || !query) return snippet;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = snippet.split(regex);
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? <mark key={i}>{part}</mark> : part
  );
}

export function SearchView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';

  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState('active');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!query) { setData(null); return; }
    setError('');
    setData(null);
    const params: Record<string, string> = { query };
    if (status !== 'active') params.status = status;

    search(params)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [query, status]);

  if (!query) return (
    <div className="content">
      <EmptyState
        title="Search Kilroy"
        message="Use the omnibar above (⌘K) to search across all posts."
      />
    </div>
  );

  return (
    <div className="content">
      <div className="search-header">
        <h2>Results for "{query}"</h2>
        <div className="controls" style={{ marginTop: '0.75rem' }}>
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="obsolete">Obsolete</option>
              <option value="all">All</option>
            </select>
          </label>
          {data && <span className="search-count">{data.results?.length || 0} results</span>}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {data?.results?.map((r: any, i: number) => (
        <div
          key={r.post_id}
          className="card card-animate"
          style={{ animationDelay: `${i * 30}ms` }}
          onClick={() => navigate(`/post/${r.post_id}`)}
        >
          <div className="card-title">
            <span className="card-title-text">{r.title}</span>
            <span className={`status-dot status-dot-${r.status}`} />
          </div>
          <div className="card-meta">
            {r.topic}
            {r.match_location && <> · <span className="match-location">{r.match_location}</span></>}
          </div>
          {r.snippet && <div className="snippet">{highlightSnippet(r.snippet, query)}</div>}
        </div>
      ))}

      {data && !data.results?.length && (
        <EmptyState
          title="No results"
          message={`Nothing matched "${query}". Try a different search term.`}
        />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add web/src/views/SearchView.tsx
git commit -m "feat(web): rewrite SearchView for Campfire design"
```

---

### Task 7: Rewrite NewPostView, Skeleton, AuthorPrompt

Update the remaining components.

**Files:**
- Rewrite: `web/src/views/NewPostView.tsx`
- Rewrite: `web/src/components/Skeleton.tsx`
- Rewrite: `web/src/components/AuthorPrompt.tsx`

**Step 1: Rewrite NewPostView.tsx**

```tsx
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPost } from '../lib/api';

export function NewPostView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [topic, setTopic] = useState(searchParams.get('topic') || '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !title.trim() || !body.trim()) {
      setError('Topic, title, and body are required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload: Record<string, any> = {
        topic: topic.trim(),
        title: title.trim(),
        body: body.trim(),
      };

      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length) payload.tags = tagList;

      const author = localStorage.getItem('kilroy_author');
      if (author) payload.author = author;

      const post = await createPost(payload);
      navigate(`/post/${post.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-grow body textarea
  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  return (
    <div className="content reading">
      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Topic</label>
          <input
            placeholder="e.g. auth/google"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        </div>

        <input
          className="title-input"
          placeholder="Post title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="form-group" style={{ marginTop: '1.25rem' }}>
          <label>Body</label>
          <textarea
            placeholder="Write your knowledge..."
            value={body}
            onChange={handleBodyChange}
            rows={8}
          />
        </div>

        <div className="form-group">
          <label>Tags (comma-separated)</label>
          <input
            placeholder="e.g. gotcha, oauth"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Publishing...' : 'Publish'}
        </button>
      </form>
    </div>
  );
}
```

**Step 2: Rewrite Skeleton.tsx**

Update EmptyState to accept `title` prop:

```tsx
export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line skeleton-meta" />
          <div className="skeleton-line skeleton-tags" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, message, actionLabel, onAction }: {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      {title && <h2>{title}</h2>}
      <p>{message}</p>
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
```

**Step 3: Rewrite AuthorPrompt.tsx**

Warmer styling, same functionality:

```tsx
import { useState, useEffect } from 'react';

export function AuthorPrompt() {
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('kilroy_author');
    if (!stored) setShow(true);
    else setName(stored);
  }, []);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem('kilroy_author', trimmed);
    setShow(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setShow(false);
  };

  if (!show) return null;

  return (
    <div className="author-prompt-overlay">
      <div className="author-prompt">
        <h3>Who are you?</h3>
        <p>Your name will appear on posts and comments you create. Stored in your browser only.</p>
        <input
          autoFocus
          placeholder="e.g. human:sarah"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="author-prompt-actions">
          <button className="btn" onClick={() => setShow(false)}>Skip</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Verify build**

```bash
cd /home/ubuntu/hearsay/web && npx tsc -b --noEmit && npx vite build
```

Expected: Full build passes.

**Step 5: Commit**

```bash
git add web/src/views/NewPostView.tsx web/src/components/Skeleton.tsx web/src/components/AuthorPrompt.tsx
git commit -m "feat(web): rewrite NewPostView, Skeleton, AuthorPrompt for Campfire"
```

---

### Task 8: Final CSS Polish & Build Verification

Ensure all CSS classes used by the new components exist in index.css. Verify full build and visual check.

**Files:**
- Modify: `web/src/index.css` (add any missing classes)

**Step 1: Audit CSS for missing classes**

Walk through every `className` used in all components and verify each has a corresponding CSS rule. Key classes to verify exist:

- `.app`, `.content`, `.content.reading`
- `.omnibar-*` (all omnibar classes from Task 2)
- `.card`, `.card-title`, `.card-title-text`, `.card-meta`, `.card-tags`, `.card-animate`, `.folder-card`
- `.status-dot`, `.status-dot-active`, `.status-dot-archived`, `.status-dot-obsolete`
- `.tag`, `.controls`, `.controls select`, `.controls label`, `.spacer`
- `.post-detail`, `.post-meta-line`, `.meta-sep`, `.post-tags`, `.post-actions`, `.text-action`, `.text-action-danger`, `.post-body`
- `.comments-divider`, `.comments-heading`, `.comment`, `.comment-header`, `.comment-author`, `.comment-time`, `.comment-body`, `.comment-form`
- `.search-header`, `.search-count`, `.snippet`, `.snippet mark`, `.match-location`
- `.form-group`, `.title-input`, `.btn`, `.btn-primary`
- `.skeleton-card`, `.skeleton-line`, `.skeleton-title`, `.skeleton-meta`, `.skeleton-tags`
- `.empty-state`, `.empty-state h2`, `.empty-state p`
- `.error`
- `.author-prompt-overlay`, `.author-prompt`, `.author-prompt-actions`
- `@keyframes fadeUp`, `@keyframes shimmer`

Add any that are missing. Remove any old classes that are no longer referenced (e.g., `.sidebar`, `.header`, `.tree-*`, `.breadcrumb`, `.empty-ascii`, `.card.status-border-*`).

**Step 2: Full build**

```bash
cd /home/ubuntu/hearsay/web && npx tsc -b --noEmit && npx vite build
```

Expected: Clean build, no errors.

**Step 3: Copy built assets to server's expected location**

```bash
cp -r /home/ubuntu/hearsay/web/dist/* /home/ubuntu/hearsay/web/dist/
```

(This is a no-op if the server already reads from `web/dist/`. Just verify the server picks up the new build.)

**Step 4: Visual smoke test**

Start/restart the server and check http://localhost:7432 in browser:

- [ ] Warm light background loads (not dark)
- [ ] Omnibar visible at top center with "kilroy" wordmark
- [ ] ⌘K opens the omnibar input
- [ ] Empty state shows welcome message
- [ ] Creating a post works and redirects to post view
- [ ] Post view is centered, readable, warm
- [ ] Search via omnibar shows results

**Step 5: Commit**

```bash
git add web/src/index.css
git commit -m "style(web): complete Campfire CSS polish and cleanup"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | CSS foundation + fonts | `index.css`, `index.html` |
| 2 | Omnibar component | `Omnibar.tsx` |
| 3 | App.tsx rewrite, delete sidebar/breadcrumb | `App.tsx`, delete `Sidebar.tsx`, `Breadcrumb.tsx` |
| 4 | BrowseView rewrite | `BrowseView.tsx` |
| 5 | PostView rewrite | `PostView.tsx` |
| 6 | SearchView rewrite | `SearchView.tsx` |
| 7 | NewPostView, Skeleton, AuthorPrompt rewrites | `NewPostView.tsx`, `Skeleton.tsx`, `AuthorPrompt.tsx` |
| 8 | CSS audit, build, visual smoke test | `index.css` |
