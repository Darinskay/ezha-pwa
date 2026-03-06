# EZHA PWA (Vue 3)

This project is a Vue 3 + Vite + TypeScript web port of the EZHA app with feature parity for:

- Auth (email/password + Google via Supabase)
- Today tracking + start new day flow
- AI suggestions based on remaining macros
- Saved library foods/meals with quick meal logging
- History view with daily summaries and entries
- Settings for daily targets + theme
- Add Log flow (text/list/photo + label scaling + optional save to library)
- Offline draft persistence + mutation retry queue (Dexie)

## Stack

- Vue 3 + Vite + TypeScript
- Vue Router (tab routes)
- Pinia (auth, active day, settings)
- `@tanstack/vue-query`
- Tailwind CSS + Radix Vue-style patterns
- `zod` runtime validation
- Dexie for offline drafts/retries
- `@vite-pwa/plugin` + `@vite-pwa/assets-generator`
- `@vueuse/core`

## Setup

1. Copy envs:

```bash
cp .env.example .env
```

2. Install and run:

```bash
npm install
npm run dev
```

3. Build:

```bash
npm run build
```

## Notes

- The app expects the same Supabase schema/edge functions used by the original EZHA app.
- Retry queue currently handles offline `create_food_entry` mutations.
