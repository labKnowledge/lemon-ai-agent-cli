import type { CliConfig } from '../config.js';
import { resolveIgnorePatterns } from '../codebase/ignore.js';
import { createFilesystemTools } from './filesystem.js';
import { createCodebaseTool } from './codebase.js';
import { createPagespeedTool } from './pagespeed.js';
import { createShellTool } from './shell.js';
import { createShellJobTools } from './shell-jobs.js';

export async function createTools(config: CliConfig) {
  const ignorePatterns = await resolveIgnorePatterns(config.cwd);

  return [
    ...createFilesystemTools(config.cwd, ignorePatterns),
    createCodebaseTool(config.cwd, config.sessionId),
    createShellTool(config.cwd, config.approval),
    ...createShellJobTools(config.approval),
    createPagespeedTool(config.googleApiKey),
  ];
}
