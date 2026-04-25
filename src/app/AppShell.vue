<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  BookMarked,
  CalendarDays,
  Lightbulb,
  Settings,
  Sun,
} from "lucide-vue-next";
import { cn } from "@/lib/utils";

const route = useRoute();
const router = useRouter();

const tabs = [
  { name: "today", label: "Today", icon: Sun },
  { name: "suggestions", label: "Suggestions", icon: Lightbulb },
  { name: "library", label: "Library", icon: BookMarked },
  { name: "history", label: "History", icon: CalendarDays },
  { name: "settings", label: "Settings", icon: Settings },
] as const;

const hideTabs = computed(
  () => route.name === "add-log" || route.name === "log-meal-library-select",
);
const activeTabIndex = computed(() => {
  const index = tabs.findIndex((tab) => tab.name === route.name);
  return index >= 0 ? index : 0;
});
const activeIndicatorStyle = computed(() => ({
  transform: `translateX(${activeTabIndex.value * 100}%)`,
}));

const navigate = async (name: (typeof tabs)[number]["name"]): Promise<void> => {
  if (route.name === name) return;
  await router.push({ name });
};
</script>

<template>
  <div
    class="app-root feature feature-settings relative min-h-screen text-foreground"
  >
    <main class="mx-auto flex min-h-screen w-full max-w-5xl flex-col">
      <RouterView />
    </main>

    <nav
      v-if="!hideTabs"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.45rem)] sm:px-4 sm:pb-[max(env(safe-area-inset-bottom),0.55rem)]"
    >
      <div class="pointer-events-auto mx-auto max-w-5xl">
        <div
          class="overflow-hidden rounded-[1.3rem] border p-1 backdrop-blur-2xl sm:rounded-[1.55rem] sm:p-1.5"
          style="
            border-color: hsl(var(--feature-primary) / 0.24);
            background: linear-gradient(
              165deg,
              hsl(var(--card) / 0.9),
              hsl(var(--card) / 0.78)
            );
            box-shadow:
              0 -6px 36px hsl(var(--glass-shadow) / 0.2),
              inset 0 1px 0 hsl(var(--glass-highlight) / 0.48);
          "
        >
          <div class="relative grid grid-cols-5">
            <div
              aria-hidden="true"
              class="pointer-events-none absolute inset-y-0 left-0 w-1/5 rounded-[calc(1.3rem-0.25rem)] border border-border bg-secondary shadow-[0_10px_24px_hsl(var(--glass-shadow)/0.18)] transition-transform duration-300 ease-out sm:rounded-[calc(1.55rem-0.375rem)]"
              :style="activeIndicatorStyle"
            />
            <button
              v-for="tab in tabs"
              :key="tab.name"
              :aria-label="tab.label"
              class="group relative z-10 flex min-h-12 flex-col items-center justify-center gap-1 rounded-[calc(1.3rem-0.25rem)] px-0.5 py-0 text-[10px] font-semibold transition-colors duration-300 sm:min-h-14 sm:rounded-[calc(1.55rem-0.375rem)] sm:px-1 sm:py-0 sm:text-[11px]"
              :class="
                cn(
                  route.name === tab.name
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )
              "
              @click="navigate(tab.name)"
            >
              <component :is="tab.icon" class="size-3.5 sm:size-4" />
              <span class="whitespace-nowrap leading-none">{{
                tab.label
              }}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  </div>
</template>
