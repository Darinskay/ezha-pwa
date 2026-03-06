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
import { ensureProfileAndTargets, resolveActiveTarget } from "@/services/profile-bootstrap";
import { useActiveDayStore } from "@/stores/active-day-store";
import type { DailySummary, DailyTarget, MacroTargets, MacroTotals } from "@/types/domain";

interface TodayData {
  activeDate: string;
  targets: MacroTargets;
  totals: MacroTotals;
  availableTargets: DailyTarget[];
  activeTarget?: DailyTarget;
  entriesWithItems: Awaited<ReturnType<typeof foodEntryRepository.fetchEntriesWithItemsByDateKey>>;
}

const router = useRouter();
const queryClient = useQueryClient();
const activeDayStore = useActiveDayStore();

const showTargetChooser = ref(false);
const selectedTargetId = ref<string>("");

const loadToday = async (): Promise<TodayData> => {
  const { profile, targets } = await ensureProfileAndTargets();
  const activeTarget = await resolveActiveTarget(profile, targets);

  const summary = await dailySummaryRepository.fetchSummary(profile.active_date);
  const resolvedTargets: MacroTargets = summary
    ? {
        calories: Math.round(summary.calories_target),
        protein: Math.round(summary.protein_target),
        carbs: Math.round(summary.carbs_target),
        fat: Math.round(summary.fat_target)
      }
    : activeTarget
      ? {
          calories: Math.round(activeTarget.calories_target),
          protein: Math.round(activeTarget.protein_target),
          carbs: Math.round(activeTarget.carbs_target),
          fat: Math.round(activeTarget.fat_target)
        }
      : EXAMPLE_TARGETS;

  const entriesWithItems = await foodEntryRepository.fetchEntriesWithItemsByDateKey(profile.active_date);
  const totals = toMacroTotals(entriesWithItems.map((entry) => entry.entry));

  activeDayStore.setActiveDate(profile.active_date);

  return {
    activeDate: profile.active_date,
    targets: resolvedTargets,
    totals,
    availableTargets: targets,
    activeTarget,
    entriesWithItems
  };
};

const todayQuery = useQuery({
  queryKey: queryKeys.today,
  queryFn: loadToday
});
const todayData = computed(() => todayQuery.data.value);
const todayError = computed(() => (todayQuery.error.value as Error | null) ?? null);

const startNewDayMutation = useMutation({
  mutationFn: async (nextTarget: DailyTarget) => {
    const profile = await profileRepository.fetchProfile();
    if (!profile) throw new Error("Unable to load profile.");

    const summaryForActiveDate = await dailySummaryRepository.fetchSummary(profile.active_date);
    const currentTarget =
      todayQuery.data.value?.activeTarget ??
      (profile.active_target_id ? await dailyTargetRepository.fetchTarget(profile.active_target_id) : null);

    const entries = await foodEntryRepository.fetchEntriesByDateKey(profile.active_date);
    const totals = toMacroTotals(entries);

    const summary: DailySummary = {
      user_id: profile.user_id,
      date: profile.active_date,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      calories_target:
        summaryForActiveDate?.calories_target ?? currentTarget?.calories_target ?? profile.calories_target,
      protein_target:
        summaryForActiveDate?.protein_target ?? currentTarget?.protein_target ?? profile.protein_target,
      carbs_target: summaryForActiveDate?.carbs_target ?? currentTarget?.carbs_target ?? profile.carbs_target,
      fat_target: summaryForActiveDate?.fat_target ?? currentTarget?.fat_target ?? profile.fat_target,
      has_data: entries.length > 0,
      daily_target_id: summaryForActiveDate?.daily_target_id ?? currentTarget?.id ?? null,
      daily_target_name: summaryForActiveDate?.daily_target_name ?? currentTarget?.name ?? null,
      created_at: null
    };

    await dailySummaryRepository.upsertSummary(summary);

    const currentDate = parseDateKey(profile.active_date) ?? new Date();
    const candidate = addDays(currentDate, 1);
    const nextDate = toDateKey(new Date(Math.max(candidate.getTime(), (parseDateKey(nowDateKey()) ?? new Date()).getTime())));

    await profileRepository.updateActiveDate(nextDate);
    await profileRepository.updateActiveTarget(nextTarget.id);
    activeDayStore.setActiveDate(nextDate);
  },
  onSuccess: async () => {
    showTargetChooser.value = false;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.today }),
      queryClient.invalidateQueries({ queryKey: queryKeys.history }),
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestionsContext })
    ]);
  }
});

const deleteEntryMutation = useMutation({
  mutationFn: async (entryId: string) => {
    await foodEntryRepository.deleteEntry(entryId);
  },
  onSuccess: async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.today }),
      queryClient.invalidateQueries({ queryKey: queryKeys.history }),
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestionsContext })
    ]);
  }
});

const title = computed(() => {
  const activeDate = todayQuery.data.value?.activeDate;
  if (!activeDate) return "Today";
  const parsed = parseDateKey(activeDate);
  if (!parsed) return "Today";
  const label = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short"
  }).format(parsed);
  return `Today, ${label}`;
});

const openAddLog = async (): Promise<void> => {
  await router.push({ name: "add-log", query: { mode: "log" } });
};

const startNewDay = async (): Promise<void> => {
  const data = todayQuery.data.value;
  if (!data || data.availableTargets.length === 0) return;

  if (data.availableTargets.length === 1) {
    await startNewDayMutation.mutateAsync(data.availableTargets[0]);
    return;
  }

  selectedTargetId.value = data.activeTarget?.id ?? data.availableTargets[0].id;
  showTargetChooser.value = true;
};

const confirmStartNewDay = async (): Promise<void> => {
  const data = todayQuery.data.value;
  if (!data) return;
  const nextTarget = data.availableTargets.find((target) => target.id === selectedTargetId.value);
  if (!nextTarget) return;
  await startNewDayMutation.mutateAsync(nextTarget);
};

const deleteEntry = async (entryId: string): Promise<void> => {
  const confirmed = window.confirm("Delete entry?");
  if (!confirmed) return;
  await deleteEntryMutation.mutateAsync(entryId);
};
</script>

<template>
  <section class="app-page">
    <header class="page-header">
      <h1 class="page-title">{{ title }}</h1>
      <p class="page-subtitle">Track your active day and roll over when you are done.</p>
    </header>

    <Card class="glass space-y-4 p-4 sm:p-5">
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div class="stat-chip">
          <p class="text-[11px] uppercase tracking-[0.04em] text-muted-foreground">Calories Left</p>
          <p class="mt-1 text-lg font-semibold">
            {{ Math.max((todayData?.targets.calories ?? 0) - (todayData?.totals.calories ?? 0), 0) }}
          </p>
        </div>
        <div class="stat-chip">
          <p class="text-[11px] uppercase tracking-[0.04em] text-muted-foreground">Protein Left</p>
          <p class="mt-1 text-lg font-semibold">
            {{ Math.max((todayData?.targets.protein ?? 0) - (todayData?.totals.protein ?? 0), 0) }}g
          </p>
        </div>
        <div class="stat-chip">
          <p class="text-[11px] uppercase tracking-[0.04em] text-muted-foreground">Carbs Left</p>
          <p class="mt-1 text-lg font-semibold">
            {{ Math.max((todayData?.targets.carbs ?? 0) - (todayData?.totals.carbs ?? 0), 0) }}g
          </p>
        </div>
        <div class="stat-chip">
          <p class="text-[11px] uppercase tracking-[0.04em] text-muted-foreground">Fat Left</p>
          <p class="mt-1 text-lg font-semibold">
            {{ Math.max((todayData?.targets.fat ?? 0) - (todayData?.totals.fat ?? 0), 0) }}g
          </p>
        </div>
      </div>

      <Separator />

      <MacroProgressTable
        :targets="todayData?.targets ?? EXAMPLE_TARGETS"
        :eaten="todayData?.totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 }"
      />

      <p v-if="todayError" class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {{ todayError.message }}
      </p>
    </Card>

    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Button :loading="todayQuery.isFetching.value" @click="openAddLog">Log Meal</Button>
      <Button variant="outline" :loading="startNewDayMutation.isPending.value" @click="startNewDay">
        Start New Day
      </Button>
    </div>

    <Card v-if="showTargetChooser && todayData" class="space-y-3 p-4 sm:p-5">
      <h3 class="text-sm font-semibold">Choose target for next day</h3>
      <SelectField v-model="selectedTargetId">
        <option v-for="target in todayData.availableTargets" :key="target.id" :value="target.id">
          {{ target.name }} · {{ Math.round(target.calories_target) }} kcal
        </option>
      </SelectField>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button :loading="startNewDayMutation.isPending.value" @click="confirmStartNewDay">Confirm</Button>
        <Button variant="ghost" @click="showTargetChooser = false">Cancel</Button>
      </div>
    </Card>

    <Card class="space-y-3 p-4 sm:p-5">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">Today&apos;s Progress</h2>
        <span class="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {{ todayData?.entriesWithItems.length ?? 0 }} entries
        </span>
      </div>

      <div v-if="todayQuery.isPending.value" class="rounded-xl border border-dashed border-border/80 py-8 text-center text-sm text-muted-foreground">
        Loading today data...
      </div>
      <div
        v-else-if="!todayData?.entriesWithItems.length"
        class="rounded-xl border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground"
      >
        No items yet.
      </div>
      <div v-else class="space-y-3">
        <div v-for="entry in todayData?.entriesWithItems ?? []" :key="entry.entry.id" class="space-y-2">
          <FoodEntryCard :entry-with-items="entry" :show-expand="true" />
          <Button
            variant="ghost"
            size="sm"
            class="text-destructive"
            :loading="deleteEntryMutation.isPending.value"
            @click="deleteEntry(entry.entry.id)"
          >
            Delete entry
          </Button>
        </div>
      </div>
    </Card>
  </section>
</template>
