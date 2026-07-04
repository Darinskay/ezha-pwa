# Codex Prompt — EZHA PWA UI Restyle (Glaze light / Nightbloom dark)

Copy everything below the line into Codex, run from the `ezha-pwa` repo root.

---

You are restyling the visual theme of EZHA PWA, a nutrition-tracking web app (Vue 3 + Vite + TypeScript, Tailwind CSS 3 with shadcn-vue conventions, Pinia, vue-router). This is a **visual-only refactor**: do not change any business logic, stores, repositories, Dexie/db code, services, query layer, or routing. Only touch CSS variables, Tailwind config, template classes, and purely presentational component markup.

The design system already follows the shadcn pattern: HSL tokens as CSS variables in `src/style.css` consumed via `tailwind.config.ts` (`darkMode: ["class"]`). Keep that architecture — this restyle is a retokening plus a new background/card treatment.

## Goal

Two adaptive themes from one token set:

- **Light mode — "Glaze"**: warm aurora-gradient background with frosted-glass cards floating on top.
- **Dark mode — "Nightbloom"** (`.dark` class): deep violet-black background with soft glow accents; same layouts, dark token values.

## Step 1 — Retoken `src/style.css` and extend `tailwind.config.ts`

Update the existing `:root` and `.dark` variable blocks and add the new tokens (as HSL triplets, shadcn-style). Reference hex values:

| Token | Light (Glaze) | Dark (Nightbloom) |
|---|---|---|
| `--primary` (magenta: CTAs, calorie ring) | `#D62E96` | `#FF3DA6` |
| `--secondary` (indigo/violet: protein) | `#5D50E6` | `#9D6BFF` |
| `--accent` (peach / lilac: carbs) | `#FF8A4C` | `#C9B8FF` |
| `--foreground` | `#3A1444` | `#F2EDFF` |
| `--muted-foreground` | `#8E6D9C` | `#8C7FAE` |
| `--background` | `#F7F1F9` (aurora painted on top, below) | `#0D0918` |
| `--card` | white at 55% opacity (pair with backdrop blur) | violet gradient, see GlassCard |
| `--border` (card strokes) | white at 85% opacity | `#C9B8FF` at 16% opacity |
| `--track` (progress bar troughs — new token) | `#3A1444` at 9% opacity | `#C9B8FF` at 14% opacity |

Where a token needs alpha, define the variable as an HSL triplet and apply alpha at the utility level (`bg-card/55` style) or add dedicated rgba custom properties — stay consistent with how the file already does it.

In `tailwind.config.ts`:
- Add `track` to the colors map.
- Extend `borderRadius`: `card: "1.75rem"` (28px), `row: "1.375rem"` (22px), `thumb: "0.9375rem"` (15px). Keep the existing `lg/md/sm` working.
- Add a glass shadow: `glass: "0 18px 40px -18px rgb(58 20 68 / 0.22)"`.
- Keep the existing SF Pro system font stack — no new fonts, no serifs, no mono in UI. Hierarchy is weight-driven (`font-extrabold` numerals with `tracking-tight`, `font-semibold` labels).

## Step 2 — `AppBackground` component

Create `src/components/AppBackground.vue`: a `fixed inset-0 -z-10 pointer-events-none` layer rendered once in the app shell (`src/app/`, behind `<RouterView>`), covering all routes.

- **Light**: base `linear-gradient(170deg, #FBF3FA, #F2EEFB 55%, #FAF0F6)` plus three radial blobs layered via `background-image` (comma-separated radial-gradients, no extra DOM):
  - peach `#FF8A4C` at 32% opacity, circle centered ~`88% -6%`, radius ≈ 100vw
  - indigo `#5D50E6` at 26% opacity, centered ~`-12% 22%`
  - magenta `#D62E96` at 30% opacity, centered ~`60% 108%`
- **Dark**: solid `#0D0918` plus violet `#9D6BFF` at 28% opacity glow top-right and magenta `#FF3DA6` at 14% opacity mid-left.
- Implement both via a small scoped style with `:root`/`.dark` driven custom properties or a `dark:` class swap.

Remove/override any opaque page backgrounds on route views so the aurora shows through everywhere.

## Step 3 — `GlassCard` treatment

Create a shared card class (in `style.css` under `@layer components`) or a `GlassCard.vue` wrapper — whichever fits the existing `src/components/ui` conventions better:

- Light: `background: rgb(255 255 255 / 0.55); backdrop-filter: blur(20px); border: 1px solid rgb(255 255 255 / 0.85);` + `shadow-glass`, radius `rounded-card` (hero) or `rounded-row` (list rows).
- Dark: `background: linear-gradient(160deg, rgb(157 107 255 / 0.14), rgb(157 107 255 / 0.04)); border: 1px solid rgb(201 184 255 / 0.16);` no heavy shadow.
- Include a `-webkit-backdrop-filter` fallback and an `@supports not (backdrop-filter: blur(1px))` fallback to a more opaque background (important for older Safari PWA contexts).

Apply it to every card surface in the app: today summary, food entry rows, library items, suggestion cards, settings groups, dialogs/sheets content.

## Step 4 — Hero "calories left" card (`src/features/today`)

Restyle the daily summary into one glass hero card, horizontal layout:

**Left — calorie ring (132×132px):**
- SVG circle with `stroke-linecap="round"`, stroke width ≈ 12; progress stroke uses a gradient (`<linearGradient>` from `--secondary` → `--primary` → `--accent`); trough circle in `--track`. Progress = consumed / target.
- Center: remaining kcal, `text-[33px] font-extrabold tracking-tight`, with "kcal left" caption in `text-muted-foreground text-[11px] font-semibold`.

**Right — three stacked macro bars (12px gap), each:**
- Header row: macro name (left, `text-[11px] font-bold`) and `consumed/target g` (right, `text-[11px] font-semibold text-muted-foreground`).
- Capsule bar 7px tall, trough `bg-track`; fills are horizontal gradients:
  - Protein: secondary → lighter
  - Carbs: accent → lighter
  - Fat: primary → lighter
- Animate width/ring on value change with a CSS transition (`transition-[width] duration-500 ease-out`; ring via `stroke-dashoffset` transition).

## Step 5 — Apply app-wide

- Every route (today, add-log, library, meal, suggestions, settings, auth) sits on `AppBackground` with glass cards — audit each folder under `src/features/`.
- Food entry rows: glass, `rounded-row`, 44px thumbnail (`rounded-thumb`), name `text-[13.5px] font-bold`, macro line "P · C · F" in `text-muted-foreground text-[10.5px]`, kcal right-aligned `font-extrabold`.
- Primary buttons: gradient `--primary → --secondary`, white label, `rounded-full`, subtle colored shadow. Update the shadcn-vue button variants in `src/components/ui` rather than styling ad hoc.
- Bottom navigation (if present): floating pill — translucent blur bar, `rounded-full`, detached from the screen edge with margin and `env(safe-area-inset-bottom)` padding; active tab gets the primary→secondary gradient pill.
- Sweep for hardcoded colors: grep `src/` for hex values, `bg-white`, `bg-gray-*`, `text-gray-*` etc., and replace with semantic tokens. Nothing may bypass the token system.
- PWA chrome: update `theme_color` in the PWA manifest config (vite-plugin-pwa options in `vite.config.ts`) and the `<meta name="theme-color">` in `index.html` — light `#F7F1F9`, dark `#0D0918` (use two media-query meta tags).

## Constraints

- No new dependencies.
- Do not modify `src/stores`, `src/repositories`, `src/db`, `src/services`, `src/query`, `src/router` logic, or Supabase/Dexie code.
- Keep the shadcn-vue variable architecture intact — restyle by retokening, not by forking components.
- Must pass: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
- Keep changes reviewable: prefer token/class edits over rewriting components; do not rename existing components or files.

## Acceptance checklist

1. Light mode: aurora background visible behind translucent blurred cards on every route; no opaque white page backgrounds remain.
2. Dark mode (`.dark`): violet-void background with glow; cards are translucent violet gradients; accents switch to `#FF3DA6` / `#9D6BFF` / `#C9B8FF`.
3. Today shows the hero card: gradient SVG ring with kcal-left numeral + three gradient macro bars, animated on data change.
4. Radii: 28px hero cards, 22px rows, 15px thumbnails, capsule bars/buttons.
5. Backdrop-filter fallback works (cards remain readable where blur is unsupported).
6. Manifest/meta theme-color matches the new backgrounds; safe-area insets respected on the bottom nav.
7. `typecheck`, `lint`, `test`, and `build` all pass; all existing flows (auth, logging, library, meal, suggestions, settings) behave exactly as before.
