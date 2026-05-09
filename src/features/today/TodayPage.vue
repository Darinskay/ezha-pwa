<script setup lang="ts">
import { computed, ref } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import Card from "@/components/ui/Card.vue";
import MacroProgressTable from "@/components/MacroProgressTable.vue";
import FoodEntryCard from "@/components/FoodEntryCard.vue";
import { EXAMPLE_TARGETS } from "@/lib/macros";
import { foodEntryRepository } from "@/repositories/food-entry-repository";
import { invalidateDailyDataQueries } from "@/query/invalidation";
import { queryKeys } from "@/query/keys";
import { syncDailySummaryForDate } from "@/services/day-summary-service";
import { fetchDayBootstrap } from "@/services/profile-bootstrap";
import { useActiveDayStore } from "@/stores/active-day-store";

const queryClient = useQueryClient();
const activeDayStore = useActiveDayStore();

const showDeleteToast = ref(false);
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

const deleteEntry = async (entryId: string): Promise<void> => {
  const confirmed = window.confirm("Delete entry?");
  if (!confirmed) return;
  await deleteEntryMutation.mutateAsync(entryId);
};

const isSummaryPending = computed(() => todaySummaryQuery.isPending.value);
const isEntriesPending = computed(
  () => todayEntriesQuery.isPending.value || todayEntriesQuery.isFetching.value,
);
const summarySkeletonCards = Array.from({ length: 4 }, (_, index) => index);
const entrySkeletonRows = Array.from({ length: 2 }, (_, index) => index);
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
