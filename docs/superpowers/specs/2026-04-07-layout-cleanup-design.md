# Layout Cleanup: Unified 720px Content Column

## Problem

The web UI has three different content widths (omnibar ~640px, browse 960px, post detail 720px), all centered independently. The controls row (filters, sort, New Post) floats as a separate band between the omnibar and content. Navigating from browse to post detail causes a jarring width shift. The omnibar also houses unrelated actions (Invite, theme toggle) alongside its navigation/search role.

## Design

### Unified width

All content uses **720px max-width**, matching the existing reading/post-detail width.

- Browse view: narrows from 960px to 720px
- Post detail view: stays at 720px (no change)
- Post editor view: stays at 720px (no change)
- Search results view: narrows from 960px to 720px
- Omnibar inner content: widens from ~640px to 720px

This eliminates width shifts when navigating between views. 720px yields ~80-90 characters per line at 16px body text — slightly above ideal for pure prose, but right for Kilroy's mixed content (prose + code + tables).

Wide tables and code blocks get `overflow-x: auto` and scroll horizontally within the 720px container. Standard pattern.

### Navbar restructure

The navbar is a full-width sticky bar. It contains three zones:

```
┌─── navbar (full width, sticky) ────────────────────────────────┐
│ [□ sidebar]    ┌─ omnibar (720px, centered) ─┐   [+Invite] [theme] [account] │
│                │ srijan / sagaland /      ⌘K  │                               │
│                └──────────────────────────────┘                               │
└────────────────────────────────────────────────────────────────┘
```

**Left zone:** Sidebar toggle button. Positioned absolute or at the left edge of the navbar.

**Center zone:** Omnibar pill, max-width 720px, centered. Contains only:
- Breadcrumb path (clickable segments)
- Search input (activated by ⌘K or clicking)

**Right zone:** App-level actions, positioned absolute or at the right edge. Contains:
- Invite button
- Theme toggle
- Account menu

The omnibar no longer houses Invite or theme toggle. It is purely navigation + search.

### Browse view

Controls row stays as-is, just narrower at 720px:

```
┌─── 720px ─────────────────────────────────────┐
│ [Active] [Archived] [Obsolete] [All]           │
│ [Sort: Updated ▾]                [+ New Post]  │
│                                                 │
│ analytics/                           5 posts   │
│ 8 contributors · 12d ago                       │
│ ────────────────────────────────────────────── │
│ marketing/                           4 posts   │
│ 8 contributors · 12d ago                       │
│ ────────────────────────────────────────────── │
│ ...                                             │
└─────────────────────────────────────────────────┘
```

No changes to filter behavior, sort behavior, or New Post button placement.

### Post detail view

No layout changes. Already at 720px. Title, date, tags, actions, body, comments all stay as-is.

### Search results view

Narrows from 960px to 720px. No other changes.

### Post editor view

No changes. Already at 720px.

## CSS changes summary

1. `--content-width`: change from `960px` to `720px` (or remove the variable and use `--reading-width` everywhere)
2. `.omnibar`: widen to `max-width: 720px` (matching content)
3. Move `.invite-wrapper` and `.theme-toggle` out of `.omnibar` into a new `.navbar-actions` container positioned at the right edge of `.omnibar-row`
4. `.omnibar-row`: ensure it supports three-zone layout (left sidebar toggle, center omnibar, right actions)
5. `.prose table`: ensure `overflow-x: auto` on a wrapper element
6. Remove `.content.reading` class distinction if both widths are now 720px — just use `.content`

## Out of scope

- Sidebar redesign (stays as-is, mostly closed)
- Mobile responsiveness
- New Post button placement changes
- Filter/sort behavior changes
- Post detail layout changes
