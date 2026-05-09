<script setup lang="ts">
import { computed } from "vue";
import {
  formatMacro,
  macroProgressBarPercent,
  macroProgressPercent,
} from "@/lib/macros";
import type { MacroTargets, MacroTotals } from "@/types/domain";

type MacroRow = {
  key: keyof MacroTotals;
  title: string;
  unit: "kcal" | "g";
  eaten: number;
  target: number;
};

const props = defineProps<{
  targets: MacroTargets;
  eaten: MacroTotals;
}>();

const macroRows = computed<MacroRow[]>(() => [
  {
    key: "calories",
    title: "Calories",
    unit: "kcal",
    eaten: props.eaten.calories,
    target: props.targets.calories,
  },
  {
    key: "protein",
    title: "Protein",
    unit: "g",
    eaten: props.eaten.protein,
    target: props.targets.protein,
  },
  {
    key: "carbs",
    title: "Carbs",
    unit: "g",
    eaten: props.eaten.carbs,
    target: props.targets.carbs,
  },
  {
    key: "fat",
    title: "Fat",
    unit: "g",
    eaten: props.eaten.fat,
    target: props.targets.fat,
  },
]);

const unitLabel = (unit: MacroRow["unit"]): string =>
  unit === "kcal" ? "kcal" : "g";

const progressColor = (eaten: number, target: number): string => {
  const percent = macroProgressPercent(eaten, target);
  if (percent >= 101) return "hsl(var(--destructive))";
  if (percent >= 90) return "hsl(142 71% 45%)";
  return "hsl(var(--primary))";
};

const progressStyle = (
  eaten: number,
  target: number,
): { width: string; backgroundColor: string } => {
  return {
    width: `${macroProgressBarPercent(eaten, target)}%`,
    backgroundColor: progressColor(eaten, target),
  };
};
</script>

<template>
  <div class="space-y-4">
    <div v-for="row in macroRows" :key="row.key" class="space-y-1.5">
      <div class="flex items-start justify-between gap-3 text-sm">
        <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span class="font-semibold">{{ row.title }}</span>
          <span class="text-xs font-semibold text-primary">
            {{ macroProgressPercent(row.eaten, row.target) }}% closed
          </span>
        </div>
        <span
          class="shrink-0 text-right text-xs text-muted-foreground sm:text-sm"
        >
          {{ formatMacro(row.eaten, 0) }} / {{ formatMacro(row.target, 0) }}
          {{ unitLabel(row.unit) }}
        </span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          class="h-full rounded-full transition-[width] duration-300"
          :style="progressStyle(row.eaten, row.target)"
        />
      </div>
    </div>
  </div>
</template>
