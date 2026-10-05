<script setup lang="ts">
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from "radix-vue";
defineProps<{ title: string; busy?: boolean }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <DialogRoot
    :open="true"
    @update:open="
      (open) => {
        if (!open && !busy) emit('close');
      }
    "
  >
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/30" />
      <DialogContent
        class="pointer-events-none fixed inset-0 z-50 grid items-end px-2 pb-[max(env(safe-area-inset-bottom),0.65rem)] pt-6 outline-none sm:place-items-center sm:p-4 [&>*]:pointer-events-auto"
        :aria-describedby="undefined"
        @interact-outside.prevent
      >
        <DialogTitle class="sr-only">{{ title }}</DialogTitle>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
