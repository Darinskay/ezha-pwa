<script setup lang="ts">
import { computed } from "vue";
import {
  formatMacro,
  macroProgressBarPercent,
  remainingMacros,
} from "@/lib/macros";
import type { MacroTargets, MacroTotals } from "@/types/domain";
const props = defineProps<{ targets: MacroTargets; eaten: MacroTotals }>();
const remaining = computed(() => remainingMacros(props.targets, props.eaten));
const ringRadius = 58;
const ringCircumference = 2 * Math.PI * ringRadius;
const consumedCalories = computed(() => Math.round(props.eaten.calories));
const targetCalories = computed(() => Math.round(props.targets.calories));
const remainingCalories = computed(() =>
  Math.max(0, targetCalories.value - consumedCalories.value),
);
const ringOffset = computed(
  () =>
    ringCircumference *
    (1 -
      macroProgressBarPercent(props.eaten.calories, props.targets.calories) /
        100),
);
const rows = [
  { key: "protein", title: "Protein", unit: "g", color: "secondary" },
  { key: "carbs", title: "Carbs", unit: "g", color: "accent" },
  { key: "fat", title: "Fat", unit: "g", color: "primary" },
] as const;
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
    <div class="space-y-4">
      <div v-for="row in rows" :key="row.key" class="min-w-0 space-y-1.5">
        <div class="flex items-baseline justify-between gap-3">
          <p class="text-sm font-medium">{{ row.title }}</p>
          <p class="text-lg font-bold tabular-nums">
            {{ formatMacro(Math.abs(remaining[row.key]), 0) }} {{ row.unit }}
            <span class="text-xs font-medium text-muted-foreground">{{
              remaining[row.key] < 0 ? "over" : "left"
            }}</span>
          </p>
        </div>
        <div
          class="h-1.5 overflow-hidden rounded-full bg-track/15"
          aria-hidden="true"
        >
          <div
            class="h-full rounded-full"
            :style="{
              width: `${macroProgressBarPercent(eaten[row.key], targets[row.key])}%`,
              background: `hsl(var(--${row.color}))`,
            }"
          />
        </div>
        <p class="text-xs text-muted-foreground">
          {{ formatMacro(eaten[row.key], 0) }} /
          {{ formatMacro(targets[row.key], 0) }} {{ row.unit }} eaten
        </p>
      </div>
    </div>
  </div>
</template>
