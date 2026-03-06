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
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
    props.variant === "default" && "border-transparent bg-primary text-primary-foreground",
    props.variant === "secondary" && "border-transparent bg-secondary text-secondary-foreground",
    props.variant === "outline" && "text-foreground",
    props.variant === "warning" && "border-transparent bg-amber-100 text-amber-900",
    props.class
  )
);
</script>

<template>
  <span :class="classes">
    <slot />
  </span>
</template>
