# SaunaPortal Festival 2026 — AI Development Rules

## Project

This is the Festival 2026 section of SaunaPortal.

The application is a web-based sauna festival course and certification system.

## Before changing anything

Always inspect the existing code before making changes.

Understand how the relevant files currently work.

Do not rewrite or replace working functionality unnecessarily.

Prefer small, targeted changes.

## File handling

Keep the existing project structure unless there is a clear reason to change it.

Do not create duplicate files or alternative implementations without a reason.

Do not delete existing functionality unless explicitly requested.

## Frontend

This project uses HTML, CSS and JavaScript.

Keep the existing visual design and UX unless the user explicitly asks for a redesign.

Make the interface responsive and mobile-friendly.

## Supabase

Supabase is used as the backend/database.

Never expose Supabase secret/service-role keys in frontend code.

Use the existing Supabase configuration and patterns found in the project.

Do not create a new database structure without first inspecting the existing one.

## Course

The course consists of multiple steps/modules.

Course progress and completion should remain compatible with the existing implementation.

Do not change the course structure unless explicitly requested.

## Quiz

The quiz is part of the certification flow.

Quiz answers and validation should use the existing Supabase/backend approach.

Do not hardcode sensitive answer keys in frontend code if the existing architecture is designed to validate them through Supabase.

## Git

The user works with Git branches.

Do not run destructive Git commands.

Do not reset, checkout, rebase, force-push, or delete branches unless explicitly instructed.

Do not create commits unless explicitly asked.

## Communication

Before making significant changes:

1. Explain what you intend to change.
2. Identify the files involved.
3. Make the smallest reasonable change.
4. Don't explain if not explicilty asked for it

If something is unclear, ask the user instead of guessing.

## Important

Always preserve existing functionality unless the requested change requires otherwise.