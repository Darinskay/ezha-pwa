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
        'bg-border/80',
        $props.class
      )
    "
    aria-hidden="true"
  />
</template>
