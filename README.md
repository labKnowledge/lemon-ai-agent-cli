# Lemon AI Agent CLI

A generic CLI agent powered by [lemon-ai-agent](https://www.npmjs.com/package/lemon-ai-agent) and Google Gemini. Read/write files, run shell commands, analyze websites with PageSpeed Insights, and more.

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
# or after build: npx lemon
```

### One-shot print mode

```bash
npm run lemon -- -p "List files in the current directory"
npm run lemon -- --print "Summarize this project"
npm run lemon -- -p -f ./task.md
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
| `--cwd <path>` | Workspace root for tools |
| `--approval always\|smart\|yolo` | Shell approval mode (default: `always`) |
| `--model <model>` | Model id (default: `gemini-2.5-flash`; `gemini-2.0-flash` retired June 2026) |
| `--session <id>` | Session id for history |

### REPL bang commands

| Input | Behavior |
|-------|----------|
| `!npm test` | Run shell command directly (bypasses agent) |
| `!!` | Repeat last bang command |
| `/exit` | Quit |

### Approval modes

| Mode | Behavior |
|------|----------|
| `always` (default) | Prompt before every shell command |
| `smart` | Auto-run benign commands; prompt for destructive ones |
| `yolo` | Run all commands without prompts |

## Tools

- `read_file`, `write_file`, `list_directory`, `glob_files`
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
