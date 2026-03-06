<script setup lang="ts">
import type { MacroTargets, MacroTotals } from "@/types/domain";

defineProps<{
  targets: MacroTargets;
  eaten: MacroTotals;
}>();

const progress = (eaten: number, target: number): number => {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((eaten / target) * 100)));
};

const remaining = (target: number, eaten: number): number => Math.max(target - eaten, 0);
</script>

<template>
  <div class="space-y-3">
    <div class="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
      <span class="font-medium">Calories</span>
      <div class="h-2 overflow-hidden rounded-full bg-muted">
        <div class="h-full bg-primary" :style="{ width: `${progress(eaten.calories, targets.calories)}%` }" />
      </div>
      <span>{{ eaten.calories }} / {{ targets.calories }}</span>
    </div>

    <div class="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
      <span class="font-medium">Protein</span>
      <div class="h-2 overflow-hidden rounded-full bg-muted">
        <div class="h-full bg-orange-500" :style="{ width: `${progress(eaten.protein, targets.protein)}%` }" />
      </div>
      <span>{{ eaten.protein }} / {{ targets.protein }}g</span>
    </div>

    <div class="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
      <span class="font-medium">Carbs</span>
      <div class="h-2 overflow-hidden rounded-full bg-muted">
        <div class="h-full bg-sky-500" :style="{ width: `${progress(eaten.carbs, targets.carbs)}%` }" />
      </div>
      <span>{{ eaten.carbs }} / {{ targets.carbs }}g</span>
    </div>

    <div class="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
      <span class="font-medium">Fat</span>
      <div class="h-2 overflow-hidden rounded-full bg-muted">
        <div class="h-full bg-pink-500" :style="{ width: `${progress(eaten.fat, targets.fat)}%` }" />
      </div>
      <span>{{ eaten.fat }} / {{ targets.fat }}g</span>
    </div>

    <p class="text-xs text-muted-foreground">
      Remaining: {{ remaining(targets.calories, eaten.calories) }} kcal ·
      P{{ remaining(targets.protein, eaten.protein) }}g ·
      C{{ remaining(targets.carbs, eaten.carbs) }}g ·
      F{{ remaining(targets.fat, eaten.fat) }}g
    </p>
  </div>
</template>
