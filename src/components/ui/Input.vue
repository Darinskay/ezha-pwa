<script setup lang="ts">
import { cn } from "@/lib/utils";

withDefaults(
  defineProps<{
    modelValue?: string | number | null;
    type?: string;
    placeholder?: string;
    class?: string;
    disabled?: boolean;
  }>(),
  {
    modelValue: "",
    type: "text",
    placeholder: "",
    disabled: false
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const onInput = (event: Event): void => {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
};
</script>

<template>
  <input
    :value="modelValue ?? ''"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="
      cn(
        'flex h-10 w-full rounded-xl border px-3 py-2 text-[14px] transition-all duration-200 sm:h-11 sm:rounded-2xl sm:px-3.5 sm:text-sm',
        'placeholder:text-muted-foreground/90 ring-offset-background focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
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
