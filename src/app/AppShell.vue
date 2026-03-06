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

const hideTabs = computed(() => route.name === "add-log");

const navigate = async (name: (typeof tabs)[number]["name"]): Promise<void> => {
  if (route.name === name) return;
  await router.push({ name });
};
</script>

<template>
  <div class="relative min-h-screen text-foreground">
    <main class="mx-auto flex min-h-screen w-full max-w-5xl flex-col">
      <RouterView />
    </main>

    <nav
      v-if="!hideTabs"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.55rem)] sm:px-4"
    >
      <div class="pointer-events-auto mx-auto max-w-5xl">
        <div class="grid grid-cols-5 gap-1 rounded-2xl border border-border/80 bg-card/90 p-1.5 shadow-[0_-6px_30px_rgb(15_23_42_/_0.16)] backdrop-blur-xl">
          <button
            v-for="tab in tabs"
            :key="tab.name"
            :aria-label="tab.label"
            class="group flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-semibold transition-all duration-200"
            :class="
              cn(
                route.name === tab.name
                  ? 'bg-primary text-primary-foreground shadow-[0_10px_20px_hsl(var(--primary)/0.35)]'
                  : 'text-muted-foreground hover:bg-muted/75 hover:text-foreground'
              )
            "
            @click="navigate(tab.name)"
          >
            <component :is="tab.icon" class="size-4" />
            <span class="leading-none">{{ tab.label }}</span>
          </button>
        </div>
      </div>
    </nav>
  </div>
</template>
