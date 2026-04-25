<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { useInfiniteScroll } from "@vueuse/core";
import { Trash2, X } from "lucide-vue-next";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Input from "@/components/ui/Input.vue";
import { queryKeys } from "@/query/keys";
import { savedFoodRepository } from "@/repositories/saved-food-repository";
import FoodEditorDialog from "@/features/library/FoodEditorDialog.vue";
import MealQuickLogDialog from "@/features/meal/MealQuickLogDialog.vue";
import { queryClient } from "@/query/query-client";
import type { SavedFood, SavedFoodDraft } from "@/types/domain";

const router = useRouter();
const localQueryClient = useQueryClient();
const PAGE_SIZE = 20;

const searchText = ref("");
const editingFood = ref<SavedFood | null>(null);
const loggingMeal = ref<SavedFood | null>(null);
const visibleCount = ref(PAGE_SIZE);

const foodsQuery = useQuery({
  queryKey: queryKeys.library,
  queryFn: async () => savedFoodRepository.fetchFoods(),
});

const filteredFoods = computed(() => {
  const foods = foodsQuery.data.value ?? [];
  const search = searchText.value.trim().toLowerCase();
  if (!search) return foods;
  return foods.filter((food) => food.name.toLowerCase().includes(search));
});

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

const openFood = (food: SavedFood): void => {
  if (food.is_meal) {
    loggingMeal.value = food;
    return;
  }

  editingFood.value = food;
};

const onDelete = async (foodId: string): Promise<void> => {
  const confirmed = window.confirm("Delete this food?");
  if (!confirmed) return;
  await deleteFoodMutation.mutateAsync(foodId);
};

const onSaveEdit = async (draft: SavedFoodDraft): Promise<void> => {
  if (!editingFood.value) return;
  await saveFoodMutation.mutateAsync({ id: editingFood.value.id, draft });
};

const onMealSaved = async (): Promise<void> => {
  loggingMeal.value = null;
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.todaySummary }),
    queryClient.invalidateQueries({ queryKey: queryKeys.todayEntries }),
    queryClient.invalidateQueries({ queryKey: queryKeys.history }),
    queryClient.invalidateQueries({ queryKey: queryKeys.suggestionsContext }),
  ]);
};

const clearSearch = (): void => {
  searchText.value = "";
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
            class="pr-10"
            placeholder="Search your library..."
          />
          <button
            v-if="searchText"
            type="button"
            class="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Clear search"
            @click="clearSearch"
          >
            <X class="size-4" />
          </button>
        </div>
        <Button class="shrink-0 px-3 sm:px-4" @click="openAddFood"
          >Add food</Button
        >
      </div>
    </Card>

    <section class="stack-section">
      <div class="stack-section-header">
        <h2 class="text-lg font-semibold">Saved foods</h2>
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
        No saved foods.
      </div>

      <div v-else class="space-y-1">
        <article
          v-for="food in visibleFoods"
          :key="food.id"
          class="cursor-pointer rounded-2xl border border-border/70 bg-card/70 p-3 transition-colors hover:bg-card/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          role="button"
          tabindex="0"
          @click="openFood(food)"
          @keydown.enter.prevent="openFood(food)"
          @keydown.space.prevent="openFood(food)"
        >
          <div class="space-y-1">
            <h3 class="font-semibold">{{ food.name }}</h3>
            <p class="text-xs text-muted-foreground">
              {{
                food.is_meal
                  ? "Meal"
                  : food.unit_type === "per_100g"
                    ? "Per 100g"
                    : "Per serving"
              }}
              · {{ Math.round(food.calories_per_100g) }} kcal /100g
            </p>
          </div>

          <div class="mt-3 flex items-center gap-2">
            <Button
              v-if="food.is_meal"
              variant="secondary"
              size="sm"
              @click.stop="loggingMeal = food"
            >
              Log
            </Button>

            <Button
              variant="ghost"
              size="sm"
              class="text-destructive"
              :loading="deleteFoodMutation.isPending.value"
              :aria-label="`Delete ${food.name}`"
              @click.stop="onDelete(food.id)"
            >
              <Trash2 class="size-4" />
              Delete
            </Button>
          </div>
        </article>
      </div>

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
