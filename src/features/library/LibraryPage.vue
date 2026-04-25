<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { Pencil, Trash2 } from "lucide-vue-next";
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

const searchText = ref("");
const editingFood = ref<SavedFood | null>(null);
const loggingMeal = ref<SavedFood | null>(null);

const foodsQuery = useQuery({
  queryKey: queryKeys.library,
  queryFn: async () => savedFoodRepository.fetchFoods()
});

const filteredFoods = computed(() => {
  const foods = foodsQuery.data.value ?? [];
  const search = searchText.value.trim().toLowerCase();
  if (!search) return foods;
  return foods.filter((food) => food.name.toLowerCase().includes(search));
});

const deleteFoodMutation = useMutation({
  mutationFn: async (foodId: string) => {
    await savedFoodRepository.deleteFood(foodId);
  },
  onSuccess: async () => {
    await Promise.all([
      localQueryClient.invalidateQueries({ queryKey: queryKeys.library }),
    ]);
  }
});

const saveFoodMutation = useMutation({
  mutationFn: async ({ id, draft }: { id: string; draft: SavedFoodDraft }) => {
    await savedFoodRepository.updateFood(id, draft);
  },
  onSuccess: async () => {
    editingFood.value = null;
    await localQueryClient.invalidateQueries({ queryKey: queryKeys.library });
  }
});

const openAddFood = async (): Promise<void> => {
  await router.push({ name: "add-log", query: { mode: "library" } });
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
    queryClient.invalidateQueries({ queryKey: queryKeys.suggestionsContext })
  ]);
};
</script>

<template>
  <section class="app-page feature feature-library">
    <header class="page-header">
      <h1 class="page-title">Library</h1>
      <p class="page-subtitle">Save foods and meals for quick logging.</p>
    </header>

    <Card class="glass space-y-3 p-3 sm:p-5">
      <Button class="w-full sm:w-auto" @click="openAddFood">Add food</Button>
      <Input v-model="searchText" placeholder="Search your library..." />
    </Card>

    <Card class="space-y-3 p-3 sm:p-5">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">Saved foods</h2>
        <span class="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {{ filteredFoods.length }} items
        </span>
      </div>

      <div v-if="foodsQuery.isPending.value" class="rounded-xl border border-dashed border-border/80 py-8 text-center text-sm text-muted-foreground">
        Loading...
      </div>

      <div
        v-else-if="filteredFoods.length === 0"
        class="rounded-xl border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground"
      >
        No saved foods.
      </div>

      <div v-else class="space-y-2">
        <article
          v-for="food in filteredFoods"
          :key="food.id"
          class="relative flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/70 p-3 pr-12 sm:min-h-[6.5rem]"
        >
          <div class="space-y-1">
            <h3 class="font-semibold">{{ food.name }}</h3>
            <p class="text-xs text-muted-foreground">
              {{ food.is_meal ? "Meal" : food.unit_type === "per_100g" ? "Per 100g" : "Per serving" }} ·
              {{ Math.round(food.calories_per_100g) }} kcal /100g
            </p>
            <Button v-if="food.is_meal" variant="secondary" size="sm" class="mt-2 w-fit" @click="loggingMeal = food">
              Log
            </Button>
          </div>

          <Button
            v-if="!food.is_meal"
            variant="ghost"
            size="sm"
            class="absolute right-2 top-2 h-8 w-8 rounded-full p-0 text-muted-foreground"
            :aria-label="`Edit ${food.name}`"
            @click="editingFood = food"
          >
            <Pencil class="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            class="absolute bottom-2 right-2 h-8 w-8 rounded-full p-0 text-destructive"
            :loading="deleteFoodMutation.isPending.value"
            :aria-label="`Delete ${food.name}`"
            @click="onDelete(food.id)"
          >
            <Trash2 class="size-4" />
          </Button>
        </article>
      </div>

      <p v-if="foodsQuery.error.value" class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {{ (foodsQuery.error.value as Error).message }}
      </p>
    </Card>

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
