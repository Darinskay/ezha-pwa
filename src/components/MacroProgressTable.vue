<script setup lang="ts">
import type { MacroTargets, MacroTotals } from "@/types/domain";

defineProps<{
  targets: MacroTargets;
  eaten: MacroTotals;
}>();

const progressPercent = (eaten: number, target: number): number => {
  if (target <= 0) return 0;
  return Math.max(0, Math.round((eaten / target) * 100));
};

const progress = (eaten: number, target: number): number => {
  return Math.min(progressPercent(eaten, target), 100);
};

const progressColor = (eaten: number, target: number): string => {
  const percent = progressPercent(eaten, target);
  if (percent >= 101) return "hsl(var(--destructive))";
  if (percent >= 90) return "hsl(142 71% 45%)";
  return "hsl(var(--primary))";
};

const progressStyle = (eaten: number, target: number): { width: string; backgroundColor: string } => {
  return {
    width: `${progress(eaten, target)}%`,
    backgroundColor: progressColor(eaten, target)
  };
};
</script>

<template>
  <div class="space-y-4">
    <div class="space-y-1.5">
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="font-semibold">Calories</span>
        <span class="text-xs text-muted-foreground sm:text-sm">{{ eaten.calories }} / {{ targets.calories }}</span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          class="h-full rounded-full transition-[width] duration-300"
          :style="progressStyle(eaten.calories, targets.calories)"
        />
      </div>
    </div>

    <div class="space-y-1.5">
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="font-semibold">Protein</span>
        <span class="text-xs text-muted-foreground sm:text-sm">{{ eaten.protein }} / {{ targets.protein }}g</span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          class="h-full rounded-full transition-[width] duration-300"
          :style="progressStyle(eaten.protein, targets.protein)"
        />
      </div>
    </div>

    <div class="space-y-1.5">
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="font-semibold">Carbs</span>
        <span class="text-xs text-muted-foreground sm:text-sm">{{ eaten.carbs }} / {{ targets.carbs }}g</span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          class="h-full rounded-full transition-[width] duration-300"
          :style="progressStyle(eaten.carbs, targets.carbs)"
        />
      </div>
    </div>

    <div class="space-y-1.5">
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="font-semibold">Fat</span>
        <span class="text-xs text-muted-foreground sm:text-sm">{{ eaten.fat }} / {{ targets.fat }}g</span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          class="h-full rounded-full transition-[width] duration-300"
          :style="progressStyle(eaten.fat, targets.fat)"
        />
      </div>
    </div>
  </div>
</template>
