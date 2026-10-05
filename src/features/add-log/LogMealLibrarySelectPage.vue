<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { Check, Plus, Star } from "lucide-vue-next";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import { loadDraft, saveDraft } from "@/db/offline-db";
import {
  buildLogItemFromSavedFood,
  buildLogItemsFromSavedMeal,
  totalsFromLogItems,
  type LogMealItem,
} from "@/features/add-log/log-meal-service";
import {
  defaultFoodGrams,
  filterLibraryFoods,
  readLibraryIds,
  writeLibraryIds,
  sortLibraryByRecent,
  type LibraryFilter,
} from "@/features/library/library-helpers";
import { queryKeys } from "@/query/keys";
import { savedFoodRepository } from "@/repositories/saved-food-repository";
import { useActiveDayStore } from "@/stores/active-day-store";
import type { SavedFood } from "@/types/domain";

interface DraftSnapshot {
  logItems?: LogMealItem[];
  [key: string]: unknown;
}
const props = defineProps<{ embedded?: boolean; date?: string }>();
const emit = defineEmits<{ done: []; "busy-change": [busy: boolean] }>();
const router = useRouter();
const route = useRoute();
const activeDay = useActiveDayStore();
const date = computed(
  () =>
    props.date ??
    (typeof route.query.date === "string"
      ? route.query.date
      : activeDay.activeDate),
);
const draftKey = computed(() => `add-log:log:${date.value}`);
const searchText = ref("");
const filter = ref<LibraryFilter>("all");
const favorites = ref(readLibraryIds("favorites"));
const recents = readLibraryIds("recents");
const toggleFavorite = (id: string): void => {
  favorites.value = favorites.value.includes(id)
    ? favorites.value.filter((value) => value !== id)
    : [...favorites.value, id];
  writeLibraryIds("favorites", favorites.value);
};
const selected = ref<Record<string, LogMealItem[]>>({});
const loadingId = ref<string | null>(null);
const isConfirming = ref(false);
watch([loadingId, isConfirming], ([loading, confirming]) =>
  emit("busy-change", !!loading || confirming),
);
const errorMessage = ref<string | null>(null);
const foodsQuery = useQuery({
  queryKey: queryKeys.library,
  queryFn: () => savedFoodRepository.fetchFoods(),
});
const filteredFoods = computed(() =>
  sortLibraryByRecent(
    filterLibraryFoods(
      foodsQuery.data.value ?? [],
      searchText.value,
      filter.value,
      favorites.value,
    ),
    recents,
  ),
);
const selectionCount = computed(() => Object.keys(selected.value).length);
const selectedItems = computed(() => Object.values(selected.value).flat());
const totals = computed(() => totalsFromLogItems(selectedItems.value));
const filters = [
  { value: "all", label: "All" },
  { value: "foods", label: "Foods" },
  { value: "meals", label: "Meals" },
  { value: "favorites", label: "Favorites" },
] as const;

const toggleSelection = async (food: SavedFood): Promise<void> => {
  if (loadingId.value || isConfirming.value) return;
  errorMessage.value = null;
  if (selected.value[food.id]) {
    const next = { ...selected.value };
    delete next[food.id];
    selected.value = next;
    return;
  }
  loadingId.value = food.id;
  try {
    const items = food.is_meal
      ? buildLogItemsFromSavedMeal(
          await savedFoodRepository.fetchMealIngredients(food.id),
        )
      : [buildLogItemFromSavedFood(food, defaultFoodGrams(food))];
    if (!items.length || items.some((item) => item.isNutritionMissing)) {
      throw new Error(
        `${food.name} has missing nutrition. Choose another item.`,
      );
    }
    selected.value = { ...selected.value, [food.id]: items };
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Unable to add this item. Try again.";
  } finally {
    loadingId.value = null;
  }
};

const returnToLog = async (): Promise<void> => {
  if (props.embedded) emit("done");
  else
    await router.replace({
      name: "add-log",
      query: { mode: "log", date: date.value },
    });
};

const confirmSelection = async (): Promise<void> => {
  if (!selectionCount.value || loadingId.value || isConfirming.value) return;
  isConfirming.value = true;
  errorMessage.value = null;
  try {
    const draft = await loadDraft<DraftSnapshot>(draftKey.value);
    await saveDraft(draftKey.value, {
      ...draft,
      pendingLibrarySelectReturn: true,
      usedLibrarySource: true,
      logItems: [...(draft?.logItems ?? []), ...selectedItems.value],
    });
    const ids = Object.keys(selected.value);
    writeLibraryIds(
      "recents",
      [...ids, ...recents.filter((id) => !ids.includes(id))].slice(0, 16),
    );
    await returnToLog();
  } catch {
    errorMessage.value = "Your selection could not be added. Please try again.";
  } finally {
    isConfirming.value = false;
  }
};
</script>

<template>
  <section
    class="feature feature-add-log"
    :class="
      embedded
        ? 'glass flex h-[90dvh] w-full flex-col overflow-hidden rounded-t-card p-3 sm:max-w-2xl sm:rounded-card sm:p-5'
        : 'app-page feature feature-add-log'
    "
  >
    <header class="mb-3 flex items-center justify-between gap-2">
      <h1 class="page-title">Add from Library</h1>
      <Button
        variant="ghost"
        :disabled="!!loadingId || isConfirming"
        @click="returnToLog"
        >Back</Button
      >
    </header>
    <div class="space-y-2 pb-3">
      <Input
        v-model="searchText"
        type="search"
        aria-label="Search foods and meals"
        placeholder="Search foods and meals"
      />
      <div class="flex flex-wrap gap-2" aria-label="Filter library">
        <Button
          v-for="option in filters"
          :key="option.value"
          size="sm"
          :variant="filter === option.value ? 'secondary' : 'ghost'"
          :aria-pressed="filter === option.value"
          @click="filter = option.value"
          >{{ option.label }}</Button
        >
      </div>
    </div>
    <div
      :class="embedded ? 'min-h-0 flex-1 overflow-y-auto' : ''"
      class="space-y-2"
    >
      <p
        v-if="foodsQuery.isPending.value"
        class="stack-section-state"
        role="status"
      >
        Loading your library…
      </p>
      <div
        v-else-if="foodsQuery.error.value"
        class="stack-section-state"
        role="alert"
      >
        <p>Unable to load your library.</p>
        <Button variant="ghost" @click="foodsQuery.refetch()">Try again</Button>
      </div>
      <p v-else-if="!filteredFoods.length" class="stack-section-state">
        {{
          searchText || filter !== "all"
            ? "No matches. Try another search or filter."
            : "Your library is empty. Go back to log with a photo or description."
        }}
      </p>
      <div
        v-for="food in filteredFoods"
        :key="food.id"
        class="flex items-center gap-1"
      >
        <button
          type="button"
          class="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border/50 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :aria-pressed="!!selected[food.id]"
          :disabled="!!loadingId || isConfirming"
          @click="toggleSelection(food)"
        >
          <span class="min-w-0 flex-1">
            <span class="block break-words text-sm font-semibold">{{
              food.name
            }}</span>
            <span class="block text-xs text-muted-foreground">{{
              food.is_meal
                ? "Saved meal"
                : food.unit_type === "per_serving"
                  ? "One serving"
                  : "100 g"
            }}</span>
          </span>
          <span v-if="loadingId === food.id" class="text-xs" role="status"
            >Loading…</span
          >
          <Check
            v-else-if="selected[food.id]"
            class="size-5 text-primary"
            aria-hidden="true"
          />
          <Plus
            v-else
            class="size-5 text-muted-foreground"
            aria-hidden="true"
          />
        </button>
        <Button
          variant="ghost"
          class="size-11 p-0"
          :aria-label="`${favorites.includes(food.id) ? 'Unfavorite' : 'Favorite'} ${food.name}`"
          :aria-pressed="favorites.includes(food.id)"
          @click="toggleFavorite(food.id)"
          ><Star
            class="size-4"
            :class="
              favorites.includes(food.id) ? 'fill-primary text-primary' : ''
            "
            aria-hidden="true"
        /></Button>
      </div>
    </div>
    <div
      class="glass sticky bottom-0 mt-3 space-y-2 rounded-card p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
    >
      <p v-if="errorMessage" role="alert" class="text-sm text-destructive">
        {{ errorMessage }}
      </p>
      <p v-if="selectionCount" class="text-xs text-muted-foreground">
        {{ Math.round(totals.calories) }} kcal · Adjust quantities on the next
        screen.
      </p>
      <Button
        class="w-full"
        :loading="isConfirming"
        :disabled="!selectionCount || !!loadingId"
        @click="confirmSelection"
        >Add {{ selectionCount || "" }}
        {{ selectionCount === 1 ? "item" : "items" }}</Button
      >
    </div>
  </section>
</template>
