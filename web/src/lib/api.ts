import type {
  FormattedPost,
  FormattedComment,
  ReadPostResponse,
  SearchResponse,
  BrowseResponse,
  TagsResponse,
  DeletePostResponse,
  SharePostResponse,
  RevokeShareResponse,
  ProjectInfoResponse,
  PublicPostResponse,
  MembersListResponse,
  RemoveMemberResponse,
  LeaveProjectResponse,
  RegenerateInviteResponse,
  RegenerateKeyResponse,
  ProjectsListResponse,
  CreateProjectResponse,
  AccountResponse,
  CreateAccountResponse,
  SlugSuggestionResponse,
  StatsResponse,
  AuthConfig,
  JoinResponse,
  OAuthConsentRequest,
  OAuthConsentResponse,
} from '@kilroy/api-types';

function getBase(accountSlug: string, projectSlug: string): string {
  return `/${accountSlug}/${projectSlug}/api`;
}

async function request<T>(accountSlug: string, projectSlug: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getBase(accountSlug, projectSlug)}${path}`, {
    credentials: 'include',
    ...init,
  });
  const contentType = res.headers.get('content-type') || '';
  const raw = await res.text();
  let data: any = null;

  if (raw) {
    if (contentType.includes('application/json')) {
      data = JSON.parse(raw);
    } else {
      try {
        data = JSON.parse(raw);
      } catch {
        if (res.status === 401) {
          window.location.href = '/login';
          throw new Error('Redirecting to login…');
        }
        throw new Error(`Expected JSON response but received ${contentType || 'non-JSON content'}`);
      }
    }
  }

  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Redirecting to login…');
  }
  if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
  return data as T;
}

/**
 * Wrapper for global `/api/...` fetches that don't go through the project-scoped base path.
 * Same auth + error handling, no project context.
 */
async function globalRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'include', ...init });
  const data = await res.json().catch(() => null);
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Redirecting to login…');
  }
  if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
  return data as T;
}

// ─── Project-scoped API ─────────────────────────────────────────

// NOTE: The `/browse` route is referenced by callers but not currently implemented
// on the server — this wrapper will 404 at runtime until that lands.
export function browse(accountSlug: string, projectSlug: string, params: Record<string, string> = {}, init?: RequestInit): Promise<BrowseResponse> {
  const qs = new URLSearchParams(params).toString();
  return request<BrowseResponse>(accountSlug, projectSlug, `/browse${qs ? `?${qs}` : ''}`, init);
}

export function tags(accountSlug: string, projectSlug: string, params: Record<string, string> = {}, init?: RequestInit): Promise<TagsResponse> {
  const qs = new URLSearchParams(params).toString();
  return request<TagsResponse>(accountSlug, projectSlug, `/tags${qs ? `?${qs}` : ''}`, init);
}

export function readPost(accountSlug: string, projectSlug: string, id: string): Promise<ReadPostResponse> {
  return request<ReadPostResponse>(accountSlug, projectSlug, `/posts/${encodeURIComponent(id)}`);
}

export function search(accountSlug: string, projectSlug: string, params: Record<string, string>): Promise<SearchResponse> {
  const qs = new URLSearchParams(params).toString();
  return request<SearchResponse>(accountSlug, projectSlug, `/search?${qs}`);
}

export function createPost(accountSlug: string, projectSlug: string, body: Record<string, any>): Promise<FormattedPost> {
  return request<FormattedPost>(accountSlug, projectSlug, '/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function updatePost(accountSlug: string, projectSlug: string, postId: string, body: Record<string, any>): Promise<FormattedPost> {
  return request<FormattedPost>(accountSlug, projectSlug, `/posts/${encodeURIComponent(postId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function createComment(accountSlug: string, projectSlug: string, postId: string, body: Record<string, any>): Promise<FormattedComment> {
  return request<FormattedComment>(accountSlug, projectSlug, `/posts/${encodeURIComponent(postId)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function sharePost(accountSlug: string, projectSlug: string, postId: string): Promise<SharePostResponse> {
  return request<SharePostResponse>(accountSlug, projectSlug, `/posts/${encodeURIComponent(postId)}/share`, {
    method: 'POST',
  });
}

export function revokePostShare(accountSlug: string, projectSlug: string, postId: string): Promise<RevokeShareResponse> {
  return request<RevokeShareResponse>(accountSlug, projectSlug, `/posts/${encodeURIComponent(postId)}/share`, {
    method: 'DELETE',
  });
}

export function updateStatus(accountSlug: string, projectSlug: string, postId: string, status: string): Promise<FormattedPost> {
  return request<FormattedPost>(accountSlug, projectSlug, `/posts/${encodeURIComponent(postId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export function deletePost(accountSlug: string, projectSlug: string, postId: string): Promise<DeletePostResponse> {
  return request<DeletePostResponse>(accountSlug, projectSlug, `/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
  });
}

export function getProjectInfo(accountSlug: string, projectSlug: string): Promise<ProjectInfoResponse> {
  return request<ProjectInfoResponse>(accountSlug, projectSlug, '/info');
}

// ─── Global API ─────────────────────────────────────────────────

export function listMembers(projectId: string): Promise<MembersListResponse> {
  return globalRequest<MembersListResponse>(`/api/projects/${encodeURIComponent(projectId)}/members`);
}

export function removeMemberApi(projectId: string, accountId: string): Promise<RemoveMemberResponse> {
  return globalRequest<RemoveMemberResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(accountId)}`,
    { method: 'DELETE' },
  );
}

export function leaveProject(projectId: string): Promise<LeaveProjectResponse> {
  return globalRequest<LeaveProjectResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/leave`,
    { method: 'POST' },
  );
}

export function regenerateInviteLinkApi(projectId: string): Promise<RegenerateInviteResponse> {
  return globalRequest<RegenerateInviteResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/regenerate-invite`,
    { method: 'POST' },
  );
}

export function regenerateKeyApi(projectId: string): Promise<RegenerateKeyResponse> {
  return globalRequest<RegenerateKeyResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/regenerate-key`,
    { method: 'POST' },
  );
}

// ─── Special-case responses (binary, unauthenticated) ───────────

/** Streams a zip; doesn't return JSON. */
export async function exportProject(accountSlug: string, projectSlug: string): Promise<void> {
  const res = await fetch(`${getBase(accountSlug, projectSlug)}/export`, {
    credentials: 'include',
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Redirecting to login…');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Export failed: ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kilroy-export.zip';
  a.click();
  URL.revokeObjectURL(url);
}

/** Public share view — unauthenticated, custom 401 handling not needed. */
export async function readPublicPost(token: string): Promise<PublicPostResponse> {
  const res = await fetch(`/api/public/posts/${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
  return data as PublicPostResponse;
}

// ─── Account / projects (global) ────────────────────────────────

/**
 * Reads the signed-in account. Returns `null` when the user isn't authenticated
 * (the endpoint legitimately 401s in that case). Does NOT redirect to /login —
 * AuthContext uses this to decide whether a user is signed in at all.
 */
export async function getAccount(): Promise<AccountResponse | null> {
  try {
    const res = await fetch('/api/account', { credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as AccountResponse;
  } catch {
    return null;
  }
}

export function createAccount(slug: string, displayName?: string): Promise<CreateAccountResponse> {
  return globalRequest<CreateAccountResponse>('/api/account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, ...(displayName ? { display_name: displayName } : {}) }),
  });
}

export function getSlugSuggestion(): Promise<SlugSuggestionResponse> {
  return globalRequest<SlugSuggestionResponse>('/api/account/slug-suggestion');
}

export function listProjects(): Promise<ProjectsListResponse> {
  return globalRequest<ProjectsListResponse>('/api/projects');
}

export function createProjectApi(slug: string): Promise<CreateProjectResponse> {
  return globalRequest<CreateProjectResponse>('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
  });
}

// ─── Public / auth (no credentials, no JSON-error redirect) ─────

/** No auth needed; returns null on failure rather than throwing. */
export async function getStats(): Promise<StatsResponse | null> {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return null;
    return (await res.json()) as StatsResponse;
  } catch {
    return null;
  }
}

/** No auth needed. */
export async function getAuthConfig(): Promise<AuthConfig | null> {
  try {
    const res = await fetch('/api/auth-config');
    if (!res.ok) return null;
    return (await res.json()) as AuthConfig;
  } catch {
    return null;
  }
}

// ─── Project-scoped join ────────────────────────────────────────

export function getJoinInfo(accountSlug: string, projectSlug: string, token: string): Promise<JoinResponse> {
  return request<JoinResponse>(accountSlug, projectSlug, `/join?token=${encodeURIComponent(token)}`);
}

// ─── OAuth consent (better-auth) ────────────────────────────────

export function oauthConsent(body: OAuthConsentRequest): Promise<OAuthConsentResponse> {
  return globalRequest<OAuthConsentResponse>('/api/auth/oauth2/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
