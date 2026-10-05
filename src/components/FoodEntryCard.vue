<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronDown, Trash2 } from "lucide-vue-next";
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

const title = computed(
  () => props.entryWithItems.entry.input_text?.trim() || "Meal",
);

const detailTitle = computed(() => {
  const itemNames = props.entryWithItems.items
    .map((item) => item.name.trim())
    .join(", ");
  return itemNames &&
    title.value.toLocaleLowerCase() === itemNames.toLocaleLowerCase()
    ? null
    : title.value;
});

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

const descriptionLabel = computed(() =>
  [createdLabel.value, sourceLabel.value, confidenceLabel.value]
    .filter(Boolean)
    .join(" · "),
);

const macroLine = computed(
  () =>
    `P ${Math.round(props.entryWithItems.entry.protein)}g · C ${Math.round(
      props.entryWithItems.entry.carbs,
    )}g · F ${Math.round(props.entryWithItems.entry.fat)}g`,
);

const handleDelete = (): void => {
  emit("delete", props.entryWithItems.entry.id);
};

const toggleExpanded = (): void => {
  if (!props.showExpand) return;
  expanded.value = !expanded.value;
};
</script>

<template>
  <article class="glass rounded-thumb p-2">
    <div class="flex items-center gap-1">
      <component
        :is="showExpand ? 'button' : 'div'"
        class="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :type="showExpand ? 'button' : undefined"
        :aria-expanded="showExpand ? expanded : undefined"
        :aria-controls="
          showExpand ? `entry-${entryWithItems.entry.id}` : undefined
        "
        :aria-label="
          showExpand
            ? `${expanded ? 'Hide' : 'Show'} details for ${title}`
            : undefined
        "
        @click="toggleExpanded"
      >
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-bold"
            >{{ Math.round(entryWithItems.entry.calories) }} kcal</span
          >
          <span class="block text-xs text-muted-foreground">{{
            macroLine
          }}</span>
        </span>
        <ChevronDown
          v-if="showExpand"
          class="size-4 shrink-0 text-muted-foreground"
          :class="{ 'rotate-180': expanded }"
          aria-hidden="true"
        />
      </component>
      <Button
        v-if="showDelete"
        variant="ghost"
        class="size-11 rounded-full p-0 text-destructive hover:bg-destructive/10"
        :loading="deleteLoading"
        :aria-label="`Delete ${title}`"
        @click="handleDelete"
      >
        <Trash2 v-if="!deleteLoading" class="size-4" aria-hidden="true" />
      </Button>
    </div>
    <div
      v-if="expanded"
      :id="`entry-${entryWithItems.entry.id}`"
      class="mt-2 space-y-2 border-t border-border/50 px-2 pt-3"
    >
      <h3 v-if="detailTitle" class="break-words text-sm font-semibold">
        {{ detailTitle }}
      </h3>
      <p class="text-xs text-muted-foreground">{{ descriptionLabel }}</p>
      <ul v-if="entryWithItems.items.length" class="divide-y divide-border/40">
        <li
          v-for="item in entryWithItems.items"
          :key="item.id"
          class="py-2 text-sm"
        >
          <div class="flex items-start justify-between gap-3">
            <span class="min-w-0 break-words font-medium">{{ item.name }}</span>
            <span class="shrink-0 text-xs text-muted-foreground"
              >{{ item.grams }} g</span
            >
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ Math.round(item.calories) }} kcal · P
            {{ Math.round(item.protein) }}g · C {{ Math.round(item.carbs) }}g ·
            F {{ Math.round(item.fat) }}g
          </p>
        </li>
      </ul>
    </div>
  </article>
</template>
