import { createLemonAgent } from 'lemon-ai-agent';
import type { LemonAgent } from 'lemon-ai-agent';
import type { CliConfig } from '../config.js';
import { createShellGate } from '../approval/gate.js';
import { createTools } from '../tools/index.js';

function agentOptions(config: CliConfig, systemMessage: string, maxIterations: number) {
  return {
    model: config.model,
    tools: createTools(config),
    systemMessage,
    maxIterations,
    humanGate: config.approval !== 'yolo' ? createShellGate(config.approval) : undefined,
  };
}

export async function createResearcher(config: CliConfig): Promise<LemonAgent> {
  return createLemonAgent({
    ...agentOptions(
      config,
      `You are a research specialist. Gather facts, read files, search the codebase, and summarize findings concisely. Workspace: ${config.cwd}`,
      15,
    ),
  });
}

export async function createCoder(config: CliConfig): Promise<LemonAgent> {
  return createLemonAgent({
    ...agentOptions(
      config,
      `You are a coding specialist. Write, edit, and refactor code. Run builds when needed. Workspace: ${config.cwd}`,
      20,
    ),
  });
}

export async function createTester(config: CliConfig): Promise<LemonAgent> {
  return createLemonAgent({
    ...agentOptions(
      config,
      `You are a testing specialist. Run tests, diagnose failures, and verify fixes. Workspace: ${config.cwd}`,
      15,
    ),
  });
}

export async function createReviewer(config: CliConfig): Promise<LemonAgent> {
  return createLemonAgent({
    ...agentOptions(
      config,
      `You are a review specialist. Review changes for quality, security, and correctness. Workspace: ${config.cwd}`,
      10,
    ),
  });
}

export async function createGeneral(config: CliConfig): Promise<LemonAgent> {
  return createLemonAgent({
    ...agentOptions(
      config,
      `You are a general-purpose specialist for miscellaneous tasks. Workspace: ${config.cwd}`,
      15,
    ),
  });
}
