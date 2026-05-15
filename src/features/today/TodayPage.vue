<script setup lang="ts">
import { computed, ref } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { useRouter } from "vue-router";
import { ChevronDown, Target } from "lucide-vue-next";
import Card from "@/components/ui/Card.vue";
import MacroProgressTable from "@/components/MacroProgressTable.vue";
import FoodEntryCard from "@/components/FoodEntryCard.vue";
import { EXAMPLE_TARGETS } from "@/lib/macros";
import { foodEntryRepository } from "@/repositories/food-entry-repository";
import { invalidateDailyDataQueries } from "@/query/invalidation";
import { queryKeys } from "@/query/keys";
import {
  applyDailyTargetForDate,
  syncDailySummaryForDate,
} from "@/services/day-summary-service";
import { fetchDayBootstrap } from "@/services/profile-bootstrap";
import { useActiveDayStore } from "@/stores/active-day-store";
import TargetSelectorDialog from "@/features/today/TargetSelectorDialog.vue";

const queryClient = useQueryClient();
const router = useRouter();
const activeDayStore = useActiveDayStore();

const showDeleteToast = ref(false);
const isTargetSelectorOpen = ref(false);
let deleteToastTimer: ReturnType<typeof setTimeout> | null = null;

const todaySummaryQuery = useQuery({
  queryKey: computed(() =>
    queryKeys.daySummaryByDate(activeDayStore.activeDate),
  ),
  queryFn: async () => {
    const data = await fetchDayBootstrap(activeDayStore.activeDate);
    activeDayStore.setActiveDate(data.activeDate);
    return data;
  },
});
const todayData = computed(() => todaySummaryQuery.data.value);
const summaryEntries = computed(() => todayData.value?.entries ?? []);
const todayError = computed(
  () => (todaySummaryQuery.error.value as Error | null) ?? null,
);

const todayEntriesQuery = useQuery({
  queryKey: computed(() =>
    queryKeys.todayEntriesByDate(
      todayData.value?.activeDate ?? "pending",
      summaryEntries.value.map((entry) => entry.id),
    ),
  ),
  enabled: computed(() => !!todayData.value?.activeDate),
  queryFn: async () => {
    return foodEntryRepository.fetchItemsForEntries(summaryEntries.value);
  },
});

const entriesWithItems = computed(() => todayEntriesQuery.data.value ?? []);
const entriesError = computed(
  () => (todayEntriesQuery.error.value as Error | null) ?? null,
);
const selectedTarget = computed(() => todayData.value?.activeTarget);
const targetLabel = computed(
  () => selectedTarget.value?.name ?? "Saved target",
);
const targetCalories = computed(() =>
  Math.round(
    selectedTarget.value?.calories_target ??
      todayData.value?.targets.calories ??
      0,
  ),
);
const targetEyebrow = computed(() =>
  activeDayStore.isToday ? "Today's target" : "Day target",
);
const hasLoggedEntries = computed(() => summaryEntries.value.length > 0);

const deleteEntryMutation = useMutation({
  mutationFn: async (entryId: string) => {
    await foodEntryRepository.deleteEntry(entryId);
    await syncDailySummaryForDate(activeDayStore.activeDate);
  },
  onSuccess: async () => {
    await invalidateDailyDataQueries(queryClient);
    showDeleteToast.value = true;
    if (deleteToastTimer) clearTimeout(deleteToastTimer);
    deleteToastTimer = setTimeout(() => {
      showDeleteToast.value = false;
    }, 3000);
  },
});

const applyTargetMutation = useMutation({
  mutationFn: async (targetId: string) => {
    await applyDailyTargetForDate(activeDayStore.activeDate, targetId);
  },
  onSuccess: async () => {
    isTargetSelectorOpen.value = false;
    await invalidateDailyDataQueries(queryClient, { includeEntries: false });
  },
});

const deleteEntry = async (entryId: string): Promise<void> => {
  const confirmed = window.confirm("Delete entry?");
  if (!confirmed) return;
  await deleteEntryMutation.mutateAsync(entryId);
};

const isSummaryPending = computed(() => todaySummaryQuery.isPending.value);
const isEntriesPending = computed(
  () => todayEntriesQuery.isPending.value || todayEntriesQuery.isFetching.value,
);
const targetError = computed(
  () => (applyTargetMutation.error.value as Error | null) ?? null,
);
const summarySkeletonCards = Array.from({ length: 4 }, (_, index) => index);
const entrySkeletonRows = Array.from({ length: 2 }, (_, index) => index);

const openTargetSelector = (): void => {
  isTargetSelectorOpen.value = true;
};

const applyTarget = async (targetId: string): Promise<void> => {
  await applyTargetMutation.mutateAsync(targetId);
};

const addTarget = async (): Promise<void> => {
  isTargetSelectorOpen.value = false;
  await router.push({ name: "settings" });
};
</script>

<template>
  <section class="app-page feature feature-today">
    <Card class="glass space-y-3 p-3 sm:p-5">
      <div v-if="isSummaryPending" class="space-y-3">
        <div class="space-y-4">
          <div
            v-for="row in summarySkeletonCards"
            :key="`macro-${row}`"
            class="space-y-2"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="skeleton h-3 w-28 rounded-full"></div>
              <div class="skeleton h-3 w-24 rounded-full"></div>
            </div>
            <div class="skeleton h-2.5 w-full rounded-full"></div>
            <div class="skeleton h-3 w-24 rounded-full"></div>
          </div>
        </div>
      </div>
      <template v-else>
        <button
          class="group flex w-full items-center justify-between gap-3 rounded-[1rem] border border-primary/20 bg-card/60 px-3 py-2.5 text-left shadow-[inset_0_1px_0_hsl(var(--glass-highlight)/0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-card/78 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          type="button"
          @click="openTargetSelector"
        >
          <div class="flex min-w-0 items-center gap-3">
            <div
              class="flex size-10 shrink-0 items-center justify-center rounded-[0.9rem] border border-primary/20 bg-primary/10 text-primary"
            >
              <Target class="size-5" />
            </div>
            <div class="min-w-0">
              <p
                class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                {{ targetEyebrow }}
              </p>
              <p class="truncate text-sm font-semibold text-foreground">
                {{ targetLabel }} · {{ targetCalories }} kcal
              </p>
            </div>
          </div>

          <div
            class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground transition-colors group-hover:text-foreground"
          >
            <ChevronDown class="size-4" />
          </div>
        </button>

        <MacroProgressTable
          :targets="todayData?.targets ?? EXAMPLE_TARGETS"
          :eaten="
            todayData?.totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 }
          "
        />
      </template>

      <p
        v-if="todayError"
        class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ todayError.message }}
      </p>
    </Card>

    <section class="stack-section">
      <div class="stack-section-header">
        <h2 class="text-lg font-semibold">Daily Progress</h2>
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
          Tap the <strong>+</strong> button below to add your first meal.
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

    <TargetSelectorDialog
      v-if="isTargetSelectorOpen && todayData"
      :targets="todayData.availableTargets"
      :selected-target-id="todayData.activeTarget?.id"
      :has-entries="hasLoggedEntries"
      :loading="applyTargetMutation.isPending.value"
      :error-message="targetError?.message"
      @select="applyTarget"
      @close="isTargetSelectorOpen = false"
      @add-target="addTarget"
    />
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
