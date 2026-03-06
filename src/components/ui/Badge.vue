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
    props.variant === "default" && "border-transparent bg-primary text-primary-foreground",
    props.variant === "secondary" && "border-transparent bg-secondary text-secondary-foreground",
    props.variant === "outline" && "border-border/80 bg-background/90 text-foreground",
    props.variant === "warning" && "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
    props.class
  )
);
</script>

<template>
  <span :class="classes">
    <slot />
  </span>
</template>
