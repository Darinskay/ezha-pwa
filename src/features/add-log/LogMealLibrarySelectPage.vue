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
import { parseNumberInput } from "@/lib/number";
import { queryKeys } from "@/query/keys";
import { savedFoodRepository } from "@/repositories/saved-food-repository";

interface AddLogDraftSnapshot {
  logItems?: LogMealItem[];
  usedLibrarySource?: boolean;
  pendingLibrarySelectReturn?: boolean;
  [key: string]: unknown;
}

interface EditableIngredient {
  id: string;
  name: string;
  gramsText: string;
  originalGrams: number;
  originalCalories: number;
  originalProtein: number;
  originalCarbs: number;
  originalFat: number;
  linkedFoodId: string | null;
}

type SelectorFilter = "all" | "favorites" | "recent";
type ActiveTab = "foods" | "meals";

const LOG_MODE_DRAFT_KEY = "add-log:log";
const LIBRARY_FAVORITES_KEY = "ezha:library-food-favorites";
const LIBRARY_RECENTS_KEY = "ezha:library-food-recents";
const MAX_RECENT_FOODS = 16;

const router = useRouter();

// --- Foods tab state ---
const searchText = ref("");
const activeFilter = ref<SelectorFilter>("all");
const selectedFoodIds = ref<string[]>([]);
const gramsByFoodId = ref<Record<string, string>>({});
const favoriteFoodIds = ref<string[]>([]);
const recentFoodIds = ref<string[]>([]);

// --- Meals tab state ---
const activeTab = ref<ActiveTab>("foods");
const mealSearchText = ref("");
const selectedMealIds = ref<string[]>([]);
const mealIngredientsByMealId = ref<Record<string, EditableIngredient[]>>({});
const loadingMealId = ref<string | null>(null);
const mealLoadError = ref<string | null>(null);

// --- Queries ---
const foodsQuery = useQuery({
  queryKey: [...queryKeys.library, "selector-foods"],
  queryFn: async () => savedFoodRepository.fetchNonMealFoods()
});

const mealsQuery = useQuery({
  queryKey: [...queryKeys.library, "selector-meals"],
  queryFn: async () => savedFoodRepository.fetchMeals()
});

// --- Foods tab helpers ---
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

// --- Meals tab helpers ---
const filteredMeals = computed(() => {
  const meals = mealsQuery.data.value ?? [];
  const search = mealSearchText.value.trim().toLowerCase();
  return search ? meals.filter((meal) => meal.name.toLowerCase().includes(search)) : meals;
});

const isMealSelected = (mealId: string): boolean => selectedMealIds.value.includes(mealId);

const selectedMealCount = computed(() => selectedMealIds.value.length);

const canSaveMeal = computed(() =>
  selectedMealIds.value.length > 0 &&
  selectedMealIds.value.some((mealId) =>
    (mealIngredientsByMealId.value[mealId] ?? []).some((i) => (parseNumberInput(i.gramsText) ?? 0) > 0)
  )
);

const selectMeal = async (mealId: string): Promise<void> => {
  if (isMealSelected(mealId)) {
    selectedMealIds.value = selectedMealIds.value.filter((id) => id !== mealId);
    return;
  }

  selectedMealIds.value = [...selectedMealIds.value, mealId];

  if (mealIngredientsByMealId.value[mealId]) return;

  loadingMealId.value = mealId;
  mealLoadError.value = null;
  try {
    const raw = await savedFoodRepository.fetchMealIngredients(mealId);
    mealIngredientsByMealId.value = {
      ...mealIngredientsByMealId.value,
      [mealId]: raw.map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        gramsText: formatMacro(ingredient.grams, 1),
        originalGrams: ingredient.grams,
        originalCalories: ingredient.calories,
        originalProtein: ingredient.protein,
        originalCarbs: ingredient.carbs,
        originalFat: ingredient.fat,
        linkedFoodId: ingredient.linked_food_id ?? null
      }))
    };
  } catch (error) {
    mealLoadError.value = error instanceof Error ? error.message : "Unable to load ingredients.";
    selectedMealIds.value = selectedMealIds.value.filter((id) => id !== mealId);
  } finally {
    loadingMealId.value = null;
  }
};

const ingredientScaledMacros = (ingredient: EditableIngredient) => {
  const grams = parseNumberInput(ingredient.gramsText) ?? 0;
  if (ingredient.originalGrams <= 0 || grams <= 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }
  const scale = grams / ingredient.originalGrams;
  return {
    calories: ingredient.originalCalories * scale,
    protein: ingredient.originalProtein * scale,
    carbs: ingredient.originalCarbs * scale,
    fat: ingredient.originalFat * scale
  };
};

const buildLogItemFromEditableIngredient = (ingredient: EditableIngredient): LogMealItem | null => {
  const grams = parseNumberInput(ingredient.gramsText) ?? 0;
  if (grams <= 0 || ingredient.originalGrams <= 0) return null;

  const per100 = 100 / ingredient.originalGrams;
  return {
    id: crypto.randomUUID(),
    name: ingredient.name,
    gramsText: formatMacro(grams, 1),
    macroBasis: "per_100g",
    baseGrams: 100,
    baseCalories: ingredient.originalCalories * per100,
    baseProtein: ingredient.originalProtein * per100,
    baseCarbs: ingredient.originalCarbs * per100,
    baseFat: ingredient.originalFat * per100,
    origin: "library_meal",
    linkedFoodId: ingredient.linkedFoodId,
    aiConfidence: null,
    aiNotes: "Added from saved meal",
    isNutritionMissing: false
  };
};

// --- Draft helpers ---
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

// --- Confirm: foods ---
const confirmFoodSelection = async (): Promise<void> => {
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

// --- Confirm: meals ---
const confirmMealSelection = async (): Promise<void> => {
  if (selectedMealIds.value.length === 0) return;

  const logItems = selectedMealIds.value.flatMap((mealId) => {
    const ingredients = mealIngredientsByMealId.value[mealId] ?? [];
    return ingredients
      .map(buildLogItemFromEditableIngredient)
      .filter((item): item is LogMealItem => item !== null);
  });

  const draft = await loadDraft<AddLogDraftSnapshot>(LOG_MODE_DRAFT_KEY);
  const currentLogItems = Array.isArray(draft?.logItems) ? draft.logItems : [];
  const nonLibraryItems = currentLogItems.filter(
    (item) => item.origin !== "library_food" && item.origin !== "library_meal"
  );

  const nextDraft: AddLogDraftSnapshot = {
    ...(draft ?? {}),
    pendingLibrarySelectReturn: true,
    usedLibrarySource: logItems.length > 0,
    logItems: [...nonLibraryItems, ...logItems]
  };

  await saveDraft(LOG_MODE_DRAFT_KEY, nextDraft);
  await returnToAddLog();
};

favoriteFoodIds.value = readIdArrayFromStorage(LIBRARY_FAVORITES_KEY);
recentFoodIds.value = readIdArrayFromStorage(LIBRARY_RECENTS_KEY);
void preselectFromDraft();
</script>

<template>
  <section class="app-page feature feature-add-log pb-28">
    <header class="page-header">
      <h1 class="page-title">Select from Library</h1>
      <p class="page-subtitle">Add individual foods or a full saved meal to your log.</p>
    </header>

    <!-- Tab bar + search -->
    <Card class="glass space-y-3 p-3 sm:p-5">
      <!-- Tab buttons -->
      <div class="flex gap-1 rounded-xl border border-border/60 bg-muted/30 p-1">
        <button
          class="flex-1 rounded-lg py-1.5 text-sm font-semibold transition-all"
          :class="activeTab === 'foods' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'foods'"
        >
          Foods
        </button>
        <button
          class="flex-1 rounded-lg py-1.5 text-sm font-semibold transition-all"
          :class="activeTab === 'meals' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'meals'"
        >
          Meals
        </button>
      </div>

      <!-- Foods tab: search + filters -->
      <template v-if="activeTab === 'foods'">
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
      </template>

      <!-- Meals tab: search -->
      <template v-else>
        <Input v-model="mealSearchText" placeholder="Search saved meals..." />
      </template>
    </Card>

    <!-- Foods list -->
    <Card v-if="activeTab === 'foods'" class="mt-3 space-y-3 p-3 sm:p-5">
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

    <!-- Meals list -->
    <Card v-else class="mt-3 space-y-3 p-3 sm:p-5">
      <div v-if="mealsQuery.isPending.value" class="rounded-xl border border-dashed border-border/80 py-8 text-center text-sm text-muted-foreground">
        Loading saved meals...
      </div>

      <div
        v-else-if="filteredMeals.length === 0"
        class="rounded-xl border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground"
      >
        No saved meals found. Create a meal in the Library tab first.
      </div>

      <div v-else class="space-y-2">
        <article
          v-for="meal in filteredMeals"
          :key="meal.id"
          class="rounded-2xl border bg-card/70 overflow-hidden"
          :class="isMealSelected(meal.id) ? 'border-[hsl(var(--feature-primary)/0.5)]' : 'border-border/70'"
        >
          <!-- Meal header row -->
          <div
            class="flex cursor-pointer items-start justify-between gap-2 p-3"
            role="button"
            tabindex="0"
            @click="selectMeal(meal.id)"
            @keydown.enter.prevent="selectMeal(meal.id)"
            @keydown.space.prevent="selectMeal(meal.id)"
          >
            <div class="flex items-start gap-3">
              <!-- Selection indicator -->
              <input
                class="mt-1 size-4 rounded border-border accent-primary shrink-0"
                type="checkbox"
                :checked="isMealSelected(meal.id)"
                @click.stop
                @change.stop="selectMeal(meal.id)"
              />
              <div>
                <p class="text-sm font-semibold">{{ meal.name }}</p>
                <p class="text-xs text-muted-foreground">Tap to expand and adjust ingredient grams</p>
              </div>
            </div>
            <span class="mt-0.5 text-xs text-muted-foreground transition-transform" :class="isMealSelected(meal.id) ? 'rotate-180' : ''">▾</span>
          </div>

          <!-- Ingredient list (expanded) -->
          <template v-if="isMealSelected(meal.id)">
            <div v-if="loadingMealId === meal.id" class="border-t border-border/50 px-3 py-4 text-center text-sm text-muted-foreground">
              Loading ingredients...
            </div>

            <div v-else-if="mealIngredientsByMealId[meal.id]?.length === 0" class="border-t border-border/50 px-3 py-4 text-center text-sm text-muted-foreground">
              This meal has no ingredients saved.
            </div>

            <div v-else class="border-t border-border/50 divide-y divide-border/40">
              <div
                v-for="ingredient in mealIngredientsByMealId[meal.id]"
                :key="ingredient.id"
                class="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5"
              >
                <div>
                  <p class="text-sm font-medium">{{ ingredient.name }}</p>
                  <p class="text-xs text-muted-foreground">
                    {{ Math.round(ingredientScaledMacros(ingredient).calories) }} kcal ·
                    P{{ Math.round(ingredientScaledMacros(ingredient).protein) }}g ·
                    C{{ Math.round(ingredientScaledMacros(ingredient).carbs) }}g ·
                    F{{ Math.round(ingredientScaledMacros(ingredient).fat) }}g
                  </p>
                </div>
                <div class="w-24">
                  <Input
                    v-model="ingredient.gramsText"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="g"
                    @click.stop
                  />
                  <p class="mt-0.5 text-center text-[10px] text-muted-foreground">grams</p>
                </div>
              </div>
            </div>
          </template>
        </article>
      </div>

      <p v-if="mealLoadError" class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {{ mealLoadError }}
      </p>

      <p v-if="mealsQuery.error.value" class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {{ (mealsQuery.error.value as Error).message }}
      </p>
    </Card>

    <!-- Fixed bottom bar -->
    <div class="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-card/95 px-4 py-3 backdrop-blur sm:left-auto sm:right-auto sm:w-full sm:max-w-screen-sm sm:rounded-t-2xl">
      <div class="mx-auto grid max-w-screen-sm grid-cols-2 gap-2">
        <Button variant="ghost" @click="returnToAddLog">Cancel</Button>
        <Button v-if="activeTab === 'foods'" :disabled="selectedCount === 0" @click="confirmFoodSelection">
          Add Selected ({{ selectedCount }})
        </Button>
        <Button v-else :disabled="!canSaveMeal" @click="confirmMealSelection">
          Add {{ selectedMealCount > 0 ? `Selected (${selectedMealCount})` : 'Meal' }}
        </Button>
      </div>
    </div>
  </section>
</template>
