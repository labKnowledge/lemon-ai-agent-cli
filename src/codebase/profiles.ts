import { access } from 'node:fs/promises';
import { join } from 'node:path';

export type ProjectProfile = 'node' | 'python' | 'rust' | 'go' | 'java';

const PROFILE_MARKERS: Record<ProjectProfile, string[]> = {
  node: ['package.json'],
  python: ['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile'],
  rust: ['Cargo.toml'],
  go: ['go.mod'],
  java: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
};

const PROFILE_EXTRA_IGNORES: Record<ProjectProfile, string[]> = {
  node: ['**/.pnpm-store/**', '**/.yarn/**', '**/out/**'],
  python: ['**/.tox/**', '**/.nox/**', '**/htmlcov/**'],
  rust: ['**/target/**'],
  go: ['**/vendor/**'],
  java: ['**/target/**', '**/.gradle/**', '**/build/**'],
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function detectProfiles(cwd: string): Promise<ProjectProfile[]> {
  const found: ProjectProfile[] = [];

  for (const [profile, markers] of Object.entries(PROFILE_MARKERS) as [
    ProjectProfile,
    string[],
  ][]) {
    for (const marker of markers) {
      if (await exists(join(cwd, marker))) {
        found.push(profile);
        break;
      }
    }
  }

  return found;
}

export function getProfileIgnores(profiles: ProjectProfile[]): string[] {
  const patterns = new Set<string>();
  for (const profile of profiles) {
    for (const p of PROFILE_EXTRA_IGNORES[profile]) {
      patterns.add(p);
    }
  }
  return [...patterns];
}

export const KEY_FILES_BY_PROFILE: Record<ProjectProfile, string[]> = {
  node: ['package.json', 'tsconfig.json', 'README.md'],
  python: ['pyproject.toml', 'requirements.txt', 'README.md'],
  rust: ['Cargo.toml', 'README.md'],
  go: ['go.mod', 'README.md'],
  java: ['pom.xml', 'build.gradle', 'README.md'],
};
