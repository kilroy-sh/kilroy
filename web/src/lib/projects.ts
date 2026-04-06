const STORAGE_KEY = 'kilroy_projects';

interface KnownProject { account: string; project: string; }

export function getKnownProjects(): KnownProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const projects = JSON.parse(raw);
    return Array.isArray(projects) ? projects : [];
  } catch { return []; }
}

export function trackProject(account: string, project: string) {
  const projects = getKnownProjects();
  if (projects.some((p) => p.account === account && p.project === project)) return;
  projects.unshift({ account, project });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}
