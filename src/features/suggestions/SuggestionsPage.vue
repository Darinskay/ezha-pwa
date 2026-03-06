<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Input from "@/components/ui/Input.vue";
import SelectField from "@/components/ui/SelectField.vue";
import Separator from "@/components/ui/Separator.vue";
import Textarea from "@/components/ui/Textarea.vue";
import { EXAMPLE_TARGETS, remainingMacros, toMacroTotals } from "@/lib/macros";
import { aiSuggestionService } from "@/services/ai-suggestion-service";
import { ensureProfileAndTargets, resolveActiveTarget } from "@/services/profile-bootstrap";
import { dailySummaryRepository } from "@/repositories/daily-summary-repository";
import { foodEntryRepository } from "@/repositories/food-entry-repository";
import { profileRepository } from "@/repositories/profile-repository";
import { queryKeys } from "@/query/keys";
import type { DailyTarget, MealSuggestion, MacroTargets, MacroTotals } from "@/types/domain";

const queryClient = useQueryClient();

const mealType = ref<"Meal" | "Snack">("Meal");
const maxPrepTimeMinutes = ref(20);
const ingredientNotes = ref("");
const suggestions = ref<MealSuggestion[]>([]);
const suggestionError = ref<string | null>(null);

interface SuggestionsContext {
  activeDate: string;
  targets: MacroTargets;
  totals: MacroTotals;
  remaining: MacroTotals;
}

const clampPrepTime = (value: number): number => Math.min(Math.max(value, 1), 240);

const loadContext = async (): Promise<SuggestionsContext> => {
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

  const entries = await foodEntryRepository.fetchEntriesByDateKey(profile.active_date);
  const totals = toMacroTotals(entries);

  return {
    activeDate: profile.active_date,
    targets: resolvedTargets,
    totals,
    remaining: remainingMacros(resolvedTargets, totals)
  };
};

const contextQuery = useQuery({
  queryKey: queryKeys.suggestionsContext,
  queryFn: loadContext
});
const contextData = computed(() => contextQuery.data.value);
const contextError = computed(() => (contextQuery.error.value as Error | null) ?? null);

const exceedWarning = (suggestion: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}, remaining: MacroTotals): string | undefined => {
  const parts: string[] = [];
  if (suggestion.calories > remaining.calories) {
    parts.push(`calories by ${Math.round(suggestion.calories - remaining.calories)} kcal`);
  }
  if (suggestion.protein > remaining.protein) {
    parts.push(`protein by ${Math.round(suggestion.protein - remaining.protein)} g`);
  }
  if (suggestion.carbs > remaining.carbs) {
    parts.push(`carbs by ${Math.round(suggestion.carbs - remaining.carbs)} g`);
  }
  if (suggestion.fat > remaining.fat) {
    parts.push(`fat by ${Math.round(suggestion.fat - remaining.fat)} g`);
  }
  return parts.length ? `Exceeds ${parts.join(", ")}` : undefined;
};

const fetchSuggestionsMutation = useMutation({
  mutationFn: async (variationNote?: string) => {
    if (!contextQuery.data.value) {
      throw new Error("Unable to load remaining macros.");
    }

    if (maxPrepTimeMinutes.value < 1 || maxPrepTimeMinutes.value > 240) {
      throw new Error("Prep time must be between 1 and 240 minutes.");
    }

    const payloads = await aiSuggestionService.fetchSuggestions({
      remaining: contextQuery.data.value.remaining,
      mealType: mealType.value,
      maxPrepMinutes: maxPrepTimeMinutes.value,
      count: 3,
      ingredientNotes: ingredientNotes.value.trim() || undefined,
      variationNote,
      units: "grams"
    });

    return payloads.slice(0, 3).map((payload) => ({
      id: crypto.randomUUID(),
      title: payload.title,
      description: payload.description,
      calories: Math.round(payload.calories),
      protein: Math.round(payload.protein),
      carbs: Math.round(payload.carbs),
      fat: Math.round(payload.fat),
      warning: exceedWarning(payload, contextQuery.data.value!.remaining),
      notes: payload.notes
    }));
  },
  onSuccess: (data) => {
    suggestions.value = data;
    suggestionError.value = null;
  },
  onError: (error) => {
    suggestionError.value = error instanceof Error ? error.message : "Unable to fetch suggestions.";
  }
});

const requestSuggestions = async (variationNote?: string): Promise<void> => {
  if (!contextQuery.data.value) {
    await contextQuery.refetch();
  }

  await fetchSuggestionsMutation.mutateAsync(variationNote);
};

const regenerateDifferent = async (): Promise<void> => {
  await requestSuggestions("Different options");
};

const regenerateIngredients = async (): Promise<void> => {
  await requestSuggestions(`Adjust ingredients: ${ingredientNotes.value.trim()}`);
};

const regenerateTime = async (): Promise<void> => {
  maxPrepTimeMinutes.value = clampPrepTime(maxPrepTimeMinutes.value);
  await requestSuggestions(`Adjust prep time to ${maxPrepTimeMinutes.value} minutes`);
};

watch(
  () => contextQuery.data.value?.activeDate,
  () => {
    suggestions.value = [];
    suggestionError.value = null;
  }
);

const refreshContext = async (): Promise<void> => {
  await contextQuery.refetch();
  await queryClient.invalidateQueries({ queryKey: queryKeys.today });
};
</script>

<template>
  <section class="app-page">
    <header class="page-header">
      <h1 class="page-title">Suggestions</h1>
      <p class="page-subtitle">AI meal ideas based on your remaining macros.</p>
    </header>

    <Card class="glass space-y-4 p-4 sm:p-5">
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div class="stat-chip">
          <p class="text-[11px] uppercase tracking-[0.04em] text-muted-foreground">Calories</p>
          <p class="mt-1 text-lg font-semibold">{{ contextData?.remaining.calories ?? 0 }} kcal</p>
        </div>
        <div class="stat-chip">
          <p class="text-[11px] uppercase tracking-[0.04em] text-muted-foreground">Protein</p>
          <p class="mt-1 text-lg font-semibold">{{ contextData?.remaining.protein ?? 0 }} g</p>
        </div>
        <div class="stat-chip">
          <p class="text-[11px] uppercase tracking-[0.04em] text-muted-foreground">Carbs</p>
          <p class="mt-1 text-lg font-semibold">{{ contextData?.remaining.carbs ?? 0 }} g</p>
        </div>
        <div class="stat-chip">
          <p class="text-[11px] uppercase tracking-[0.04em] text-muted-foreground">Fat</p>
          <p class="mt-1 text-lg font-semibold">{{ contextData?.remaining.fat ?? 0 }} g</p>
        </div>
      </div>

      <p
        v-if="contextData && contextData.targets.calories === 0 && contextData.targets.protein === 0 && contextData.targets.carbs === 0 && contextData.targets.fat === 0"
        class="rounded-xl border border-border/80 bg-background/80 px-3 py-2 text-sm text-muted-foreground"
      >
        Set your daily targets in Settings for better suggestions.
      </p>

      <p v-if="contextError" class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {{ contextError.message }}
      </p>

      <Separator />

      <Button variant="ghost" size="sm" @click="refreshContext">Refresh context</Button>
    </Card>

    <Card class="space-y-4 p-4 sm:p-5">
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="space-y-1">
          <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Meal type</label>
          <SelectField v-model="mealType">
            <option value="Meal">Meal</option>
            <option value="Snack">Snack</option>
          </SelectField>
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Max prep time (1-240)</label>
          <Input v-model="maxPrepTimeMinutes" type="number" min="1" max="240" />
        </div>
      </div>

      <div class="space-y-1">
        <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Ingredient notes</label>
        <Textarea v-model="ingredientNotes" :rows="3" placeholder="Example: no peanuts, add berries" />
      </div>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button :loading="fetchSuggestionsMutation.isPending.value" @click="requestSuggestions()">
          Get suggestions
        </Button>
        <Button variant="secondary" :disabled="!suggestions.length" @click="regenerateDifferent">
          Another options
        </Button>
        <Button variant="secondary" :disabled="!suggestions.length" @click="regenerateIngredients">
          Regenerate by ingredients
        </Button>
        <Button variant="secondary" :disabled="!suggestions.length" @click="regenerateTime">
          Regenerate by time
        </Button>
      </div>

      <p v-if="suggestionError" class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {{ suggestionError }}
      </p>
    </Card>

    <div class="space-y-3">
      <Card v-if="!suggestions.length" class="rounded-2xl border-dashed p-4 text-sm text-muted-foreground">
        No suggestions yet. Fill the form and tap Get suggestions.
      </Card>

      <Card v-for="suggestion in suggestions" :key="suggestion.id" class="space-y-3 p-4 sm:p-5">
        <div class="flex items-start justify-between gap-3">
          <h3 class="text-base font-semibold">{{ suggestion.title }}</h3>
          <span class="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {{ suggestion.calories }} kcal
          </span>
        </div>
        <p class="text-sm text-muted-foreground">{{ suggestion.description }}</p>
        <p class="rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
          P{{ suggestion.protein }}g · C{{ suggestion.carbs }}g · F{{ suggestion.fat }}g
        </p>
        <p v-if="suggestion.warning" class="text-xs font-medium text-destructive">{{ suggestion.warning }}</p>
        <p v-if="suggestion.notes" class="text-xs text-muted-foreground">{{ suggestion.notes }}</p>
      </Card>
    </div>
  </section>
</template>
