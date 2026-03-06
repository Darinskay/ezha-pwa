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
    "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200",
    "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none active:scale-[0.99]",
    props.variant === "default" &&
      "bg-primary text-primary-foreground shadow-[0_12px_28px_hsl(var(--primary)/0.3)] hover:brightness-105",
    props.variant === "secondary" &&
      "border border-border/70 bg-secondary/80 text-secondary-foreground hover:bg-secondary",
    props.variant === "ghost" && "text-foreground hover:bg-muted/70",
    props.variant === "destructive" &&
      "bg-destructive text-destructive-foreground shadow-[0_12px_24px_hsl(var(--destructive)/0.22)] hover:brightness-110",
    props.variant === "outline" && "border border-border/80 bg-card/70 hover:bg-muted/65",
    props.size === "sm" && "h-9 px-3.5 text-xs",
    props.size === "md" && "h-11 px-4",
    props.size === "lg" && "h-12 px-5 text-base",
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
