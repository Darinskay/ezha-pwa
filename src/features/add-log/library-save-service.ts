import type { FoodUnitType, SavedFood, SavedFoodDraft } from "@/types/domain";

export interface ManualLibraryDraftInput {
  name: string;
  unitType: FoodUnitType;
  servingSizeGrams: number | null;
  servingUnit: string;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
}

export interface PhotoLibraryDraftInput {
  name: string;
  caloriesPerDisplayUnit: number | null;
  proteinPerDisplayUnit: number | null;
  carbsPerDisplayUnit: number | null;
  fatPerDisplayUnit: number | null;
  isLabelPhoto: boolean;
  labelGrams: number | null;
}

export interface LibraryDraftBuildResult {
  draft: SavedFoodDraft | null;
  error: string | null;
}

export interface DuplicateCheckRepository {
  fetchFoodByName(name: string): Promise<SavedFood | null>;
  insertFood(draft: SavedFoodDraft): Promise<void>;
  updateFood(id: string, draft: SavedFoodDraft): Promise<void>;
}

export interface PendingLibraryDuplicate {
  existing: SavedFood;
  draft: SavedFoodDraft;
}

export type DuplicateSaveChoice = "update" | "create";

export type SaveLibraryDraftResult =
  | { status: "saved" }
  | { status: "duplicate"; pending: PendingLibraryDuplicate };

export interface SuggestedLibraryNameInput {
  selectedLibraryFoodName: string | null;
  listItemNames: string[];
  descriptionText: string;
  aiFoodName: string | null;
}

const isMacroTupleValid = (
  values: [number | null, number | null, number | null, number | null]
): values is [number, number, number, number] =>
  values.every((value) => value != null && Number.isFinite(value));

const toPer100gFromDisplayValue = (value: number, isLabelPhoto: boolean, labelGrams: number | null): number => {
  if (!isLabelPhoto || !labelGrams || labelGrams <= 0) {
    return value;
  }
  return value / (labelGrams / 100);
};

const zeroPerServingMacros = {
  calories_per_serving: 0,
  protein_per_serving: 0,
  carbs_per_serving: 0,
  fat_per_serving: 0
};

export const buildPhotoLibraryDraft = (input: PhotoLibraryDraftInput): LibraryDraftBuildResult => {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    return { draft: null, error: "Please enter a food name to save to Library." };
  }

  const macroTuple: [number | null, number | null, number | null, number | null] = [
    input.caloriesPerDisplayUnit,
    input.proteinPerDisplayUnit,
    input.carbsPerDisplayUnit,
    input.fatPerDisplayUnit
  ];

  if (!isMacroTupleValid(macroTuple)) {
    return { draft: null, error: "Please enter valid macro values." };
  }

  const [caloriesPerDisplayUnit, proteinPerDisplayUnit, carbsPerDisplayUnit, fatPerDisplayUnit] = macroTuple;

  return {
    error: null,
    draft: {
      name: trimmedName,
      unit_type: "per_100g",
      serving_size: null,
      serving_unit: null,
      calories_per_100g: toPer100gFromDisplayValue(caloriesPerDisplayUnit, input.isLabelPhoto, input.labelGrams),
      protein_per_100g: toPer100gFromDisplayValue(proteinPerDisplayUnit, input.isLabelPhoto, input.labelGrams),
      carbs_per_100g: toPer100gFromDisplayValue(carbsPerDisplayUnit, input.isLabelPhoto, input.labelGrams),
      fat_per_100g: toPer100gFromDisplayValue(fatPerDisplayUnit, input.isLabelPhoto, input.labelGrams),
      ...zeroPerServingMacros
    }
  };
};

export const buildManualLibraryDraft = (input: ManualLibraryDraftInput): LibraryDraftBuildResult => {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    return { draft: null, error: "Please enter a food name." };
  }

  const macroTuple: [number | null, number | null, number | null, number | null] = [
    input.caloriesPer100g,
    input.proteinPer100g,
    input.carbsPer100g,
    input.fatPer100g
  ];
  if (!isMacroTupleValid(macroTuple)) {
    return { draft: null, error: "Please enter valid macro values." };
  }
  const [caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g] = macroTuple;

  if (input.unitType === "per_serving" && (!input.servingSizeGrams || input.servingSizeGrams <= 0)) {
    return { draft: null, error: "Please enter grams per serving." };
  }

  const servingMultiplier =
    input.unitType === "per_serving" && input.servingSizeGrams ? input.servingSizeGrams / 100 : 0;

  return {
    error: null,
    draft: {
      name: trimmedName,
      unit_type: input.unitType,
      serving_size: input.unitType === "per_serving" ? input.servingSizeGrams : null,
      serving_unit: input.unitType === "per_serving" ? input.servingUnit.trim() || null : null,
      calories_per_100g: caloriesPer100g,
      protein_per_100g: proteinPer100g,
      carbs_per_100g: carbsPer100g,
      fat_per_100g: fatPer100g,
      calories_per_serving: caloriesPer100g * servingMultiplier,
      protein_per_serving: proteinPer100g * servingMultiplier,
      carbs_per_serving: carbsPer100g * servingMultiplier,
      fat_per_serving: fatPer100g * servingMultiplier
    }
  };
};

export const saveLibraryDraftWithDuplicateCheck = async (
  repository: DuplicateCheckRepository,
  draft: SavedFoodDraft
): Promise<SaveLibraryDraftResult> => {
  const existing = await repository.fetchFoodByName(draft.name);
  if (existing) {
    return { status: "duplicate", pending: { existing, draft } };
  }

  await repository.insertFood(draft);
  return { status: "saved" };
};

export const resolveDuplicateSaveChoice = async (
  repository: DuplicateCheckRepository,
  pending: PendingLibraryDuplicate,
  choice: DuplicateSaveChoice
): Promise<void> => {
  if (choice === "update") {
    await repository.updateFood(pending.existing.id, pending.draft);
    return;
  }

  await repository.insertFood(pending.draft);
};

export const suggestedLibraryNameFromInputs = (input: SuggestedLibraryNameInput): string | null => {
  const selected = input.selectedLibraryFoodName?.trim();
  if (selected) {
    return selected;
  }

  const listNames = input.listItemNames.map((item) => item.trim()).filter(Boolean);
  if (listNames.length) {
    return listNames.join(" + ");
  }

  const description = input.descriptionText.trim();
  if (description) {
    return description;
  }

  const aiName = input.aiFoodName?.trim();
  if (aiName) {
    return aiName;
  }

  return null;
};
