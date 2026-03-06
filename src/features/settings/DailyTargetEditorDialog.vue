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
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
    <Card class="w-full max-w-lg space-y-4 border-border/80 bg-card/96 p-4 sm:p-5">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">{{ target ? "Edit Target" : "New Target" }}</h3>
        <Button variant="ghost" size="sm" @click="emit('close')">Close</Button>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Name</label>
        <Input v-model="name" placeholder="e.g. Basic" />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Calories</label>
          <Input v-model="calories" type="number" min="0" step="1" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Protein (g)</label>
          <Input v-model="protein" type="number" min="0" step="1" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Carbs (g)</label>
          <Input v-model="carbs" type="number" min="0" step="1" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Fat (g)</label>
          <Input v-model="fat" type="number" min="0" step="1" />
        </div>
      </div>

      <p v-if="errorMessage" class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {{ errorMessage }}
      </p>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button @click="save">Save</Button>
        <Button variant="ghost" @click="emit('close')">Cancel</Button>
      </div>
    </Card>
  </div>
</template>
