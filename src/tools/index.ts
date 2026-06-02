import type { CliConfig } from '../config.js';
import { createFilesystemTools } from './filesystem.js';
import { createPagespeedTool } from './pagespeed.js';
import { createShellTool } from './shell.js';

export function createTools(config: CliConfig) {
  return [
    ...createFilesystemTools(config.cwd),
    createShellTool(config.cwd, config.approval),
    createPagespeedTool(config.googleApiKey),
  ];
}
