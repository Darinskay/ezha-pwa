<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import {
  TabsContent,
  TabsIndicator,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from "radix-vue";
import { Camera, BookMarked, Trash2 } from "lucide-vue-next";
import { useQueryClient } from "@tanstack/vue-query";
import { watchDebounced } from "@vueuse/core";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Input from "@/components/ui/Input.vue";
import SelectField from "@/components/ui/SelectField.vue";
import Textarea from "@/components/ui/Textarea.vue";
import {
  clearDraft,
  enqueueRetry,
  loadDraft,
  saveDraft,
} from "@/db/offline-db";
import {
  buildManualLibraryDraft,
  buildPhotoLibraryDraft,
  resolveDuplicateSaveChoice,
  saveLibraryDraftWithDuplicateCheck,
  suggestedLibraryNameFromInputs,
  type DuplicateSaveChoice,
  type PendingLibraryDuplicate,
} from "@/features/add-log/library-save-service";
import {
  applyEditedLabelMacrosToItem,
  buildFoodEntryPayload,
  buildLabelLogItemsFromEstimate,
  buildLogItemsFromEstimate,
  buildMealIngredientsFromLogItems,
  MAX_LOG_ITEM_GRAMS,
  macrosFromLogItem,
  normalizeLogItemGrams,
  resolveLogMealAnalyzeInputType,
  totalsFromLogItems,
  type LogMealItem,
} from "@/features/add-log/log-meal-service";
import { descriptionFromDraft } from "@/features/add-log/meal-input-helpers";
import { formatMacro } from "@/lib/macros";
import { parseNumberInput } from "@/lib/number";
import { invalidateDailyDataQueries } from "@/query/invalidation";
import { foodEntryRepository } from "@/repositories/food-entry-repository";
import { savedFoodRepository } from "@/repositories/saved-food-repository";
import { aiAnalysisService } from "@/services/ai-analysis-service";
import { resolveActiveDateForLogging } from "@/services/active-date-service";
import { syncDailySummaryForDate } from "@/services/day-summary-service";
import { storageService } from "@/services/storage-service";
import { useActiveDayStore } from "@/stores/active-day-store";
import { currentUserId } from "@/lib/supabase";
import type { MacroEstimate, SavedFoodDraft } from "@/types/domain";

interface DraftItem {
  id: string;
  name: string;
  gramsText: string;
}

interface PendingDuplicate extends PendingLibraryDuplicate {
  onResolved?: () => Promise<void>;
}

interface AddLogDraft {
  entryMode?: "description" | "list";
  descriptionText: string;
  items?: DraftItem[];
  logItems: LogMealItem[];
  isLabelPhoto: boolean;
  labelGramsText: string;
  caloriesText: string;
  proteinText: string;
  carbsText: string;
  fatText: string;
  saveToLibrary: boolean;
  libraryName: string;
  hasUserEditedLibraryName: boolean;
  usedPhotoSource: boolean;
  usedTextSource: boolean;
  usedLibrarySource: boolean;
  usedPhotoMode: "food_photo" | "label_photo" | null;
  latestLabelItemId: string | null;
  libraryEntryMode: "photo" | "manual";
  manualUnitType: "per_100g" | "per_serving";
  manualServingSizeText: string;
  manualServingUnit: string;
  manualCaloriesText: string;
  manualProteinText: string;
  manualCarbsText: string;
  manualFatText: string;
  selectedImageFile: File | null;
  pendingEntryId: string | null;
  pendingImagePath: string | null;
  pendingLibrarySelectReturn?: boolean;
  activeLogDate?: string;
  analyzedInput?: string | null;
  estimate?: MacroEstimate | null;
}

const props = withDefaults(
  defineProps<{
    embedded?: boolean;
    initialMode?: "log" | "library";
    date?: string;
  }>(),
  {
    embedded: false,
    initialMode: "log",
  },
);
const emit = defineEmits<{
  close: [];
  saved: [nextRouteName: "today" | "library", queued: boolean, notice: string];
  "select-library": [];
  "busy-change": [busy: boolean];
}>();

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const activeDayStore = useActiveDayStore();

const mode = computed<"log" | "library">(() =>
  props.embedded
    ? props.initialMode
    : route.query.mode === "library"
      ? "library"
      : "log",
);
const activeLogDate = computed(() => {
  if (props.date) return props.date;
  const routeDate =
    typeof route.query.date === "string" ? route.query.date : undefined;
  return routeDate ?? activeDayStore.activeDate;
});
const pageClass = computed(() =>
  props.embedded
    ? "glass flex h-[90dvh] w-full max-w-none flex-col gap-3 overflow-hidden rounded-t-card rounded-b-none p-3 sm:max-w-2xl sm:rounded-card sm:p-5"
    : "app-page feature feature-add-log",
);
const pageTitle = computed(() =>
  mode.value === "log"
    ? props.embedded
      ? "Log meal"
      : "Log meal"
    : "Add Food",
);
const closePage = async (): Promise<void> => {
  if (!(await persistDraft())) return;
  if (props.embedded) {
    emit("close");
    return;
  }
  if (window.history.state?.back) router.back();
  else
    await router.replace({
      name: mode.value === "library" ? "library" : "today",
    });
};

const draftKey = computed(() =>
  mode.value === "log"
    ? `add-log:log:${activeLogDate.value}`
    : "add-log:library",
);
const isHydrating = ref(true);
const hasFinished = ref(false);
let draftWrites: Promise<void> = Promise.resolve();
let isDisposed = false;
const analyzedInput = ref<string | null>(null);

const descriptionText = ref("");
const logItems = ref<LogMealItem[]>([]);
const reviewPanel = ref<InstanceType<typeof Card> | null>(null);
const lastValidGramsByItemId = ref<Record<string, string>>({});
const lastValidLibraryFoodGramsByFoodId = ref<Record<string, string>>({});

const photoFileInput = ref<HTMLInputElement | null>(null);

const selectedImageFile = ref<File | null>(null);
const imagePreviewUrl = ref<string | null>(null);
const pendingEntryId = ref<string | null>(null);
const pendingImagePath = ref<string | null>(null);

const isLabelPhoto = ref(false);
const labelGramsText = ref("");
let labelBaseEstimate: MacroEstimate | null = null;

const estimate = ref<MacroEstimate | null>(null);
const caloriesText = ref("");
const proteinText = ref("");
const carbsText = ref("");
const fatText = ref("");

const isAnalyzing = ref(false);
const isSaving = ref(false);
watch([isAnalyzing, isSaving], ([analyzing, saving]) =>
  emit("busy-change", analyzing || saving),
);
const errorMessage = ref<string | null>(null);
const saveMessage = ref<string | null>(null);

const saveToLibrary = ref(false);
const libraryName = ref("");
const hasUserEditedLibraryName = ref(false);
const pendingDuplicate = ref<PendingDuplicate | null>(null);
const usedPhotoSource = ref(false);
const usedTextSource = ref(false);
const usedLibrarySource = ref(false);
const usedPhotoMode = ref<"food_photo" | "label_photo" | null>(null);
const latestLabelItemId = ref<string | null>(null);

const gramsValidationMessage = ref<string | null>(null);

const libraryEntryMode = ref<"photo" | "manual">("photo");
const manualUnitType = ref<"per_100g" | "per_serving">("per_100g");
const manualServingSizeText = ref("");
const manualServingUnit = ref("serving");
const manualCaloriesText = ref("");
const manualProteinText = ref("");
const manualCarbsText = ref("");
const manualFatText = ref("");

const manualPerServingPreview = computed(() => {
  const calories = parseNumberInput(manualCaloriesText.value);
  const protein = parseNumberInput(manualProteinText.value);
  const carbs = parseNumberInput(manualCarbsText.value);
  const fat = parseNumberInput(manualFatText.value);
  const servingSize = parseNumberInput(manualServingSizeText.value);

  if (
    calories == null ||
    protein == null ||
    carbs == null ||
    fat == null ||
    servingSize == null ||
    servingSize <= 0
  ) {
    return null;
  }

  const multiplier = servingSize / 100;
  return {
    calories: calories * multiplier,
    protein: protein * multiplier,
    carbs: carbs * multiplier,
    fat: fat * multiplier,
  };
});

const hasTextInput = computed(() => !!descriptionText.value.trim());
const hasPhotoInput = computed(
  () => !!selectedImageFile.value || !!pendingImagePath.value,
);
const inputFingerprint = computed(() =>
  JSON.stringify([
    descriptionText.value.trim(),
    selectedImageFile.value
      ? [
          selectedImageFile.value.name,
          selectedImageFile.value.size,
          selectedImageFile.value.lastModified,
        ]
      : pendingImagePath.value,
    isLabelPhoto.value,
  ]),
);
const needsAnalysis = computed(
  () =>
    (hasTextInput.value || hasPhotoInput.value) &&
    analyzedInput.value !== inputFingerprint.value,
);
const hasAnyLogItems = computed(
  () => buildMealIngredientsFromLogItems(logItems.value).length > 0,
);
const logTotals = computed(() => totalsFromLogItems(logItems.value));
const labelEditableItem = computed(() =>
  latestLabelItemId.value
    ? (logItems.value.find((item) => item.id === latestLabelItemId.value) ??
      null)
    : null,
);

const canAnalyze = computed(() => {
  if (isHydrating.value || isAnalyzing.value) return false;
  if (isSaving.value) return false;
  if (mode.value === "library" && libraryEntryMode.value === "photo") {
    return hasPhotoInput.value;
  }
  return hasTextInput.value || hasPhotoInput.value;
});

const canSaveLog = computed(() => {
  return (
    !isHydrating.value &&
    hasAnyLogItems.value &&
    !needsAnalysis.value &&
    !isAnalyzing.value &&
    !isSaving.value
  );
});

const suggestedLibraryName = computed(() =>
  suggestedLibraryNameFromInputs({
    selectedLibraryFoodName: null,
    listItemNames: logItems.value.map((item) => item.name),
    descriptionText: descriptionText.value,
    aiFoodName: estimate.value?.foodName ?? null,
  }),
);

const suggestedFoodName = (): string => {
  return suggestedLibraryName.value ?? "Meal";
};

const parseMacro = (value: string): number | null => parseNumberInput(value);

const onLibraryNameInput = (nextName: string): void => {
  hasUserEditedLibraryName.value = true;
  libraryName.value = nextName;
};

const defaultGramsTextForItem = (item: LogMealItem): string => {
  const fallback = item.baseGrams > 0 ? item.baseGrams : 100;
  return formatMacro(fallback, 1);
};

const rememberValidGramsForItem = (item: LogMealItem): void => {
  const normalized = normalizeLogItemGrams(item.gramsText);
  if (normalized == null) return;

  const normalizedText = formatMacro(normalized, 1);
  lastValidGramsByItemId.value[item.id] = normalizedText;
  if (item.origin === "library_food" && item.linkedFoodId) {
    lastValidLibraryFoodGramsByFoodId.value[item.linkedFoodId] = normalizedText;
  }
};

const syncRememberedLogItemGrams = (): void => {
  const nextIds = new Set(logItems.value.map((item) => item.id));
  for (const id of Object.keys(lastValidGramsByItemId.value)) {
    if (!nextIds.has(id)) {
      delete lastValidGramsByItemId.value[id];
    }
  }

  for (const item of logItems.value) {
    rememberValidGramsForItem(item);
  }
};

const fallbackGramsTextForItem = (item: LogMealItem): string => {
  const byItemId = lastValidGramsByItemId.value[item.id];
  if (byItemId) return byItemId;

  if (item.origin === "library_food" && item.linkedFoodId) {
    const byFoodId = lastValidLibraryFoodGramsByFoodId.value[item.linkedFoodId];
    if (byFoodId) return byFoodId;
  }

  return defaultGramsTextForItem(item);
};

const normalizeLogItemGramsText = (item: LogMealItem): void => {
  const normalized = normalizeLogItemGrams(item.gramsText);
  if (normalized == null) {
    item.gramsText = fallbackGramsTextForItem(item);
    rememberValidGramsForItem(item);
    return;
  }

  if (
    normalized >= MAX_LOG_ITEM_GRAMS &&
    parseNumberInput(item.gramsText) != null
  ) {
    gramsValidationMessage.value = `Max grams per item is ${MAX_LOG_ITEM_GRAMS}g.`;
  }
  item.gramsText = formatMacro(normalized, 1);
  rememberValidGramsForItem(item);
};

const adjustLogItemGrams = (item: LogMealItem, delta: number): void => {
  const current = normalizeLogItemGrams(item.gramsText) ?? 0;
  const next = Math.min(Math.max(current + delta, 0), MAX_LOG_ITEM_GRAMS);
  item.gramsText = formatMacro(next, 1);
  rememberValidGramsForItem(item);
  if (next >= MAX_LOG_ITEM_GRAMS && delta > 0) {
    gramsValidationMessage.value = `Max grams per item is ${MAX_LOG_ITEM_GRAMS}g.`;
  }
};

const normalizeAllLogItemGrams = (): void => {
  for (const item of logItems.value) {
    normalizeLogItemGramsText(item);
  }
};

const analysisInputType = computed(() => {
  if (mode.value === "library") {
    return isLabelPhoto.value ? "label_photo" : "photo";
  }
  return resolveLogMealAnalyzeInputType(
    hasPhotoInput.value,
    isLabelPhoto.value,
  );
});

const clearImage = (): void => {
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value);
  }
  selectedImageFile.value = null;
  imagePreviewUrl.value = null;
  pendingEntryId.value = null;
  pendingImagePath.value = null;
  isLabelPhoto.value = false;
  if (photoFileInput.value) photoFileInput.value.value = "";
  labelGramsText.value = "";
  labelBaseEstimate = null;
};

const pickPhoto = (): void => {
  photoFileInput.value?.click();
};

const setEstimate = (nextEstimate: MacroEstimate): void => {
  estimate.value = nextEstimate;
  caloriesText.value = formatMacro(nextEstimate.calories, 2);
  proteinText.value = formatMacro(nextEstimate.protein, 2);
  carbsText.value = formatMacro(nextEstimate.carbs, 2);
  fatText.value = formatMacro(nextEstimate.fat, 2);
};

const setMacroTextFromTotals = (totals: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}): void => {
  caloriesText.value = formatMacro(totals.calories, 2);
  proteinText.value = formatMacro(totals.protein, 2);
  carbsText.value = formatMacro(totals.carbs, 2);
  fatText.value = formatMacro(totals.fat, 2);
};

const applyLabelScaling = (): void => {
  if (!isLabelPhoto.value || !labelBaseEstimate) return;
  const grams = parseMacro(labelGramsText.value);
  if (!grams || grams <= 0) {
    setEstimate(labelBaseEstimate);
    return;
  }

  const multiplier = grams / 100;
  const scaled: MacroEstimate = {
    ...labelBaseEstimate,
    calories: labelBaseEstimate.calories * multiplier,
    protein: labelBaseEstimate.protein * multiplier,
    carbs: labelBaseEstimate.carbs * multiplier,
    fat: labelBaseEstimate.fat * multiplier,
    items: labelBaseEstimate.items.map((item) => ({
      ...item,
      grams: item.grams * multiplier,
      calories: item.calories * multiplier,
      protein: item.protein * multiplier,
      carbs: item.carbs * multiplier,
      fat: item.fat * multiplier,
    })),
  };

  setEstimate(scaled);
};

const replaceAiLogItems = (nextAiItems: LogMealItem[]): void => {
  const nonAiItems = logItems.value.filter((item) => item.origin !== "ai");
  logItems.value = [...nonAiItems, ...nextAiItems];
};

const removeLogItem = (id: string): void => {
  logItems.value = logItems.value.filter((item) => item.id !== id);
  if (latestLabelItemId.value === id) {
    latestLabelItemId.value = null;
  }
};

const clearMealDraft = (): void => {
  if (!window.confirm("Clear this meal draft and start again?")) return;
  resetAddLogState();
  analyzedInput.value = null;
  logItems.value = [];
  lastValidGramsByItemId.value = {};
  lastValidLibraryFoodGramsByFoodId.value = {};
  usedLibrarySource.value = false;
  latestLabelItemId.value = null;
  gramsValidationMessage.value = null;
};

const syncLabelEditorFromItem = (): void => {
  if (!labelEditableItem.value) return;
  const macros = macrosFromLogItem(labelEditableItem.value);
  setMacroTextFromTotals(macros);
};

const uploadIfNeeded = async (): Promise<string | null> => {
  if (pendingImagePath.value) return pendingImagePath.value;
  if (!selectedImageFile.value) return null;

  const userId = await currentUserId();
  const entryId = pendingEntryId.value ?? crypto.randomUUID();
  pendingEntryId.value = entryId;

  const path = await storageService.uploadFoodImage(
    selectedImageFile.value,
    userId,
    entryId,
  );
  pendingImagePath.value = path;
  return path;
};

const openLibrarySelector = async (): Promise<void> => {
  if (mode.value !== "log") return;
  const draft = buildDraftSnapshot();
  try {
    await draftWrites;
    await saveDraft(draftKey.value, {
      ...draft,
      pendingLibrarySelectReturn: true,
    } satisfies AddLogDraft);
  } catch {
    errorMessage.value =
      "Your meal draft could not be saved. Please try opening the library again.";
    return;
  }
  if (props.embedded) {
    emit("select-library");
    return;
  }
  await router.push({
    name: "log-meal-library-select",
    query: { date: activeLogDate.value },
  });
};

const analyze = async (): Promise<void> => {
  if (isAnalyzing.value || isSaving.value) {
    return;
  }

  saveMessage.value = null;
  errorMessage.value = null;

  isAnalyzing.value = true;
  try {
    const imagePath = await uploadIfNeeded();
    const text = mode.value === "log" ? descriptionText.value.trim() : "";
    const requestedInput = inputFingerprint.value;
    const nextEstimate = await aiAnalysisService.analyze({
      text: text || undefined,
      imagePath: imagePath ?? undefined,
      inputType: analysisInputType.value,
    });
    analyzedInput.value = requestedInput;

    setEstimate(nextEstimate);

    if (isLabelPhoto.value) {
      labelBaseEstimate = nextEstimate;
      applyLabelScaling();
    } else {
      labelBaseEstimate = null;
    }

    if (mode.value === "log") {
      if (isLabelPhoto.value) {
        const grams = parseMacro(labelGramsText.value);
        const labelItems = buildLabelLogItemsFromEstimate(
          nextEstimate,
          grams,
          suggestedFoodName(),
        );
        replaceAiLogItems(labelItems);
        latestLabelItemId.value = labelItems[0]?.id ?? null;
        syncLabelEditorFromItem();
      } else {
        const aiItems = buildLogItemsFromEstimate(
          nextEstimate,
          suggestedFoodName(),
        );
        replaceAiLogItems(aiItems);
        setMacroTextFromTotals(logTotals.value);
        latestLabelItemId.value = null;
      }

      if (imagePath) {
        usedPhotoSource.value = true;
        usedPhotoMode.value = isLabelPhoto.value ? "label_photo" : "food_photo";
      }
      if (text) {
        usedTextSource.value = true;
      }
      await nextTick();
      reviewPanel.value?.$el?.scrollIntoView?.({ block: "start" });
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Unable to analyze meal.";
  } finally {
    isAnalyzing.value = false;
  }
};

const buildLibraryDraft = (name: string): SavedFoodDraft | null => {
  const result = buildPhotoLibraryDraft({
    name,
    caloriesPerDisplayUnit: parseMacro(caloriesText.value),
    proteinPerDisplayUnit: parseMacro(proteinText.value),
    carbsPerDisplayUnit: parseMacro(carbsText.value),
    fatPerDisplayUnit: parseMacro(fatText.value),
    isLabelPhoto: isLabelPhoto.value,
    labelGrams: parseMacro(labelGramsText.value),
  });

  if (!result.draft) {
    errorMessage.value = result.error;
    return null;
  }

  return result.draft;
};

const saveLibraryDraft = async (draft: SavedFoodDraft): Promise<boolean> => {
  const result = await saveLibraryDraftWithDuplicateCheck(
    savedFoodRepository,
    draft,
  );
  if (result.status === "duplicate") {
    pendingDuplicate.value = { ...result.pending };
    return false;
  }

  return true;
};

const resolveDuplicate = async (choice: DuplicateSaveChoice): Promise<void> => {
  if (!pendingDuplicate.value) return;

  const { onResolved, ...pending } = pendingDuplicate.value;
  pendingDuplicate.value = null;

  await resolveDuplicateSaveChoice(savedFoodRepository, pending, choice);

  if (onResolved) {
    await onResolved();
  }

  saveMessage.value = "Saved to library.";
};

const finishAndExit = async (
  nextRouteName: "today" | "library",
  queued = false,
  notice = "",
): Promise<void> => {
  hasFinished.value = true;
  await draftWrites;
  await clearDraft(draftKey.value);
  activeDayStore.setActiveDate(activeLogDate.value);
  await invalidateDailyDataQueries(queryClient, {
    includeLibrary: true,
    includeSettingsTargets: true,
  });

  if (props.embedded) {
    emit("saved", nextRouteName, queued, notice);
    return;
  }

  await router.replace({
    name: nextRouteName,
    query:
      nextRouteName === "today"
        ? { logged: queued ? "queued" : "saved", ...(notice ? { notice } : {}) }
        : {},
  });
};

const saveLogEntry = async (): Promise<void> => {
  if (isAnalyzing.value || isSaving.value) {
    return;
  }

  normalizeAllLogItemGrams();
  gramsValidationMessage.value = null;

  const blockedItems = logItems.value.filter(
    (item) =>
      item.isNutritionMissing &&
      (normalizeLogItemGrams(item.gramsText) ?? 0) > 0,
  );
  if (blockedItems.length > 0) {
    errorMessage.value = "Remove items with missing nutrition before logging.";
    return;
  }

  if (!canSaveLog.value) {
    errorMessage.value = "At least one item must have grams greater than 0.";
    return;
  }

  if (saveToLibrary.value && !libraryName.value.trim()) {
    errorMessage.value = "Enter a meal name to save this log to Library.";
    return;
  }

  isSaving.value = true;
  errorMessage.value = null;
  saveMessage.value = null;

  try {
    const userId = await currentUserId();
    const entryId = pendingEntryId.value ?? crypto.randomUUID();
    pendingEntryId.value = entryId;
    const imagePath = hasPhotoInput.value
      ? ((await uploadIfNeeded()) ?? null)
      : null;
    const activeDate = await resolveActiveDateForLogging(
      userId,
      activeLogDate.value,
    );

    const hasLibraryItems = logItems.value.some(
      (item) =>
        item.origin === "library_food" || item.origin === "library_meal",
    );
    const hasAiItems = logItems.value.some((item) => item.origin === "ai");
    const { entry, entryItems } = buildFoodEntryPayload({
      entryId,
      userId,
      activeDate,
      imagePath,
      items: logItems.value,
      sources: {
        usedPhoto: usedPhotoSource.value,
        usedText:
          usedTextSource.value || (hasAiItems && !usedPhotoSource.value),
        usedLibrary: hasLibraryItems,
      },
      isLabelPhoto: usedPhotoMode.value === "label_photo",
    });

    if (entryItems.length === 0) {
      errorMessage.value = "Add at least one valid item with grams.";
      return;
    }

    let queuedForRetry = false;
    try {
      await foodEntryRepository.insertFoodEntry(entry, entryItems);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save entry";
      if (
        !navigator.onLine ||
        message.toLowerCase().includes("network") ||
        message.toLowerCase().includes("fetch")
      ) {
        await enqueueRetry("create_food_entry", { entry, items: entryItems });
        queuedForRetry = true;
      } else {
        throw error;
      }
    }

    let notice = "";
    if (saveToLibrary.value) {
      try {
        await savedFoodRepository.insertMeal(
          libraryName.value.trim(),
          buildMealIngredientsFromLogItems(logItems.value),
        );
      } catch {
        notice = "The library copy could not be saved. Your meal log is kept.";
      }
    }
    if (!queuedForRetry) {
      try {
        await syncDailySummaryForDate(activeDate);
      } catch {
        notice = [notice, "Daily totals will refresh when you reconnect."]
          .filter(Boolean)
          .join(" ");
      }
    }
    await finishAndExit("today", queuedForRetry, notice);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Unable to save entry.";
  } finally {
    isSaving.value = false;
  }
};

const saveManualLibrary = async (): Promise<void> => {
  isSaving.value = true;
  errorMessage.value = null;
  saveMessage.value = null;

  try {
    const result = buildManualLibraryDraft({
      name: libraryName.value,
      unitType: manualUnitType.value,
      servingSizeGrams:
        manualUnitType.value === "per_serving"
          ? parseMacro(manualServingSizeText.value)
          : null,
      servingUnit: manualServingUnit.value,
      caloriesPer100g: parseMacro(manualCaloriesText.value),
      proteinPer100g: parseMacro(manualProteinText.value),
      carbsPer100g: parseMacro(manualCarbsText.value),
      fatPer100g: parseMacro(manualFatText.value),
    });

    if (!result.draft) {
      throw new Error(result.error ?? "Unable to save to library.");
    }

    const didSave = await saveLibraryDraft(result.draft);
    if (!didSave && pendingDuplicate.value) {
      pendingDuplicate.value.onResolved = async () => {
        await finishAndExit("library");
      };
      return;
    }

    await finishAndExit("library");
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Unable to save to library.";
  } finally {
    isSaving.value = false;
  }
};

const saveLibraryFromEstimate = async (): Promise<void> => {
  const draft = buildLibraryDraft(libraryName.value || suggestedFoodName());
  if (!draft) return;

  isSaving.value = true;
  errorMessage.value = null;
  saveMessage.value = null;

  try {
    const didSave = await saveLibraryDraft(draft);
    if (!didSave && pendingDuplicate.value) {
      pendingDuplicate.value.onResolved = async () => {
        await finishAndExit("library");
      };
      return;
    }

    await finishAndExit("library");
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Unable to save to library.";
  } finally {
    isSaving.value = false;
  }
};

const onFilePicked = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0] ?? null;
  if (!file) return;

  clearImage();
  selectedImageFile.value = file;
  imagePreviewUrl.value = URL.createObjectURL(file);
  target.value = "";
};

const applyLabelMacroEdits = (): void => {
  if (!labelEditableItem.value) {
    errorMessage.value = "Analyze a label photo first.";
    return;
  }

  const calories = parseMacro(caloriesText.value);
  const protein = parseMacro(proteinText.value);
  const carbs = parseMacro(carbsText.value);
  const fat = parseMacro(fatText.value);

  if (calories == null || protein == null || carbs == null || fat == null) {
    errorMessage.value = "Enter valid macro values for label overrides.";
    return;
  }

  const grams = parseMacro(labelGramsText.value);
  logItems.value = logItems.value.map((item) =>
    item.id === labelEditableItem.value?.id
      ? applyEditedLabelMacrosToItem(
          item,
          { calories, protein, carbs, fat },
          grams,
        )
      : item,
  );
  errorMessage.value = null;
  syncLabelEditorFromItem();
};

const resetAddLogState = (): void => {
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value);
  }
  selectedImageFile.value = null;
  imagePreviewUrl.value = null;
  pendingEntryId.value = null;
  pendingImagePath.value = null;

  descriptionText.value = "";
  logItems.value = [];
  lastValidGramsByItemId.value = {};
  lastValidLibraryFoodGramsByFoodId.value = {};
  isLabelPhoto.value = false;
  labelGramsText.value = "";
  caloriesText.value = "";
  proteinText.value = "";
  carbsText.value = "";
  fatText.value = "";
  saveToLibrary.value = false;
  libraryName.value = "";
  hasUserEditedLibraryName.value = false;
  usedPhotoSource.value = false;
  usedTextSource.value = false;
  usedLibrarySource.value = false;
  usedPhotoMode.value = null;
  latestLabelItemId.value = null;
  libraryEntryMode.value = "photo";
  manualUnitType.value = "per_100g";
  manualServingSizeText.value = "";
  manualServingUnit.value = "serving";
  manualCaloriesText.value = "";
  manualProteinText.value = "";
  manualCarbsText.value = "";
  manualFatText.value = "";
  labelBaseEstimate = null;
  estimate.value = null;
};

const applyDraftSnapshot = (draft: AddLogDraft): void => {
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value);
  }
  estimate.value = draft.estimate ?? null;
  labelBaseEstimate = draft.isLabelPhoto ? (draft.estimate ?? null) : null;
  selectedImageFile.value = draft.selectedImageFile ?? null;
  pendingEntryId.value = draft.pendingEntryId ?? null;
  pendingImagePath.value = draft.pendingImagePath ?? null;
  imagePreviewUrl.value = selectedImageFile.value
    ? URL.createObjectURL(selectedImageFile.value)
    : null;

  descriptionText.value = descriptionFromDraft(draft);
  analyzedInput.value = draft.analyzedInput ?? null;
  logItems.value = draft.logItems ?? [];
  syncRememberedLogItemGrams();
  isLabelPhoto.value = draft.isLabelPhoto;
  labelGramsText.value = draft.labelGramsText;
  caloriesText.value = draft.caloriesText;
  proteinText.value = draft.proteinText;
  carbsText.value = draft.carbsText;
  fatText.value = draft.fatText;
  saveToLibrary.value = draft.saveToLibrary;
  libraryName.value = draft.libraryName;
  hasUserEditedLibraryName.value = draft.hasUserEditedLibraryName ?? false;
  usedPhotoSource.value = draft.usedPhotoSource ?? false;
  usedTextSource.value = draft.usedTextSource ?? false;
  usedLibrarySource.value = draft.usedLibrarySource ?? false;
  usedPhotoMode.value = draft.usedPhotoMode ?? null;
  latestLabelItemId.value = draft.latestLabelItemId ?? null;
  libraryEntryMode.value = draft.libraryEntryMode;
  manualUnitType.value = draft.manualUnitType;
  manualServingSizeText.value = draft.manualServingSizeText;
  manualServingUnit.value = draft.manualServingUnit;
  manualCaloriesText.value = draft.manualCaloriesText;
  manualProteinText.value = draft.manualProteinText;
  manualCarbsText.value = draft.manualCarbsText;
  manualFatText.value = draft.manualFatText;
};

const buildDraftSnapshot = (): AddLogDraft => ({
  activeLogDate: activeLogDate.value,
  analyzedInput: analyzedInput.value,
  estimate: estimate.value,
  entryMode: "description",
  descriptionText: descriptionText.value,
  items: [],
  logItems: logItems.value,
  isLabelPhoto: isLabelPhoto.value,
  labelGramsText: labelGramsText.value,
  caloriesText: caloriesText.value,
  proteinText: proteinText.value,
  carbsText: carbsText.value,
  fatText: fatText.value,
  saveToLibrary: saveToLibrary.value,
  libraryName: libraryName.value,
  hasUserEditedLibraryName: hasUserEditedLibraryName.value,
  usedPhotoSource: usedPhotoSource.value,
  usedTextSource: usedTextSource.value,
  usedLibrarySource: usedLibrarySource.value,
  usedPhotoMode: usedPhotoMode.value,
  latestLabelItemId: latestLabelItemId.value,
  libraryEntryMode: libraryEntryMode.value,
  manualUnitType: manualUnitType.value,
  manualServingSizeText: manualServingSizeText.value,
  manualServingUnit: manualServingUnit.value,
  manualCaloriesText: manualCaloriesText.value,
  manualProteinText: manualProteinText.value,
  manualCarbsText: manualCarbsText.value,
  manualFatText: manualFatText.value,
  selectedImageFile: selectedImageFile.value,
  pendingEntryId: pendingEntryId.value,
  pendingImagePath: pendingImagePath.value,
});

const hydrateFromDraft = async (): Promise<void> => {
  isHydrating.value = true;
  analyzedInput.value = null;
  try {
    let draft = await loadDraft<AddLogDraft>(draftKey.value);
    if (!draft && mode.value === "log") {
      const legacy = await loadDraft<AddLogDraft>("add-log:log");
      if (
        legacy &&
        (!legacy.activeLogDate || legacy.activeLogDate === activeLogDate.value)
      ) {
        draft = legacy;
        await saveDraft(draftKey.value, {
          ...legacy,
          activeLogDate: activeLogDate.value,
        });
        await clearDraft("add-log:log");
      }
    }
    if (draft) applyDraftSnapshot(draft);
    else resetAddLogState();
  } catch {
    errorMessage.value =
      "Your draft could not be restored. Please try reopening the logger.";
  } finally {
    isHydrating.value = false;
  }
};

const persistDraft = async (): Promise<boolean> => {
  if (isDisposed || isHydrating.value || hasFinished.value) return true;
  const key = draftKey.value;
  const snapshot = buildDraftSnapshot();
  draftWrites = draftWrites
    .catch(() => {})
    .then(() => saveDraft(key, snapshot));
  try {
    await draftWrites;
    return true;
  } catch {
    errorMessage.value =
      "Your draft could not be saved on this device. Keep this screen open to avoid losing it.";
    return false;
  }
};

watch(draftKey, hydrateFromDraft, { immediate: true });
onBeforeRouteLeave(async () => await persistDraft());
const saveBeforePageHide = (): void => {
  void persistDraft();
};
onMounted(() => window.addEventListener("pagehide", saveBeforePageHide));

watchDebounced(
  [
    selectedImageFile,
    analyzedInput,
    estimate,
    descriptionText,
    logItems,
    isLabelPhoto,
    labelGramsText,
    caloriesText,
    proteinText,
    carbsText,
    fatText,
    saveToLibrary,
    libraryName,
    hasUserEditedLibraryName,
    usedPhotoSource,
    usedTextSource,
    usedLibrarySource,
    usedPhotoMode,
    latestLabelItemId,
    libraryEntryMode,
    manualUnitType,
    manualServingSizeText,
    manualServingUnit,
    manualCaloriesText,
    manualProteinText,
    manualCarbsText,
    manualFatText,
  ],
  () => {
    void persistDraft();
  },
  { debounce: 400, maxWait: 1200, deep: true },
);

watch(
  mode,
  () => {
    errorMessage.value = null;
    saveMessage.value = null;
  },
  { immediate: true },
);

watch(
  suggestedLibraryName,
  (nextSuggestedName) => {
    if (hasUserEditedLibraryName.value) return;
    libraryName.value = nextSuggestedName ?? "";
  },
  { immediate: true },
);

watch(
  logItems,
  () => {
    syncRememberedLogItemGrams();
  },
  { deep: true, immediate: true },
);

watch([isLabelPhoto, labelGramsText], () => {
  applyLabelScaling();
  if (!isLabelPhoto.value || !labelEditableItem.value) return;
  const grams = parseMacro(labelGramsText.value);
  if (!grams || grams <= 0) return;

  logItems.value = logItems.value.map((item) =>
    item.id === labelEditableItem.value?.id
      ? { ...item, gramsText: formatMacro(grams, 1) }
      : item,
  );
  syncLabelEditorFromItem();
});

watch(
  [mode, logTotals, latestLabelItemId],
  () => {
    if (mode.value !== "log") return;
    if (labelEditableItem.value && isLabelPhoto.value) {
      return;
    }
    setMacroTextFromTotals(logTotals.value);
  },
  { immediate: true, deep: true },
);

defineExpose({ persistDraft });

onUnmounted(() => {
  isDisposed = true;
  window.removeEventListener("pagehide", saveBeforePageHide);
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value);
  }
});
</script>

<template>
  <section class="feature feature-add-log" :class="pageClass">
    <header class="flex items-start justify-between gap-3">
      <div class="page-header">
        <h1 class="page-title">
          {{ pageTitle }}
        </h1>
        <p class="page-subtitle">
          {{
            mode === "log"
              ? `Logging for ${activeLogDate}.`
              : "Save foods to your library."
          }}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        :disabled="isAnalyzing || isSaving"
        @click="closePage"
        >Close</Button
      >
    </header>
    <div
      :class="
        embedded ? 'min-h-0 flex-1 space-y-3 overflow-y-auto' : 'space-y-3'
      "
    >
      <Card v-if="mode === 'library'" class="space-y-4 p-3 sm:p-5">
        <TabsRoot v-model="libraryEntryMode">
          <TabsList class="ios-segment">
            <TabsTrigger value="photo" class="ios-segment-trigger">
              Photo
            </TabsTrigger>
            <TabsTrigger value="manual" class="ios-segment-trigger">
              Manual
            </TabsTrigger>
          </TabsList>
          <TabsIndicator
            class="h-[2px] bg-[hsl(var(--feature-primary))] transition-all"
          />

          <TabsContent value="manual" class="mt-4 space-y-3">
            <div class="space-y-1">
              <label
                class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground"
                >Food name</label
              >
              <Input
                :model-value="libraryName"
                placeholder="e.g. Apple"
                @update:modelValue="onLibraryNameInput"
              />
            </div>

            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div class="space-y-1">
                <label
                  class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground"
                  >Unit type</label
                >
                <SelectField v-model="manualUnitType">
                  <option value="per_100g">Per 100g</option>
                  <option value="per_serving">Per serving</option>
                </SelectField>
              </div>

              <template v-if="manualUnitType === 'per_serving'">
                <div class="space-y-1">
                  <label
                    class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground"
                    >Serving grams</label
                  >
                  <Input
                    v-model="manualServingSizeText"
                    type="number"
                    min="0"
                    step="0.1"
                  />
                </div>
                <div class="space-y-1">
                  <label
                    class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground"
                    >Serving unit</label
                  >
                  <Input v-model="manualServingUnit" />
                </div>
              </template>
            </div>

            <p class="text-sm font-medium">Nutrition per 100 g</p>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div class="space-y-1">
                <label
                  class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground"
                  >Calories</label
                >
                <Input
                  v-model="manualCaloriesText"
                  type="number"
                  min="0"
                  step="0.1"
                />
              </div>
              <div class="space-y-1">
                <label
                  class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground"
                  >Protein</label
                >
                <Input
                  v-model="manualProteinText"
                  type="number"
                  min="0"
                  step="0.1"
                />
              </div>
              <div class="space-y-1">
                <label
                  class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground"
                  >Carbs</label
                >
                <Input
                  v-model="manualCarbsText"
                  type="number"
                  min="0"
                  step="0.1"
                />
              </div>
              <div class="space-y-1">
                <label
                  class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground"
                  >Fat</label
                >
                <Input
                  v-model="manualFatText"
                  type="number"
                  min="0"
                  step="0.1"
                />
              </div>
            </div>

            <p
              v-if="manualPerServingPreview && manualUnitType === 'per_serving'"
              class="rounded-thumb border border-white/50 bg-white/40 px-3 py-2 text-xs text-muted-foreground dark:border-border/20 dark:bg-card/30"
            >
              Per serving:
              {{ formatMacro(manualPerServingPreview.calories, 1) }} kcal · P{{
                formatMacro(manualPerServingPreview.protein, 1)
              }}
              · C{{ formatMacro(manualPerServingPreview.carbs, 1) }} · F{{
                formatMacro(manualPerServingPreview.fat, 1)
              }}
            </p>

            <Button
              class="w-full sm:w-auto"
              :loading="isSaving"
              @click="saveManualLibrary"
              >Save to Library</Button
            >
          </TabsContent>
        </TabsRoot>
      </Card>

      <Card
        v-if="mode === 'log' || libraryEntryMode === 'photo'"
        class="space-y-3 p-3 sm:p-5"
      >
        <div
          class="grid gap-2"
          :class="mode === 'log' ? 'grid-cols-2' : 'grid-cols-1'"
        >
          <Button
            variant="secondary"
            :disabled="isHydrating || isAnalyzing || isSaving"
            @click="pickPhoto"
          >
            <Camera class="size-4" aria-hidden="true" />{{
              imagePreviewUrl ? "Change photo" : "Photo"
            }}
          </Button>
          <Button
            v-if="mode === 'log'"
            variant="secondary"
            :disabled="isHydrating || isAnalyzing || isSaving"
            @click="openLibrarySelector"
          >
            <BookMarked class="size-4" aria-hidden="true" />Library
          </Button>
        </div>
        <input
          ref="photoFileInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="onFilePicked"
        />
        <div v-if="mode === 'log'" class="space-y-2">
          <label for="meal-description" class="text-sm font-medium"
            >What did you eat?
            <span class="font-normal text-muted-foreground">{{
              hasPhotoInput ? "(optional)" : ""
            }}</span></label
          >
          <Textarea
            id="meal-description"
            v-model="descriptionText"
            :disabled="isHydrating || isAnalyzing || isSaving"
            :rows="3"
            placeholder="e.g. 150g chicken, rice and a little olive oil"
          />
        </div>
        <div class="space-y-2">
          <img
            v-if="imagePreviewUrl"
            :src="imagePreviewUrl"
            alt="Selected meal photo"
            class="max-h-56 w-full rounded-xl border border-border/80 object-cover"
          />
          <div class="flex flex-wrap items-center gap-2">
            <Button
              v-if="imagePreviewUrl"
              size="sm"
              variant="ghost"
              :disabled="isAnalyzing || isSaving"
              @click="clearImage"
              >Remove photo</Button
            >
            <label
              v-if="imagePreviewUrl"
              class="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"
            >
              <input
                v-model="isLabelPhoto"
                :disabled="isAnalyzing || isSaving"
                type="checkbox"
                class="size-4 rounded border-border accent-primary"
              />
              This is a nutrition label
            </label>
          </div>

          <Input
            v-if="imagePreviewUrl && isLabelPhoto"
            v-model="labelGramsText"
            type="number"
            min="0"
            step="0.1"
            placeholder="Grams eaten (optional)"
          />
        </div>

        <Button
          v-if="mode === 'library'"
          class="w-full sm:w-auto"
          :loading="isAnalyzing"
          :disabled="!canAnalyze"
          @click="analyze"
        >
          Estimate nutrition
        </Button>
      </Card>

      <Card
        ref="reviewPanel"
        v-if="mode === 'library' ? !!estimate : logItems.length > 0"
        class="space-y-4 p-3 sm:p-5"
      >
        <div
          v-if="mode === 'library'"
          class="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          <div class="space-y-1">
            <label
              class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground"
              >Calories</label
            >
            <Input v-model="caloriesText" type="number" min="0" step="0.1" />
          </div>
          <div class="space-y-1">
            <label
              class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground"
              >Protein</label
            >
            <Input v-model="proteinText" type="number" min="0" step="0.1" />
          </div>
          <div class="space-y-1">
            <label
              class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground"
              >Carbs</label
            >
            <Input v-model="carbsText" type="number" min="0" step="0.1" />
          </div>
          <div class="space-y-1">
            <label
              class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground"
              >Fat</label
            >
            <Input v-model="fatText" type="number" min="0" step="0.1" />
          </div>
        </div>

        <template v-if="mode === 'log'">
          <h2 class="text-base font-semibold">Review meal</h2>
          <p
            v-if="logItems.some((item) => item.origin === 'ai')"
            class="text-xs text-muted-foreground"
          >
            Estimated nutrition. Adjust quantities before logging.
          </p>
          <article
            v-for="item in logItems"
            :key="item.id"
            class="glass space-y-2 rounded-card p-3"
          >
            <div class="flex items-start justify-between gap-2">
              <h4 class="text-sm font-semibold">{{ item.name }}</h4>
              <Button
                variant="ghost"
                size="sm"
                class="size-11 rounded-full p-0 text-destructive"
                :disabled="isAnalyzing || isSaving"
                :aria-label="`Remove ${item.name}`"
                @click="removeLogItem(item.id)"
              >
                <Trash2 class="size-4" />
              </Button>
            </div>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div class="space-y-1">
                <label
                  class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground"
                  >Grams (g)</label
                >
                <div class="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    :disabled="isAnalyzing || isSaving"
                    :aria-label="`Decrease grams for ${item.name}`"
                    @click="adjustLogItemGrams(item, -5)"
                    >-</Button
                  >
                  <Input
                    v-model="item.gramsText"
                    :disabled="isAnalyzing || isSaving"
                    :aria-label="`Grams for ${item.name}`"
                    inputmode="decimal"
                    type="number"
                    min="0"
                    :max="String(MAX_LOG_ITEM_GRAMS)"
                    step="0.1"
                    placeholder="Grams (g)"
                    @blur="normalizeLogItemGramsText(item)"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    :disabled="isAnalyzing || isSaving"
                    :aria-label="`Increase grams for ${item.name}`"
                    @click="adjustLogItemGrams(item, 5)"
                    >+</Button
                  >
                </div>
              </div>
              <p
                class="rounded-thumb border border-white/50 bg-white/40 px-3 py-2 text-xs text-muted-foreground dark:border-border/20 dark:bg-card/30"
              >
                {{ formatMacro(macrosFromLogItem(item).calories, 1) }} kcal ·
                P{{ formatMacro(macrosFromLogItem(item).protein, 1) }} · C{{
                  formatMacro(macrosFromLogItem(item).carbs, 1)
                }}
                · F{{ formatMacro(macrosFromLogItem(item).fat, 1) }}
              </p>
            </div>
            <p
              v-if="item.isNutritionMissing"
              class="rounded-thumb border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary"
            >
              Nutrition is missing. Remove this item to log the rest of your
              meal.
            </p>
          </article>

          <div
            class="rounded-thumb border border-white/50 bg-white/40 p-3 text-sm dark:border-border/20 dark:bg-card/30"
          >
            Total: {{ formatMacro(logTotals.calories, 1) }} kcal · P{{
              formatMacro(logTotals.protein, 1)
            }}g · C{{ formatMacro(logTotals.carbs, 1) }}g · F{{
              formatMacro(logTotals.fat, 1)
            }}g
          </div>

          <div v-if="labelEditableItem" class="space-y-2">
            <p
              class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground"
            >
              Label macro overrides
            </p>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Input
                v-model="caloriesText"
                type="number"
                min="0"
                step="0.1"
                placeholder="Calories"
              />
              <Input
                v-model="proteinText"
                type="number"
                min="0"
                step="0.1"
                placeholder="Protein"
              />
              <Input
                v-model="carbsText"
                type="number"
                min="0"
                step="0.1"
                placeholder="Carbs"
              />
              <Input
                v-model="fatText"
                type="number"
                min="0"
                step="0.1"
                placeholder="Fat"
              />
            </div>
            <Button size="sm" variant="secondary" @click="applyLabelMacroEdits"
              >Apply label macros</Button
            >
          </div>

          <p
            v-if="gramsValidationMessage"
            class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {{ gramsValidationMessage }}
          </p>

          <div class="space-y-2">
            <label class="inline-flex min-h-11 items-center gap-2 text-sm">
              <input
                v-model="saveToLibrary"
                :disabled="isSaving"
                type="checkbox"
                class="size-4 rounded border-border accent-primary"
              />
              Save this meal to Library
            </label>
            <Input
              v-if="saveToLibrary"
              :disabled="isSaving"
              aria-label="Meal name for Library"
              :model-value="libraryName"
              placeholder="Meal name"
              @update:modelValue="onLibraryNameInput"
            />
          </div>
        </template>

        <div v-if="mode === 'library'" class="space-y-2">
          <Input
            :model-value="libraryName"
            placeholder="Food name for library"
            @update:modelValue="onLibraryNameInput"
          />
          <Button
            class="w-full sm:w-auto"
            :loading="isSaving"
            @click="saveLibraryFromEstimate"
            >Save to Library</Button
          >
        </div>
      </Card>

      <p
        v-if="errorMessage"
        role="alert"
        class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ errorMessage }}
      </p>
      <p
        v-if="saveMessage"
        class="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary"
      >
        {{ saveMessage }}
      </p>

      <Button
        v-if="
          mode === 'log' && (logItems.length || hasTextInput || hasPhotoInput)
        "
        variant="ghost"
        :disabled="isSaving || isAnalyzing"
        @click="clearMealDraft"
        >Clear draft</Button
      >
    </div>
    <div
      v-if="mode === 'log'"
      :class="
        embedded ? 'shrink-0' : 'fixed inset-x-3 bottom-3 mx-auto max-w-5xl'
      "
      class="glass z-10 space-y-2 rounded-card p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
    >
      <p
        v-if="logItems.length && needsAnalysis"
        class="text-xs text-muted-foreground"
      >
        Your photo or description changed. Update the estimate before logging.
      </p>
      <Button
        class="w-full"
        :loading="isAnalyzing || isSaving"
        :disabled="isHydrating || (needsAnalysis ? !canAnalyze : !canSaveLog)"
        @click="needsAnalysis ? analyze() : saveLogEntry()"
      >
        {{
          needsAnalysis || !logItems.length
            ? "Estimate nutrition"
            : `Log meal · ${Math.round(logTotals.calories)} kcal`
        }}
      </Button>
    </div>

    <div v-if="pendingDuplicate" class="dialog-overlay feature feature-add-log">
      <Card
        class="w-full max-w-none space-y-4 rounded-t-card rounded-b-none p-3 sm:max-w-md sm:rounded-card sm:p-5"
      >
        <h3 class="text-lg font-semibold">Food already exists</h3>
        <p class="text-sm text-muted-foreground">
          "{{ pendingDuplicate.existing.name }}" is already in your Library.
        </p>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button @click="resolveDuplicate('update')">Update existing</Button>
          <Button variant="secondary" @click="resolveDuplicate('create')"
            >Create new</Button
          >
          <Button variant="ghost" @click="pendingDuplicate = null"
            >Cancel</Button
          >
        </div>
      </Card>
    </div>
  </section>
</template>
