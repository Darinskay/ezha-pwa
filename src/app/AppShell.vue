<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { BookMarked, CalendarDays, Lightbulb, Settings, Sun } from "lucide-vue-next";
import { cn } from "@/lib/utils";

const route = useRoute();
const router = useRouter();

const tabs = [
  { name: "today", label: "Today", icon: Sun },
  { name: "suggestions", label: "Suggestions", icon: Lightbulb },
  { name: "library", label: "Library", icon: BookMarked },
  { name: "history", label: "History", icon: CalendarDays },
  { name: "settings", label: "Settings", icon: Settings }
] as const;

const hideTabs = computed(() => route.name === "add-log" || route.name === "log-meal-library-select");

const featureClass = computed(() => {
  const name = String(route.name ?? "");
  if (name === "today") return "feature-today";
  if (name === "suggestions") return "feature-suggestions";
  if (name === "library") return "feature-library";
  if (name === "history") return "feature-history";
  if (name === "settings") return "feature-settings";
  if (name === "add-log" || name === "log-meal-library-select") return "feature-add-log";
  return "feature-today";
});

const navigate = async (name: (typeof tabs)[number]["name"]): Promise<void> => {
  if (route.name === name) return;
  await router.push({ name });
};
</script>

<template>
  <div :class="cn('app-root feature relative min-h-screen text-foreground', featureClass)">
    <main class="mx-auto flex min-h-screen w-full max-w-5xl flex-col">
      <RouterView />
    </main>

    <nav
      v-if="!hideTabs"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(env(safe-area-inset-bottom),0.45rem)] sm:px-4 sm:pb-[max(env(safe-area-inset-bottom),0.55rem)]"
    >
      <div class="pointer-events-auto mx-auto max-w-5xl">
        <div
          class="grid grid-cols-5 gap-0.5 rounded-[1.3rem] border p-1 backdrop-blur-2xl sm:gap-1 sm:rounded-[1.55rem] sm:p-1.5"
          style="
            border-color: hsl(var(--feature-primary) / 0.24);
            background: linear-gradient(165deg, hsl(var(--card) / 0.9), hsl(var(--card) / 0.78));
            box-shadow:
              0 -6px 36px hsl(var(--glass-shadow) / 0.2),
              inset 0 1px 0 hsl(var(--glass-highlight) / 0.48);
          "
        >
          <button
            v-for="tab in tabs"
            :key="tab.name"
            :aria-label="tab.label"
            class="group flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition-all duration-200 sm:min-h-14 sm:rounded-2xl sm:px-1.5 sm:py-2 sm:text-[11px]"
            :class="
              cn(
                route.name === tab.name
                  ? 'border border-border bg-secondary text-foreground shadow-[0_10px_24px_hsl(var(--glass-shadow)/0.18)]'
                  : 'text-muted-foreground hover:bg-muted/65 hover:text-foreground'
              )
            "
            @click="navigate(tab.name)"
          >
            <component :is="tab.icon" class="size-3.5 sm:size-4" />
            <span class="leading-none">{{ tab.label }}</span>
          </button>
        </div>
      </div>
    </nav>
  </div>
</template>
