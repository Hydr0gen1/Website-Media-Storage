# Contributing to Media Storage

## AI Coding Tools

This repo is configured for both **Claude Code** and **Aider**.

- Claude Code reads `.claude/CLAUDE.md` and `.claude/rules/` automatically
- Aider reads the same files via `.aider.conf.yml`

Both tools see the same project conventions and server deployment constraints.
If you update a rule in `.claude/rules/`, both tools pick it up — no duplication needed.

## Server Deployment

This app auto-deploys to a home server when you push to `main`.
Read `.claude/rules/server-constraints.md` before making infrastructure changes
(port numbers, upload paths, database schema, environment variables).
