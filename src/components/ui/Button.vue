<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    variant?: "default" | "secondary" | "ghost" | "destructive" | "outline";
    size?: "sm" | "md" | "lg";
    loading?: boolean;
    disabled?: boolean;
    class?: string;
    type?: "button" | "submit" | "reset";
  }>(),
  {
    variant: "default",
    size: "md",
    loading: false,
    disabled: false,
    type: "button"
  }
);

const classes = computed(() =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
    props.variant === "default" && "bg-primary text-primary-foreground hover:opacity-90",
    props.variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    props.variant === "ghost" && "hover:bg-muted",
    props.variant === "destructive" &&
      "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    props.variant === "outline" && "border border-border bg-background hover:bg-muted",
    props.size === "sm" && "h-8 px-3",
    props.size === "md" && "h-10 px-4",
    props.size === "lg" && "h-12 px-5",
    props.class
  )
);
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled || loading">
    <svg
      v-if="loading"
      class="size-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.2" stroke-width="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="4" />
    </svg>
    <slot />
  </button>
</template>
