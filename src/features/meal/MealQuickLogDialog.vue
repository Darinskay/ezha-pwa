<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Input from "@/components/ui/Input.vue";
import SelectField from "@/components/ui/SelectField.vue";
import { enqueueRetry } from "@/db/offline-db";
import { formatMacro, savedFoodMacrosForQuantity } from "@/lib/macros";
import { parseNumberInput } from "@/lib/number";
import { currentUserId } from "@/lib/supabase";
import { foodEntryRepository } from "@/repositories/food-entry-repository";
import { profileRepository } from "@/repositories/profile-repository";
import { savedFoodRepository } from "@/repositories/saved-food-repository";
import { defaultProfileForUser } from "@/services/profile-bootstrap";
import type { FoodEntry, FoodEntryItem, SavedFood, SavedMealIngredient } from "@/types/domain";

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

const props = defineProps<{
  meal: SavedFood;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const isLoading = ref(false);
const isSaving = ref(false);
const errorMessage = ref<string | null>(null);
const ingredients = ref<EditableIngredient[]>([]);
const nonMealFoods = ref<SavedFood[]>([]);
const addIngredientFoodId = ref("");
const addIngredientGrams = ref("100");

const toEditable = (ingredient: SavedMealIngredient): EditableIngredient => ({
  id: ingredient.id,
  name: ingredient.name,
  gramsText: formatMacro(ingredient.grams, 1),
  originalGrams: ingredient.grams,
  originalCalories: ingredient.calories,
  originalProtein: ingredient.protein,
  originalCarbs: ingredient.carbs,
  originalFat: ingredient.fat,
  linkedFoodId: ingredient.linked_food_id ?? null
});

const gramsFor = (ingredient: EditableIngredient): number => parseNumberInput(ingredient.gramsText) ?? 0;
const scaleFor = (ingredient: EditableIngredient): number => {
  const grams = gramsFor(ingredient);
  if (ingredient.originalGrams <= 0 || grams <= 0) return 0;
  return grams / ingredient.originalGrams;
};

const totals = computed(() => {
  return ingredients.value.reduce(
    (acc, ingredient) => {
      const scale = scaleFor(ingredient);
      if (scale <= 0) return acc;
      return {
        calories: acc.calories + ingredient.originalCalories * scale,
        protein: acc.protein + ingredient.originalProtein * scale,
        carbs: acc.carbs + ingredient.originalCarbs * scale,
        fat: acc.fat + ingredient.originalFat * scale
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
});

const canSave = computed(() => ingredients.value.some((ingredient) => gramsFor(ingredient) > 0));

const loadData = async (): Promise<void> => {
  isLoading.value = true;
  errorMessage.value = null;
  try {
    const [mealIngredients, nonMeal] = await Promise.all([
      savedFoodRepository.fetchMealIngredients(props.meal.id),
      savedFoodRepository.fetchNonMealFoods()
    ]);

    ingredients.value = mealIngredients.map(toEditable);
    nonMealFoods.value = nonMeal;
    addIngredientFoodId.value = nonMeal[0]?.id ?? "";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load ingredients.";
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  void loadData();
});

const addIngredient = (): void => {
  const selected = nonMealFoods.value.find((food) => food.id === addIngredientFoodId.value);
  if (!selected) return;

  const grams = parseNumberInput(addIngredientGrams.value);
  if (!grams || grams <= 0) return;

  const macros = savedFoodMacrosForQuantity(selected, grams);
  ingredients.value.push({
    id: crypto.randomUUID(),
    name: selected.name,
    gramsText: formatMacro(grams, 1),
    originalGrams: grams,
    originalCalories: macros.calories,
    originalProtein: macros.protein,
    originalCarbs: macros.carbs,
    originalFat: macros.fat,
    linkedFoodId: selected.id
  });
};

const removeIngredient = (id: string): void => {
  ingredients.value = ingredients.value.filter((ingredient) => ingredient.id !== id);
};

const resolvedActiveDate = async (userId: string): Promise<string> => {
  const profile = await profileRepository.fetchProfile();
  if (profile?.active_date) {
    return profile.active_date;
  }

  const fallback = defaultProfileForUser(userId);
  await profileRepository.ensureProfileRowExists(fallback);
  return fallback.active_date;
};

const buildScaledMacros = (ingredient: EditableIngredient) => {
  const scale = scaleFor(ingredient);
  return {
    calories: ingredient.originalCalories * scale,
    protein: ingredient.originalProtein * scale,
    carbs: ingredient.originalCarbs * scale,
    fat: ingredient.originalFat * scale
  };
};

const save = async (): Promise<void> => {
  if (!canSave.value) {
    errorMessage.value = "Add at least one ingredient with grams.";
    return;
  }

  isSaving.value = true;
  errorMessage.value = null;

  try {
    const userId = await currentUserId();
    const entryId = crypto.randomUUID();
    const activeDate = await resolvedActiveDate(userId);

    const entry: FoodEntry = {
      id: entryId,
      user_id: userId,
      date: activeDate,
      input_type: "text",
      input_text: props.meal.name,
      image_path: null,
      calories: totals.value.calories,
      protein: totals.value.protein,
      carbs: totals.value.carbs,
      fat: totals.value.fat,
      ai_confidence: null,
      ai_source: "library",
      ai_notes: "Logged from saved meal",
      created_at: null
    };

    const items: FoodEntryItem[] = ingredients.value
      .map((ingredient) => {
        const grams = gramsFor(ingredient);
        if (grams <= 0) return null;
        const scaled = buildScaledMacros(ingredient);
        return {
          id: crypto.randomUUID(),
          entry_id: entryId,
          user_id: userId,
          name: ingredient.name,
          grams,
          calories: scaled.calories,
          protein: scaled.protein,
          carbs: scaled.carbs,
          fat: scaled.fat,
          ai_confidence: null,
          ai_notes: "",
          created_at: null
        } satisfies FoodEntryItem;
      })
      .filter(Boolean) as FoodEntryItem[];

    await foodEntryRepository.insertFoodEntry(entry, items);
    emit("saved");
    emit("close");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save entry.";
    if (!navigator.onLine || message.toLowerCase().includes("network")) {
      const userId = (await currentUserId().catch(() => "")) || "";
      const entryId = crypto.randomUUID();
      const activeDate = await resolvedActiveDate(userId);

      const queuedEntry: FoodEntry = {
        id: entryId,
        user_id: userId,
        date: activeDate,
        input_type: "text",
        input_text: props.meal.name,
        image_path: null,
        calories: totals.value.calories,
        protein: totals.value.protein,
        carbs: totals.value.carbs,
        fat: totals.value.fat,
        ai_confidence: null,
        ai_source: "library",
        ai_notes: "Logged from saved meal",
        created_at: null
      };

      const queuedItems: FoodEntryItem[] = ingredients.value
        .map((ingredient) => {
          const grams = gramsFor(ingredient);
          if (grams <= 0) return null;
          const scaled = buildScaledMacros(ingredient);
          return {
            id: crypto.randomUUID(),
            entry_id: entryId,
            user_id: userId,
            name: ingredient.name,
            grams,
            calories: scaled.calories,
            protein: scaled.protein,
            carbs: scaled.carbs,
            fat: scaled.fat,
            ai_confidence: null,
            ai_notes: "",
            created_at: null
          } satisfies FoodEntryItem;
        })
        .filter(Boolean) as FoodEntryItem[];

      await enqueueRetry("create_food_entry", { entry: queuedEntry, items: queuedItems });
      emit("saved");
      emit("close");
      return;
    }

    errorMessage.value = message;
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
    <Card class="max-h-[92vh] w-full max-w-2xl overflow-y-auto p-4">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold">Log Meal</h3>
          <p class="text-sm text-muted-foreground">{{ meal.name }}</p>
        </div>
        <Button variant="ghost" size="sm" @click="emit('close')">Close</Button>
      </div>

      <div v-if="isLoading" class="py-8 text-center text-sm text-muted-foreground">Loading...</div>

      <template v-else>
        <div class="space-y-3">
          <article
            v-for="ingredient in ingredients"
            :key="ingredient.id"
            class="space-y-2 rounded-md border p-3"
          >
            <div class="flex items-start justify-between gap-2">
              <h4 class="text-sm font-medium">{{ ingredient.name }}</h4>
              <Button variant="ghost" size="sm" @click="removeIngredient(ingredient.id)">Remove</Button>
            </div>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input v-model="ingredient.gramsText" type="number" min="0" step="0.1" placeholder="Grams" />
              <p class="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                {{ Math.round(buildScaledMacros(ingredient).calories) }} kcal · P{{ Math.round(buildScaledMacros(ingredient).protein) }} · C{{ Math.round(buildScaledMacros(ingredient).carbs) }} · F{{ Math.round(buildScaledMacros(ingredient).fat) }}
              </p>
            </div>
          </article>
        </div>

        <div class="mt-4 space-y-2 rounded-md border p-3">
          <h4 class="text-sm font-semibold">Add ingredient</h4>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <SelectField v-model="addIngredientFoodId">
              <option v-for="food in nonMealFoods" :key="food.id" :value="food.id">
                {{ food.name }}
              </option>
            </SelectField>
            <Input v-model="addIngredientGrams" type="number" min="0" step="0.1" placeholder="Grams" />
            <Button variant="secondary" @click="addIngredient">Add</Button>
          </div>
        </div>

        <div class="mt-4 rounded-md bg-muted p-3 text-sm">
          Total: {{ formatMacro(totals.calories, 1) }} kcal ·
          P{{ formatMacro(totals.protein, 1) }}g ·
          C{{ formatMacro(totals.carbs, 1) }}g ·
          F{{ formatMacro(totals.fat, 1) }}g
        </div>

        <p v-if="errorMessage" class="mt-3 text-sm text-destructive">{{ errorMessage }}</p>

        <div class="mt-4 flex gap-2">
          <Button class="flex-1" :loading="isSaving" :disabled="!canSave" @click="save">Save log</Button>
          <Button variant="ghost" class="flex-1" @click="emit('close')">Cancel</Button>
        </div>
      </template>
    </Card>
  </div>
</template>
