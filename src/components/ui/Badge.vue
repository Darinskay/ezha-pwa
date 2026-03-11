<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    variant?: "default" | "secondary" | "outline" | "warning";
    class?: string;
  }>(),
  {
    variant: "default"
  }
);

const classes = computed(() =>
  cn(
    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.03em] transition-colors",
    props.variant === "default" && "border-transparent text-white",
    props.variant === "secondary" && "border-transparent bg-secondary text-secondary-foreground",
    props.variant === "outline" && "border text-foreground",
    props.variant === "warning" && "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
    props.class
  )
);
</script>

<template>
  <span
    :class="classes"
    :style="
      variant === 'default'
        ? 'background: linear-gradient(142deg, hsl(var(--feature-primary)), hsl(var(--feature-secondary)));'
        : variant === 'outline'
          ? 'border-color: hsl(var(--feature-primary) / 0.26); background: hsl(var(--feature-soft) / 0.52);'
          : ''
    "
  >
    <slot />
  </span>
</template>
