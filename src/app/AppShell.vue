<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { BookMarked, Lightbulb, Plus, Settings, Sun } from "lucide-vue-next";
import DialogSheet from "@/components/ui/DialogSheet.vue";
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
const logBusy = ref(false);
const logDate = ref(activeDayStore.activeDate);
const logPanel = ref<InstanceType<typeof AddLogPage> | null>(null);
const logMessage = ref("");
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
  logBusy.value = false;
  logDate.value = activeDayStore.activeDate;
  logMessage.value = "";
  logDialogStep.value = "log";
  isLogDialogOpen.value = true;
};

const closeLogDialog = async (): Promise<void> => {
  if (logBusy.value) return;
  if (logPanel.value && !(await logPanel.value.persistDraft())) return;
  isLogDialogOpen.value = false;
  logDialogStep.value = "log";
};

const onMealLogged = async (
  _route: string,
  queued: boolean,
  notice: string,
): Promise<void> => {
  isLogDialogOpen.value = false;
  logDialogStep.value = "log";
  logMessage.value = queued
    ? "Saved on this device. Your totals will update after syncing."
    : "Meal logged.";
  if (notice) logMessage.value += ` ${notice}`;
  await router.push({ name: "today" });
};

const openLibrarySelector = (): void => {
  logDialogStep.value = "library-select";
};

const returnToLogDialog = (): void => {
  logBusy.value = false;
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
      <p v-if="logMessage" role="status" class="mx-3 mt-3 text-sm text-primary">
        {{ logMessage }}
      </p>
      <RouterView />
    </main>

    <nav
      v-if="!hideTabs"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.45rem)] sm:px-4 sm:pb-[max(env(safe-area-inset-bottom),0.55rem)]"
    >
      <div class="pointer-events-auto mx-auto max-w-5xl">
        <div
          class="glass overflow-visible rounded-full p-1 sm:p-1.5"
          style="
            box-shadow:
              0 18px 54px hsl(var(--glass-shadow) / 0.22),
              inset 0 1px 0 hsl(var(--glass-highlight) / 0.48);
          "
        >
          <div class="relative grid grid-cols-5 items-end gap-0.5">
            <button
              v-for="tab in leftTabs"
              :key="tab.name"
              :aria-label="tab.label"
              :aria-current="route.name === tab.name ? 'page' : undefined"
              class="group relative z-10 flex min-h-12 flex-col items-center justify-center gap-1 rounded-full px-0.5 py-0 text-[10px] font-semibold transition-all duration-300 sm:min-h-14 sm:px-1 sm:py-0 sm:text-[11px]"
              :class="
                cn(
                  route.name === tab.name
                    ? 'text-white shadow-[0_10px_24px_hsl(var(--primary)/0.22)]'
                    : 'text-muted-foreground hover:text-foreground',
                )
              "
              :style="
                route.name === tab.name
                  ? 'background: linear-gradient(142deg, hsl(var(--primary)), hsl(var(--secondary)));'
                  : ''
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
              class="group relative z-20 mx-auto -mt-5 flex size-16 items-center justify-center rounded-full border text-white shadow-[0_16px_38px_hsl(var(--primary)/0.42)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] sm:size-[4.35rem]"
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
                    hsl(var(--primary)),
                    hsl(var(--secondary))
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
              :aria-current="route.name === tab.name ? 'page' : undefined"
              class="group relative z-10 flex min-h-12 flex-col items-center justify-center gap-1 rounded-full px-0.5 py-0 text-[10px] font-semibold transition-all duration-300 sm:min-h-14 sm:px-1 sm:py-0 sm:text-[11px]"
              :class="
                cn(
                  route.name === tab.name
                    ? 'text-white shadow-[0_10px_24px_hsl(var(--primary)/0.22)]'
                    : 'text-muted-foreground hover:text-foreground',
                )
              "
              :style="
                route.name === tab.name
                  ? 'background: linear-gradient(142deg, hsl(var(--primary)), hsl(var(--secondary)));'
                  : ''
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

    <DialogSheet
      v-if="isLogDialogOpen"
      :title="logDialogStep === 'log' ? 'Log meal' : 'Add from Library'"
      :busy="logBusy"
      @close="closeLogDialog"
    >
      <AddLogPage
        ref="logPanel"
        v-if="logDialogStep === 'log'"
        class="meal-dialog-panel"
        embedded
        initial-mode="log"
        :date="logDate"
        @close="closeLogDialog"
        @saved="onMealLogged"
        @busy-change="logBusy = $event"
        @select-library="openLibrarySelector"
      />
      <LogMealLibrarySelectPage
        v-else
        class="meal-dialog-panel"
        embedded
        :date="logDate"
        @done="returnToLogDialog"
        @busy-change="logBusy = $event"
      />
    </DialogSheet>
  </div>
</template>
