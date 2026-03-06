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
          'h-11 w-full appearance-none rounded-xl border border-input/85 bg-background/95 px-3.5 py-2 pr-9 text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          $props.class
        )
      "
      @change="onChange"
    >
      <slot />
    </select>
    <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
  </div>
</template>
