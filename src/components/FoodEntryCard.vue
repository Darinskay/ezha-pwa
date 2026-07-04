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
  [
    createdLabel.value,
    sourceLabel.value,
    confidenceLabel.value,
  ]
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
  if (!props.showExpand || props.entryWithItems.items.length === 0) return;
  expanded.value = !expanded.value;
};
</script>

<template>
  <article class="glass rounded-thumb p-2.5 sm:p-3">
    <div class="flex min-h-12 items-center gap-3">
      <button
        v-if="showExpand && entryWithItems.items.length > 0"
        class="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1.5 py-1.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        type="button"
        :aria-expanded="expanded"
        :aria-label="`${expanded ? 'Hide' : 'Show'} details for ${title}`"
        @click="toggleExpanded"
      >
        <span class="min-w-0 flex-1">
          <h4 class="truncate text-[13.5px] font-bold leading-5">
            {{ title }}
          </h4>
          <p class="truncate text-[10.5px] font-semibold leading-4 text-muted-foreground">
            {{ descriptionLabel }}
          </p>
          <p class="truncate text-[10.5px] font-semibold leading-4 text-muted-foreground">
            {{ macroLine }}
          </p>
        </span>
        <ChevronDown
          class="size-4 shrink-0 text-muted-foreground transition-transform duration-200"
          :class="{ 'rotate-180': expanded }"
          aria-hidden="true"
        />
      </button>

      <div v-else class="min-w-0 flex-1 px-1.5 py-1.5">
        <h4 class="truncate text-[13.5px] font-bold leading-5">
          {{ title }}
        </h4>
        <p class="truncate text-[10.5px] font-semibold leading-4 text-muted-foreground">
          {{ descriptionLabel }}
        </p>
        <p class="truncate text-[10.5px] font-semibold leading-4 text-muted-foreground">
          {{ macroLine }}
        </p>
      </div>

      <div class="shrink-0 text-right">
        <p class="text-sm font-extrabold leading-none">
          {{ Math.round(entryWithItems.entry.calories) }}
        </p>
        <p class="mt-0.5 text-[10px] font-semibold text-muted-foreground">
          kcal
        </p>
      </div>

      <Button
        v-if="showDelete"
        variant="ghost"
        size="sm"
        class="size-9 rounded-full p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        :loading="deleteLoading"
        :aria-label="`Delete ${title}`"
        @click.stop="handleDelete"
      >
        <Trash2 v-if="!deleteLoading" class="size-4" />
      </Button>
    </div>

    <ul
      v-if="expanded && entryWithItems.items.length > 0"
      class="mt-2 space-y-2 border-t pt-2"
      style="border-color: hsl(var(--feature-primary) / 0.12)"
    >
      <li
        v-for="item in entryWithItems.items"
        :key="item.id"
        class="rounded-thumb border border-white/50 bg-white/40 px-3 py-2 text-sm dark:border-border/20 dark:bg-card/30"
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
