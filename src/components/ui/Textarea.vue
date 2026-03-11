<script setup lang="ts">
import { cn } from "@/lib/utils";

withDefaults(
  defineProps<{
    modelValue?: string;
    rows?: number;
    placeholder?: string;
    class?: string;
  }>(),
  {
    modelValue: "",
    rows: 4,
    placeholder: ""
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const onInput = (event: Event): void => {
  emit("update:modelValue", (event.target as HTMLTextAreaElement).value);
};
</script>

<template>
  <textarea
    :value="modelValue"
    :rows="rows"
    :placeholder="placeholder"
    :class="
      cn(
        'flex min-h-[88px] w-full rounded-xl border px-3 py-2 text-[14px] transition-all duration-200 sm:min-h-[108px] sm:rounded-2xl sm:px-3.5 sm:py-2.5 sm:text-sm',
        'placeholder:text-muted-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        $props.class
      )
    "
    style="
      border-color: hsl(var(--input));
      background: linear-gradient(162deg, hsl(var(--card) / 0.86), hsl(var(--card) / 0.7));
      box-shadow: inset 0 1px 0 hsl(var(--glass-highlight) / 0.52);
    "
    @input="onInput"
  />
</template>
