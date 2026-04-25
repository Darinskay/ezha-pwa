<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import SelectField from "@/components/ui/SelectField.vue";
import Separator from "@/components/ui/Separator.vue";
import MacroProgressTable from "@/components/MacroProgressTable.vue";
import FoodEntryCard from "@/components/FoodEntryCard.vue";
import { addDays, nowDateKey, parseDateKey, toDateKey } from "@/lib/date";
import { EXAMPLE_TARGETS, toMacroTotals } from "@/lib/macros";
import { dailySummaryRepository } from "@/repositories/daily-summary-repository";
import { dailyTargetRepository } from "@/repositories/daily-target-repository";
import { foodEntryRepository } from "@/repositories/food-entry-repository";
import { profileRepository } from "@/repositories/profile-repository";
import { queryKeys } from "@/query/keys";
import { fetchTodayBootstrap } from "@/services/profile-bootstrap";
import { useActiveDayStore } from "@/stores/active-day-store";
import type { DailySummary, DailyTarget } from "@/types/domain";

const router = useRouter();
const queryClient = useQueryClient();
const activeDayStore = useActiveDayStore();

const isOpeningAddLog = ref(false);
const showTargetChooser = ref(false);
const selectedTargetId = ref<string>("");
const startNewDayError = ref<string | null>(null);
const startNewDayWarning = ref<string | null>(null);
const showDeleteToast = ref(false);
let deleteToastTimer: ReturnType<typeof setTimeout> | null = null;

const todaySummaryQuery = useQuery({
  queryKey: queryKeys.todaySummary,
  queryFn: async () => {
    const data = await fetchTodayBootstrap();
    activeDayStore.setActiveDate(data.activeDate);
    return data;
  },
});
const todayData = computed(() => todaySummaryQuery.data.value);
const todayError = computed(
  () => (todaySummaryQuery.error.value as Error | null) ?? null,
);

const todayEntriesQuery = useQuery({
  queryKey: computed(() =>
    queryKeys.todayEntriesByDate(todayData.value?.activeDate ?? "pending"),
  ),
  enabled: computed(() => !!todayData.value?.activeDate),
  queryFn: async () => {
    const entries = todaySummaryQuery.data.value?.entries ?? [];
    return foodEntryRepository.fetchItemsForEntries(entries);
  },
});

const entriesWithItems = computed(() => todayEntriesQuery.data.value ?? []);
const entriesError = computed(
  () => (todayEntriesQuery.error.value as Error | null) ?? null,
);

const startNewDayMutation = useMutation({
  mutationFn: async (nextTarget: DailyTarget) => {
    startNewDayError.value = null;
    startNewDayWarning.value = null;

    const profile = await profileRepository.fetchProfile();
    if (!profile) throw new Error("Unable to load profile.");

    const summaryForActiveDate = await dailySummaryRepository.fetchSummary(
      profile.active_date,
    );
    const currentTarget =
      todaySummaryQuery.data.value?.activeTarget ??
      (profile.active_target_id
        ? await dailyTargetRepository.fetchTarget(profile.active_target_id)
        : null);

    const entries = await foodEntryRepository.fetchEntriesByDateKey(
      profile.active_date,
    );
    const totals = toMacroTotals(entries);

    const summary: DailySummary = {
      user_id: profile.user_id,
      date: profile.active_date,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      calories_target:
        summaryForActiveDate?.calories_target ??
        currentTarget?.calories_target ??
        profile.calories_target,
      protein_target:
        summaryForActiveDate?.protein_target ??
        currentTarget?.protein_target ??
        profile.protein_target,
      carbs_target:
        summaryForActiveDate?.carbs_target ??
        currentTarget?.carbs_target ??
        profile.carbs_target,
      fat_target:
        summaryForActiveDate?.fat_target ??
        currentTarget?.fat_target ??
        profile.fat_target,
      has_data: entries.length > 0,
      daily_target_id:
        summaryForActiveDate?.daily_target_id ?? currentTarget?.id ?? null,
      daily_target_name:
        summaryForActiveDate?.daily_target_name ?? currentTarget?.name ?? null,
    };

    let summaryWarning: string | null = null;
    try {
      await dailySummaryRepository.upsertSummary(summary);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save previous day summary.";
      summaryWarning = `Started new day, but previous day summary could not be saved: ${message}`;
    }

    const currentDate = parseDateKey(profile.active_date) ?? new Date();
    const candidate = addDays(currentDate, 1);
    const nextDate = toDateKey(
      new Date(
        Math.max(
          candidate.getTime(),
          (parseDateKey(nowDateKey()) ?? new Date()).getTime(),
        ),
      ),
    );

    await profileRepository.updateActiveDate(nextDate);
    await profileRepository.updateActiveTarget(nextTarget.id);
    activeDayStore.setActiveDate(nextDate);

    return { summaryWarning };
  },
  onSuccess: async ({ summaryWarning }) => {
    if (summaryWarning) {
      startNewDayWarning.value = summaryWarning;
    }
    showTargetChooser.value = false;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.todaySummary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.todayEntries }),
      queryClient.invalidateQueries({ queryKey: queryKeys.history }),
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestionsContext }),
    ]);
  },
  onError: (error) => {
    startNewDayError.value =
      error instanceof Error ? error.message : "Unable to start a new day.";
  },
});

const deleteEntryMutation = useMutation({
  mutationFn: async (entryId: string) => {
    await foodEntryRepository.deleteEntry(entryId);
  },
  onSuccess: async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.todaySummary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.todayEntries }),
      queryClient.invalidateQueries({ queryKey: queryKeys.history }),
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestionsContext }),
    ]);
    showDeleteToast.value = true;
    if (deleteToastTimer) clearTimeout(deleteToastTimer);
    deleteToastTimer = setTimeout(() => {
      showDeleteToast.value = false;
    }, 3000);
  },
});

const title = computed(() => {
  const activeDate = todaySummaryQuery.data.value?.activeDate;
  if (!activeDate) return "Today";
  const parsed = parseDateKey(activeDate);
  if (!parsed) return "Today";
  const label = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(parsed);
  return `Today, ${label}`;
});

const openAddLog = async (): Promise<void> => {
  if (isOpeningAddLog.value) return;
  isOpeningAddLog.value = true;
  try {
    await router.push({ name: "add-log", query: { mode: "log" } });
  } finally {
    isOpeningAddLog.value = false;
  }
};

const startNewDay = async (): Promise<void> => {
  const data = todaySummaryQuery.data.value;
  if (!data || data.availableTargets.length === 0) return;

  if (data.availableTargets.length === 1) {
    try {
      await startNewDayMutation.mutateAsync(data.availableTargets[0]);
    } catch {
      // Error is handled via mutation onError and displayed in-page.
    }
    return;
  }

  selectedTargetId.value = data.activeTarget?.id ?? data.availableTargets[0].id;
  showTargetChooser.value = true;
};

const confirmStartNewDay = async (): Promise<void> => {
  const data = todaySummaryQuery.data.value;
  if (!data) return;
  const nextTarget = data.availableTargets.find(
    (target) => target.id === selectedTargetId.value,
  );
  if (!nextTarget) return;
  try {
    await startNewDayMutation.mutateAsync(nextTarget);
  } catch {
    // Error is handled via mutation onError and displayed in-page.
  }
};

const deleteEntry = async (entryId: string): Promise<void> => {
  const confirmed = window.confirm("Delete entry?");
  if (!confirmed) return;
  await deleteEntryMutation.mutateAsync(entryId);
};

const remainingAmount = (target: number, eaten: number): number =>
  Math.max(target - eaten, 0);

const consumedPercent = (target: number, eaten: number): number => {
  if (target <= 0) return 0;
  return Math.max(0, Math.round((eaten / target) * 100));
};

const macroStatusIcon = (target: number, eaten: number): string => {
  if (target <= 0) return "";
  const pct = (eaten / target) * 100;
  if (pct > 100) return "✗";
  if (pct >= 80) return "⚠";
  return "✓";
};

const macroStatusClass = (target: number, eaten: number): string => {
  if (target <= 0) return "";
  const pct = (eaten / target) * 100;
  if (pct > 100) return "text-destructive";
  if (pct >= 80) return "text-amber-500";
  return "text-green-500";
};

const canStartNewDay = computed(
  () => !!todayData.value && todayData.value.availableTargets.length > 0,
);
const isSummaryPending = computed(() => todaySummaryQuery.isPending.value);
const isEntriesPending = computed(
  () => todayEntriesQuery.isPending.value || todayEntriesQuery.isFetching.value,
);
const summarySkeletonCards = Array.from({ length: 4 }, (_, index) => index);
const entrySkeletonRows = Array.from({ length: 2 }, (_, index) => index);
</script>

<template>
  <section class="app-page feature feature-today">
    <header class="page-header">
      <h1 class="page-title">{{ title }}</h1>
      <p class="page-subtitle">
        Track your active day and roll over when you are done.
      </p>
    </header>

    <Card class="glass space-y-4 p-3 sm:p-5">
      <div
        v-if="isSummaryPending"
        class="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        <div
          v-for="card in summarySkeletonCards"
          :key="card"
          class="stat-chip space-y-2"
        >
          <div class="skeleton h-3 w-20 rounded-full"></div>
          <div class="skeleton h-6 w-16 rounded-lg sm:h-7 sm:w-20"></div>
        </div>
      </div>
      <div v-else class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div class="stat-chip">
          <p
            class="text-[11px] uppercase tracking-[0.04em] text-muted-foreground flex items-center gap-1"
          >
            Calories Left
            <span
              :class="
                macroStatusClass(
                  todayData?.targets.calories ?? 0,
                  todayData?.totals.calories ?? 0,
                )
              "
              class="text-[10px]"
            >
              {{
                macroStatusIcon(
                  todayData?.targets.calories ?? 0,
                  todayData?.totals.calories ?? 0,
                )
              }}
            </span>
          </p>
          <p class="mt-1 text-base font-semibold sm:text-lg">
            {{
              remainingAmount(
                todayData?.targets.calories ?? 0,
                todayData?.totals.calories ?? 0,
              )
            }}
            <span class="ml-1 text-xs font-medium text-muted-foreground">
              ·
              {{
                consumedPercent(
                  todayData?.targets.calories ?? 0,
                  todayData?.totals.calories ?? 0,
                )
              }}%
            </span>
          </p>
        </div>
        <div class="stat-chip">
          <p
            class="text-[11px] uppercase tracking-[0.04em] text-muted-foreground flex items-center gap-1"
          >
            Protein Left
            <span
              :class="
                macroStatusClass(
                  todayData?.targets.protein ?? 0,
                  todayData?.totals.protein ?? 0,
                )
              "
              class="text-[10px]"
            >
              {{
                macroStatusIcon(
                  todayData?.targets.protein ?? 0,
                  todayData?.totals.protein ?? 0,
                )
              }}
            </span>
          </p>
          <p class="mt-1 text-base font-semibold sm:text-lg">
            {{
              remainingAmount(
                todayData?.targets.protein ?? 0,
                todayData?.totals.protein ?? 0,
              )
            }}g
            <span class="ml-1 text-xs font-medium text-muted-foreground">
              ·
              {{
                consumedPercent(
                  todayData?.targets.protein ?? 0,
                  todayData?.totals.protein ?? 0,
                )
              }}%
            </span>
          </p>
        </div>
        <div class="stat-chip">
          <p
            class="text-[11px] uppercase tracking-[0.04em] text-muted-foreground flex items-center gap-1"
          >
            Carbs Left
            <span
              :class="
                macroStatusClass(
                  todayData?.targets.carbs ?? 0,
                  todayData?.totals.carbs ?? 0,
                )
              "
              class="text-[10px]"
            >
              {{
                macroStatusIcon(
                  todayData?.targets.carbs ?? 0,
                  todayData?.totals.carbs ?? 0,
                )
              }}
            </span>
          </p>
          <p class="mt-1 text-base font-semibold sm:text-lg">
            {{
              remainingAmount(
                todayData?.targets.carbs ?? 0,
                todayData?.totals.carbs ?? 0,
              )
            }}g
            <span class="ml-1 text-xs font-medium text-muted-foreground">
              ·
              {{
                consumedPercent(
                  todayData?.targets.carbs ?? 0,
                  todayData?.totals.carbs ?? 0,
                )
              }}%
            </span>
          </p>
        </div>
        <div class="stat-chip">
          <p
            class="text-[11px] uppercase tracking-[0.04em] text-muted-foreground flex items-center gap-1"
          >
            Fat Left
            <span
              :class="
                macroStatusClass(
                  todayData?.targets.fat ?? 0,
                  todayData?.totals.fat ?? 0,
                )
              "
              class="text-[10px]"
            >
              {{
                macroStatusIcon(
                  todayData?.targets.fat ?? 0,
                  todayData?.totals.fat ?? 0,
                )
              }}
            </span>
          </p>
          <p class="mt-1 text-base font-semibold sm:text-lg">
            {{
              remainingAmount(
                todayData?.targets.fat ?? 0,
                todayData?.totals.fat ?? 0,
              )
            }}g
            <span class="ml-1 text-xs font-medium text-muted-foreground">
              ·
              {{
                consumedPercent(
                  todayData?.targets.fat ?? 0,
                  todayData?.totals.fat ?? 0,
                )
              }}%
            </span>
          </p>
        </div>
      </div>

      <Separator />

      <div v-if="isSummaryPending" class="space-y-3">
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div
            v-for="row in summarySkeletonCards"
            :key="`macro-${row}`"
            class="space-y-2"
          >
            <div class="skeleton h-3 w-14 rounded-full"></div>
            <div class="skeleton h-2.5 w-full rounded-full"></div>
          </div>
        </div>
        <div class="skeleton h-24 w-full rounded-2xl"></div>
      </div>
      <MacroProgressTable
        v-else
        :targets="todayData?.targets ?? EXAMPLE_TARGETS"
        :eaten="
          todayData?.totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 }
        "
      />

      <p
        v-if="todayError"
        class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ todayError.message }}
      </p>
      <p
        v-if="startNewDayWarning"
        class="rounded-xl border border-amber-300/50 bg-amber-100/60 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200"
      >
        {{ startNewDayWarning }}
      </p>
      <p
        v-if="startNewDayError"
        class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ startNewDayError }}
      </p>
    </Card>

    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Button :loading="isOpeningAddLog" @click="openAddLog">Log Meal</Button>
      <div class="flex flex-col gap-1">
        <Button
          variant="outline"
          :loading="startNewDayMutation.isPending.value"
          :disabled="!canStartNewDay"
          @click="startNewDay"
        >
          Start New Day
        </Button>
        <p
          v-if="!canStartNewDay && !isSummaryPending"
          class="text-center text-xs text-muted-foreground"
        >
          Create a daily target in Settings first.
        </p>
      </div>
    </div>

    <Card v-if="showTargetChooser && todayData" class="space-y-3 p-3 sm:p-5">
      <div>
        <h3 class="text-sm font-semibold">Choose target for next day</h3>
        <p class="text-xs text-muted-foreground">
          Your current entries will be saved to History.
        </p>
      </div>
      <SelectField v-model="selectedTargetId">
        <option
          v-for="target in todayData.availableTargets"
          :key="target.id"
          :value="target.id"
        >
          {{ target.name }} · {{ Math.round(target.calories_target) }} kcal
        </option>
      </SelectField>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          :loading="startNewDayMutation.isPending.value"
          @click="confirmStartNewDay"
          >Confirm</Button
        >
        <Button variant="ghost" @click="showTargetChooser = false"
          >Cancel</Button
        >
      </div>
    </Card>

    <section class="stack-section">
      <div class="stack-section-header">
        <h2 class="text-lg font-semibold">Today&apos;s Progress</h2>
        <span class="stack-section-meta">
          {{ todayData?.entries.length ?? 0 }} entries
        </span>
      </div>

      <div v-if="isSummaryPending || isEntriesPending" class="space-y-3">
        <div
          v-for="row in entrySkeletonRows"
          :key="row"
          class="rounded-2xl border border-border/70 bg-card/70 p-3 sm:p-5"
        >
          <div class="space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div class="space-y-2">
                <div class="skeleton h-4 w-28 rounded-full"></div>
                <div class="skeleton h-3 w-20 rounded-full"></div>
              </div>
              <div class="skeleton h-6 w-14 rounded-full"></div>
            </div>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div
                v-for="metric in summarySkeletonCards"
                :key="`entry-${row}-metric-${metric}`"
                class="space-y-2"
              >
                <div class="skeleton h-3 w-12 rounded-full"></div>
                <div class="skeleton h-3 w-16 rounded-full"></div>
              </div>
            </div>
            <div class="skeleton h-8 w-24 rounded-xl"></div>
          </div>
        </div>
      </div>
      <p
        v-else-if="entriesError"
        class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ entriesError.message }}
      </p>
      <div
        v-else-if="!entriesWithItems.length"
        class="stack-section-state stack-section-state-dashed"
      >
        <p>Nothing logged yet.</p>
        <p class="mt-1">
          Tap <strong>Log Meal</strong> above to add your first meal.
        </p>
      </div>
      <div v-else class="space-y-3">
        <div v-for="entry in entriesWithItems" :key="entry.entry.id">
          <FoodEntryCard
            :entry-with-items="entry"
            :show-expand="true"
            :show-delete="true"
            :delete-loading="deleteEntryMutation.isPending.value"
            @delete="deleteEntry"
          />
        </div>
      </div>
    </section>
    <Transition name="toast">
      <div
        v-if="showDeleteToast"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg"
      >
        Entry deleted
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

.skeleton {
  position: relative;
  overflow: hidden;
  background: linear-gradient(
    90deg,
    hsl(var(--muted) / 0.55) 0%,
    hsl(var(--muted) / 0.82) 50%,
    hsl(var(--muted) / 0.55) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
