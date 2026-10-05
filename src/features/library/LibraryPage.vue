<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
} from "radix-vue";
import { useRouter } from "vue-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { useInfiniteScroll } from "@vueuse/core";
import { MoreHorizontal, Pencil, Star, X } from "lucide-vue-next";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Input from "@/components/ui/Input.vue";
import { invalidateDailyDataQueries } from "@/query/invalidation";
import { queryKeys } from "@/query/keys";
import { savedFoodRepository } from "@/repositories/saved-food-repository";
import FoodEditorDialog from "@/features/library/FoodEditorDialog.vue";
import MealQuickLogDialog from "@/features/meal/MealQuickLogDialog.vue";
import {
  filterLibraryFoods,
  readLibraryIds,
  writeLibraryIds,
  sortLibraryByRecent,
  type LibraryFilter,
} from "@/features/library/library-helpers";
import type { SavedFood, SavedFoodDraft } from "@/types/domain";

const router = useRouter();
const localQueryClient = useQueryClient();
const PAGE_SIZE = 20;

const searchText = ref("");
const activeFilter = ref<LibraryFilter>("all");
const logMessage = ref("");
const favorites = ref(readLibraryIds("favorites"));
const recents = ref(readLibraryIds("recents"));
const toggleFavorite = (id: string): void => {
  favorites.value = favorites.value.includes(id)
    ? favorites.value.filter((value) => value !== id)
    : [...favorites.value, id];
  writeLibraryIds("favorites", favorites.value);
};
const filters = [
  { value: "all", label: "All" },
  { value: "foods", label: "Foods" },
  { value: "meals", label: "Meals" },
  { value: "favorites", label: "Favorites" },
] as const;
const editingFood = ref<SavedFood | null>(null);
const loggingMeal = ref<SavedFood | null>(null);
const visibleCount = ref(PAGE_SIZE);

const foodsQuery = useQuery({
  queryKey: queryKeys.library,
  queryFn: async () => savedFoodRepository.fetchFoods(),
});

const filteredFoods = computed(() =>
  sortLibraryByRecent(
    filterLibraryFoods(
      foodsQuery.data.value ?? [],
      searchText.value,
      activeFilter.value,
      favorites.value,
    ),
    recents.value,
  ),
);

const visibleFoods = computed(() =>
  filteredFoods.value.slice(0, visibleCount.value),
);

const resetVisibleFoods = (): void => {
  visibleCount.value = Math.min(PAGE_SIZE, filteredFoods.value.length);
};

const loadMoreFoods = (): void => {
  visibleCount.value = Math.min(
    visibleCount.value + PAGE_SIZE,
    filteredFoods.value.length,
  );
};

watch(filteredFoods, resetVisibleFoods, { immediate: true });

useInfiniteScroll(
  window,
  () => {
    loadMoreFoods();
  },
  {
    distance: 192,
    canLoadMore: () => visibleCount.value < filteredFoods.value.length,
  },
);

const deleteFoodMutation = useMutation({
  mutationFn: async (foodId: string) => {
    await savedFoodRepository.deleteFood(foodId);
  },
  onSuccess: async () => {
    await localQueryClient.invalidateQueries({ queryKey: queryKeys.library });
  },
});

const saveFoodMutation = useMutation({
  mutationFn: async ({ id, draft }: { id: string; draft: SavedFoodDraft }) => {
    await savedFoodRepository.updateFood(id, draft);
  },
  onSuccess: async () => {
    editingFood.value = null;
    await localQueryClient.invalidateQueries({ queryKey: queryKeys.library });
  },
});

const openAddFood = async (): Promise<void> => {
  await router.push({ name: "add-log", query: { mode: "library" } });
};

const onDelete = async (foodId: string): Promise<void> => {
  const confirmed = window.confirm("Delete this food?");
  if (!confirmed) return;
  deleteFoodMutation.mutate(foodId);
};

const onSaveEdit = async (draft: SavedFoodDraft): Promise<void> => {
  if (!editingFood.value) return;
  saveFoodMutation.mutate({ id: editingFood.value.id, draft });
};

const onMealSaved = async (queued: boolean): Promise<void> => {
  if (loggingMeal.value) {
    recents.value = [
      loggingMeal.value.id,
      ...recents.value.filter((id) => id !== loggingMeal.value?.id),
    ].slice(0, 16);
    writeLibraryIds("recents", recents.value);
  }
  loggingMeal.value = null;
  logMessage.value = queued
    ? "Saved on this device. Your totals will update after syncing."
    : "Meal logged.";
  await invalidateDailyDataQueries(localQueryClient);
};

const clearSearch = (): void => {
  searchText.value = "";
};

const foodUnitLabel = (food: SavedFood): string => {
  if (food.is_meal) return "Meal";
  if (food.unit_type === "per_100g") return "Per 100g";
  if (food.serving_size && food.serving_unit) {
    return `${Math.round(food.serving_size)} ${food.serving_unit}`;
  }
  return "Per serving";
};

const foodDescription = (food: SavedFood): string => {
  if (food.is_meal) return "Saved meal";
  const calories =
    food.unit_type === "per_serving"
      ? food.calories_per_serving
      : food.calories_per_100g;
  return `${foodUnitLabel(food)} · ${Math.round(calories)} kcal`;
};
</script>

<template>
  <section class="app-page feature feature-library">
    <header class="page-header">
      <h1 class="page-title">Library</h1>
      <p class="page-subtitle">Save foods and meals for quick logging.</p>
    </header>

    <Card class="glass p-3 sm:p-5">
      <div class="flex items-center gap-2">
        <div class="relative min-w-0 flex-1">
          <Input
            v-model="searchText"
            class="pr-12"
            type="search"
            aria-label="Search foods and meals"
            placeholder="Search foods and meals"
          />
          <button
            v-if="searchText"
            type="button"
            class="absolute right-0 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Clear search"
            @click="clearSearch"
          >
            <X class="size-4" />
          </button>
        </div>
        <Button class="shrink-0 px-3 sm:px-4" @click="openAddFood">Add</Button>
      </div>
      <div class="mt-3 flex flex-wrap gap-2" aria-label="Filter library">
        <Button
          v-for="option in filters"
          :key="option.value"
          size="sm"
          :variant="activeFilter === option.value ? 'secondary' : 'ghost'"
          :aria-pressed="activeFilter === option.value"
          @click="activeFilter = option.value"
          >{{ option.label }}</Button
        >
      </div>
    </Card>
    <p v-if="logMessage" role="status" class="text-sm text-primary">
      {{ logMessage }}
    </p>

    <section class="stack-section">
      <div class="stack-section-header">
        <h2 class="text-lg font-semibold">Foods and meals</h2>
        <span class="stack-section-meta">
          {{ filteredFoods.length }} items
        </span>
      </div>

      <div
        v-if="foodsQuery.isPending.value"
        class="stack-section-state stack-section-state-dashed"
      >
        Loading...
      </div>

      <div
        v-else-if="filteredFoods.length === 0"
        class="stack-section-state stack-section-state-dashed"
      >
        {{
          searchText || activeFilter !== "all"
            ? "No matches. Try another search or filter."
            : "Your library is empty. Save a food or meal to log it quickly next time."
        }}
      </div>

      <div v-else class="space-y-2">
        <article
          v-for="food in visibleFoods"
          :key="food.id"
          class="glass rounded-thumb p-2.5 sm:p-3"
        >
          <div class="flex min-h-12 items-center gap-3">
            <button
              class="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-1.5 py-1.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              type="button"
              :aria-label="`Log ${food.name}`"
              @click="loggingMeal = food"
            >
              <span class="min-w-0 flex-1">
                <h3 class="break-words text-sm font-bold leading-5">
                  {{ food.name }}
                </h3>
                <p class="text-xs leading-4 text-muted-foreground">
                  {{ foodDescription(food) }}
                </p>
              </span>
            </button>

            <Button
              variant="secondary"
              size="sm"
              class="h-11 rounded-full px-3"
              :aria-label="`Log ${food.name}`"
              @click.stop="loggingMeal = food"
            >
              Log
            </Button>

            <DropdownMenuRoot>
              <DropdownMenuTrigger as-child>
                <Button
                  variant="ghost"
                  class="size-11 p-0"
                  :aria-label="`Manage ${food.name}`"
                  ><MoreHorizontal class="size-5" aria-hidden="true"
                /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuContent
                  align="end"
                  :side-offset="6"
                  class="glass feature feature-library z-50 grid min-w-44 gap-1 rounded-xl p-1"
                >
                  <DropdownMenuItem
                    class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm outline-none focus:bg-muted"
                    @select="toggleFavorite(food.id)"
                    ><Star class="size-4" aria-hidden="true" />{{
                      favorites.includes(food.id) ? "Unfavorite" : "Favorite"
                    }}</DropdownMenuItem
                  >
                  <DropdownMenuItem
                    v-if="!food.is_meal"
                    class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm outline-none focus:bg-muted"
                    @select="
                      saveFoodMutation.reset();
                      editingFood = food;
                    "
                    ><Pencil class="size-4" aria-hidden="true" />Edit
                    food</DropdownMenuItem
                  >
                  <DropdownMenuItem
                    class="flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm text-destructive outline-none focus:bg-muted"
                    :disabled="deleteFoodMutation.isPending.value"
                    @select="onDelete(food.id)"
                    >Delete</DropdownMenuItem
                  >
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenuRoot>
          </div>
        </article>
      </div>

      <Button
        v-if="visibleCount < filteredFoods.length"
        variant="ghost"
        class="w-full"
        @click="loadMoreFoods"
        >Show more</Button
      >
      <p
        v-if="saveFoodMutation.error.value || deleteFoodMutation.error.value"
        role="alert"
        class="text-sm text-destructive"
      >
        {{
          (saveFoodMutation.error.value as Error | null)?.message ??
          (deleteFoodMutation.error.value as Error | null)?.message
        }}
      </p>
      <p
        v-if="foodsQuery.error.value"
        class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ (foodsQuery.error.value as Error).message }}
      </p>
    </section>

    <FoodEditorDialog
      v-if="editingFood"
      :food="editingFood"
      :saving="saveFoodMutation.isPending.value"
      :save-error="(saveFoodMutation.error.value as Error | null)?.message"
      @save="onSaveEdit"
      @close="editingFood = null"
    />

    <MealQuickLogDialog
      v-if="loggingMeal"
      :meal="loggingMeal"
      @close="loggingMeal = null"
      @saved="onMealSaved"
    />
  </section>
</template>
