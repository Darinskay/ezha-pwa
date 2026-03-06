<script setup lang="ts">
import { computed, ref } from "vue";
import Badge from "@/components/ui/Badge.vue";
import type { FoodEntryWithItems } from "@/types/domain";

const props = defineProps<{
  entryWithItems: FoodEntryWithItems;
  showExpand?: boolean;
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
    minute: "2-digit"
  }).format(new Date(value));
});
</script>

<template>
  <article class="space-y-2 rounded-lg border border-border bg-card p-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h4 class="font-medium">
          {{ entryWithItems.entry.input_text?.trim() || "Meal" }}
        </h4>
        <p class="text-xs text-muted-foreground">{{ createdLabel }}</p>
      </div>
      <div class="text-right">
        <p class="text-lg font-semibold">{{ Math.round(entryWithItems.entry.calories) }}</p>
        <p class="text-xs text-muted-foreground">kcal</p>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <Badge variant="outline">P {{ Math.round(entryWithItems.entry.protein) }}g</Badge>
      <Badge variant="outline">C {{ Math.round(entryWithItems.entry.carbs) }}g</Badge>
      <Badge variant="outline">F {{ Math.round(entryWithItems.entry.fat) }}g</Badge>
      <Badge v-if="confidenceLabel" variant="secondary">{{ confidenceLabel }}</Badge>
      <Badge variant="secondary">{{ sourceLabel }}</Badge>
    </div>

    <button
      v-if="showExpand && entryWithItems.items.length > 0"
      class="text-xs text-primary"
      @click="expanded = !expanded"
    >
      {{ expanded ? "Hide details" : "Show details" }}
    </button>

    <ul v-if="expanded && entryWithItems.items.length > 0" class="space-y-2 pt-1">
      <li
        v-for="item in entryWithItems.items"
        :key="item.id"
        class="rounded-md bg-muted px-3 py-2 text-sm"
      >
        <div class="flex items-center justify-between">
          <span class="font-medium">{{ item.name }}</span>
          <span class="text-xs text-muted-foreground">{{ item.grams }} g</span>
        </div>
        <p class="mt-1 text-xs text-muted-foreground">
          {{ Math.round(item.calories) }} kcal · P{{ Math.round(item.protein) }} · C{{ Math.round(item.carbs) }} · F{{ Math.round(item.fat) }}
        </p>
      </li>
    </ul>
  </article>
</template>
