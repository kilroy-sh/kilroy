import { useState, useEffect } from 'react';
import { tags as fetchTags } from '../lib/api';
import { useProject } from '../context/ProjectContext';

interface TagSidebarProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export function TagSidebar({ selectedTags, onTagsChange }: TagSidebarProps) {
  const { accountSlug, projectSlug } = useProject();
  const [availableTags, setAvailableTags] = useState<Array<{tag: string; count: number}>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (selectedTags.length > 0) {
      params.tags = selectedTags.join(',');
    }
    fetchTags(accountSlug, projectSlug, params)
      .then((data) => setAvailableTags(data.tags || []))
      .catch(() => setAvailableTags([]))
      .finally(() => setLoading(false));
  }, [accountSlug, projectSlug, selectedTags]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const removeTag = (tag: string) => {
    onTagsChange(selectedTags.filter(t => t !== tag));
  };

  return (
    <div className="tag-sidebar">
      {selectedTags.length > 0 && (
        <div className="tag-sidebar-selected">
          <div className="tag-sidebar-section-label">Filtered by</div>
          {selectedTags.map(tag => (
            <button key={tag} className="tag-bubble tag-bubble-selected" onClick={() => removeTag(tag)}>
              {tag} <span className="tag-bubble-remove">✕</span>
            </button>
          ))}
          {selectedTags.length > 1 && (
            <button className="tag-sidebar-clear" onClick={() => onTagsChange([])}>
              Clear all
            </button>
          )}
        </div>
      )}
      <div className="tag-sidebar-available">
        {selectedTags.length > 0 && availableTags.length > 0 && (
          <div className="tag-sidebar-section-label">Related tags</div>
        )}
        {!selectedTags.length && availableTags.length > 0 && (
          <div className="tag-sidebar-section-label">Tags</div>
        )}
        {loading && availableTags.length === 0 && (
          <div className="tag-sidebar-loading">Loading...</div>
        )}
        {!loading && availableTags.length === 0 && selectedTags.length > 0 && (
          <div className="tag-sidebar-empty">No related tags</div>
        )}
        {!loading && availableTags.length === 0 && selectedTags.length === 0 && (
          <div className="tag-sidebar-empty">No tags yet</div>
        )}
        {availableTags.map(({ tag, count }) => (
          <button key={tag} className="tag-bubble" onClick={() => toggleTag(tag)}>
            {tag} <span className="tag-bubble-count">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
