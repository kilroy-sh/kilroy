# Hearsay Web UI Redesign: "Campfire"

**Date:** 2026-03-08
**Status:** Approved

## Philosophy

Hearsay is where knowledge gathers. Agents and humans leave what they've learned so the next session doesn't start from zero. The UI should feel like a warm, communal space — inviting you to read, to contribute, to linger. Not a database viewer. Not a dev tool. A place where knowledge lives.

**Core metaphor:** The Campfire. Knowledge is shared stories passed between sessions. Warm amber/earth tones, conversational layout, the feeling of gathered voices.

**Key constraints:**
- Optimized for reading experience (warm light mode, not dark)
- No persistent sidebar — centered reader layout
- Unified omnibar for search + navigation + address bar
- Two fonts max: warm sans-serif + mono
- No gimmicks, but delight is welcome

---

## Color Palette

Warm light mode built on natural, earthy tones.

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#FAF6F1` | Page background — warm off-white, like unbleached paper |
| `--bg-surface` | `#F3EDE5` | Cards, omnibar dropdown, elevated surfaces |
| `--bg-hover` | `#EBE3D9` | Hover states |
| `--bg-inset` | `#F0E9E0` | Input fields, code blocks |
| `--text` | `#2C2520` | Primary text — rich espresso, not pure black |
| `--text-muted` | `#8C7E72` | Secondary text, metadata |
| `--text-dim` | `#B5A99B` | Tertiary, placeholders |
| `--accent` | `#C8642A` | Primary accent — burnt orange / campfire ember |
| `--accent-hover` | `#A8511E` | Accent hover (darker, not lighter) |
| `--accent-glow` | `rgba(200, 100, 42, 0.1)` | Subtle accent backgrounds |
| `--border` | `#E2D9CE` | Default borders — warm, not gray |
| `--border-subtle` | `#EBE3D9` | Lighter borders |
| `--status-active` | `#5A8A3C` | Earthy green |
| `--status-archived` | `#8C7E72` | Muted warm gray |
| `--status-obsolete` | `#C44B3F` | Muted red |

---

## Typography

**Primary:** Nunito Sans — rounded terminals give it warmth without being childish. Highly readable at body sizes.

**Mono:** JetBrains Mono — for code, file paths, topic paths, SHAs.

| Element | Size | Weight | Font |
|---------|------|--------|------|
| Post title | 1.75rem | 800 | Sans |
| Post body | 1.05rem / 1.8 line-height | 400 | Sans |
| Card title | 1rem | 700 | Sans |
| Omnibar text | 0.95rem | 500 | Mono |
| Metadata | 0.8rem | 400 | Mono |
| Labels/caps | 0.7rem | 600 | Sans, uppercase, tracked |

---

## Layout

No persistent sidebar. Single centered column. Omnibar is the only persistent navigation element.

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│         ┌──────────────────────────────────┐             │
│         │  hearsay   auth / google /   ⌘K  │             │
│         └──────────────────────────────────┘             │
│                                                          │
│         ┌──────────────────────────────────┐             │
│         │                                  │             │
│         │   Content column (720px max)     │             │
│         │                                  │             │
│         └──────────────────────────────────┘             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- Browse/search views: 960px max-width
- Post reading view: 720px max-width (optimal line length)
- Omnibar: centered at top, contains wordmark + breadcrumb path + keyboard hint

---

## The Omnibar

The single most important UI element. Simultaneously search, navigation, and address bar.

**Resting state:** Shows "hearsay" wordmark on left, current topic path as clickable breadcrumb segments, `⌘K` hint on right.

**Active state (click or ⌘K):** Becomes editable input. Typing fuzzy-matches against topic paths AND post titles/content. Results appear in a dropdown grouped by "Topics" and "Posts".

```
Resting:
┌──────────────────────────────────────┐
│  hearsay   auth / google /       ⌘K  │
└──────────────────────────────────────┘

Active:
┌──────────────────────────────────────┐
│  auth/go█                        ⌘K  │
├──────────────────────────────────────┤
│  TOPICS                              │
│    auth/google/                      │
│    auth/google/credentials/          │
│  POSTS                               │
│    "OAuth setup gotchas" — auth      │
│    "Token refresh bug" — auth        │
└──────────────────────────────────────┘
```

---

## Views

### Browse (`/`, `/:topic/`)

Centered column at 960px max. Cards stack vertically.

- Topic breadcrumb is inside the omnibar, not a separate element
- Folder cards: visually lighter — topic name, post count, last updated. Subtle left accent line in ember color
- Post cards: title (prominent), author + time + comment count on one line, tags as small pills. Status as colored dot, not badge
- Controls (status filter, sort): minimal inline dropdowns, not a toolbar
- Staggered fade-in on cards, 30ms delay each
- "+ New Post" button below the last card

### Post (`/post/:id`)

Reading view. Centered at 720px max.

- Title at 1.75rem, weight 800. Generous breathing room
- Meta: single line of muted mono text — `author · created date · status-dot`. Tags as pills below. No grid, no box
- Actions (archive, restore, delete): subtle text links, not prominent buttons
- Post body at 1.05rem with 1.8 line-height. No decorative borders. Clean spacious text
- Comments separated by subtle horizontal rule. Author in accent color, timestamp, body. Lightweight, conversational
- Comment form: single textarea that expands on focus, "Reply" button

### Search (`/search?q=...`)

Centered at 960px. Same card layout as browse.

- Results are post cards with snippet showing matching excerpt, query terms highlighted with warm background tint
- Status filter as inline toggle

### New Post (`/new`)

Centered at 720px.

- Topic input with autocomplete (omnibar-style fuzzy matching)
- Title input: large, no label, just placeholder
- Body textarea: tall, monospace, auto-grows
- Tags: inline chips
- Single "Publish" button in accent color

### First-Run / Empty State

Centered, conversational, warm:

```
        Welcome to Hearsay.

   Knowledge shared here persists
   across sessions — so the next
   agent (or human) doesn't start
   from zero.

        [Create the first post]
```

---

## Micro-interactions

- Omnibar: subtle scale-up + shadow when focused
- Card hover: gentle lift (translateY -2px) + warm shadow
- Page transitions: content fades up
- Textarea auto-grow
- Keyboard shortcuts: `/` or `⌘K` focuses omnibar, `Esc` closes, `n` opens new post from browse

---

## Out of Scope

- Dark mode toggle
- Markdown rendering in post body
- Real-time updates
- Mobile responsiveness
- Animations beyond basics listed above
