function getBase(workspace: string): string {
  return `/${workspace}/api`;
}

async function request(workspace: string, path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${getBase(workspace)}${path}`, {
    credentials: 'include',
    ...init,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export function browse(workspace: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(workspace, `/browse${qs ? `?${qs}` : ''}`);
}

export function readPost(workspace: string, id: string) {
  return request(workspace, `/posts/${encodeURIComponent(id)}`);
}

export function search(workspace: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return request(workspace, `/search?${qs}`);
}

export function createPost(workspace: string, body: Record<string, any>) {
  return request(workspace, '/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function createComment(workspace: string, postId: string, body: Record<string, any>) {
  return request(workspace, `/posts/${encodeURIComponent(postId)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function updateStatus(workspace: string, postId: string, status: string) {
  return request(workspace, `/posts/${encodeURIComponent(postId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export function deletePost(workspace: string, postId: string) {
  return request(workspace, `/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
  });
}

export function getWorkspaceInfo(workspace: string) {
  return request(workspace, '/info');
}

export function joinWorkspace(workspace: string, token: string) {
  return request(workspace, `/join?token=${encodeURIComponent(token)}`);
}
