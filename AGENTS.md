# SaunaPortal — AI agent instructions

## Git and pull requests (required workflow)

When you **add or change a feature or fix** in this repository:

1. **Branch from `main`** — Create a dedicated feature branch (do not commit directly to `main`).
2. **Implement and commit** — Keep commits focused; push the branch to `origin`.
3. **Open a PR to `main`** — Use the project PR tooling (not ad‑hoc forge CLIs for create/update). Give the user the **PR URL** when the work is ready.
4. **One feature per PR** — If `main` already merged earlier work, branch again from current `main` for follow-up features (do not rely on an old branch after its PR merged).

Do **not** assume work is shipped because it was pushed to a branch. Merged **#PR** on `main` is the source of truth for what is live.

If the user only asked a question or review with **no code changes**, a branch and PR are not required.

## Repository layout

- `festival2026/` — SaunaFestival 2026 course, forum, admin, and related static assets.
- `my-sauna-portal/` — Other SaunaPortal tools (e.g. postertool).

See `festival2026/AGENTS.md` for Festival 2026–specific rules (Supabase, courses, UI).

## Safety

Avoid destructive git operations (force-push, hard reset, rebase, branch deletion) unless the user explicitly asks.
