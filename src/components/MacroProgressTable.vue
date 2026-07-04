<script setup lang="ts">
import { computed } from "vue";
import {
  formatMacro,
  macroProgressBarPercent,
  macroProgressPercent,
} from "@/lib/macros";
import type { MacroTargets, MacroTotals } from "@/types/domain";

type MacroRow = {
  key: "protein" | "carbs" | "fat";
  title: string;
  eaten: number;
  target: number;
  gradient: string;
};

const props = defineProps<{
  targets: MacroTargets;
  eaten: MacroTotals;
}>();

const ringRadius = 58;
const ringCircumference = 2 * Math.PI * ringRadius;

const consumedCalories = computed(() => Math.round(props.eaten.calories));
const targetCalories = computed(() => Math.round(props.targets.calories));
const remainingCalories = computed(() =>
  Math.max(0, targetCalories.value - consumedCalories.value),
);
const calorieProgress = computed(() =>
  props.targets.calories > 0
    ? Math.min(Math.max(props.eaten.calories / props.targets.calories, 0), 1)
    : 0,
);
const ringOffset = computed(
  () => ringCircumference * (1 - calorieProgress.value),
);

const macroRows = computed<MacroRow[]>(() => [
  {
    key: "protein",
    title: "Protein",
    eaten: props.eaten.protein,
    target: props.targets.protein,
    gradient:
      "linear-gradient(90deg, hsl(var(--secondary)), hsl(var(--secondary) / 0.62))",
  },
  {
    key: "carbs",
    title: "Carbs",
    eaten: props.eaten.carbs,
    target: props.targets.carbs,
    gradient:
      "linear-gradient(90deg, hsl(var(--accent)), hsl(var(--accent) / 0.62))",
  },
  {
    key: "fat",
    title: "Fat",
    eaten: props.eaten.fat,
    target: props.targets.fat,
    gradient:
      "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.62))",
  },
]);

const progressStyle = (
  eaten: number,
  target: number,
  gradient: string,
): { width: string; background: string } => {
  return {
    width: `${macroProgressBarPercent(eaten, target)}%`,
    background: gradient,
  };
};
</script>

<template>
  <div class="grid gap-5 sm:grid-cols-[8.25rem_minmax(0,1fr)] sm:items-center">
    <div class="relative mx-auto size-[132px] shrink-0">
      <svg
        class="size-[132px] -rotate-90"
        viewBox="0 0 132 132"
        role="img"
        :aria-label="`${consumedCalories} of ${targetCalories} calories consumed`"
      >
        <defs>
          <linearGradient id="calorie-ring" x1="12" y1="12" x2="120" y2="120">
            <stop stop-color="hsl(var(--secondary))" />
            <stop offset="1" stop-color="hsl(var(--primary))" />
          </linearGradient>
        </defs>
        <circle
          cx="66"
          cy="66"
          :r="ringRadius"
          fill="none"
          stroke="hsl(var(--track) / 0.14)"
          stroke-width="10"
        />
        <circle
          cx="66"
          cy="66"
          :r="ringRadius"
          fill="none"
          stroke="url(#calorie-ring)"
          stroke-linecap="round"
          stroke-width="10"
          :stroke-dasharray="ringCircumference"
          :stroke-dashoffset="ringOffset"
          class="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>

      <div class="absolute inset-0 grid place-items-center text-center">
        <div>
          <p class="text-[28px] font-extrabold leading-none tracking-tight">
            {{ remainingCalories }}
          </p>
          <p class="mt-1 text-[11px] font-semibold text-muted-foreground">
            kcal left
          </p>
        </div>
      </div>
    </div>

    <div class="space-y-3">
      <div v-for="row in macroRows" :key="row.key" class="space-y-1.5">
        <div class="flex items-center justify-between gap-3">
          <span class="text-[12px] font-semibold">{{ row.title }}</span>
          <span class="text-[11px] font-semibold text-muted-foreground">
            {{ formatMacro(row.eaten, 0) }} / {{ formatMacro(row.target, 0) }} g
          </span>
        </div>
        <div
          class="h-[7px] overflow-hidden rounded-full"
          style="background: hsl(var(--track) / 0.14)"
        >
          <div
            class="h-full rounded-full transition-[width] duration-500 ease-out"
            :style="progressStyle(row.eaten, row.target, row.gradient)"
          />
        </div>
        <p class="text-[10.5px] font-semibold text-muted-foreground">
          {{ macroProgressPercent(row.eaten, row.target) }}% closed
        </p>
      </div>
    </div>
  </div>
</template>
