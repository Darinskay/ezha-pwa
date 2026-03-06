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
  <div class="space-y-4">
    <div class="space-y-1.5">
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="font-semibold">Calories</span>
        <span class="text-xs text-muted-foreground sm:text-sm">{{ eaten.calories }} / {{ targets.calories }}</span>
      </div>
      <div class="h-2.5 overflow-hidden rounded-full bg-muted/80">
        <div
          class="h-full rounded-full bg-primary transition-[width] duration-300"
          :style="{ width: `${progress(eaten.calories, targets.calories)}%` }"
        />
      </div>
    </div>

    <div class="space-y-1.5">
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="font-semibold">Protein</span>
        <span class="text-xs text-muted-foreground sm:text-sm">{{ eaten.protein }} / {{ targets.protein }}g</span>
      </div>
      <div class="h-2.5 overflow-hidden rounded-full bg-muted/80">
        <div
          class="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
          :style="{ width: `${progress(eaten.protein, targets.protein)}%` }"
        />
      </div>
    </div>

    <div class="space-y-1.5">
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="font-semibold">Carbs</span>
        <span class="text-xs text-muted-foreground sm:text-sm">{{ eaten.carbs }} / {{ targets.carbs }}g</span>
      </div>
      <div class="h-2.5 overflow-hidden rounded-full bg-muted/80">
        <div
          class="h-full rounded-full bg-sky-500 transition-[width] duration-300"
          :style="{ width: `${progress(eaten.carbs, targets.carbs)}%` }"
        />
      </div>
    </div>

    <div class="space-y-1.5">
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="font-semibold">Fat</span>
        <span class="text-xs text-muted-foreground sm:text-sm">{{ eaten.fat }} / {{ targets.fat }}g</span>
      </div>
      <div class="h-2.5 overflow-hidden rounded-full bg-muted/80">
        <div
          class="h-full rounded-full bg-amber-500 transition-[width] duration-300"
          :style="{ width: `${progress(eaten.fat, targets.fat)}%` }"
        />
      </div>
    </div>

    <p class="rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
      Remaining: {{ remaining(targets.calories, eaten.calories) }} kcal ·
      P{{ remaining(targets.protein, eaten.protein) }}g ·
      C{{ remaining(targets.carbs, eaten.carbs) }}g ·
      F{{ remaining(targets.fat, eaten.fat) }}g
    </p>
  </div>
</template>
