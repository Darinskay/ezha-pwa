<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Input from "@/components/ui/Input.vue";
import { loadDraft, saveDraft } from "@/db/offline-db";
import { buildLogItemFromSavedFood, normalizeLogItemGrams, type LogMealItem } from "@/features/add-log/log-meal-service";
import { formatMacro } from "@/lib/macros";
import { queryKeys } from "@/query/keys";
import { savedFoodRepository } from "@/repositories/saved-food-repository";

interface AddLogDraftSnapshot {
  logItems?: LogMealItem[];
  usedLibrarySource?: boolean;
  pendingLibrarySelectReturn?: boolean;
  [key: string]: unknown;
}

type SelectorFilter = "all" | "favorites" | "recent";

const LOG_MODE_DRAFT_KEY = "add-log:log";
const LIBRARY_FAVORITES_KEY = "ezha:library-food-favorites";
const LIBRARY_RECENTS_KEY = "ezha:library-food-recents";
const MAX_RECENT_FOODS = 16;

const router = useRouter();

const searchText = ref("");
const activeFilter = ref<SelectorFilter>("all");
const selectedFoodIds = ref<string[]>([]);
const gramsByFoodId = ref<Record<string, string>>({});
const favoriteFoodIds = ref<string[]>([]);
const recentFoodIds = ref<string[]>([]);

const foodsQuery = useQuery({
  queryKey: [...queryKeys.library, "selector-foods"],
  queryFn: async () => savedFoodRepository.fetchNonMealFoods()
});

const readIdArrayFromStorage = (key: string): string[] => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
};

const writeIdArrayToStorage = (key: string, ids: string[]): void => {
  window.localStorage.setItem(key, JSON.stringify(ids));
};

const isSelected = (foodId: string): boolean => selectedFoodIds.value.includes(foodId);

const ensureDefaultGrams = (foodId: string): void => {
  if (!gramsByFoodId.value[foodId]) {
    gramsByFoodId.value = { ...gramsByFoodId.value, [foodId]: "100" };
  }
};

const setSelected = (foodId: string, nextSelected: boolean): void => {
  if (nextSelected) {
    if (!selectedFoodIds.value.includes(foodId)) {
      selectedFoodIds.value = [...selectedFoodIds.value, foodId];
    }
    ensureDefaultGrams(foodId);
    return;
  }

  selectedFoodIds.value = selectedFoodIds.value.filter((id) => id !== foodId);
};

const onSelectionChange = (foodId: string, event: Event): void => {
  const input = event.target as HTMLInputElement | null;
  setSelected(foodId, !!input?.checked);
};

const toggleSelected = (foodId: string): void => {
  setSelected(foodId, !isSelected(foodId));
};

const setGrams = (foodId: string, value: string): void => {
  gramsByFoodId.value = { ...gramsByFoodId.value, [foodId]: value };
};

const toggleFavorite = (foodId: string): void => {
  favoriteFoodIds.value = favoriteFoodIds.value.includes(foodId)
    ? favoriteFoodIds.value.filter((id) => id !== foodId)
    : [...favoriteFoodIds.value, foodId];
  writeIdArrayToStorage(LIBRARY_FAVORITES_KEY, favoriteFoodIds.value);
};

const selectedCount = computed(() => selectedFoodIds.value.length);

const filteredFoods = computed(() => {
  const foods = foodsQuery.data.value ?? [];
  const search = searchText.value.trim().toLowerCase();
  const filteredBySearch = search ? foods.filter((food) => food.name.toLowerCase().includes(search)) : foods;

  if (activeFilter.value === "favorites") {
    return filteredBySearch.filter((food) => favoriteFoodIds.value.includes(food.id));
  }

  if (activeFilter.value === "recent") {
    return recentFoodIds.value
      .map((id) => filteredBySearch.find((food) => food.id === id) ?? null)
      .filter((food): food is (typeof filteredBySearch)[number] => !!food);
  }

  return filteredBySearch;
});

const preselectFromDraft = async (): Promise<void> => {
  const draft = await loadDraft<AddLogDraftSnapshot>(LOG_MODE_DRAFT_KEY);
  const logItems = Array.isArray(draft?.logItems) ? draft.logItems : [];
  const libraryFoodItems = logItems.filter(
    (item): item is LogMealItem => item.origin === "library_food" && !!item.linkedFoodId
  );

  if (libraryFoodItems.length === 0) {
    return;
  }

  const nextSelected: string[] = [];
  const nextGrams: Record<string, string> = {};

  for (const item of libraryFoodItems) {
    const linkedFoodId = item.linkedFoodId;
    if (!linkedFoodId || nextSelected.includes(linkedFoodId)) {
      continue;
    }
    nextSelected.push(linkedFoodId);
    nextGrams[linkedFoodId] = item.gramsText || "100";
  }

  selectedFoodIds.value = nextSelected;
  gramsByFoodId.value = nextGrams;
};

const pushRecentFoodIds = (foodIds: string[]): void => {
  recentFoodIds.value = [...foodIds, ...recentFoodIds.value.filter((id) => !foodIds.includes(id))].slice(0, MAX_RECENT_FOODS);
  writeIdArrayToStorage(LIBRARY_RECENTS_KEY, recentFoodIds.value);
};

const returnToAddLog = async (): Promise<void> => {
  await router.replace({ name: "add-log" });
};

const confirmSelection = async (): Promise<void> => {
  if (selectedFoodIds.value.length === 0) {
    return;
  }

  const foods = foodsQuery.data.value ?? [];
  const draft = await loadDraft<AddLogDraftSnapshot>(LOG_MODE_DRAFT_KEY);
  const currentLogItems = Array.isArray(draft?.logItems) ? draft.logItems : [];
  const nonLibraryItems = currentLogItems.filter(
    (item) => item.origin !== "library_food" && item.origin !== "library_meal"
  );

  const selectedLogItems = selectedFoodIds.value
    .map((foodId) => {
      const food = foods.find((candidate) => candidate.id === foodId);
      if (!food) return null;
      const normalized = normalizeLogItemGrams(gramsByFoodId.value[foodId] ?? "100");
      const grams = normalized != null && normalized > 0 ? normalized : 100;
      return buildLogItemFromSavedFood(food, grams);
    })
    .filter((item): item is LogMealItem => !!item);

  const nextDraft: AddLogDraftSnapshot = {
    ...(draft ?? {}),
    pendingLibrarySelectReturn: true,
    usedLibrarySource: selectedLogItems.length > 0,
    logItems: [...nonLibraryItems, ...selectedLogItems]
  };

  await saveDraft(LOG_MODE_DRAFT_KEY, nextDraft);
  pushRecentFoodIds(selectedFoodIds.value);
  await returnToAddLog();
};

favoriteFoodIds.value = readIdArrayFromStorage(LIBRARY_FAVORITES_KEY);
recentFoodIds.value = readIdArrayFromStorage(LIBRARY_RECENTS_KEY);
void preselectFromDraft();
</script>

<template>
  <section class="app-page feature feature-add-log pb-28">
    <header class="page-header">
      <h1 class="page-title">Select Foods</h1>
      <p class="page-subtitle">Choose one or more foods to add to your meal draft.</p>
    </header>

    <Card class="glass space-y-3 p-3 sm:p-5">
      <Input v-model="searchText" placeholder="Search library foods..." />

      <div class="flex flex-wrap gap-2">
        <Button size="sm" :variant="activeFilter === 'all' ? 'default' : 'outline'" @click="activeFilter = 'all'">
          All
        </Button>
        <Button
          size="sm"
          :variant="activeFilter === 'favorites' ? 'default' : 'outline'"
          @click="activeFilter = 'favorites'"
        >
          Favorites
        </Button>
        <Button size="sm" :variant="activeFilter === 'recent' ? 'default' : 'outline'" @click="activeFilter = 'recent'">
          Recent
        </Button>
      </div>
    </Card>

    <Card class="mt-3 space-y-3 p-3 sm:p-5">
      <div v-if="foodsQuery.isPending.value" class="rounded-xl border border-dashed border-border/80 py-8 text-center text-sm text-muted-foreground">
        Loading library foods...
      </div>

      <div
        v-else-if="filteredFoods.length === 0"
        class="rounded-xl border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground"
      >
        No foods found.
      </div>

      <div v-else class="space-y-2">
        <article
          v-for="food in filteredFoods"
          :key="food.id"
          class="cursor-pointer space-y-2 rounded-2xl border border-border/70 bg-card/70 p-3"
          role="button"
          tabindex="0"
          @click="toggleSelected(food.id)"
          @keydown.enter.prevent="toggleSelected(food.id)"
          @keydown.space.prevent="toggleSelected(food.id)"
        >
          <div class="flex items-start justify-between gap-2">
            <label class="flex items-start gap-3">
              <input
                class="mt-1 size-4 rounded border-border accent-primary"
                type="checkbox"
                :checked="isSelected(food.id)"
                @click.stop
                @change="onSelectionChange(food.id, $event)"
              />
              <div>
                <p class="text-sm font-semibold">{{ food.name }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ formatMacro(food.calories_per_100g, 1) }} kcal/100g ·
                  P{{ formatMacro(food.protein_per_100g, 1) }} ·
                  C{{ formatMacro(food.carbs_per_100g, 1) }} ·
                  F{{ formatMacro(food.fat_per_100g, 1) }}
                </p>
              </div>
            </label>

            <Button variant="ghost" size="sm" @click.stop="toggleFavorite(food.id)">
              {{ favoriteFoodIds.includes(food.id) ? "★" : "☆" }}
            </Button>
          </div>

          <div
            v-if="isSelected(food.id)"
            class="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-end"
            @click.stop
          >
            <p class="text-xs text-muted-foreground">Serving / quantity</p>
            <Input
              :model-value="gramsByFoodId[food.id] ?? '100'"
              type="number"
              min="0"
              step="0.1"
              placeholder="Grams"
              @click.stop
              @update:modelValue="(value) => setGrams(food.id, String(value))"
            />
          </div>
        </article>
      </div>

      <p v-if="foodsQuery.error.value" class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {{ (foodsQuery.error.value as Error).message }}
      </p>
    </Card>

    <div class="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-card/95 px-4 py-3 backdrop-blur sm:left-auto sm:right-auto sm:w-full sm:max-w-screen-sm sm:rounded-t-2xl">
      <div class="mx-auto grid max-w-screen-sm grid-cols-2 gap-2">
        <Button variant="ghost" @click="returnToAddLog">Cancel</Button>
        <Button :disabled="selectedCount === 0" @click="confirmSelection">Add Selected ({{ selectedCount }})</Button>
      </div>
    </div>
  </section>
</template>
