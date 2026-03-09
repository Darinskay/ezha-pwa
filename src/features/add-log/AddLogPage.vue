<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { TabsContent, TabsIndicator, TabsList, TabsRoot, TabsTrigger } from "radix-vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { watchDebounced } from "@vueuse/core";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Input from "@/components/ui/Input.vue";
import SelectField from "@/components/ui/SelectField.vue";
import Textarea from "@/components/ui/Textarea.vue";
import { clearDraft, enqueueRetry, loadDraft, saveDraft } from "@/db/offline-db";
import {
  buildManualLibraryDraft,
  buildPhotoLibraryDraft,
  resolveDuplicateSaveChoice,
  saveLibraryDraftWithDuplicateCheck,
  suggestedLibraryNameFromInputs,
  type DuplicateSaveChoice,
  type PendingLibraryDuplicate
} from "@/features/add-log/library-save-service";
import {
  applyEditedLabelMacrosToItem,
  buildFoodEntryPayload,
  buildLabelLogItemsFromEstimate,
  buildLogItemFromSavedFood,
  buildLogItemsFromEstimate,
  buildLogItemsFromSavedMeal,
  buildMealIngredientsFromLogItems,
  macrosFromLogItem,
  resolveLogMealAnalyzeInputType,
  totalsFromLogItems,
  type LogMealItem
} from "@/features/add-log/log-meal-service";
import { formatMacro } from "@/lib/macros";
import { parseNumberInput } from "@/lib/number";
import { queryKeys } from "@/query/keys";
import { foodEntryRepository } from "@/repositories/food-entry-repository";
import { savedFoodRepository } from "@/repositories/saved-food-repository";
import { aiAnalysisService } from "@/services/ai-analysis-service";
import { resolveActiveDateForLogging } from "@/services/active-date-service";
import { storageService } from "@/services/storage-service";
import { currentUserId } from "@/lib/supabase";
import type {
  AIItemInput,
  MacroEstimate,
  SavedFoodDraft
} from "@/types/domain";

interface DraftItem {
  id: string;
  name: string;
  gramsText: string;
}

type LogWay = "camera" | "gallery" | "text" | "library";

interface PendingDuplicate extends PendingLibraryDuplicate {
  onResolved?: () => Promise<void>;
}

interface AddLogDraft {
  selectedLogWays: LogWay[];
  selectedPhotoPicker: "camera" | "gallery" | null;
  entryMode: "description" | "list";
  descriptionText: string;
  items: DraftItem[];
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
  librarySearchText: string;
  selectedLibraryFoodId: string;
  libraryFoodQuantityText: string;
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
}

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();

const mode = computed<"log" | "library">(() => (route.query.mode === "library" ? "library" : "log"));
const draftKey = computed(() => `add-log:${mode.value}`);

const selectedLogWays = ref<LogWay[]>([]);
const selectedPhotoPicker = ref<"camera" | "gallery" | null>(null);

const entryMode = ref<"description" | "list">("description");
const descriptionText = ref("");
const items = ref<DraftItem[]>([{ id: crypto.randomUUID(), name: "", gramsText: "" }]);
const logItems = ref<LogMealItem[]>([]);

const cameraFileInput = ref<HTMLInputElement | null>(null);
const galleryFileInput = ref<HTMLInputElement | null>(null);

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
const errorMessage = ref<string | null>(null);
const saveMessage = ref<string | null>(null);

const saveToLibrary = ref(false);
const libraryName = ref("");
const hasUserEditedLibraryName = ref(false);
const pendingDuplicate = ref<PendingDuplicate | null>(null);
const librarySearchText = ref("");
const usedPhotoSource = ref(false);
const usedTextSource = ref(false);
const usedLibrarySource = ref(false);
const usedPhotoMode = ref<"food_photo" | "label_photo" | null>(null);
const latestLabelItemId = ref<string | null>(null);

const selectedLibraryFoodId = ref("");
const libraryFoodQuantityText = ref("100");

const libraryEntryMode = ref<"photo" | "manual">("photo");
const manualUnitType = ref<"per_100g" | "per_serving">("per_100g");
const manualServingSizeText = ref("");
const manualServingUnit = ref("serving");
const manualCaloriesText = ref("");
const manualProteinText = ref("");
const manualCarbsText = ref("");
const manualFatText = ref("");

const isLogWaySelected = (way: LogWay): boolean => selectedLogWays.value.includes(way);
const isTextWaySelected = computed(() => isLogWaySelected("text"));
const isLibraryWaySelected = computed(() => isLogWaySelected("library"));
const isPhotoWaySelected = computed(() => isLogWaySelected("camera") || isLogWaySelected("gallery"));

const savedFoodsQuery = useQuery({
  queryKey: queryKeys.library,
  queryFn: async () => savedFoodRepository.fetchFoods()
});

const allSavedFoods = computed(() => savedFoodsQuery.data.value ?? []);
const filteredLibraryFoods = computed(() => {
  const search = librarySearchText.value.trim().toLowerCase();
  if (!search) return allSavedFoods.value;
  return allSavedFoods.value.filter((food) => food.name.toLowerCase().includes(search));
});

const selectedLibraryFood = computed(() => {
  return allSavedFoods.value.find((food) => food.id === selectedLibraryFoodId.value) ?? null;
});

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
    fat: fat * multiplier
  };
});

const hasTextInput = computed(() => {
  if (!isTextWaySelected.value) {
    return false;
  }
  if (entryMode.value === "list") {
    return items.value.some((item) => item.name.trim() || item.gramsText.trim());
  }
  return !!descriptionText.value.trim();
});

const hasPhotoInput = computed(() => {
  if (!isPhotoWaySelected.value) {
    return false;
  }
  return !!selectedImageFile.value || !!pendingImagePath.value;
});
const hasAnyLogItems = computed(() => buildMealIngredientsFromLogItems(logItems.value).length > 0);
const logTotals = computed(() => totalsFromLogItems(logItems.value));
const canAddSelectedLibraryItem = computed(() => !!selectedLibraryFood.value && !isAnalyzing.value && !isSaving.value);
const labelEditableItem = computed(() =>
  latestLabelItemId.value ? logItems.value.find((item) => item.id === latestLabelItemId.value) ?? null : null
);

const canAnalyze = computed(() => {
  if (isAnalyzing.value) return false;
  if (isSaving.value) return false;
  if (mode.value === "library" && libraryEntryMode.value === "photo") {
    return hasPhotoInput.value;
  }
  return hasTextInput.value || hasPhotoInput.value;
});

const canSaveLog = computed(() => {
  return hasAnyLogItems.value && !isAnalyzing.value && !isSaving.value;
});

const suggestedLibraryName = computed(() =>
  suggestedLibraryNameFromInputs({
    selectedLibraryFoodName: null,
    listItemNames: logItems.value.map((item) => item.name),
    descriptionText: descriptionText.value,
    aiFoodName: estimate.value?.foodName ?? null
  })
);

const suggestedFoodName = (): string => {
  return suggestedLibraryName.value ?? "Meal";
};

const parseMacro = (value: string): number | null => parseNumberInput(value);

const onLibraryNameInput = (nextName: string): void => {
  hasUserEditedLibraryName.value = true;
  libraryName.value = nextName;
};

const analysisInputType = computed(() => {
  if (mode.value === "library") {
    return isLabelPhoto.value ? "label_photo" : "photo";
  }
  return resolveLogMealAnalyzeInputType(hasPhotoInput.value, isLabelPhoto.value);
});

const clearImage = (): void => {
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value);
  }
  selectedImageFile.value = null;
  imagePreviewUrl.value = null;
  pendingEntryId.value = null;
  pendingImagePath.value = null;
  selectedPhotoPicker.value = null;
  isLabelPhoto.value = false;
  labelGramsText.value = "";
  labelBaseEstimate = null;
};

const toggleLogWay = (way: LogWay): void => {
  if (selectedLogWays.value.includes(way)) {
    selectedLogWays.value = selectedLogWays.value.filter((current) => current !== way);
    return;
  }
  selectedLogWays.value = [...selectedLogWays.value, way];
};

const pickFromCamera = (): void => {
  cameraFileInput.value?.click();
};

const pickFromGallery = (): void => {
  galleryFileInput.value?.click();
};

const setEstimate = (nextEstimate: MacroEstimate): void => {
  estimate.value = nextEstimate;
  caloriesText.value = formatMacro(nextEstimate.calories, 2);
  proteinText.value = formatMacro(nextEstimate.protein, 2);
  carbsText.value = formatMacro(nextEstimate.carbs, 2);
  fatText.value = formatMacro(nextEstimate.fat, 2);
};

const setMacroTextFromTotals = (totals: { calories: number; protein: number; carbs: number; fat: number }): void => {
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
      fat: item.fat * multiplier
    }))
  };

  setEstimate(scaled);
};

const validateItemInputs = (requireAtLeastOne: boolean): AIItemInput[] | null => {
  if (entryMode.value !== "list") return [];

  const parsed: AIItemInput[] = [];

  for (const item of items.value) {
    const name = item.name.trim();
    const gramsText = item.gramsText.trim();

    if (!name && !gramsText) continue;
    if (!name) {
      errorMessage.value = "Please enter a food name for each item.";
      return null;
    }

    const grams = parseMacro(gramsText);
    if (!grams || grams <= 0) {
      errorMessage.value = "Please enter grams for each item.";
      return null;
    }

    parsed.push({ name, grams });
  }

  if (requireAtLeastOne && parsed.length === 0) {
    errorMessage.value = "Add at least one food item or attach a photo.";
    return null;
  }

  return parsed;
};

const appendLogItems = (nextItems: LogMealItem[]): void => {
  logItems.value = [...logItems.value, ...nextItems];
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

  const path = await storageService.uploadFoodImage(selectedImageFile.value, userId, entryId);
  pendingImagePath.value = path;
  return path;
};

const addSelectedLibraryFood = async (): Promise<void> => {
  if (!selectedLibraryFood.value) {
    errorMessage.value = "Choose a saved food or meal first.";
    return;
  }

  errorMessage.value = null;
  saveMessage.value = null;

  if (selectedLibraryFood.value.is_meal) {
    try {
      const ingredients = await savedFoodRepository.fetchMealIngredients(selectedLibraryFood.value.id);
      appendLogItems(buildLogItemsFromSavedMeal(ingredients));
      usedLibrarySource.value = true;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "Unable to add meal ingredients.";
    }
    return;
  }

  appendLogItems([buildLogItemFromSavedFood(selectedLibraryFood.value, 100)]);
  usedLibrarySource.value = true;
};

const analyze = async (): Promise<void> => {
  if (isAnalyzing.value || isSaving.value) {
    return;
  }

  saveMessage.value = null;
  errorMessage.value = null;

  isAnalyzing.value = true;
  try {
    const itemInputs =
      mode.value === "log" && isTextWaySelected.value
        ? validateItemInputs(entryMode.value === "list" && !hasPhotoInput.value)
        : [];
    if (!itemInputs) return;

    const imagePath = isPhotoWaySelected.value ? await uploadIfNeeded() : null;
    const text =
      mode.value === "log" && isTextWaySelected.value && entryMode.value === "description"
        ? descriptionText.value.trim()
        : "";

    const nextEstimate = await aiAnalysisService.analyze({
      text: text || undefined,
      items: itemInputs.length ? itemInputs : undefined,
      imagePath: imagePath ?? undefined,
      inputType: analysisInputType.value
    });

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
        const labelItems = buildLabelLogItemsFromEstimate(nextEstimate, grams, suggestedFoodName());
        replaceAiLogItems(labelItems);
        latestLabelItemId.value = labelItems[0]?.id ?? null;
        syncLabelEditorFromItem();
      } else {
        const aiItems = buildLogItemsFromEstimate(nextEstimate, suggestedFoodName());
        replaceAiLogItems(aiItems);
        setMacroTextFromTotals(logTotals.value);
        latestLabelItemId.value = null;
      }

      if (imagePath) {
        usedPhotoSource.value = true;
        usedPhotoMode.value = isLabelPhoto.value ? "label_photo" : "food_photo";
      }
      if (isTextWaySelected.value && (text || itemInputs.length > 0)) {
        usedTextSource.value = true;
      }
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to analyze meal.";
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
    labelGrams: parseMacro(labelGramsText.value)
  });

  if (!result.draft) {
    errorMessage.value = result.error;
    return null;
  }

  return result.draft;
};

const saveLibraryDraft = async (draft: SavedFoodDraft): Promise<boolean> => {
  const result = await saveLibraryDraftWithDuplicateCheck(savedFoodRepository, draft);
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

const finishAndExit = async (nextRouteName: "today" | "library"): Promise<void> => {
  await clearDraft(draftKey.value);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.today }),
    queryClient.invalidateQueries({ queryKey: queryKeys.history }),
    queryClient.invalidateQueries({ queryKey: queryKeys.library }),
    queryClient.invalidateQueries({ queryKey: queryKeys.suggestionsContext }),
    queryClient.invalidateQueries({ queryKey: queryKeys.settingsTargets })
  ]);

  await router.replace({ name: nextRouteName });
};

const saveLogEntry = async (): Promise<void> => {
  if (isAnalyzing.value || isSaving.value) {
    return;
  }

  if (!canSaveLog.value) {
    errorMessage.value = "Add at least one item before saving.";
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
    const imagePath = hasPhotoInput.value ? (await uploadIfNeeded()) ?? null : null;
    const activeDate = await resolveActiveDateForLogging(userId);

    const hasLibraryItems = logItems.value.some(
      (item) => item.origin === "library_food" || item.origin === "library_meal"
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
        usedText: usedTextSource.value || (hasAiItems && !usedPhotoSource.value),
        usedLibrary: hasLibraryItems
      },
      isLabelPhoto: usedPhotoMode.value === "label_photo"
    });

    if (entryItems.length === 0) {
      errorMessage.value = "Add at least one valid item with grams.";
      return;
    }

    try {
      await foodEntryRepository.insertFoodEntry(entry, entryItems);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save entry";
      if (!navigator.onLine || message.toLowerCase().includes("network") || message.toLowerCase().includes("fetch")) {
        await enqueueRetry("create_food_entry", { entry, items: entryItems });
      } else {
        throw error;
      }
    }

    if (saveToLibrary.value) {
      await savedFoodRepository.insertMeal(
        libraryName.value.trim(),
        buildMealIngredientsFromLogItems(logItems.value)
      );
    }

    await finishAndExit("today");
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to save entry.";
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
      servingSizeGrams: manualUnitType.value === "per_serving" ? parseMacro(manualServingSizeText.value) : null,
      servingUnit: manualServingUnit.value,
      caloriesPer100g: parseMacro(manualCaloriesText.value),
      proteinPer100g: parseMacro(manualProteinText.value),
      carbsPer100g: parseMacro(manualCarbsText.value),
      fatPer100g: parseMacro(manualFatText.value)
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
    errorMessage.value = error instanceof Error ? error.message : "Unable to save to library.";
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
    errorMessage.value = error instanceof Error ? error.message : "Unable to save to library.";
  } finally {
    isSaving.value = false;
  }
};

const onFilePicked = (event: Event, source: "camera" | "gallery" | null = null): void => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0] ?? null;
  if (!file) return;

  clearImage();
  selectedPhotoPicker.value = source;
  selectedImageFile.value = file;
  imagePreviewUrl.value = URL.createObjectURL(file);
};

const addItemRow = (): void => {
  items.value.push({ id: crypto.randomUUID(), name: "", gramsText: "" });
};

const removeItemRow = (id: string): void => {
  items.value = items.value.filter((item) => item.id !== id);
  if (items.value.length === 0) {
    items.value = [{ id: crypto.randomUUID(), name: "", gramsText: "" }];
  }
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
      ? applyEditedLabelMacrosToItem(item, { calories, protein, carbs, fat }, grams)
      : item
  );
  errorMessage.value = null;
  syncLabelEditorFromItem();
};

const hydrateFromDraft = async (): Promise<void> => {
  const draft = await loadDraft<AddLogDraft>(draftKey.value);
  if (!draft) {
    selectedLogWays.value = [];
    selectedPhotoPicker.value = null;
    entryMode.value = "description";
    descriptionText.value = "";
    items.value = [{ id: crypto.randomUUID(), name: "", gramsText: "" }];
    logItems.value = [];
    isLabelPhoto.value = false;
    labelGramsText.value = "";
    caloriesText.value = "";
    proteinText.value = "";
    carbsText.value = "";
    fatText.value = "";
    saveToLibrary.value = false;
    libraryName.value = "";
    hasUserEditedLibraryName.value = false;
    librarySearchText.value = "";
    selectedLibraryFoodId.value = "";
    libraryFoodQuantityText.value = "100";
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
    return;
  }

  selectedLogWays.value = draft.selectedLogWays ?? [];
  selectedPhotoPicker.value = draft.selectedPhotoPicker ?? null;
  entryMode.value = draft.entryMode;
  descriptionText.value = draft.descriptionText;
  items.value = draft.items.length ? draft.items : [{ id: crypto.randomUUID(), name: "", gramsText: "" }];
  logItems.value = draft.logItems ?? [];
  isLabelPhoto.value = draft.isLabelPhoto;
  labelGramsText.value = draft.labelGramsText;
  caloriesText.value = draft.caloriesText;
  proteinText.value = draft.proteinText;
  carbsText.value = draft.carbsText;
  fatText.value = draft.fatText;
  saveToLibrary.value = draft.saveToLibrary;
  libraryName.value = draft.libraryName;
  hasUserEditedLibraryName.value = draft.hasUserEditedLibraryName ?? false;
  librarySearchText.value = draft.librarySearchText ?? "";
  selectedLibraryFoodId.value = draft.selectedLibraryFoodId;
  libraryFoodQuantityText.value = draft.libraryFoodQuantityText || "100";
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

const persistDraft = async (): Promise<void> => {
  const draft: AddLogDraft = {
    selectedLogWays: selectedLogWays.value,
    selectedPhotoPicker: selectedPhotoPicker.value,
    entryMode: entryMode.value,
    descriptionText: descriptionText.value,
    items: items.value,
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
    librarySearchText: librarySearchText.value,
    selectedLibraryFoodId: selectedLibraryFoodId.value,
    libraryFoodQuantityText: libraryFoodQuantityText.value,
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
    manualFatText: manualFatText.value
  };

  await saveDraft(draftKey.value, draft);
};

watch(
  mode,
  async () => {
    await hydrateFromDraft();
  },
  { immediate: true }
);

watchDebounced(
  [
    selectedLogWays,
    selectedPhotoPicker,
    entryMode,
    descriptionText,
    items,
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
    librarySearchText,
    selectedLibraryFoodId,
    libraryFoodQuantityText,
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
    manualFatText
  ],
  () => {
    void persistDraft();
  },
  { debounce: 400, maxWait: 1200, deep: true }
);

watch(
  mode,
  () => {
    errorMessage.value = null;
    saveMessage.value = null;
  },
  { immediate: true }
);

watch(
  suggestedLibraryName,
  (nextSuggestedName) => {
    if (hasUserEditedLibraryName.value) return;
    libraryName.value = nextSuggestedName ?? "";
  },
  { immediate: true }
);

watch(
  [isLabelPhoto, labelGramsText],
  () => {
    applyLabelScaling();
    if (!isLabelPhoto.value || !labelEditableItem.value) return;
    const grams = parseMacro(labelGramsText.value);
    if (!grams || grams <= 0) return;

    logItems.value = logItems.value.map((item) =>
      item.id === labelEditableItem.value?.id ? { ...item, gramsText: formatMacro(grams, 1) } : item
    );
    syncLabelEditorFromItem();
  }
);

watch(
  () => selectedLibraryFoodId.value,
  () => {
    libraryFoodQuantityText.value = "100";
  }
);

watch(
  [mode, logTotals, latestLabelItemId],
  () => {
    if (mode.value !== "log") return;
    if (labelEditableItem.value && isLabelPhoto.value) {
      return;
    }
    setMacroTextFromTotals(logTotals.value);
  },
  { immediate: true, deep: true }
);

onMounted(() => {
  void savedFoodsQuery.refetch();
});

onUnmounted(() => {
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value);
  }
});
</script>

<template>
  <section class="app-page">
    <header class="flex items-start justify-between gap-3">
      <div class="page-header">
        <h1 class="page-title">
          {{ mode === "log" ? "Add Log" : "Add Food" }}
        </h1>
        <p class="page-subtitle">
          {{ mode === "log" ? "Log with AI, photo, or saved library items." : "Save foods to your library." }}
        </p>
      </div>
      <Button variant="ghost" size="sm" @click="router.back()">Close</Button>
    </header>

    <Card v-if="mode === 'log'" class="glass space-y-4 p-4 sm:p-5">
      <div class="space-y-2">
        <p class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Choose how to log</p>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button
            size="sm"
            :variant="isLogWaySelected('camera') ? 'default' : 'outline'"
            @click="toggleLogWay('camera')"
          >
            Camera
          </Button>
          <Button
            size="sm"
            :variant="isLogWaySelected('gallery') ? 'default' : 'outline'"
            @click="toggleLogWay('gallery')"
          >
            Gallery
          </Button>
          <Button
            size="sm"
            :variant="isLogWaySelected('text') ? 'default' : 'outline'"
            @click="toggleLogWay('text')"
          >
            Text
          </Button>
          <Button
            size="sm"
            :variant="isLogWaySelected('library') ? 'default' : 'outline'"
            @click="toggleLogWay('library')"
          >
            Library
          </Button>
        </div>
      </div>
    </Card>

    <Card v-if="mode === 'log' && isLibraryWaySelected" class="glass space-y-4 p-4 sm:p-5">
      <div class="space-y-2">
        <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Library search</label>
        <Input v-model="librarySearchText" placeholder="Search saved foods and meals" />
      </div>

      <div class="space-y-2">
        <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Quick library pick</label>
        <SelectField v-model="selectedLibraryFoodId">
          <option value="">Choose a saved food or meal...</option>
          <option v-for="food in filteredLibraryFoods" :key="food.id" :value="food.id">
            {{ food.name }}{{ food.is_meal ? " (meal)" : "" }}
          </option>
        </SelectField>
      </div>

      <div v-if="selectedLibraryFood" class="space-y-2 rounded-2xl border border-border/70 bg-background/80 p-3">
        <p class="text-sm font-semibold">Selected: {{ selectedLibraryFood.name }}</p>
        <Input
          v-if="!selectedLibraryFood.is_meal"
          v-model="libraryFoodQuantityText"
          type="number"
          min="0"
          step="0.1"
          placeholder="Grams (default 100)"
        />
        <p v-else class="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          This saved meal adds all ingredients as separate log items.
        </p>
        <Button size="sm" :disabled="!canAddSelectedLibraryItem" @click="addSelectedLibraryFood">Add to log</Button>
      </div>
    </Card>

    <Card v-if="mode === 'library'" class="space-y-4 p-4 sm:p-5">
      <TabsRoot v-model="libraryEntryMode">
        <TabsList class="inline-flex rounded-xl border border-border/70 bg-muted/70 p-1">
          <TabsTrigger
            value="photo"
            class="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-card data-[state=active]:text-foreground"
          >
            Photo
          </TabsTrigger>
          <TabsTrigger
            value="manual"
            class="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-card data-[state=active]:text-foreground"
          >
            Manual
          </TabsTrigger>
        </TabsList>
        <TabsIndicator class="h-[2px] bg-primary transition-all" />

        <TabsContent value="manual" class="mt-4 space-y-3">
          <div class="space-y-1">
            <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Food name</label>
            <Input :model-value="libraryName" placeholder="e.g. Apple" @update:modelValue="onLibraryNameInput" />
          </div>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div class="space-y-1">
              <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Unit type</label>
              <SelectField v-model="manualUnitType">
                <option value="per_100g">Per 100g</option>
                <option value="per_serving">Per serving</option>
              </SelectField>
            </div>

            <template v-if="manualUnitType === 'per_serving'">
              <div class="space-y-1">
                <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Serving grams</label>
                <Input v-model="manualServingSizeText" type="number" min="0" step="0.1" />
              </div>
              <div class="space-y-1">
                <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Serving unit</label>
                <Input v-model="manualServingUnit" />
              </div>
            </template>
          </div>

          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div class="space-y-1">
              <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Calories</label>
              <Input v-model="manualCaloriesText" type="number" min="0" step="0.1" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Protein</label>
              <Input v-model="manualProteinText" type="number" min="0" step="0.1" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Carbs</label>
              <Input v-model="manualCarbsText" type="number" min="0" step="0.1" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Fat</label>
              <Input v-model="manualFatText" type="number" min="0" step="0.1" />
            </div>
          </div>

          <p
            v-if="manualPerServingPreview && manualUnitType === 'per_serving'"
            class="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          >
            Per serving: {{ formatMacro(manualPerServingPreview.calories, 1) }} kcal ·
            P{{ formatMacro(manualPerServingPreview.protein, 1) }} ·
            C{{ formatMacro(manualPerServingPreview.carbs, 1) }} ·
            F{{ formatMacro(manualPerServingPreview.fat, 1) }}
          </p>

          <Button class="w-full sm:w-auto" :loading="isSaving" @click="saveManualLibrary">Save to Library</Button>
        </TabsContent>
      </TabsRoot>
    </Card>

    <Card v-if="mode === 'log' ? isTextWaySelected || isPhotoWaySelected : libraryEntryMode === 'photo'" class="space-y-4 p-4 sm:p-5">
      <TabsRoot v-if="mode === 'log' && isTextWaySelected" v-model="entryMode">
        <TabsList class="inline-flex rounded-xl border border-border/70 bg-muted/70 p-1">
          <TabsTrigger
            value="description"
            class="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-card data-[state=active]:text-foreground"
          >
            Description
          </TabsTrigger>
          <TabsTrigger
            value="list"
            class="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-card data-[state=active]:text-foreground"
          >
            List
          </TabsTrigger>
        </TabsList>

        <TabsContent value="description" class="mt-4">
          <Textarea
            v-model="descriptionText"
            :rows="4"
            placeholder="Describe your meal. Example: chicken with rice, 250g"
          />
        </TabsContent>

        <TabsContent value="list" class="mt-4 space-y-2">
          <article v-for="item in items" :key="item.id" class="grid grid-cols-12 gap-2 rounded-xl border border-border/70 bg-background/80 p-2">
            <Input v-model="item.name" class="col-span-7" placeholder="Food name" />
            <Input v-model="item.gramsText" class="col-span-4" type="number" min="0" step="0.1" placeholder="Grams (g)" />
            <Button variant="ghost" class="col-span-1 px-0" @click="removeItemRow(item.id)">×</Button>
          </article>
          <Button size="sm" variant="secondary" @click="addItemRow">Add item</Button>
        </TabsContent>
      </TabsRoot>

      <div v-if="mode === 'library' || isPhotoWaySelected" class="space-y-2">
        <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Photo (optional)</label>
        <template v-if="mode === 'log'">
          <div class="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              :disabled="!isLogWaySelected('camera')"
              @click="pickFromCamera"
            >
              Open Camera
            </Button>
            <Button
              size="sm"
              variant="secondary"
              :disabled="!isLogWaySelected('gallery')"
              @click="pickFromGallery"
            >
              Open Gallery
            </Button>
          </div>
          <input
            ref="cameraFileInput"
            type="file"
            accept="image/*"
            capture="environment"
            class="hidden"
            @change="(event) => onFilePicked(event, 'camera')"
          />
          <input
            ref="galleryFileInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="(event) => onFilePicked(event, 'gallery')"
          />
          <p v-if="selectedPhotoPicker" class="text-xs text-muted-foreground">
            Selected source: {{ selectedPhotoPicker === "camera" ? "Camera" : "Gallery" }}
          </p>
        </template>
        <input
          v-else
          type="file"
          accept="image/*"
          class="block w-full rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground"
          @change="onFilePicked"
        />
        <img
          v-if="imagePreviewUrl"
          :src="imagePreviewUrl"
          alt="Selected meal photo"
          class="max-h-56 w-full rounded-xl border border-border/80 object-cover"
        />
        <div class="flex flex-wrap items-center gap-2">
          <Button v-if="imagePreviewUrl" size="sm" variant="ghost" @click="clearImage">Remove photo</Button>
          <label v-if="imagePreviewUrl" class="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input v-model="isLabelPhoto" type="checkbox" class="size-4 rounded border-border accent-primary" />
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
        v-if="mode === 'library' || isTextWaySelected || isPhotoWaySelected"
        class="w-full sm:w-auto"
        :loading="isAnalyzing"
        :disabled="!canAnalyze"
        @click="analyze"
      >
        Analyze
      </Button>
    </Card>

    <Card v-if="mode === 'library' ? !!estimate : hasAnyLogItems" class="space-y-4 p-4 sm:p-5">
      <div v-if="mode === 'library'" class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div class="space-y-1">
          <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Calories</label>
          <Input v-model="caloriesText" type="number" min="0" step="0.1" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Protein</label>
          <Input v-model="proteinText" type="number" min="0" step="0.1" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Carbs</label>
          <Input v-model="carbsText" type="number" min="0" step="0.1" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Fat</label>
          <Input v-model="fatText" type="number" min="0" step="0.1" />
        </div>
      </div>

      <template v-if="mode === 'log'">
        <article
          v-for="item in logItems"
          :key="item.id"
          class="space-y-2 rounded-2xl border border-border/70 bg-card/70 p-3"
        >
          <div class="flex items-start justify-between gap-2">
            <h4 class="text-sm font-semibold">{{ item.name }}</h4>
            <Button variant="ghost" size="sm" @click="removeLogItem(item.id)">Remove</Button>
          </div>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div class="space-y-1">
              <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Grams (g)</label>
              <Input v-model="item.gramsText" type="number" min="0" step="0.1" placeholder="Grams (g)" />
            </div>
            <p class="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {{ formatMacro(macrosFromLogItem(item).calories, 1) }} kcal ·
              P{{ formatMacro(macrosFromLogItem(item).protein, 1) }} ·
              C{{ formatMacro(macrosFromLogItem(item).carbs, 1) }} ·
              F{{ formatMacro(macrosFromLogItem(item).fat, 1) }}
            </p>
          </div>
        </article>

        <div class="rounded-xl border border-border/70 bg-muted/40 p-3 text-sm">
          Total: {{ formatMacro(logTotals.calories, 1) }} kcal ·
          P{{ formatMacro(logTotals.protein, 1) }}g ·
          C{{ formatMacro(logTotals.carbs, 1) }}g ·
          F{{ formatMacro(logTotals.fat, 1) }}g
        </div>

        <div v-if="labelEditableItem" class="space-y-2">
          <p class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Label macro overrides</p>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Input v-model="caloriesText" type="number" min="0" step="0.1" placeholder="Calories" />
            <Input v-model="proteinText" type="number" min="0" step="0.1" placeholder="Protein" />
            <Input v-model="carbsText" type="number" min="0" step="0.1" placeholder="Carbs" />
            <Input v-model="fatText" type="number" min="0" step="0.1" placeholder="Fat" />
          </div>
          <Button size="sm" variant="secondary" @click="applyLabelMacroEdits">Apply label macros</Button>
        </div>

        <div class="space-y-2">
          <label class="inline-flex items-center gap-2 text-sm">
            <input v-model="saveToLibrary" type="checkbox" class="size-4 rounded border-border accent-primary" />
            Save as meal to Library after logging
          </label>
          <Input
            v-if="saveToLibrary"
            :model-value="libraryName"
            placeholder="Meal name"
            @update:modelValue="onLibraryNameInput"
          />
        </div>

        <Button class="w-full sm:w-auto" :loading="isSaving" :disabled="!canSaveLog" @click="saveLogEntry">
          Save log
        </Button>
      </template>

      <div v-if="mode === 'library'" class="space-y-2">
        <Input :model-value="libraryName" placeholder="Food name for library" @update:modelValue="onLibraryNameInput" />
        <Button class="w-full sm:w-auto" :loading="isSaving" @click="saveLibraryFromEstimate">Save to Library</Button>
      </div>
    </Card>

    <p v-if="errorMessage" class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{{ errorMessage }}</p>
    <p v-if="saveMessage" class="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">{{ saveMessage }}</p>

    <div v-if="pendingDuplicate" class="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
      <Card class="w-full max-w-md space-y-4 border-border/80 bg-card/96 p-4 sm:p-5">
        <h3 class="text-lg font-semibold">Food already exists</h3>
        <p class="text-sm text-muted-foreground">
          "{{ pendingDuplicate.existing.name }}" is already in your Library.
        </p>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button @click="resolveDuplicate('update')">Update existing</Button>
          <Button variant="secondary" @click="resolveDuplicate('create')">Create new</Button>
          <Button variant="ghost" @click="pendingDuplicate = null">Cancel</Button>
        </div>
      </Card>
    </div>
  </section>
</template>
