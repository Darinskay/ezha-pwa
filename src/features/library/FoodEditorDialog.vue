<script setup lang="ts">
import { computed, ref } from "vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Input from "@/components/ui/Input.vue";
import SelectField from "@/components/ui/SelectField.vue";
import { parseNumberInput } from "@/lib/number";
import { formatMacro } from "@/lib/macros";
import type { SavedFood, SavedFoodDraft } from "@/types/domain";

const props = defineProps<{
  food?: SavedFood;
  saving?: boolean;
}>();

const emit = defineEmits<{
  save: [draft: SavedFoodDraft];
  close: [];
}>();

const name = ref(props.food?.name ?? "");
const unitType = ref<"per_100g" | "per_serving">(props.food?.unit_type ?? "per_100g");
const servingSizeText = ref(props.food?.serving_size ? formatMacro(props.food.serving_size, 1) : "");
const servingUnit = ref(props.food?.serving_unit ?? "serving");
const caloriesText = ref(formatMacro(props.food?.calories_per_100g ?? 0, 2));
const proteinText = ref(formatMacro(props.food?.protein_per_100g ?? 0, 2));
const carbsText = ref(formatMacro(props.food?.carbs_per_100g ?? 0, 2));
const fatText = ref(formatMacro(props.food?.fat_per_100g ?? 0, 2));
const errorMessage = ref<string | null>(null);

const perServingPreview = computed(() => {
  const calories = parseNumberInput(caloriesText.value);
  const protein = parseNumberInput(proteinText.value);
  const carbs = parseNumberInput(carbsText.value);
  const fat = parseNumberInput(fatText.value);
  const servingSize = parseNumberInput(servingSizeText.value);
  if (calories == null || protein == null || carbs == null || fat == null || servingSize == null || servingSize <= 0) {
    return null;
  }
  const multiplier = servingSize / 100;
  return {
    calories: calories * multiplier,
    protein: protein * multiplier,
    carbs: carbs * multiplier,
    fat: fat * multiplier
  };
});

const save = (): void => {
  errorMessage.value = null;

  const trimmedName = name.value.trim();
  if (!trimmedName) {
    errorMessage.value = "Please enter a name.";
    return;
  }

  const calories = parseNumberInput(caloriesText.value);
  const protein = parseNumberInput(proteinText.value);
  const carbs = parseNumberInput(carbsText.value);
  const fat = parseNumberInput(fatText.value);

  if (calories == null || protein == null || carbs == null || fat == null) {
    errorMessage.value =
      unitType.value === "per_serving"
        ? "Enter per 100g macros to calculate per serving."
        : "Please enter valid macro values.";
    return;
  }

  const servingSize = unitType.value === "per_serving" ? parseNumberInput(servingSizeText.value) : null;

  if (unitType.value === "per_serving" && (!servingSize || servingSize <= 0)) {
    errorMessage.value = "Please enter grams per serving.";
    return;
  }

  const perServing =
    unitType.value === "per_serving" && servingSize
      ? {
          calories: calories * (servingSize / 100),
          protein: protein * (servingSize / 100),
          carbs: carbs * (servingSize / 100),
          fat: fat * (servingSize / 100)
        }
      : {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0
        };

  emit("save", {
    name: trimmedName,
    unit_type: unitType.value,
    serving_size: unitType.value === "per_serving" ? servingSize : null,
    serving_unit: unitType.value === "per_serving" ? servingUnit.value.trim() || null : null,
    calories_per_100g: calories,
    protein_per_100g: protein,
    carbs_per_100g: carbs,
    fat_per_100g: fat,
    calories_per_serving: perServing.calories,
    protein_per_serving: perServing.protein,
    carbs_per_serving: perServing.carbs,
    fat_per_serving: perServing.fat
  });
};
</script>

<template>
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
    <Card class="w-full max-w-xl space-y-4 p-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">{{ food ? "Edit Food" : "Add Food" }}</h3>
        <Button variant="ghost" size="sm" @click="emit('close')">Close</Button>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-medium">Food name</label>
        <Input v-model="name" placeholder="Food name" />
      </div>

      <div class="space-y-2">
        <label class="text-xs font-medium">Unit type</label>
        <SelectField v-model="unitType">
          <option value="per_100g">Per 100g</option>
          <option value="per_serving">Per serving</option>
        </SelectField>
      </div>

      <div v-if="unitType === 'per_serving'" class="grid grid-cols-2 gap-2">
        <div class="space-y-2">
          <label class="text-xs font-medium">Serving grams</label>
          <Input v-model="servingSizeText" type="number" min="0" step="0.1" />
        </div>
        <div class="space-y-2">
          <label class="text-xs font-medium">Serving unit</label>
          <Input v-model="servingUnit" placeholder="serving" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div class="space-y-1">
          <label class="text-xs font-medium">Calories</label>
          <Input v-model="caloriesText" type="number" min="0" step="0.1" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium">Protein</label>
          <Input v-model="proteinText" type="number" min="0" step="0.1" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium">Carbs</label>
          <Input v-model="carbsText" type="number" min="0" step="0.1" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium">Fat</label>
          <Input v-model="fatText" type="number" min="0" step="0.1" />
        </div>
      </div>

      <p v-if="unitType === 'per_serving' && perServingPreview" class="rounded-md bg-muted p-2 text-xs text-muted-foreground">
        Per serving: {{ formatMacro(perServingPreview.calories, 1) }} kcal ·
        P{{ formatMacro(perServingPreview.protein, 1) }} ·
        C{{ formatMacro(perServingPreview.carbs, 1) }} ·
        F{{ formatMacro(perServingPreview.fat, 1) }}
      </p>

      <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

      <div class="flex gap-2">
        <Button class="flex-1" :loading="saving" @click="save">Save</Button>
        <Button variant="ghost" class="flex-1" @click="emit('close')">Cancel</Button>
      </div>
    </Card>
  </div>
</template>
