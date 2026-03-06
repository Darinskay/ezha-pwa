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
        'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
        'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        $props.class
      )
    "
    @input="onInput"
  />
</template>
