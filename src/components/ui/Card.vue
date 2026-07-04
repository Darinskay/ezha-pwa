<script setup lang="ts">
import { cn } from "@/lib/utils";

defineProps<{ class?: string }>();
</script>

<template>
  <section
    :class="
      cn(
        'glass rounded-card text-card-foreground',
        $props.class,
      )
    "
  >
    <slot />
  </section>
</template>
