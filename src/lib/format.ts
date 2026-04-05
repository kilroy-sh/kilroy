/**
 * Format a post row from the database into the API response shape.
 * Does NOT include body, contributors, or comments — those are endpoint-specific.
 */
export function formatPost(post: {
  id: string;
  title: string;
  topic: string;
  status: string;
  tags: string | null;
  author: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: post.id,
    title: post.title,
    topic: post.topic,
    status: post.status,
    tags: post.tags ? JSON.parse(post.tags) : [],
    author: post.author,
    created_at: post.createdAt.toISOString(),
    updated_at: post.updatedAt.toISOString(),
  };
}
