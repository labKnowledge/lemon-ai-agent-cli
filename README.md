# Lemon AI Agent CLI

A generic CLI agent powered by [lemon-ai-agent](https://www.npmjs.com/package/lemon-ai-agent) and Google Gemini. Read/write files, run shell commands, analyze websites with PageSpeed Insights, plan multi-step work, and orchestrate specialist agents.

## Setup

```bash
npm install
cp .env.example .env
# Add your GOOGLE_API_KEY to .env
```

## Usage

### Interactive REPL

```bash
npm run lemon
```

### One-shot print mode

```bash
npm run lemon -- -p "List files in the current directory"
npm run lemon -- --print "Summarize this project"
npm run lemon -- -p -f ./task.md
npm run lemon -- -p "refactor auth module" --plan-yolo
```

### Configuration

```bash
npm run lemon -- config
npm run lemon -- --cwd ./my-app --approval smart
```

| Flag | Description |
|------|-------------|
| `-p, --print <prompt>` | Run once and print result |
| `-f, --file <path>` | Read prompt from file |
| `--plan-yolo` | One-shot: plan and auto-select best path (requires `-p`) |
| `--cwd <path>` | Workspace root for tools |
| `--approval always\|smart\|yolo` | Shell approval mode (default: `always`) |
| `--model <model>` | Model id (default: `gemini-2.5-flash`) |
| `--session <id>` | Session id for history |

## Interaction modes

| Mode | How to activate | Behavior |
|------|-----------------|----------|
| `direct` | Default, `/d`, Shift+Tab | Execute immediately |
| `plan` | `/plan`, `/p`, Shift+Tab | Plan, critical Q&A, approval before execution |
| `plan-yolo` | `/plan-yolo`, `/py`, Shift+Tab, `--plan-yolo` | Plan, auto-select highest-scored path |
| `plan-verbose` | `/plan-verbose`, `/pv`, Shift+Tab | Verbose Q&A, refined plan, approval |

**Shift+Tab** cycles: `direct` → `plan` → `plan-yolo` → `plan-verbose` → `direct`. Works while typing — your input text is preserved.

Mode is shown in the REPL prompt: `lemon [plan-yolo]> `

### REPL commands

| Input | Behavior |
|-------|----------|
| `!npm test` | Run shell command directly (bypasses agent) |
| `!!` | Repeat last bang command |
| `/scan` | Scan codebase and save project context to session |
| `/p`, `/plan` | Set plan mode (optionally with prompt: `/p fix auth`) |
| `/py`, `/plan-yolo` | Set plan-yolo mode |
| `/pv`, `/plan-verbose` | Set plan-verbose mode |
| `/d`, `/direct` | Set direct mode |
| `/exit` | Quit |

### Approval modes (shell commands)

| Mode | Behavior |
|------|----------|
| `always` (default) | Prompt before every shell command |
| `smart` | Auto-run benign commands; prompt for destructive ones |
| `yolo` | Run all commands without prompts |

## Codebase scan and smart ignores

When you say "scan the codebase" (or run `/scan`), the agent builds a **project context** snapshot:

- Detected stack (Node, Python, Rust, Go, Java from marker files)
- Key config files and shallow directory tree (depth 2)
- Persisted in session for follow-up prompts

**Automatically excluded** from listing, globbing, and scans:

- `node_modules`, `.git`, `dist`, `build`, `.venv`, `venv`, `__pycache__`
- Profile-specific dirs (e.g. `target/` for Rust, `.tox/` for Python)
- Patterns from `.gitignore` and `.cursorignore`

Follow-up messages include the saved workspace context so the agent understands your project without re-scanning.

## Multi-agent execution

In plan modes, approved plans execute via **LemonGrove** with five specialists:

- `researcher_agent` — research and codebase exploration
- `coder_agent` — write and edit code
- `tester_agent` — run tests and verify
- `reviewer_agent` — review quality
- `general_agent` — general tasks

Steps run in **parallel batches** (same `parallelGroup`) or **sequential waves** (via `dependsOn`), based on the plan topology.

## Tools

- `read_file`, `write_file`, `list_directory`, `glob_files`
- `scan_codebase` — build project context (stack, layout, key files)
- `run_command` — shell commands in workspace
- `pagespeed_test` — Google PageSpeed Insights (pagespeed.web.dev backend)

## Build

```bash
npm run build
npm link   # optional: install `lemon` globally
```

## Requirements

- Node.js 20.15+
- `GOOGLE_API_KEY` in `.env` (Gemini + PageSpeed Insights)
