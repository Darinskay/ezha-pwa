# CLAUDE.md — EZHA PWA

This file provides context for AI assistants working in this codebase.

---

## Project Overview

EZHA PWA is a **Vue 3 Progressive Web App** for nutrition/macro tracking. It features:
- AI-powered food analysis (text + photo) via Supabase edge functions
- Offline-first architecture with Dexie (IndexedDB) and a retry queue
- Real-time sync with Supabase (PostgreSQL + Storage + Auth)
- Mobile-first PWA with service worker auto-update

**Tech stack:** Vue 3, TypeScript, Pinia, TanStack Vue Query, Dexie, Supabase, Tailwind CSS, shadcn-vue, Vite, Vitest, Netlify

---

## Repository Structure

```
src/
├── app/                  # AppShell (layout, bottom nav)
├── components/           # Reusable components
│   ├── ui/              # Shadcn-vue primitives (Button, Card, Input, etc.)
│   ├── FoodEntryCard.vue
│   └── MacroProgressTable.vue
├── db/                  # Dexie offline DB (drafts + retry queue)
├── features/            # Feature modules — one directory per route/tab
│   ├── add-log/         # Food logging with AI analysis
│   ├── auth/            # Email/password + Google OAuth
│   ├── history/         # Historical daily summaries
│   ├── library/         # Saved foods/meals management
│   ├── meal/            # Quick meal logging modal
│   ├── settings/        # Daily targets + theme
│   ├── suggestions/     # AI meal suggestions
│   └── today/           # Daily tracking dashboard
├── lib/                 # Pure utilities (date, macros, supabase client, utils)
├── query/               # TanStack Vue Query client + query keys
├── repositories/        # Data access layer (Supabase calls)
├── router/              # Vue Router with auth guard
├── services/            # Business logic (AI, retry queue, storage)
├── stores/              # Pinia stores (auth, settings, active-day)
├── types/               # Domain types + Zod schemas
├── App.vue              # Root component
└── main.ts              # App bootstrap
```

---

## Development Commands

```bash
npm run dev          # Start dev server (http://127.0.0.1:5176)
npm run build        # Type-check + Vite build → dist/
npm run preview      # Preview production build
npm run typecheck    # Type-check only (no emit)
npm run test         # Run Vitest
npm run pwa:assets   # Generate PWA icons from public/logo.svg
```

**Dev server port:** `5176` (strict — will fail if taken)

---

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

```env
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_OAUTH_REDIRECT_URL=http://localhost:5173
VITE_FOOD_IMAGES_BUCKET=food-images
```

All env vars are validated at startup via `src/lib/env.ts`. Missing vars throw immediately.

---

## Architecture Patterns

### Layered Architecture
```
Feature Page (Vue)
    └── TanStack Vue Query (server-state hooks)
        └── Repository (Supabase data access)
            └── repository-utils.ts (auth + error helpers)
```

Business logic that doesn't belong in a repository lives in `src/services/`.

### State Management
- **Server state** → TanStack Vue Query (`useQuery`, `useMutation`)
- **Global UI state** → Pinia stores (auth, settings, active-day date)
- **Offline drafts** → Dexie `drafts` table via `src/db/offline-db.ts`

### Offline Support
Failed mutations are persisted in `retryQueue` (Dexie) via `src/services/retry-queue-service.ts`. The retry service runs every 30 s with exponential backoff (max 5 min). Currently handles `create_food_entry` mutations.

---

## Naming Conventions

| Entity | Convention | Example |
|--------|-----------|---------|
| Pinia stores | `use*Store` | `useAuthStore` |
| Repositories | `*Repository` (singleton object) | `foodEntryRepository` |
| Services | `*Service` (singleton object) | `aiAnalysisService` |
| Page components | `*Page.vue` | `TodayPage.vue` |
| Dialog components | `*Dialog.vue` | `FoodEditorDialog.vue` |
| UI primitives | PascalCase in `components/ui/` | `Button.vue` |
| Types | Interfaces in `types/domain.ts` | `FoodEntry`, `MacroTotals` |
| Zod schemas | In `types/schemas.ts` | — |
| Query keys | Flat keys object in `query/keys.ts` | `queryKeys.today` |
| Date keys | `YYYY-MM-DD` string | `"2025-06-15"` |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/main.ts` | App bootstrap — Pinia, Vue Query, PWA, retry queue |
| `src/router/index.ts` | Routes + auth navigation guard |
| `src/app/AppShell.vue` | Layout wrapper with bottom tab nav |
| `src/lib/supabase.ts` | Supabase client (PKCE auth flow) |
| `src/lib/env.ts` | Env var validation + exports |
| `src/lib/utils.ts` | `cn()` Tailwind class merge helper |
| `src/lib/macros.ts` | Macro math utilities |
| `src/lib/date.ts` | Date helpers (`toDateKey`, `nowDateKey`, etc.) |
| `src/db/offline-db.ts` | Dexie schema + draft/queue helpers |
| `src/repositories/repository-utils.ts` | `getUserId()`, `ensureNoError()`, `dateKeyForQuery()` |
| `src/query/query-client.ts` | TanStack client (staleTime 30s, mutation retry off) |
| `src/query/keys.ts` | All query cache keys |
| `src/types/domain.ts` | All domain interfaces |
| `src/types/schemas.ts` | Zod schemas + `parseWithSchema()` helpers |

---

## Routing

Routes are nested under `/` with `AppShell` as the layout. The shell's bottom nav is hidden on the `/log/*` and `/log-meal/*` flows.

```
/               → redirect to /today
/today          → TodayPage
/suggestions    → SuggestionsPage
/library        → LibraryPage
/history        → HistoryPage
/settings       → SettingsPage
/log/new        → AddLogPage (full-screen overlay)
/log-meal/library-select → LogMealLibrarySelectPage
/auth           → AuthPage (guestOnly)
```

**Auth guard:** All routes require authentication except `meta: { guestOnly: true }` routes.

---

## Pinia Stores

### `useAuthStore` (`src/stores/auth-store.ts`)
- `session`, `user`, `isAuthenticated`, `isLoading`, `initialized`
- `initialize()` — call once at app startup
- `signIn()`, `signUp()`, `signInWithGoogle()`, `signOut()`

### `useSettingsStore` (`src/stores/settings-store.ts`)
- `appearance` — `"light" | "dark" | "system"` (persisted in localStorage)
- `resolvedDarkMode` — actual computed dark state
- Watches system `prefers-color-scheme` and applies Tailwind `dark` class

### `useActiveDayStore` (`src/stores/active-day-store.ts`)
- `activeDate` — current viewing date as `YYYY-MM-DD` string
- `isToday` — computed boolean
- `setActiveDate()`, `syncFromProfile()`

---

## Repositories

All repositories return typed data or throw. Always call within TanStack Query or try-catch.

| Repository | Supabase table(s) |
|-----------|------------------|
| `foodEntryRepository` | `food_entries`, `food_entry_items` |
| `savedFoodRepository` | `saved_foods`, `saved_meal_ingredients` |
| `dailyTargetRepository` | `daily_targets` |
| `dailySummaryRepository` | `daily_summaries` |
| `profileRepository` | `profiles` |

---

## AI Integration

### Food Analysis (`src/services/ai-analysis-service.ts`)
- Calls `ai-estimate` Supabase edge function
- Accepts text description, image path, or both
- Returns `MacroEstimate` (items with per-item macros)
- Validates response with Zod schema

### Meal Suggestions (`src/services/ai-suggestion-service.ts`)
- Calls `ai-suggest` Supabase edge function
- Input: remaining calories/macros, meal type, prep time, count
- Returns `MealSuggestion[]`

---

## Styling Conventions

- **Tailwind CSS** utility-first; no custom CSS files except `src/style.css` for global resets/fonts
- **Theme:** CSS custom properties (HSL format) defined in `style.css`, toggled via Tailwind `dark` class
- **Custom fonts:** `Manrope` (sans), `JetBrains Mono` (mono) — loaded from Google Fonts
- **Brand color:** `#cc3399` (pink/magenta)
- **Border radius:** `0.9rem` base, uses `--radius` CSS var
- **Component library:** shadcn-vue (Radix Vue primitives) — components in `src/components/ui/`
- **Class merging:** always use `cn()` from `src/lib/utils.ts` when conditionally composing classes

---

## TypeScript

- `strict: true` in all tsconfigs
- Path alias: `@/*` → `src/*` (use in all imports)
- Domain types live in `src/types/domain.ts` — add new types there
- Zod schemas in `src/types/schemas.ts` — validate all external data (Supabase responses, edge function responses)
- No `any` — use `unknown` and narrow with Zod when needed

---

## Testing

Framework: **Vitest 4**

```bash
npm run test       # run all tests
```

Test files are colocated with features (`*.test.ts` next to the file being tested). Current tests cover service-layer logic in `features/add-log/`. Focus tests on pure functions and services; avoid testing Vue components directly unless critical.

---

## Deployment

- **Hosting:** Netlify
- **Build:** `npm run build` → `dist/`
- **Node version:** 20
- **SPA fallback:** all `/*` → `/index.html` (configured in `netlify.toml`)
- **PWA:** Service worker auto-updates with a hard-refresh prompt on new version

---

## Common Gotchas

1. **Port 5176 is hardcoded** in `vite.config.ts` with `strictPort: true`. If it's taken, the dev server fails.
2. **Date keys** must always be `YYYY-MM-DD` strings. Use `toDateKey()` / `nowDateKey()` from `src/lib/date.ts`.
3. **Auth session** is not immediately available — always check `initialized` from `useAuthStore` before querying.
4. **Offline mutations** go through `retryQueueService` — don't bypass it for operations that need offline support.
5. **Supabase RLS** — all queries are scoped to `auth.uid()`. Repositories call `getUserId()` which throws if no session.
6. **TanStack Query mutations** have retry disabled globally — the retry queue handles re-attempts for offline scenarios.
7. **Environment variables** — all must be prefixed with `VITE_` to be accessible in the browser bundle.
8. **shadcn-vue components** — do not edit files in `src/components/ui/` directly unless intentionally customizing the design system; they're generated by shadcn-vue CLI.
