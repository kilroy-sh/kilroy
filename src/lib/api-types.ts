// Shared API response types — consumed by server (formatters, MCP) and web (fetch client).
// Pure types: no runtime, no imports. Safe to import from any package.

export type FormattedAuthor = {
  account_id: string | null;
  type: string;
  metadata: unknown;
  slug?: string;
  display_name?: string;
};

export type FormattedShare = {
  public_url: string | null;
  shared_at: string | null;
} | null;

export type FormattedPost = {
  id: string;
  title: string;
  status: string;
  tags: string[];
  author: FormattedAuthor;
  share: FormattedShare;
  created_at: string;
  updated_at: string;
};

export type FormattedComment = {
  id: string;
  post_id: string;
  body: string;
  author: FormattedAuthor;
  created_at: string;
  updated_at: string;
};

export type Contributor = {
  account_id: string;
  slug?: string;
  display_name?: string;
};

/** Response from GET /posts/:id — full post with body, contributors, and comments. */
export type ReadPostResponse = FormattedPost & {
  body: string;
  contributors: Contributor[];
  comments: FormattedComment[];
};

export type SearchResultItem = {
  post_id: string;
  title: string;
  status: string;
  tags: string[];
  snippet: string | null;
  match_location: string | null;
  rank: number;
  updated_at: string;
  // Browse mode (no query) adds these:
  comment_count?: number;
  author?: FormattedAuthor;
};

export type SearchResponse = {
  query: string | null;
  results: SearchResultItem[];
  next_cursor?: string;
  has_more?: boolean;
};

// ─── Browse (folder/topic view) ─────────────────────────────────
// NOTE: The /browse route is referenced by the web client and CLI but is not
// currently implemented on the server. This type captures the expected contract
// based on the consumers' usage. Implementing the route is tracked separately.

export type BrowsePost = {
  id: string;
  title: string;
  topic: string;
  status: string;
  tags: string[];
  updated_at: string;
  created_at?: string;
  author?: FormattedAuthor;
};

export type BrowseSubtopic = {
  name: string;
  post_count: number;
};

export type BrowseResponse = {
  posts: BrowsePost[];
  subtopics: BrowseSubtopic[];
  next_cursor?: string;
  has_more?: boolean;
};

// ─── Errors ─────────────────────────────────────────────────────

/** Standard error body returned by every route on failure. */
export type ApiError = {
  error: string;
  code?: string;
};

// ─── Project-scoped routes ──────────────────────────────────────

export type DeletePostResponse = {
  deleted: true;
  post_id: string;
};

export type SharePostResponse = {
  share: FormattedShare;
};

export type RevokeShareResponse = {
  share: null;
};

export type TagCount = {
  tag: string;
  count: number;
};

export type TagsResponse = {
  tags: TagCount[];
};

export type ProjectInfoResponse = {
  account: string;
  project: string;
  project_id: string;
  member_key: string;
  install_command: string;
  invite_link: string | null;
};

export type FindResultItem = {
  id: string;
  title: string;
  status: string;
  tags: string[];
  author: {
    account_id: string | null;
    type: string;
    metadata: unknown;
  };
  created_at: string;
  updated_at: string;
};

export type FindResponse = {
  results: FindResultItem[];
  next_cursor?: string;
  has_more?: boolean;
};

/** Response from GET /api/public/posts/:token. Like ReadPostResponse but without contributors. */
export type PublicPostResponse = FormattedPost & {
  body: string;
  comments: FormattedComment[];
};

// ─── Project-scoped join (/{account}/{project}/api/join) ────────

export type JoinNeedsLoginResponse = {
  account: string;
  project: string;
  project_url: string;
  requires_login: true;
};

export type JoinNeedsOnboardingResponse = {
  account: string;
  project: string;
  requires_onboarding: true;
};

export type JoinAlreadyMemberResponse = {
  account: string;
  project: string;
  project_url: string;
  already_member: true;
  member_key: string;
  install_command: string;
};

export type JoinSuccessResponse = {
  account: string;
  project: string;
  project_url: string;
  joined: true;
  member_key: string;
  install_command: string;
};

export type JoinResponse =
  | JoinNeedsLoginResponse
  | JoinNeedsOnboardingResponse
  | JoinAlreadyMemberResponse
  | JoinSuccessResponse;

// ─── Global routes (/api/...) ───────────────────────────────────

export type AuthConfig = {
  emailPassword: boolean;
  providers: Array<"github" | "google">;
};

export type AccountSummary = {
  id: string;
  slug: string;
  display_name: string;
};

export type AccountUserOnly = {
  has_account: false;
  user: { email: string; name: string };
};

export type AccountWithAccount = {
  has_account: true;
  account: AccountSummary;
};

export type AccountResponse = AccountUserOnly | AccountWithAccount;

/** Response from POST /api/account — uses raw camelCase fields from createAccount(). */
export type CreateAccountResponse = {
  id: string;
  slug: string;
  displayName: string;
};

export type SlugSuggestionResponse = {
  suggestion: string;
};

export type OwnedProjectSummary = {
  id: string;
  slug: string;
  created_at: string;
};

export type JoinedProjectSummary = {
  id: string;
  slug: string;
  owner: string;
  joined_at: string;
};

export type ProjectsListResponse = {
  owned: OwnedProjectSummary[];
  joined: JoinedProjectSummary[];
};

export type CreateProjectResponse = {
  id: string;
  slug: string;
  account_slug: string;
  member_key: string;
  project_url: string;
  install_command: string;
  invite_link: string;
};

export type MemberSummary = {
  account_id: string;
  slug: string;
  display_name: string;
  role: string;
  joined_at: string;
};

export type MembersListResponse = {
  members: MemberSummary[];
};

export type RemoveMemberResponse = {
  removed: true;
};

export type LeaveProjectResponse = {
  left: true;
};

export type RegenerateInviteResponse = {
  invite_token: string;
};

export type RegenerateKeyResponse = {
  member_key: string;
};

export type StatsResponse = {
  projects: number;
  writes: {
    total: number;
    last24h: number;
  };
};

// ─── OAuth (better-auth-backed) ─────────────────────────────────

export type OAuthConsentRequest = {
  accept: boolean;
  oauth_query: string;
};

/** Better-auth's response shape: success returns a redirect URL under one of these keys. */
export type OAuthConsentResponse = {
  url?: string;
  redirectTo?: string;
};
