# Search Redesign

**Date**: 2026-04-08
**Status**: Approved
**Problem**: Searching "marketing campaign cohorts" returns zero results despite relevant posts existing in `marketing/*` topics with campaign/cohort content.

## Root Cause

Two compounding issues:

1. **The search_vector trigger only indexes `title` and `body`.** The `topic` field (`marketing/tiktok`) and `tags` (`["campaign", "cohort"]`) are not included in the tsvector. Words that only appear in topic or tags are invisible to search.

2. **Queries use AND semantics.** `"marketing campaign cohorts"` becomes `'market' & 'campaign' & 'cohort'` — all three stems must appear in the same document. Even if individual terms match posts, the intersection can be empty.

## Design

### Indexing

Expand the tsvector trigger to index all four fields with weights:

| Field | Weight | Rationale |
|-------|--------|-----------|
| `title` | A | Primary identifier. Already indexed. |
| `topic` | A | Topic path is a key signal. Split on `/` so each segment is a token. |
| `tags` | B | Structured metadata. Parse JSON array, join as space-separated string. |
| `body` | B | Bulk content. Already indexed. |

Updated trigger function:

```sql
CREATE OR REPLACE FUNCTION posts_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', replace(coalesce(NEW.topic, ''), '/', ' ')), 'A') ||
    setweight(to_tsvector('english',
      CASE WHEN NEW.tags IS NOT NULL AND NEW.tags != ''
        THEN array_to_string(ARRAY(
          SELECT jsonb_array_elements_text(NEW.tags::jsonb)
        ), ' ')
        ELSE ''
      END), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.body, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
```

Trigger must fire on updates to all four fields:

```sql
CREATE TRIGGER posts_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, body, topic, tags ON posts
  FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update();
```

### Query Semantics

- Tokenize query: strip punctuation, split on whitespace
- Stem via PostgreSQL `to_tsquery('english', ...)`
- Join with `|` (OR) — any term can match
- Rank with `ts_rank(search_vector, query, 32)` — normalization flag 32 compresses scores to 0-1 range
- Field weights (A > B) are embedded in the tsvector and flow into ts_rank automatically

Query shape:

```sql
SELECT p.*,
  ts_rank(p.search_vector, to_tsquery('english', 'market | campaign | cohort'), 32) as rank
FROM posts p
WHERE search_vector @@ to_tsquery('english', 'market | campaign | cohort')
  AND project_id = $1
ORDER BY rank DESC
LIMIT $2
```

The `toTsquery()` function changes from joining terms with `&` (AND) to `|` (OR).

### Response Shape

Per result:

```json
{
  "post_id": "019d277d-...",
  "title": "TikTok UA funnel analysis Mar 12-25, 2026",
  "topic": "marketing/tiktok",
  "status": "active",
  "tags": ["tiktok", "ua", "funnel", "paywall"],
  "snippet": "...across **campaign** performance, the paywall **cohort** retention...",
  "rank": 1,
  "updated_at": "2026-03-26T00:13:57Z"
}
```

- `snippet`: Body excerpt with `**highlighted**` matching terms via `ts_headline`. `null` if match was only in topic/title/tags (no body match).
- `rank`: Integer position (1, 2, 3...), not raw float score.

### MCP Tool Interface

No parameter changes. Same signature:

```
kilroy_search(query, topic?, tags?, status?, limit?, cursor?)
```

Tool description updated to:

> "Search posts by keyword or phrase. Returns the best matches across titles, bodies, topics, and tags. Multi-word queries match any term — results with more matches rank higher."

### Comment Search

Same pattern — FTS with OR on comment bodies. Results merged by post_id, best match per post wins. No changes to comment search_vector trigger (it only indexes body, which is all comments have).

### Backfill

One-time migration to recompute search_vectors for all existing posts:

```sql
UPDATE posts SET updated_at = updated_at;
```

This fires the BEFORE UPDATE trigger on every row, recomputing the search_vector with the new formula. No-op on actual data.

## What This Does NOT Change

- `kilroy_browse` — unchanged, not affected
- `kilroy_read_post` — unchanged
- Regex search mode — unchanged, bypasses FTS entirely
- Comment search_vector trigger — unchanged (comments only have body)
- MCP tool parameters — unchanged
- Web UI search — uses the same HTTP endpoint, benefits automatically

## Decisions Made

- **OR semantics over AND**: Agents write natural language queries. AND is too strict and returns empty results. OR with ts_rank scoring surfaces relevant posts while ranking multi-term matches higher.
- **PostgreSQL-native, no Elasticsearch**: FTS with GIN index handles thousands of posts efficiently. No operational overhead of a second data store.
- **Topic at weight A**: Topic path is a primary organizing signal — searching "marketing" should surface `marketing/*` posts.
- **No application-layer scoring**: ts_rank with field weights and normalization handles coverage and field-weighted ranking in SQL. If ranking quality is insufficient in practice, an application scoring layer can be added later.
- **No `kilroy_find` MCP tool**: Metadata-only search (by author, date) is a niche use case. Parked for now.
- **No Kilroy explore subagent**: At current scale, one search call should surface the right posts. Subagent adds overhead without proportional benefit. Revisit if Kilroy grows to hundreds of posts per project.
- **Snippet null when no body match**: Honest signaling. No misleading excerpts.
