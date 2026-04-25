<script setup lang="ts">
import { computed, ref } from "vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import type { FoodEntryWithItems } from "@/types/domain";

const props = defineProps<{
  entryWithItems: FoodEntryWithItems;
  showExpand?: boolean;
  showDelete?: boolean;
  deleteLoading?: boolean;
}>();
const emit = defineEmits<{
  delete: [entryId: string];
}>();

const expanded = ref(false);

const sourceLabel = computed(() => {
  const source = props.entryWithItems.entry.ai_source;
  if (source === "library") return "Library";
  if (source === "text") return "AI: text";
  if (source === "food_photo") return "AI: photo";
  if (source === "label_photo") return "AI: label";
  if (source === "unknown") {
    return props.entryWithItems.entry.image_path ? "AI: photo" : "AI: text";
  }
  return source;
});

const confidenceLabel = computed(() => {
  const confidence = props.entryWithItems.entry.ai_confidence;
  if (confidence == null) return null;
  return `AI ${Math.round(confidence * 100)}%`;
});

const createdLabel = computed(() => {
  const value = props.entryWithItems.entry.created_at;
  if (!value) return "Time unavailable";

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
});

const showActions = computed(
  () =>
    props.showDelete ||
    (props.showExpand && props.entryWithItems.items.length > 0),
);

const handleDelete = (): void => {
  emit("delete", props.entryWithItems.entry.id);
};
</script>

<template>
  <article
    class="space-y-3 rounded-[1.1rem] border p-3 sm:rounded-[1.25rem] sm:p-4"
    style="
      border-color: hsl(var(--feature-primary) / 0.2);
      background: linear-gradient(
        158deg,
        hsl(var(--card) / 0.86),
        hsl(var(--card) / 0.7)
      );
    "
  >
    <div class="flex items-start justify-between gap-4">
      <div>
        <h4 class="text-base font-semibold">
          {{ entryWithItems.entry.input_text?.trim() || "Meal" }}
        </h4>
        <p class="text-xs text-muted-foreground">{{ createdLabel }}</p>
      </div>
      <div class="text-right">
        <p class="text-lg font-semibold leading-none sm:text-xl">
          {{ Math.round(entryWithItems.entry.calories) }}
        </p>
        <p class="text-xs text-muted-foreground">kcal</p>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <Badge variant="outline"
        >P {{ Math.round(entryWithItems.entry.protein) }}g</Badge
      >
      <Badge variant="outline"
        >C {{ Math.round(entryWithItems.entry.carbs) }}g</Badge
      >
      <Badge variant="outline"
        >F {{ Math.round(entryWithItems.entry.fat) }}g</Badge
      >
      <Badge v-if="confidenceLabel" variant="secondary">{{
        confidenceLabel
      }}</Badge>
      <Badge variant="secondary">{{ sourceLabel }}</Badge>
    </div>

    <div
      v-if="showActions"
      class="flex flex-wrap items-center justify-between gap-2 border-t pt-3"
      style="border-color: hsl(var(--feature-primary) / 0.12)"
    >
      <button
        v-if="showExpand && entryWithItems.items.length > 0"
        class="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/70"
        style="
          border-color: hsl(var(--feature-primary) / 0.24);
          background: hsl(var(--feature-soft) / 0.5);
        "
        @click="expanded = !expanded"
      >
        {{ expanded ? "Hide details" : "Show details" }}
      </button>
      <div v-else class="h-8"></div>

      <Button
        v-if="showDelete"
        variant="ghost"
        size="sm"
        class="rounded-full px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
        :loading="deleteLoading"
        @click="handleDelete"
      >
        Delete
      </Button>
    </div>

    <ul
      v-if="expanded && entryWithItems.items.length > 0"
      class="space-y-2 pt-1"
    >
      <li
        v-for="item in entryWithItems.items"
        :key="item.id"
        class="rounded-xl border px-3 py-2 text-sm"
        style="
          border-color: hsl(var(--feature-primary) / 0.16);
          background: hsl(var(--feature-soft) / 0.4);
        "
      >
        <div class="flex items-center justify-between">
          <span class="font-medium">{{ item.name }}</span>
          <span class="text-xs text-muted-foreground">{{ item.grams }} g</span>
        </div>
        <p class="mt-1 text-xs text-muted-foreground">
          {{ Math.round(item.calories) }} kcal · P{{
            Math.round(item.protein)
          }}
          · C{{ Math.round(item.carbs) }} · F{{ Math.round(item.fat) }}
        </p>
      </li>
    </ul>
  </article>
</template>
