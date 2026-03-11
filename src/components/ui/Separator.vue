<script setup lang="ts">
import { cn } from "@/lib/utils";

withDefaults(
  defineProps<{
    orientation?: "horizontal" | "vertical";
    class?: string;
  }>(),
  {
    orientation: "horizontal"
  }
);
</script>

<template>
  <div
    :class="
      cn(
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        'bg-[hsl(var(--feature-primary)/0.2)]',
        $props.class
      )
    "
    aria-hidden="true"
  />
</template>
