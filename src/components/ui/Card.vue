<script setup lang="ts">
import { cn } from "@/lib/utils";

defineProps<{ class?: string }>();
</script>

<template>
  <section
    :class="
      cn(
        'glass rounded-[1.1rem] text-card-foreground sm:rounded-[1.4rem]',
        $props.class
      )
    "
  >
    <slot />
  </section>
</template>
