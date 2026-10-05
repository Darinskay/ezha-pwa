<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Input from "@/components/ui/Input.vue";
import DialogSheet from "@/components/ui/DialogSheet.vue";
import { enqueueRetry } from "@/db/offline-db";
import {
  buildFoodEntryPayload,
  buildLogItemFromSavedFood,
  buildLogItemsFromSavedMeal,
  MAX_LOG_ITEM_GRAMS,
  macrosFromLogItem,
  totalsFromLogItems,
  type LogMealItem,
} from "@/features/add-log/log-meal-service";
import { defaultFoodGrams } from "@/features/library/library-helpers";
import { parseNumberInput } from "@/lib/number";
import { currentUserId } from "@/lib/supabase";
import { foodEntryRepository } from "@/repositories/food-entry-repository";
import { savedFoodRepository } from "@/repositories/saved-food-repository";
import { resolveActiveDateForLogging } from "@/services/active-date-service";
import { syncDailySummaryForDate } from "@/services/day-summary-service";
import { useActiveDayStore } from "@/stores/active-day-store";
import type { SavedFood } from "@/types/domain";

const props = defineProps<{ meal: SavedFood }>();
const emit = defineEmits<{ close: []; saved: [queued: boolean] }>();
const activeDay = useActiveDayStore();
const logDate = activeDay.activeDate;
const isLoading = ref(true);
const isSaving = ref(false);
const errorMessage = ref<string | null>(null);
const items = ref<LogMealItem[]>([]);
const quantity = ref(
  props.meal.is_meal ? "1" : String(defaultFoodGrams(props.meal)),
);
const scaledItems = computed(() => {
  const amount = parseNumberInput(quantity.value) ?? 0;
  return items.value.map((item) => ({
    ...item,
    gramsText: String(
      props.meal.is_meal
        ? (parseNumberInput(item.gramsText) ?? 0) * amount
        : amount,
    ),
  }));
});
const totals = computed(() => totalsFromLogItems(scaledItems.value));
const canSave = computed(
  () =>
    !isLoading.value &&
    (parseNumberInput(quantity.value) ?? 0) > 0 &&
    scaledItems.value.length > 0 &&
    scaledItems.value.every(
      (item) =>
        !item.isNutritionMissing &&
        (parseNumberInput(item.gramsText) ?? 0) > 0 &&
        (parseNumberInput(item.gramsText) ?? Infinity) <= MAX_LOG_ITEM_GRAMS,
    ),
);

const loadData = async (): Promise<void> => {
  isLoading.value = true;
  errorMessage.value = null;
  try {
    items.value = props.meal.is_meal
      ? buildLogItemsFromSavedMeal(
          await savedFoodRepository.fetchMealIngredients(props.meal.id),
        )
      : [buildLogItemFromSavedFood(props.meal, defaultFoodGrams(props.meal))];
    if (
      !items.value.length ||
      items.value.some((item) => item.isNutritionMissing)
    ) {
      errorMessage.value =
        "This item has missing nutrition. Choose another item from your library.";
    }
  } catch {
    errorMessage.value = "Unable to load this meal. Try again.";
  } finally {
    isLoading.value = false;
  }
};
onMounted(loadData);

const save = async (): Promise<void> => {
  if (!canSave.value || isSaving.value) return;
  isSaving.value = true;
  errorMessage.value = null;
  try {
    const userId = await currentUserId();
    const activeDate = await resolveActiveDateForLogging(userId, logDate);
    const payload = buildFoodEntryPayload({
      entryId: crypto.randomUUID(),
      userId,
      activeDate,
      imagePath: null,
      items: scaledItems.value,
      sources: { usedPhoto: false, usedText: false, usedLibrary: true },
      isLabelPhoto: false,
    });
    payload.entry.input_text = props.meal.name;
    let queued = false;
    try {
      await foodEntryRepository.insertFoodEntry(
        payload.entry,
        payload.entryItems,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to log this item.";
      if (!navigator.onLine || /network|fetch/i.test(message)) {
        await enqueueRetry("create_food_entry", {
          entry: payload.entry,
          items: payload.entryItems,
        });
        queued = true;
      } else throw error;
    }
    if (!queued) {
      // An entry already saved must not be submitted again after a summary failure.
      try {
        await syncDailySummaryForDate(activeDate);
      } catch {
        /* Daily progress derives totals from the saved entries on refresh. */
      }
    }
    emit("saved", queued);
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Unable to log this item. Try again.";
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <DialogSheet title="Log from Library" :busy="isSaving" @close="emit('close')">
    <Card
      class="feature feature-library flex max-h-[90dvh] w-full max-w-none flex-col gap-4 overflow-hidden rounded-t-card p-3 sm:max-w-xl sm:rounded-card sm:p-5"
    >
      <header class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="break-words text-lg font-semibold">{{ meal.name }}</h2>
          <p class="text-xs text-muted-foreground">Logging for {{ logDate }}</p>
        </div>
        <Button variant="ghost" :disabled="isSaving" @click="emit('close')"
          >Close</Button
        >
      </header>
      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto">
        <p v-if="isLoading" role="status">Loading meal…</p>
        <template v-else-if="items.length">
          <label for="library-log-quantity" class="block text-sm font-medium">{{
            meal.is_meal ? "Portions of the saved meal" : "Quantity (g)"
          }}</label>
          <Input
            id="library-log-quantity"
            v-model="quantity"
            type="number"
            inputmode="decimal"
            min="0.1"
            :max="meal.is_meal ? undefined : '5000'"
            step="0.1"
            :disabled="isSaving"
          />
          <p class="text-sm font-semibold tabular-nums">
            {{ Math.round(totals.calories) }} kcal · P
            {{ Math.round(totals.protein) }}g · C
            {{ Math.round(totals.carbs) }}g · F {{ Math.round(totals.fat) }}g
          </p>
          <details v-if="meal.is_meal">
            <summary
              class="flex min-h-11 cursor-pointer items-center text-sm font-medium"
            >
              Adjust ingredients
            </summary>
            <div
              v-for="item in items"
              :key="item.id"
              class="flex items-center gap-3 border-t border-border/40 py-2"
            >
              <div class="min-w-0 flex-1">
                <p class="break-words text-sm">{{ item.name }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ Math.round(macrosFromLogItem(item).calories) }} kcal per
                  saved portion
                </p>
              </div>
              <Input
                v-model="item.gramsText"
                class="w-24"
                type="number"
                inputmode="decimal"
                min="0.1"
                step="0.1"
                :disabled="isSaving"
                :aria-label="`Grams per saved portion for ${item.name}`"
              />
            </div>
          </details>
        </template>
        <p
          v-if="
            scaledItems.some(
              (item) =>
                (parseNumberInput(item.gramsText) ?? 0) > MAX_LOG_ITEM_GRAMS,
            )
          "
          role="alert"
          class="text-sm text-destructive"
        >
          Reduce the quantity to {{ MAX_LOG_ITEM_GRAMS }}g or less per
          ingredient.
        </p>
        <p v-if="errorMessage" role="alert" class="text-sm text-destructive">
          {{ errorMessage }}
        </p>
        <Button
          v-if="!items.length && !isLoading"
          variant="secondary"
          class="w-full"
          @click="loadData"
          >Try again</Button
        >
      </div>
      <div
        class="glass shrink-0 rounded-card p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]"
      >
        <Button
          class="w-full"
          :disabled="!canSave"
          :loading="isSaving"
          @click="save"
          >Log {{ meal.is_meal ? "meal" : "food" }} ·
          {{ Math.round(totals.calories) }} kcal</Button
        >
      </div>
    </Card>
  </DialogSheet>
</template>
