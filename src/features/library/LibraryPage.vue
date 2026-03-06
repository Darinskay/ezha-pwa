<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
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
      localQueryClient.invalidateQueries({ queryKey: queryKeys.today })
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
    queryClient.invalidateQueries({ queryKey: queryKeys.today }),
    queryClient.invalidateQueries({ queryKey: queryKeys.history }),
    queryClient.invalidateQueries({ queryKey: queryKeys.suggestionsContext })
  ]);
};
</script>

<template>
  <section class="space-y-4 p-4 md:p-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold">Library</h1>
      <p class="text-sm text-muted-foreground">Save foods and meals for quick logging.</p>
    </header>

    <Card class="space-y-3 p-4">
      <Button class="w-full" @click="openAddFood">Add food</Button>
      <Input v-model="searchText" placeholder="Search your library..." />
    </Card>

    <Card class="p-4">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold">Saved foods</h2>
        <span class="text-xs text-muted-foreground">{{ filteredFoods.length }} items</span>
      </div>

      <div v-if="foodsQuery.isPending.value" class="py-8 text-center text-sm text-muted-foreground">
        Loading...
      </div>

      <div
        v-else-if="filteredFoods.length === 0"
        class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
      >
        No saved foods.
      </div>

      <div v-else class="space-y-2">
        <article
          v-for="food in filteredFoods"
          :key="food.id"
          class="flex items-center justify-between gap-3 rounded-md border p-3"
        >
          <div>
            <h3 class="font-medium">{{ food.name }}</h3>
            <p class="text-xs text-muted-foreground">
              {{ food.is_meal ? "Meal" : food.unit_type === "per_100g" ? "Per 100g" : "Per serving" }} ·
              {{ Math.round(food.calories_per_100g) }} kcal /100g
            </p>
          </div>

          <div class="flex gap-1">
            <Button
              v-if="food.is_meal"
              variant="secondary"
              size="sm"
              @click="loggingMeal = food"
            >
              Log
            </Button>
            <Button
              v-else
              variant="secondary"
              size="sm"
              @click="editingFood = food"
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="text-destructive"
              :loading="deleteFoodMutation.isPending.value"
              @click="onDelete(food.id)"
            >
              Delete
            </Button>
          </div>
        </article>
      </div>

      <p v-if="foodsQuery.error.value" class="mt-3 text-sm text-destructive">
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
