# Lemon Code

A terminal UI coding agent powered by [lemon-ai-agent](https://www.npmjs.com/package/lemon-ai-agent), Google Gemini, [Bun](https://bun.sh), and [OpenTUI](https://opentui.com/) React. Read/write files, run shell commands, analyze websites with PageSpeed Insights, plan multi-step work, and orchestrate specialist agents.

The interactive TUI opens with a **Lemon Code** session header at the top of the transcript (cwd, model, mode, and keybindings). The footer stays minimal: input and ephemeral busy/status lines.

## Setup

```bash
bun install
cp .env.example .env
# Add your GOOGLE_API_KEY to .env
```

Requires [Bun](https://bun.sh) 1.1+ and a terminal that supports modern TUI rendering.

## Usage

### Interactive REPL (OpenTUI)

```bash
bun run lemon
```

### One-shot mode (OpenTUI, auto-runs and exits)

```bash
bun run lemon -- -p "List files in the current directory"
bun run lemon -- --print "Summarize this project"
bun run lemon -- -p -f ./task.md
bun run lemon -- -p "refactor auth module" --plan-yolo
```

### Configuration

```bash
bun run lemon -- config
bun run lemon -- --cwd ./my-app --approval smart
```

| Flag                             | Description                                              |
| -------------------------------- | -------------------------------------------------------- |
| `-p, --print <prompt>`           | Run once in the TUI and exit when done                   |
| `-f, --file <path>`              | Read prompt from file                                    |
| `--plan-yolo`                    | One-shot: plan and auto-select best path (requires `-p`) |
| `--cwd <path>`                   | Workspace root for tools                                 |
| `--approval always\|smart\|yolo` | Shell approval mode (default: `always`)                  |
| `--model <model>`                | Model id (default: `gemini-2.5-flash`)                   |
| `--session <id>`                 | Session id for history                                   |

## Interaction modes

| Mode           | How to activate                               | Behavior                                      |
| -------------- | --------------------------------------------- | --------------------------------------------- |
| `direct`       | Default, `/d`, Shift+Tab                      | Execute immediately                           |
| `plan`         | `/plan`, `/p`, Shift+Tab                      | Plan, critical Q&A, approval before execution |
| `plan-yolo`    | `/plan-yolo`, `/py`, Shift+Tab, `--plan-yolo` | Plan, auto-select highest-scored path         |
| `plan-verbose` | `/plan-verbose`, `/pv`, Shift+Tab             | Verbose Q&A, refined plan, approval           |

**Shift+Tab** cycles: `direct` → `plan` → `plan-yolo` → `plan-verbose` → `direct`.

Mode is shown in the input bar title: `Lemon Code [plan-yolo]>`.

### Input autocomplete

| Trigger | Behavior |
| ------- | -------- |
| `/` | Lists built-in slash commands and custom commands from `.lemon/commands/*.md` |
| `@` | Fuzzy file search in the workspace (respects ignore rules); file content is included when you send the message |
| `!` | Shell command hints (last command + common examples) |
| `ctrl+p` | Command palette — filter and run any command or quick action |

Use **Up/Down** and **Tab** or **Enter** to apply a suggestion. **Esc** closes the menu.

### REPL commands

| Input                  | Behavior                                              |
| ---------------------- | ----------------------------------------------------- |
| `!npm test`            | Run shell command directly (bypasses agent)           |
| `!!`                   | Repeat last bang command                              |
| `/scan`                | Scan codebase and save project context to session     |
| `/p`, `/plan`          | Set plan mode (optionally with prompt: `/p fix auth`) |
| `/py`, `/plan-yolo`    | Set plan-yolo mode                                    |
| `/pv`, `/plan-verbose` | Set plan-verbose mode                                 |
| `/d`, `/direct`        | Set direct mode                                       |
| `/exit`                | Quit                                                  |

### Approval modes (shell commands)

| Mode               | Behavior                                              |
| ------------------ | ----------------------------------------------------- |
| `always` (default) | Prompt before every shell command                     |
| `smart`            | Auto-run benign commands; prompt for destructive ones |
| `yolo`             | Run all commands without prompts                      |

## Codebase scan and smart ignores

When you say "scan the codebase" (or run `/scan`), the agent builds a **project context** snapshot:

- Detected stack (Node, Python, Rust, Go, Java from marker files)
- Key config files and shallow directory tree (depth 2)
- Persisted in session for follow-up prompts

**Automatically excluded** from listing, globbing, and scans:

- `node_modules`, `.git`, `dist`, `build`, `.venv`, `venv`, `__pycache__`
- Profile-specific dirs (e.g. `target/` for Rust, `.tox/` for Python)
- Patterns from `.gitignore` and `.cursorignore`

## Multi-agent execution

In plan modes, approved plans execute via **LemonGrove** with five specialists:

- `researcher_agent` — research and codebase exploration
- `coder_agent` — write and edit code
- `tester_agent` — run tests and verify
- `reviewer_agent` — review quality
- `general_agent` — general tasks

Steps run in **parallel batches** or **sequential waves** based on plan topology.

## Tools

- `read_file`, `write_file`, `list_directory`, `glob_files`
- `scan_codebase` — build project context
- `run_command` — shell commands in workspace
- `pagespeed_test` — Google PageSpeed Insights

## Development workflow

```bash
bun run cfbd
```

**cfbd** runs the full pre-push workflow in order:

| Step        | Script                | What it does                          |
| ----------- | --------------------- | ------------------------------------- |
| **C**lean   | `clean`               | Removes `dist/` build artifacts       |
| **F**ormat  | `format`              | Formats code with Prettier            |
| **B**uild   | `typecheck` + `build` | Type-checks, then compiles to `dist/` |
| **D**evelop | `dev`                 | Starts the interactive TUI            |

Individual scripts:

```bash
bun run clean          # rm -rf dist
bun run format         # prettier --write
bun run format:check   # prettier --check (CI)
bun run typecheck      # tsc --noEmit
bun run build          # compile to dist/
bun run dev            # start TUI
```

## Build

```bash
bun run build   # compile to dist/
bun link        # optional: install `lemon` globally
```

## Stack

- **Runtime**: Bun
- **TUI**: [@opentui/core](https://opentui.com/) + [@opentui/react](https://opentui.com/docs/bindings/react/)
- **Agent**: [lemon-ai-agent](https://www.npmjs.com/package/lemon-ai-agent) + Google Gemini

## Requirements

- Bun 1.1+
- `GOOGLE_API_KEY` in `.env` (Gemini + PageSpeed Insights)
