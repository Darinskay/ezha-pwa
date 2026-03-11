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
    "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[13px] font-semibold transition-all duration-200 sm:rounded-2xl sm:text-sm",
    "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none active:scale-[0.99]",
    props.variant === "default" &&
      "text-white shadow-[0_12px_30px_hsl(var(--feature-primary)/0.34)] hover:brightness-105",
    props.variant === "secondary" &&
      "border text-foreground hover:brightness-[1.03]",
    props.variant === "ghost" && "text-foreground hover:bg-muted/60",
    props.variant === "destructive" &&
      "bg-destructive text-destructive-foreground shadow-[0_12px_24px_hsl(var(--destructive)/0.22)] hover:brightness-110",
    props.variant === "outline" && "border bg-card/66 hover:bg-card/85",
    props.size === "sm" && "h-[2.125rem] px-3 text-xs sm:h-9 sm:px-3.5",
    props.size === "md" && "h-10 px-3.5 sm:h-11 sm:px-4",
    props.size === "lg" && "h-11 px-4 text-sm sm:h-12 sm:px-5 sm:text-base",
    props.class
  )
);
</script>

<template>
  <button
    :type="type"
    :class="classes"
    :disabled="disabled || loading"
    :style="
      variant === 'default'
        ? 'background: linear-gradient(142deg, hsl(var(--feature-primary)), hsl(var(--feature-secondary)));'
        : variant === 'secondary'
          ? 'border-color: hsl(var(--feature-primary) / 0.24); background: linear-gradient(160deg, hsl(var(--feature-soft) / 0.8), hsl(var(--card) / 0.88));'
          : variant === 'outline'
            ? 'border-color: hsl(var(--feature-primary) / 0.22);'
            : ''
    "
  >
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
