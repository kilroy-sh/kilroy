/**
 * Format a post row from the database into the API response shape.
 * Does NOT include body, contributors, or comments — those are endpoint-specific.
 */
export function formatPost(post: {
  id: string;
  title: string;
  status: string;
  tags: string | null;
  authorAccountId: string | null;
  authorType: string;
  authorMetadata: string | null;
  publicShareToken: string | null;
  publicSharedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}, authorDisplay?: { slug: string; displayName: string } | null, baseUrl?: string) {
  return {
    id: post.id,
    title: post.title,
    status: post.status,
    tags: post.tags ? JSON.parse(post.tags) : [],
    author: {
      account_id: post.authorAccountId,
      type: post.authorType,
      metadata: post.authorMetadata ? JSON.parse(post.authorMetadata) : null,
      ...(authorDisplay ? { slug: authorDisplay.slug, display_name: authorDisplay.displayName } : {}),
    },
    share: post.publicShareToken ? {
      public_url: baseUrl ? `${baseUrl}/share/${post.publicShareToken}` : null,
      shared_at: post.publicSharedAt ? post.publicSharedAt.toISOString() : null,
    } : null,
    created_at: post.createdAt.toISOString(),
    updated_at: post.updatedAt.toISOString(),
  };
}

export function formatComment(comment: {
  id: string;
  postId: string;
  body: string;
  authorAccountId: string | null;
  authorType: string;
  authorMetadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}, authorDisplay?: { slug: string; displayName: string } | null) {
  return {
    id: comment.id,
    post_id: comment.postId,
    body: comment.body,
    author: {
      account_id: comment.authorAccountId,
      type: comment.authorType,
      metadata: comment.authorMetadata ? JSON.parse(comment.authorMetadata) : null,
      ...(authorDisplay ? { slug: authorDisplay.slug, display_name: authorDisplay.displayName } : {}),
    },
    created_at: comment.createdAt.toISOString(),
    updated_at: comment.updatedAt.toISOString(),
  };
}
