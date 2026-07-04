# Codex Prompt — EZHA PWA: fix dark-mode background + invisible input borders

Copy everything below the line into Codex, run from the `ezha-pwa` repo root.

---

You are fixing two visual bugs in EZHA PWA (Vue 3 + Vite + TypeScript, Tailwind CSS 3 with shadcn-vue conventions, `darkMode: ["class"]`, HSL tokens in `src/style.css`). This is a **visual-only fix**: do not change any business logic, stores, repositories, Dexie/db code, services, query layer, or routing. Keep the shadcn token architecture intact — fix by retokening and correcting selectors, not by forking components.

## Bug 1 — Dark mode only darkens the cards, not the page background

**Root cause:** In `src/components/AppBackground.vue` the dark rule is written inside `<style scoped>` as:

```css
:global(.dark) .app-background { ... }
```

Vue's scoped-CSS compiler mangles this: it emits the rule as plain `.dark { ... }` and drops the `.app-background` part entirely. So the dark canvas gets painted on the `<html>` element, which sits *behind* the `position: fixed; inset: 0; z-index: 0` `.app-background` layer. That fixed layer keeps rendering its **light** gradient (`linear-gradient(160deg, #f7f1f9, #fff7ec, #faf0f6)`) on top, covering the whole viewport. Cards still go dark because their `.dark .glass` rules live (correctly) in global `src/style.css`. Net effect: in dark mode the page background stays light and only the "windows" change.

**Fix — move the background definition out of scoped CSS into global tokens:**

1. In `src/components/AppBackground.vue`, **remove the entire `<style scoped>` block**. Leave the template as the single `<div class="app-background" aria-hidden="true" />`. The class name is already unique, so scoping adds no value and is the source of the bug.

2. In `src/style.css`, add the background as global, unscoped rules (so `.app-background` and `.dark .app-background` are authored by hand with no compiler rewriting). Drive the colors from theme tokens rather than hard-coded hex, so light/dark live side by side in one place. Add these custom properties:

   In `:root`:
   ```css
   --app-canvas: 300 33% 96%;              /* base page color, light */
   --app-glow-1: 22 100% 65%;             /* peach */
   --app-glow-2: 244 76% 61%;             /* indigo */
   --app-glow-3: 325 70% 51%;             /* magenta */
   ```

   In `.dark`:
   ```css
   --app-canvas: 264 45% 5%;              /* deep violet-black (#0B0711-ish), slightly deeper than before */
   --app-glow-1: 258 100% 71%;           /* violet */
   --app-glow-2: 326 100% 62%;           /* magenta */
   --app-glow-3: 264 45% 5%;             /* fades into canvas */
   ```

   Then, outside any `@layer` (or in a plain top-level block), add:
   ```css
   .app-background {
     position: fixed;
     inset: 0;
     z-index: 0;
     pointer-events: none;
     background-color: hsl(var(--app-canvas));
     background-image:
       radial-gradient(circle 100vw at 15% 16%, hsl(var(--app-glow-1) / 0.30), transparent 48%),
       radial-gradient(circle 90vw at 82% 12%, hsl(var(--app-glow-2) / 0.24), transparent 48%),
       radial-gradient(circle 92vw at 58% 84%, hsl(var(--app-glow-3) / 0.28), transparent 48%),
       linear-gradient(160deg, hsl(var(--app-canvas)) 0%, hsl(var(--app-canvas)) 100%);
     transition: background-color 0.45s ease, background-image 0.45s ease;
   }
   .dark .app-background {
     background-image:
       radial-gradient(circle 72vw at 88% 4%, hsl(var(--app-glow-1) / 0.18), transparent 44%),
       radial-gradient(circle 78vw at 8% 54%, hsl(var(--app-glow-2) / 0.14), transparent 46%),
       linear-gradient(180deg, hsl(var(--app-canvas)) 0%, hsl(264 45% 7%) 54%, hsl(var(--app-canvas)) 100%);
   }
   ```

   In light mode keep the warm aurora feeling; in dark mode the whole viewport must read as a genuinely dark violet-black canvas with subtle glows — not a washed-out purple. Tune the glow opacities down if they lift the background too much; the base `--app-canvas` should dominate.

3. Also nudge the dark surface tokens a touch deeper for cohesion (optional but preferred): in `.dark`, set `--background: 264 45% 5%;` to match `--app-canvas`. Leave `--card` and the accent tokens as they are.

## Bug 2 — Input / select / textarea borders are invisible

**Root cause:** `src/components/ui/Input.vue`, `src/components/ui/SelectField.vue`, and `src/components/ui/Textarea.vue` all set `border-color: hsl(var(--input))` inline. The `--input` token is pure white (`0 0% 100%`) in light mode, so the border disappears against the white/near-white card surface; in dark mode it is a near-white lavender (`253 100% 86%`) that is too hot for a 1px stroke.

**Fix — retoken `--input` only** (do NOT change `--border`; that token is intentionally white-at-full for the glass card edge and is used elsewhere). In `src/style.css`:

- `:root`: change `--input` to a soft, clearly-visible lilac-gray, e.g. `--input: 288 28% 84%;` (reads as a gentle border on white and on the aurora).
- `.dark`: change `--input` to a mid violet that contrasts against the dark card, e.g. `--input: 257 32% 40%;` (visible, not glaring).

Verify the border is now visible in both modes on: Settings appearance/target fields, `FoodEditorDialog`, `MealQuickLogDialog`, `AddLogPage`, `TargetSelectorDialog`, and the library editors. The focus ring (`focus-visible:ring-ring`) should still take over on focus — don't touch that.

## Bug 3 (include) — Mobile status-bar color when Dark is chosen manually

`index.html` sets `<meta name="theme-color">` only via `media="(prefers-color-scheme: ...)"`. If the user picks "Dark" in Settings while the OS is in Light, the status bar stays light. Make the theme-color follow the resolved app theme:

- Keep a single default `<meta name="theme-color" content="#0B0711" />` in `index.html` (or leave the media-query pair) but additionally update it at runtime.
- In `src/stores/settings-store.ts`, inside `applyAppearance()` (which already toggles the `.dark` class), also set the meta tag to match: `#0B0711` when dark is resolved, `#F7F1F9` when light. Query/create `<meta name="theme-color">` and set its `content`. Keep it in sync in the same place `.dark` is toggled so system-preference changes are covered too.

## Constraints

- No new dependencies.
- Do not modify logic in `src/stores` (beyond the meta-tag line in `applyAppearance`), `src/repositories`, `src/db`, `src/services`, `src/query`, `src/router`, or Supabase/Dexie code.
- Do not rename existing components or files.
- Must pass: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.

## Acceptance checklist

1. Toggling Settings → Appearance → **Dark** turns the **entire viewport** dark violet-black (not just the cards); light mode still shows the warm aurora. Verify by scrolling — no light band appears behind/below content.
2. `AppBackground.vue` has no `<style>` block; the background is defined in `src/style.css` via `.app-background` / `.dark .app-background`; no `:global(.dark)` remains anywhere (`grep -rn ":global(.dark)" src` returns nothing).
3. Input, select, and textarea fields show a visible border in **both** light and dark modes, with the focus ring still appearing on focus.
4. Status-bar / theme-color matches the chosen appearance even when it differs from the OS preference.
5. `typecheck`, `lint`, `test`, and `build` all pass; all existing flows behave exactly as before.
