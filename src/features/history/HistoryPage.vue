<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import FoodEntryCard from "@/components/FoodEntryCard.vue";
import { addDays, displayDate, nowDateKey, parseDateKey, toDateKey } from "@/lib/date";
import { dailySummaryRepository } from "@/repositories/daily-summary-repository";
import { foodEntryRepository } from "@/repositories/food-entry-repository";
import { profileRepository } from "@/repositories/profile-repository";
import { queryKeys } from "@/query/keys";
import type { DailySummary, FoodEntryWithItems } from "@/types/domain";

const queryClient = useQueryClient();
const expandedDate = ref<string | null>(null);
const entriesByDate = reactive<Record<string, FoodEntryWithItems[]>>({});
const entryErrors = reactive<Record<string, string>>({});
const loadingDates = reactive<Set<string>>(new Set());

interface HistoryData {
  activeDate: string;
  summaries: DailySummary[];
}

const loadHistory = async (): Promise<HistoryData> => {
  const profile = await profileRepository.fetchProfile();
  if (!profile) {
    return { activeDate: "", summaries: [] };
  }

  const activeDate = profile.active_date;
  const endDate = parseDateKey(activeDate) ?? new Date();
  const end = addDays(endDate, -1);
  const start = addDays(end, -59);

  const summaries = await dailySummaryRepository.fetchSummaries(toDateKey(start), toDateKey(end));
  return {
    activeDate,
    summaries: summaries.filter((summary) => summary.has_data).sort((a, b) => b.date.localeCompare(a.date))
  };
};

const historyQuery = useQuery({
  queryKey: queryKeys.history,
  queryFn: loadHistory
});
const historyData = computed(() => historyQuery.data.value);
const historyError = computed(() => (historyQuery.error.value as Error | null) ?? null);

const isActiveDateToday = computed(
  () => historyQuery.data.value?.activeDate === nowDateKey()
);

const loadEntries = async (date: string): Promise<void> => {
  if (entriesByDate[date] || loadingDates.has(date)) return;

  loadingDates.add(date);
  entryErrors[date] = "";
  try {
    entriesByDate[date] = await foodEntryRepository.fetchEntriesWithItemsByDateKey(date);
  } catch (error) {
    entryErrors[date] = error instanceof Error ? error.message : "Unable to load entries.";
    entriesByDate[date] = [];
  } finally {
    loadingDates.delete(date);
  }
};

const toggleDate = async (date: string): Promise<void> => {
  expandedDate.value = expandedDate.value === date ? null : date;
  if (expandedDate.value === date) {
    await loadEntries(date);
  }
};

const goToDateMutation = useMutation({
  mutationFn: async (date: string) => {
    await profileRepository.updateActiveDate(date);
  },
  onSuccess: async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.today }),
      queryClient.invalidateQueries({ queryKey: queryKeys.history }),
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestionsContext })
    ]);
  }
});

const goToDate = async (date: string): Promise<void> => {
  await goToDateMutation.mutateAsync(date);
};

const percent = (value: number, target: number): number => {
  if (target <= 0) return 0;
  return Math.round((value / target) * 100);
};
</script>

<template>
  <section class="space-y-4 p-4 md:p-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold">History</h1>
      <p class="text-sm text-muted-foreground">Previous completed days (up to last 60 days).</p>
    </header>

    <Card class="p-4">
      <div v-if="historyQuery.isPending.value" class="py-8 text-center text-sm text-muted-foreground">
        Loading history...
      </div>

      <p v-else-if="historyError" class="text-sm text-destructive">
        {{ historyError.message }}
      </p>

      <div v-else-if="!historyData?.summaries.length" class="text-sm text-muted-foreground">
        No entries yet.
      </div>

      <div v-else class="space-y-3">
        <article
          v-for="(summary, index) in historyData?.summaries ?? []"
          :key="summary.date"
          class="rounded-md border p-3"
        >
          <button class="w-full text-left" @click="toggleDate(summary.date)">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="font-semibold">{{ displayDate(summary.date) }}</h3>
                <p v-if="summary.daily_target_name" class="text-xs text-muted-foreground">
                  Target: {{ summary.daily_target_name }}
                </p>
              </div>
              <span class="text-xs text-muted-foreground">
                {{ expandedDate === summary.date ? "Hide" : "Show" }}
              </span>
            </div>

            <div class="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <p>
                Calories: {{ Math.round(summary.calories) }} / {{ Math.round(summary.calories_target) }} ({{ percent(summary.calories, summary.calories_target) }}%)
              </p>
              <p>
                Protein: {{ Math.round(summary.protein) }} / {{ Math.round(summary.protein_target) }} ({{ percent(summary.protein, summary.protein_target) }}%)
              </p>
              <p>
                Carbs: {{ Math.round(summary.carbs) }} / {{ Math.round(summary.carbs_target) }} ({{ percent(summary.carbs, summary.carbs_target) }}%)
              </p>
              <p>
                Fat: {{ Math.round(summary.fat) }} / {{ Math.round(summary.fat_target) }} ({{ percent(summary.fat, summary.fat_target) }}%)
              </p>
            </div>
          </button>

          <Button
            v-if="index === 0 && isActiveDateToday"
            class="mt-3 w-full"
            :loading="goToDateMutation.isPending.value"
            @click="goToDate(summary.date)"
          >
            Go to this date
          </Button>

          <div v-if="expandedDate === summary.date" class="mt-3 space-y-2 border-t pt-3">
            <p v-if="loadingDates.has(summary.date)" class="text-sm text-muted-foreground">Loading entries...</p>
            <p v-else-if="entryErrors[summary.date]" class="text-sm text-destructive">{{ entryErrors[summary.date] }}</p>
            <p
              v-else-if="(entriesByDate[summary.date] ?? []).length === 0"
              class="text-sm text-muted-foreground"
            >
              No items logged.
            </p>

            <FoodEntryCard
              v-for="entry in entriesByDate[summary.date] ?? []"
              :key="entry.entry.id"
              :entry-with-items="entry"
              :show-expand="true"
            />
          </div>
        </article>
      </div>
    </Card>
  </section>
</template>
