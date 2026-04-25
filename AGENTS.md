# AGENTS.md

## Purpose

- This repository is a Vue 3 + Vite + TypeScript PWA for EZHA.
- The app supports auth, daily macro tracking, AI suggestions, saved food/meal library, history, settings, and offline retry behavior.
- Use this file as the default operating guide for any agent working in this codebase.

## Product Context

- Users log food entries, track macros, manage daily targets, and review history.
- Supabase is the primary backend for auth and persisted domain data.
- Dexie is used for offline drafts and queued retries.
- The UX is mobile-first, but pages should remain solid on desktop up to the app max width.

## Core Stack

- Vue 3 with `<script setup lang="ts">`
- Vite
- TypeScript
- Vue Router
- Pinia
- `@tanstack/vue-query`
- Tailwind CSS
- Radix-style UI patterns via local UI components
- Supabase client
- Dexie
- Vitest

## Important Paths

- `src/main.ts`: app bootstrap, Pinia, Vue Query, service worker registration, retry queue startup
- `src/router/index.ts`: routes and auth/guest guards
- `src/app/`: shell-level layout and app framing
- `src/features/`: route-level feature screens and feature-local flows
- `src/components/`: shared UI and reusable presentation components
- `src/components/ui/`: primitive UI building blocks
- `src/stores/`: Pinia state for auth, settings, active day
- `src/repositories/`: Supabase data access
- `src/services/`: orchestration and side-effect helpers
- `src/query/`: query client and cache keys
- `src/lib/`: utilities, env access, formatting, IDs, date helpers
- `src/types/`: domain contracts and schemas
- `src/db/`: Dexie offline database

## Architecture Rules

- Keep route-level behavior in `src/features`.
- Keep reusable UI in `src/components` or `src/components/ui`.
- Keep remote data access in repositories. Do not scatter raw Supabase calls through pages.
- Keep cross-feature orchestration in services when it is more than a trivial inline action.
- Keep persistent app state in Pinia only when it is truly app-level state.
- Keep server/cache state in Vue Query, not duplicated in stores.
- Keep domain types in `src/types/domain.ts` and schema parsing in `src/types/schemas.ts`.
- Prefer existing helpers from `src/lib` before introducing new utility files.

## Coding Conventions

- Follow existing TypeScript-first patterns and explicit return types on non-trivial functions.
- Match the current import style using `@/` aliases.
- Prefer small computed values and focused handlers over large monolithic blocks when editing Vue files.
- Reuse query keys from `src/query/keys.ts`; do not invent ad hoc cache keys inline.
- Reuse repositories and services instead of duplicating fetch or mutation logic.
- Preserve runtime validation patterns where repository results are parsed through schemas.
- Avoid introducing new global state unless there is a clear cross-route need.
- Keep comments sparse and only where intent is not obvious from the code.

## Vue and UI Guidance

- Use existing UI primitives like `Button`, `Card`, `Input`, `Textarea`, `Badge`, and `SelectField`.
- Preserve the app’s current visual language: soft gradients, glass surfaces, rounded corners, compact mobile-first spacing.
- Prefer Tailwind utility classes and existing design tokens from `src/style.css`.
- Do not introduce a second design system or unrelated component library.
- Keep pages responsive and test both narrow mobile widths and desktop widths.
- Avoid unnecessary watchers when a computed or query-derived value is enough.
- Keep loading, empty, and error states explicit in user-facing flows.

## Data and Side Effects

- Treat repositories as the boundary for Supabase reads and writes.
- Validate backend data before trusting it in UI code.
- Keep retry queue behavior compatible with `retry-queue-service.ts`.
- Be careful with date handling. Reuse the date helpers in `src/lib/date.ts`.
- Do not bypass profile, summary, or target flows with one-off writes unless the change is intentionally repository-level.
- Preserve offline behavior when touching mutation flows related to food entry creation.

## Routing and Feature Boundaries

- New pages belong in `src/features/<feature-name>/`.
- Route registration belongs in `src/router/index.ts`.
- Auth-protected screens should remain under the authenticated shell unless there is a clear reason otherwise.
- Respect the current tab navigation model in `AppShell.vue`.

## Testing and Validation

- Add or update Vitest coverage when changing non-trivial logic, especially services, repositories, or feature helpers.
- Prefer focused tests near the feature or service being changed.
- Do not claim completion without running the required verification commands after your iteration is done.
- Required post-iteration commands:
- `npm run lint`
- `npm run type-check`
- `npm run format`
- If any required script is missing from `package.json`, add or align the script first, then run it.
- If a command fails, report the failure clearly and do not hide it.

## Environment and Safety

- Required environment values are accessed through `src/lib/env.ts`.
- Do not hardcode secrets, Supabase keys, bucket names, or redirect URLs.
- Assume the Supabase schema and edge functions are shared with the original EZHA app.
- Do not start the dev server automatically; the user will run it manually when needed.
- Avoid destructive changes to unrelated files.
- The worktree may already contain user edits; do not revert them unless explicitly asked.

## Change Discipline

- Make the smallest coherent change that solves the problem.
- Prefer extending existing patterns over introducing new abstractions.
- When editing a file with an established style, match that style instead of rewriting it.
- Keep naming concrete and domain-specific.
- Avoid broad refactors unless they are required for correctness or clearly requested.

## Agent Workflow

- Start by reading the affected feature, repository, service, and query-key files before editing.
- Trace the data flow from UI -> store/query -> service/repository before making behavioral changes.
- Check for existing dirty worktree state before large edits.
- After changes, run the required verification commands.
- In the final summary, state what changed, what was verified, and any remaining risk or follow-up.

## Default Definition of Done

- The feature or fix matches repository architecture.
- Types remain sound.
- Existing UX patterns remain consistent.
- Required validation commands were run:
- `npm run lint`
- `npm run type-check`
- `npm run format`
- Any failing or unavailable validation step is explicitly called out.
