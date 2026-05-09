<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { BookMarked, Lightbulb, Plus, Settings, Sun } from "lucide-vue-next";
import DayNavigator from "@/components/DayNavigator.vue";
import AddLogPage from "@/features/add-log/AddLogPage.vue";
import LogMealLibrarySelectPage from "@/features/add-log/LogMealLibrarySelectPage.vue";
import { cn } from "@/lib/utils";
import { useActiveDayStore } from "@/stores/active-day-store";

const route = useRoute();
const router = useRouter();
const activeDayStore = useActiveDayStore();

const tabs = [
  { name: "today", label: "Today", icon: Sun },
  { name: "suggestions", label: "Suggestions", icon: Lightbulb },
  { name: "library", label: "Library", icon: BookMarked },
  { name: "settings", label: "Settings", icon: Settings },
] as const;
const leftTabs = tabs.slice(0, 2);
const rightTabs = tabs.slice(2);

const hideTabs = computed(
  () => route.name === "add-log" || route.name === "log-meal-library-select",
);
const showDayNavigator = computed(
  () => route.name === "today" || route.name === "suggestions",
);
const isLogDialogOpen = ref(false);
const logDialogStep = ref<"log" | "library-select">("log");

let dayBoundaryTimer: ReturnType<typeof window.setInterval> | null = null;

const refreshDayBoundary = (): void => {
  activeDayStore.refreshTodayBoundary();
};

onMounted(() => {
  dayBoundaryTimer = window.setInterval(refreshDayBoundary, 60_000);
  document.addEventListener("visibilitychange", refreshDayBoundary);
});

onUnmounted(() => {
  if (dayBoundaryTimer) {
    window.clearInterval(dayBoundaryTimer);
  }
  document.removeEventListener("visibilitychange", refreshDayBoundary);
});

const navigate = async (name: (typeof tabs)[number]["name"]): Promise<void> => {
  if (route.name === name) return;
  await router.push({ name });
};

const openLogDialog = (): void => {
  logDialogStep.value = "log";
  isLogDialogOpen.value = true;
};

const closeLogDialog = (): void => {
  isLogDialogOpen.value = false;
  logDialogStep.value = "log";
};

const openLibrarySelector = (): void => {
  logDialogStep.value = "library-select";
};

const returnToLogDialog = (): void => {
  logDialogStep.value = "log";
};
</script>

<template>
  <div
    class="app-root feature feature-settings relative min-h-screen text-foreground"
  >
    <main class="mx-auto flex min-h-screen w-full max-w-5xl flex-col">
      <DayNavigator
        v-if="showDayNavigator"
        :model-value="activeDayStore.activeDate"
        @update:modelValue="activeDayStore.setActiveDate"
      />
      <RouterView />
    </main>

    <nav
      v-if="!hideTabs"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.45rem)] sm:px-4 sm:pb-[max(env(safe-area-inset-bottom),0.55rem)]"
    >
      <div class="pointer-events-auto mx-auto max-w-5xl">
        <div
          class="overflow-visible rounded-[1.3rem] border p-1 backdrop-blur-2xl sm:rounded-[1.55rem] sm:p-1.5"
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
          <div class="relative grid grid-cols-5 items-end gap-0.5">
            <button
              v-for="tab in leftTabs"
              :key="tab.name"
              :aria-label="tab.label"
              class="group relative z-10 flex min-h-12 flex-col items-center justify-center gap-1 rounded-[calc(1.3rem-0.25rem)] px-0.5 py-0 text-[10px] font-semibold transition-all duration-300 sm:min-h-14 sm:rounded-[calc(1.55rem-0.375rem)] sm:px-1 sm:py-0 sm:text-[11px]"
              :class="
                cn(
                  route.name === tab.name
                    ? 'bg-secondary text-primary shadow-[0_10px_24px_hsl(var(--glass-shadow)/0.18)]'
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

            <button
              aria-label="Log a new meal"
              class="group relative z-20 mx-auto -mt-5 flex size-16 items-center justify-center rounded-[1.35rem] border text-white shadow-[0_16px_38px_hsl(var(--feature-primary)/0.42)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] sm:size-[4.35rem] sm:rounded-[1.55rem]"
              style="
                border-color: hsl(var(--glass-highlight) / 0.54);
                background:
                  radial-gradient(
                    circle at 32% 24%,
                    hsl(var(--glass-highlight) / 0.32),
                    transparent 28%
                  ),
                  linear-gradient(
                    142deg,
                    hsl(var(--feature-primary)),
                    hsl(var(--feature-secondary))
                  );
              "
              @click="openLogDialog"
            >
              <Plus class="size-7 stroke-[3] sm:size-8" />
            </button>

            <button
              v-for="tab in rightTabs"
              :key="tab.name"
              :aria-label="tab.label"
              class="group relative z-10 flex min-h-12 flex-col items-center justify-center gap-1 rounded-[calc(1.3rem-0.25rem)] px-0.5 py-0 text-[10px] font-semibold transition-all duration-300 sm:min-h-14 sm:rounded-[calc(1.55rem-0.375rem)] sm:px-1 sm:py-0 sm:text-[11px]"
              :class="
                cn(
                  route.name === tab.name
                    ? 'bg-secondary text-primary shadow-[0_10px_24px_hsl(var(--glass-shadow)/0.18)]'
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

    <Transition name="meal-dialog">
      <div
        v-if="isLogDialogOpen"
        class="dialog-overlay feature feature-add-log"
      >
        <AddLogPage
          v-if="logDialogStep === 'log'"
          class="meal-dialog-panel"
          embedded
          initial-mode="log"
          :date="activeDayStore.activeDate"
          @close="closeLogDialog"
          @saved="closeLogDialog"
          @select-library="openLibrarySelector"
        />
        <LogMealLibrarySelectPage
          v-else
          class="meal-dialog-panel"
          embedded
          @done="returnToLogDialog"
        />
      </div>
    </Transition>
  </div>
</template>
