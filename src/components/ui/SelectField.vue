<script setup lang="ts">
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
  <select
    :value="modelValue"
    :disabled="disabled"
    :class="
      cn(
        'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        $props.class
      )
    "
    @change="onChange"
  >
    <slot />
  </select>
</template>
