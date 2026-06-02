import { createLemonAgent } from 'lemon-ai-agent';
import type { LemonAgent } from 'lemon-ai-agent';
import type { CliConfig } from '../config.js';
import { createShellGate } from '../approval/gate.js';
import type { createTools } from '../tools/index.js';

type ToolSet = Awaited<ReturnType<typeof createTools>>;

function agentOptions(
  config: CliConfig,
  systemMessage: string,
  maxIterations: number,
  tools: ToolSet,
) {
  return {
    model: config.model,
    tools,
    systemMessage,
    maxIterations,
    humanGate: config.approval !== 'yolo' ? createShellGate(config.approval) : undefined,
  };
}

export async function createResearcher(config: CliConfig, tools: ToolSet): Promise<LemonAgent> {
  return createLemonAgent({
    ...agentOptions(
      config,
      `You are a research specialist. Gather facts, read files, search the codebase, and summarize findings concisely. Use scan_codebase for project overview. Never traverse node_modules, .venv, dist, or similar dirs. Workspace: ${config.cwd}`,
      15,
      tools,
    ),
  });
}

export async function createCoder(config: CliConfig, tools: ToolSet): Promise<LemonAgent> {
  return createLemonAgent({
    ...agentOptions(
      config,
      `You are a coding specialist. Write, edit, and refactor code. Run builds when needed. Workspace: ${config.cwd}`,
      20,
      tools,
    ),
  });
}

export async function createTester(config: CliConfig, tools: ToolSet): Promise<LemonAgent> {
  return createLemonAgent({
    ...agentOptions(
      config,
      `You are a testing specialist. Run tests, diagnose failures, and verify fixes. Workspace: ${config.cwd}`,
      15,
      tools,
    ),
  });
}

export async function createReviewer(config: CliConfig, tools: ToolSet): Promise<LemonAgent> {
  return createLemonAgent({
    ...agentOptions(
      config,
      `You are a review specialist. Review changes for quality, security, and correctness. Workspace: ${config.cwd}`,
      10,
      tools,
    ),
  });
}

export async function createGeneral(config: CliConfig, tools: ToolSet): Promise<LemonAgent> {
  return createLemonAgent({
    ...agentOptions(
      config,
      `You are a general-purpose specialist for miscellaneous tasks. Workspace: ${config.cwd}`,
      15,
      tools,
    ),
  });
}
