<script setup lang="ts">
import { ref } from "vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Input from "@/components/ui/Input.vue";
import type { DailyTarget, DailyTargetInput } from "@/types/domain";

const props = defineProps<{
  target?: DailyTarget;
}>();

const emit = defineEmits<{
  save: [input: DailyTargetInput];
  close: [];
}>();

const name = ref(props.target?.name ?? "");
const calories = ref(props.target ? String(Math.round(props.target.calories_target)) : "");
const protein = ref(props.target ? String(Math.round(props.target.protein_target)) : "");
const carbs = ref(props.target ? String(Math.round(props.target.carbs_target)) : "");
const fat = ref(props.target ? String(Math.round(props.target.fat_target)) : "");
const errorMessage = ref<string | null>(null);

const save = (): void => {
  const trimmed = name.value.trim();
  if (!trimmed) {
    errorMessage.value = "Enter a name for this target.";
    return;
  }

  const values = [Number(calories.value), Number(protein.value), Number(carbs.value), Number(fat.value)];
  if (values.some((value) => !Number.isFinite(value))) {
    errorMessage.value = "Enter valid numbers for targets.";
    return;
  }

  emit("save", {
    id: props.target?.id,
    name: trimmed,
    calories: values[0],
    protein: values[1],
    carbs: values[2],
    fat: values[3]
  });
};
</script>

<template>
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
    <Card class="w-full max-w-lg space-y-4 p-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">{{ target ? "Edit Target" : "New Target" }}</h3>
        <Button variant="ghost" size="sm" @click="emit('close')">Close</Button>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-medium">Name</label>
        <Input v-model="name" placeholder="e.g. Basic" />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <label class="text-xs font-medium">Calories</label>
          <Input v-model="calories" type="number" min="0" step="1" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium">Protein (g)</label>
          <Input v-model="protein" type="number" min="0" step="1" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium">Carbs (g)</label>
          <Input v-model="carbs" type="number" min="0" step="1" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium">Fat (g)</label>
          <Input v-model="fat" type="number" min="0" step="1" />
        </div>
      </div>

      <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

      <div class="flex gap-2">
        <Button class="flex-1" @click="save">Save</Button>
        <Button variant="ghost" class="flex-1" @click="emit('close')">Cancel</Button>
      </div>
    </Card>
  </div>
</template>
