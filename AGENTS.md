# SaunaPortal — AI agent instructions

## Local IDE vs cloud

**Local Cursor IDE (this machine):** Never `git commit`, `git push`, open a PR, or run unsolicited commands (installs, brew, auth, extra tooling) unless the user explicitly asks in that turn. Implement the requested change and stop; the user owns git. See `.cursor/rules/local-ide-permissions.mdc`.

**Cloud / remote agents:** May follow the commit + PR workflow below when shipping a feature or fix.

## Git and pull requests (cloud / when user asks)

When you **add or change a feature or fix** and you are allowed to use git (cloud agent, or local user explicitly asked to commit/PR):

1. **Branch from `main`** — Create a dedicated feature branch (do not commit directly to `main`). Fetch/pull `main` first if the checkout may be stale.
2. **Implement and commit** — Keep commits focused; push the branch to `origin`.
3. **Open a PR to `main`** — As soon as the solution is ready to review, use the project PR tooling (not ad‑hoc forge CLIs for create/update). Give the user the **PR URL**. Do not consider the task done until the PR exists.
4. **One feature per PR** — Do not add follow-up work to a branch whose PR already merged. You **cannot update a merged PR**; for more changes, create a **new** branch from current `main` and open a **new** PR.
5. **After merge, clean up** — Once the PR is merged to `main`, delete the feature branch on `origin` (and the local branch if you created it). Then branch from updated `main` for the next task.

Do **not** assume work is shipped because it was pushed to a branch. Merged **#PR** on `main` is the source of truth for what is live.

If the user only asked a question or review with **no code changes**, a branch and PR are not required.

## Repository layout

- `festival2026/` — SaunaFestival 2026 course, forum, admin, and related static assets.
- `aufguss/` — Standalone Aufguss night schedule app (admin + live participant views). Desktop only.
- `my-sauna-portal/` — Other SaunaPortal tools (e.g. postertool).

See `festival2026/AGENTS.md` for Festival 2026–specific rules (Supabase, courses, UI).

## Safety

Avoid destructive git operations (force-push, hard reset, rebase) unless the user explicitly asks. **Deleting a merged feature branch** is expected workflow (see above), not ad‑hoc cleanup.
