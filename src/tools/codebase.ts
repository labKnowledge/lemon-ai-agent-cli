import { lemonTool, z } from 'lemon-ai-agent';
import { scanCodebase } from '../codebase/scan.js';
import { loadSession, saveCodebaseContext } from '../session/memory.js';

export function createCodebaseTool(workspaceCwd: string, sessionId: string) {
  return lemonTool({
    name: 'scan_codebase',
    description:
      'Scan the workspace to build project context: stack, layout, key files. Use when the user asks to scan, explore, or understand the codebase.',
    schema: z.object({
      depth: z.number().optional().describe('Directory tree depth (default 2)'),
      refresh: z.boolean().optional().describe('Force refresh even if cached context exists'),
    }),
    run: async ({ depth, refresh }) => {
      if (!refresh) {
        const session = await loadSession(sessionId);
        if (session.codebaseContext) {
          return `${session.codebaseContext}\n\n(cached — pass refresh: true to rescan)`;
        }
      }

      const result = await scanCodebase(workspaceCwd, { depth: depth ?? 2, refresh });
      await saveCodebaseContext(sessionId, result.summary, result.scannedAt);
      return result.summary;
    },
  });
}
