// Bridge between our consent middleware and Better Auth's consentReferenceId callback.
// Both run within the same HTTP request — the Map just passes data between them.

interface PendingProject {
  projectId: string;
  accountSlug: string;
  projectSlug: string;
}

const store = new Map<string, PendingProject>();

export function setPendingProject(sessionId: string, project: PendingProject) {
  store.set(sessionId, project);
}

export function getPendingProject(sessionId: string): PendingProject | null {
  return store.get(sessionId) ?? null;
}

export function clearPendingProject(sessionId: string) {
  store.delete(sessionId);
}
