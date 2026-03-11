<script setup lang="ts">
import { ChevronDown } from "lucide-vue-next";
import { cn } from "@/lib/utils";

withDefaults(
  defineProps<{
    modelValue: string;
    class?: string;
    disabled?: boolean;
  }>(),
  {
    class: "",
    disabled: false
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const onChange = (event: Event): void => {
  emit("update:modelValue", (event.target as HTMLSelectElement).value);
};
</script>

<template>
  <div class="relative">
    <select
      :value="modelValue"
      :disabled="disabled"
      :class="
        cn(
          'h-10 w-full appearance-none rounded-xl border px-3 py-2 pr-8 text-[14px] transition-all duration-200 sm:h-11 sm:rounded-2xl sm:px-3.5 sm:pr-9 sm:text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          $props.class
        )
      "
      style="
        border-color: hsl(var(--input));
        background: linear-gradient(162deg, hsl(var(--card) / 0.86), hsl(var(--card) / 0.7));
        box-shadow: inset 0 1px 0 hsl(var(--glass-highlight) / 0.52);
      "
      @change="onChange"
    >
      <slot />
    </select>
    <ChevronDown class="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground sm:right-3 sm:size-4" />
  </div>
</template>
