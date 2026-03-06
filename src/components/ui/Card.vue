<script setup lang="ts">
import { cn } from "@/lib/utils";

defineProps<{ class?: string }>();
</script>

<template>
  <section
    :class="
      cn(
        'rounded-2xl border border-border/80 bg-card/90 text-card-foreground shadow-[0_10px_30px_rgb(15_23_42_/_0.06)] backdrop-blur-sm',
        $props.class
      )
    "
  >
    <slot />
  </section>
</template>
