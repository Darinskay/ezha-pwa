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
        'flex min-h-[108px] w-full rounded-xl border border-input/85 bg-background/95 px-3.5 py-2.5 text-sm',
        'placeholder:text-muted-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        $props.class
      )
    "
    @input="onInput"
  />
</template>
