import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import fg from 'fast-glob';
import { lemonTool, z } from 'lemon-ai-agent';
import { resolveWithinCwd } from './path-utils.js';

export function createFilesystemTools(workspaceCwd: string) {
  const readFileTool = lemonTool({
    name: 'read_file',
    description: 'Read the contents of a file in the workspace.',
    schema: z.object({
      path: z.string().describe('Relative path to the file'),
      offset: z.number().optional().describe('1-based line number to start reading from'),
      limit: z.number().optional().describe('Maximum number of lines to read'),
    }),
    run: async ({ path, offset, limit }) => {
      const resolved = resolveWithinCwd(workspaceCwd, path);
      const content = await readFile(resolved, 'utf-8');
      const lines = content.split('\n');

      const start = offset ? Math.max(0, offset - 1) : 0;
      const end = limit ? start + limit : lines.length;
      const slice = lines.slice(start, end);

      const numbered = slice.map((line, i) => {
        const lineNum = String(start + i + 1).padStart(6, ' ');
        return `${lineNum}|${line}`;
      });

      return numbered.join('\n');
    },
  });

  const writeFileTool = lemonTool({
    name: 'write_file',
    description: 'Write or overwrite a file in the workspace. Creates parent directories if needed.',
    schema: z.object({
      path: z.string().describe('Relative path to the file'),
      content: z.string().describe('File content to write'),
    }),
    run: async ({ path, content }) => {
      const resolved = resolveWithinCwd(workspaceCwd, path);
      await mkdir(dirname(resolved), { recursive: true });
      await writeFile(resolved, content, 'utf-8');
      return `Wrote ${path} (${content.length} bytes)`;
    },
  });

  const listDirectoryTool = lemonTool({
    name: 'list_directory',
    description: 'List files and directories in the workspace.',
    schema: z.object({
      path: z.string().optional().describe('Relative directory path (default: workspace root)'),
      recursive: z.boolean().optional().describe('List recursively'),
    }),
    run: async ({ path, recursive }) => {
      const resolved = resolveWithinCwd(workspaceCwd, path ?? '.');

      if (recursive) {
        const entries = await fg('**/*', {
          cwd: resolved,
          dot: true,
          onlyFiles: false,
          markDirectories: true,
        });
        return entries.length ? entries.join('\n') : '(empty directory)';
      }

      const entries = await readdir(resolved, { withFileTypes: true });
      const lines = await Promise.all(
        entries.map(async (entry) => {
          const suffix = entry.isDirectory() ? '/' : '';
          const fullPath = resolveWithinCwd(resolved, entry.name);
          const info = await stat(fullPath);
          return `${entry.name}${suffix} (${info.size} bytes)`;
        }),
      );
      return lines.length ? lines.join('\n') : '(empty directory)';
    },
  });

  const globFilesTool = lemonTool({
    name: 'glob_files',
    description: 'Find files matching a glob pattern in the workspace.',
    schema: z.object({
      pattern: z.string().describe('Glob pattern, e.g. **/*.ts'),
    }),
    run: async ({ pattern }) => {
      const matches = await fg(pattern, {
        cwd: workspaceCwd,
        dot: false,
        onlyFiles: true,
      });
      return matches.length ? matches.join('\n') : 'No files matched.';
    },
  });

  return [readFileTool, writeFileTool, listDirectoryTool, globFilesTool];
}
