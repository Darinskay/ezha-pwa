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
import { formatMacro, savedFoodMacrosForQuantity } from "@/lib/macros";
import { parseNumberInput } from "@/lib/number";
import { queryKeys } from "@/query/keys";
import { dailyTargetRepository } from "@/repositories/daily-target-repository";
import { foodEntryRepository } from "@/repositories/food-entry-repository";
import { profileRepository } from "@/repositories/profile-repository";
import { savedFoodRepository } from "@/repositories/saved-food-repository";
import { aiAnalysisService } from "@/services/ai-analysis-service";
import { defaultProfileForUser } from "@/services/profile-bootstrap";
import { storageService } from "@/services/storage-service";
import { currentUserId } from "@/lib/supabase";
import type {
  AIItemInput,
  FoodEntry,
  FoodEntryItem,
  MacroEstimate,
  SavedFoodDraft
} from "@/types/domain";

interface DraftItem {
  id: string;
  name: string;
  gramsText: string;
}

interface PendingDuplicate extends PendingLibraryDuplicate {
  onResolved?: () => Promise<void>;
}

interface AddLogDraft {
  entryMode: "description" | "list";
  descriptionText: string;
  items: DraftItem[];
  isLabelPhoto: boolean;
  labelGramsText: string;
  caloriesText: string;
  proteinText: string;
  carbsText: string;
  fatText: string;
  saveToLibrary: boolean;
  libraryName: string;
  hasUserEditedLibraryName: boolean;
  selectedLibraryFoodId: string;
  libraryFoodQuantityText: string;
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

const entryMode = ref<"description" | "list">("description");
const descriptionText = ref("");
const items = ref<DraftItem[]>([{ id: crypto.randomUUID(), name: "", gramsText: "" }]);

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

const selectedLibraryFoodId = ref("");
const libraryFoodQuantityText = ref("");

const libraryEntryMode = ref<"photo" | "manual">("photo");
const manualUnitType = ref<"per_100g" | "per_serving">("per_100g");
const manualServingSizeText = ref("");
const manualServingUnit = ref("serving");
const manualCaloriesText = ref("");
const manualProteinText = ref("");
const manualCarbsText = ref("");
const manualFatText = ref("");

const savedFoodsQuery = useQuery({
  queryKey: queryKeys.library,
  queryFn: async () => savedFoodRepository.fetchFoods()
});

const selectedLibraryFood = computed(() => {
  return (savedFoodsQuery.data.value ?? []).find((food) => food.id === selectedLibraryFoodId.value) ?? null;
});

const libraryCalculatedMacros = computed(() => {
  if (!selectedLibraryFood.value) return null;
  const quantity = parseNumberInput(libraryFoodQuantityText.value);
  if (!quantity || quantity <= 0) return null;
  return savedFoodMacrosForQuantity(selectedLibraryFood.value, quantity);
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
  if (entryMode.value === "list") {
    return items.value.some((item) => item.name.trim() || item.gramsText.trim());
  }
  return !!descriptionText.value.trim();
});

const hasPhotoInput = computed(() => !!selectedImageFile.value || !!pendingImagePath.value);

const canAnalyze = computed(() => {
  if (selectedLibraryFood.value) return false;
  if (isAnalyzing.value) return false;
  if (mode.value === "library" && libraryEntryMode.value === "photo") {
    return hasPhotoInput.value;
  }
  return hasTextInput.value || hasPhotoInput.value;
});

const canSaveLog = computed(() => {
  if (selectedLibraryFood.value) {
    return !!libraryCalculatedMacros.value;
  }
  return !!estimate.value || (!!caloriesText.value && !!proteinText.value && !!carbsText.value && !!fatText.value);
});

const suggestedLibraryName = computed(() =>
  suggestedLibraryNameFromInputs({
    selectedLibraryFoodName: selectedLibraryFood.value?.name ?? null,
    listItemNames: items.value.map((item) => item.name),
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

const resolvedInputType = computed<"photo" | "text" | "photo+text">(() => {
  if (hasPhotoInput.value && hasTextInput.value) return "photo+text";
  if (hasPhotoInput.value) return "photo";
  return "text";
});

const analysisInputType = computed(() => {
  if (isLabelPhoto.value && hasPhotoInput.value) {
    return "label_photo";
  }
  return resolvedInputType.value;
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
  labelGramsText.value = "";
  labelBaseEstimate = null;
};

const setEstimate = (nextEstimate: MacroEstimate): void => {
  estimate.value = nextEstimate;
  caloriesText.value = formatMacro(nextEstimate.calories, 2);
  proteinText.value = formatMacro(nextEstimate.protein, 2);
  carbsText.value = formatMacro(nextEstimate.carbs, 2);
  fatText.value = formatMacro(nextEstimate.fat, 2);
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

watch([isLabelPhoto, labelGramsText], () => {
  applyLabelScaling();
});

const resolvedActiveDate = async (userId: string): Promise<string> => {
  const profile = await profileRepository.fetchProfile();
  if (profile?.active_date) {
    return profile.active_date;
  }

  const fallback = defaultProfileForUser(userId);
  await profileRepository.ensureProfileRowExists(fallback);

  const targets = await dailyTargetRepository.ensureTargets(fallback);
  if (targets[0]) {
    await profileRepository.updateActiveTarget(targets[0].id);
  }

  return fallback.active_date;
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

const buildEntryItems = (
  entryId: string,
  userId: string,
  itemInputs: AIItemInput[],
  nextEstimate: MacroEstimate
): FoodEntryItem[] | null => {
  if (itemInputs.length > 0) {
    if (!nextEstimate.items.length) {
      errorMessage.value = "Please run analysis to estimate each item.";
      return null;
    }

    if (nextEstimate.items.length !== itemInputs.length) {
      errorMessage.value = "AI returned a different number of items. Please try again.";
      return null;
    }

    return itemInputs.map((input, index) => {
      const result = nextEstimate.items[index];
      return {
        id: crypto.randomUUID(),
        entry_id: entryId,
        user_id: userId,
        name: input.name,
        grams: input.grams,
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        ai_confidence: result.confidence ?? null,
        ai_notes: result.notes ?? "",
        created_at: null
      } satisfies FoodEntryItem;
    });
  }

  return nextEstimate.items.map((item) => ({
    id: crypto.randomUUID(),
    entry_id: entryId,
    user_id: userId,
    name: item.name,
    grams: item.grams,
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    ai_confidence: item.confidence ?? null,
    ai_notes: item.notes ?? "",
    created_at: null
  }));
};

const analyze = async (): Promise<void> => {
  saveMessage.value = null;
  errorMessage.value = null;

  if (selectedLibraryFood.value) {
    const macros = libraryCalculatedMacros.value;
    if (!macros) {
      errorMessage.value = "Please enter a valid quantity.";
      return;
    }

    const nextEstimate: MacroEstimate = {
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      confidence: null,
      source: "library",
      foodName: selectedLibraryFood.value.name,
      notes: "Saved foods",
      items: []
    };

    setEstimate(nextEstimate);
    return;
  }

  isAnalyzing.value = true;
  try {
    const itemInputs = validateItemInputs(entryMode.value === "list" && !hasPhotoInput.value);
    if (!itemInputs) return;

    const imagePath = await uploadIfNeeded();
    const text = entryMode.value === "description" ? descriptionText.value.trim() : "";

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
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Analysis failed.";
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
  if (!canSaveLog.value) {
    errorMessage.value = "Please enter valid macros.";
    return;
  }

  isSaving.value = true;
  errorMessage.value = null;
  saveMessage.value = null;

  try {
    if (selectedLibraryFood.value && libraryCalculatedMacros.value) {
      const userId = await currentUserId();
      const activeDate = await resolvedActiveDate(userId);

      const entry: FoodEntry = {
        id: crypto.randomUUID(),
        user_id: userId,
        date: activeDate,
        input_type: "text",
        input_text: selectedLibraryFood.value.name,
        image_path: null,
        calories: libraryCalculatedMacros.value.calories,
        protein: libraryCalculatedMacros.value.protein,
        carbs: libraryCalculatedMacros.value.carbs,
        fat: libraryCalculatedMacros.value.fat,
        ai_confidence: null,
        ai_source: "library",
        ai_notes: "From saved library",
        created_at: null
      };

      await foodEntryRepository.insertFoodEntry(entry, []);
      await finishAndExit("today");
      return;
    }

    const calories = parseMacro(caloriesText.value);
    const protein = parseMacro(proteinText.value);
    const carbs = parseMacro(carbsText.value);
    const fat = parseMacro(fatText.value);

    const activeEstimate = estimate.value ?? {
      calories: calories ?? 0,
      protein: protein ?? 0,
      carbs: carbs ?? 0,
      fat: fat ?? 0,
      confidence: null,
      source: "manual",
      foodName: null,
      notes: "Manual entry",
      items: []
    };

    if (calories == null || protein == null || carbs == null || fat == null) {
      errorMessage.value = "Please enter valid macros.";
      return;
    }

    const userId = await currentUserId();
    const entryId = pendingEntryId.value ?? crypto.randomUUID();
    pendingEntryId.value = entryId;

    const imagePath = (await uploadIfNeeded()) ?? null;
    const activeDate = await resolvedActiveDate(userId);

    const itemInputs = validateItemInputs(entryMode.value === "list" && !imagePath);
    if (!itemInputs) return;

    const entryItems = buildEntryItems(entryId, userId, itemInputs, activeEstimate);
    if (!entryItems) return;

    const entry: FoodEntry = {
      id: entryId,
      user_id: userId,
      date: activeDate,
      input_type: resolvedInputType.value,
      input_text: suggestedFoodName(),
      image_path: imagePath,
      calories,
      protein,
      carbs,
      fat,
      ai_confidence: activeEstimate.confidence ?? null,
      ai_source: (activeEstimate.source as FoodEntry["ai_source"]) || "unknown",
      ai_notes: activeEstimate.notes,
      created_at: null
    };

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

    // Keep iOS parity: persist log entry first, then attempt optional library save.
    if (saveToLibrary.value) {
      const draft = buildLibraryDraft(libraryName.value || suggestedFoodName());
      if (draft) {
        const didSave = await saveLibraryDraft(draft);
        if (!didSave && pendingDuplicate.value) {
          pendingDuplicate.value.onResolved = async () => {
            await finishAndExit("today");
          };
          saveMessage.value = "Entry saved. Choose how to handle duplicate library item.";
          return;
        }
      }
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

const parseQuickText = (value: string): { name: string; grams: number } | null => {
  const text = value.trim();
  if (!text) return null;

  const patterns: Array<{ pattern: RegExp; nameIndex: number; gramsIndex: number }> = [
    { pattern: /^(.+?)\s+(\d+(?:\.\d+)?)\s*g?$/i, nameIndex: 1, gramsIndex: 2 },
    { pattern: /^(\d+(?:\.\d+)?)\s*g?\s+(.+)$/i, nameIndex: 2, gramsIndex: 1 }
  ];

  for (const candidate of patterns) {
    const match = text.match(candidate.pattern);
    if (!match) continue;

    const name = match[candidate.nameIndex]?.trim();
    const grams = Number(match[candidate.gramsIndex]);
    if (!name || !Number.isFinite(grams) || grams <= 0) continue;

    return { name, grams };
  }

  return null;
};

const applyDescriptionToInputs = (): void => {
  if (!descriptionText.value.trim()) return;
  const parsed = parseQuickText(descriptionText.value);
  if (parsed) {
    entryMode.value = "list";
    items.value = [{ id: crypto.randomUUID(), name: parsed.name, gramsText: formatMacro(parsed.grams, 1) }];
    descriptionText.value = "";
  }
};

const onFilePicked = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0] ?? null;
  if (!file) return;

  clearImage();
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

const hydrateFromDraft = async (): Promise<void> => {
  const draft = await loadDraft<AddLogDraft>(draftKey.value);
  if (!draft) {
    hasUserEditedLibraryName.value = false;
    return;
  }

  entryMode.value = draft.entryMode;
  descriptionText.value = draft.descriptionText;
  items.value = draft.items.length ? draft.items : [{ id: crypto.randomUUID(), name: "", gramsText: "" }];
  isLabelPhoto.value = draft.isLabelPhoto;
  labelGramsText.value = draft.labelGramsText;
  caloriesText.value = draft.caloriesText;
  proteinText.value = draft.proteinText;
  carbsText.value = draft.carbsText;
  fatText.value = draft.fatText;
  saveToLibrary.value = draft.saveToLibrary;
  libraryName.value = draft.libraryName;
  hasUserEditedLibraryName.value = draft.hasUserEditedLibraryName ?? false;
  selectedLibraryFoodId.value = draft.selectedLibraryFoodId;
  libraryFoodQuantityText.value = draft.libraryFoodQuantityText;
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
    entryMode: entryMode.value,
    descriptionText: descriptionText.value,
    items: items.value,
    isLabelPhoto: isLabelPhoto.value,
    labelGramsText: labelGramsText.value,
    caloriesText: caloriesText.value,
    proteinText: proteinText.value,
    carbsText: carbsText.value,
    fatText: fatText.value,
    saveToLibrary: saveToLibrary.value,
    libraryName: libraryName.value,
    hasUserEditedLibraryName: hasUserEditedLibraryName.value,
    selectedLibraryFoodId: selectedLibraryFoodId.value,
    libraryFoodQuantityText: libraryFoodQuantityText.value,
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
    entryMode,
    descriptionText,
    items,
    isLabelPhoto,
    labelGramsText,
    caloriesText,
    proteinText,
    carbsText,
    fatText,
    saveToLibrary,
    libraryName,
    hasUserEditedLibraryName,
    selectedLibraryFoodId,
    libraryFoodQuantityText,
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
  () => selectedLibraryFoodId.value,
  () => {
    if (selectedLibraryFood.value) {
      entryMode.value = "description";
      descriptionText.value = "";
      items.value = [{ id: crypto.randomUUID(), name: "", gramsText: "" }];
      estimate.value = null;
      errorMessage.value = null;
    }
  }
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
        <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Quick library pick</label>
        <SelectField v-model="selectedLibraryFoodId">
          <option value="">Choose a saved food...</option>
          <option v-for="food in savedFoodsQuery.data.value ?? []" :key="food.id" :value="food.id">
            {{ food.name }}{{ food.is_meal ? " (meal)" : "" }}
          </option>
        </SelectField>
      </div>

      <div v-if="selectedLibraryFood" class="space-y-2 rounded-2xl border border-border/70 bg-background/80 p-3">
        <p class="text-sm font-semibold">Selected: {{ selectedLibraryFood.name }}</p>
        <Input v-model="libraryFoodQuantityText" type="number" min="0" step="0.1" placeholder="Grams" />
        <p v-if="libraryCalculatedMacros" class="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {{ formatMacro(libraryCalculatedMacros.calories, 1) }} kcal ·
          P{{ formatMacro(libraryCalculatedMacros.protein, 1) }} ·
          C{{ formatMacro(libraryCalculatedMacros.carbs, 1) }} ·
          F{{ formatMacro(libraryCalculatedMacros.fat, 1) }}
        </p>
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

    <Card v-if="!selectedLibraryFood && (mode === 'log' || libraryEntryMode === 'photo')" class="space-y-4 p-4 sm:p-5">
      <TabsRoot v-if="mode === 'log'" v-model="entryMode">
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
          <div class="mt-2">
            <Button size="sm" variant="secondary" @click="applyDescriptionToInputs">Parse grams to list</Button>
          </div>
        </TabsContent>

        <TabsContent value="list" class="mt-4 space-y-2">
          <article v-for="item in items" :key="item.id" class="grid grid-cols-12 gap-2 rounded-xl border border-border/70 bg-background/80 p-2">
            <Input v-model="item.name" class="col-span-7" placeholder="Food name" />
            <Input v-model="item.gramsText" class="col-span-4" type="number" min="0" step="0.1" placeholder="g" />
            <Button variant="ghost" class="col-span-1 px-0" @click="removeItemRow(item.id)">×</Button>
          </article>
          <Button size="sm" variant="secondary" @click="addItemRow">Add item</Button>
        </TabsContent>
      </TabsRoot>

      <div class="space-y-2">
        <label class="text-xs font-medium uppercase tracking-[0.03em] text-muted-foreground">Photo (optional)</label>
        <input
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

      <Button class="w-full sm:w-auto" :loading="isAnalyzing" :disabled="!canAnalyze" @click="analyze">Analyze</Button>
    </Card>

    <Card v-if="estimate || selectedLibraryFood" class="space-y-4 p-4 sm:p-5">
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

      <div v-else class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Input v-model="caloriesText" type="number" min="0" step="0.1" placeholder="Calories" />
        <Input v-model="proteinText" type="number" min="0" step="0.1" placeholder="Protein" />
        <Input v-model="carbsText" type="number" min="0" step="0.1" placeholder="Carbs" />
        <Input v-model="fatText" type="number" min="0" step="0.1" placeholder="Fat" />
      </div>

      <div v-if="mode === 'log'" class="space-y-2">
        <label class="inline-flex items-center gap-2 text-sm">
          <input v-model="saveToLibrary" type="checkbox" class="size-4 rounded border-border accent-primary" />
          Save to library after logging
        </label>
        <Input
          v-if="saveToLibrary"
          :model-value="libraryName"
          placeholder="Library food name"
          @update:modelValue="onLibraryNameInput"
        />
      </div>

      <div v-if="mode === 'library'" class="space-y-2">
        <Input :model-value="libraryName" placeholder="Food name for library" @update:modelValue="onLibraryNameInput" />
        <Button class="w-full sm:w-auto" :loading="isSaving" @click="saveLibraryFromEstimate">Save to Library</Button>
      </div>

      <Button v-if="mode === 'log'" class="w-full sm:w-auto" :loading="isSaving" :disabled="!canSaveLog" @click="saveLogEntry">
        Save log
      </Button>
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
