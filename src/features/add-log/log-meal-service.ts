import { formatMacro, resolvedPer100g } from "@/lib/macros";
import { parseNumberInput } from "@/lib/number";
import type {
  FoodEntry,
  FoodEntryItem,
  MacroItemEstimate,
  MacroEstimate,
  MacroTotals,
  SavedFood,
  SavedMealIngredient,
  SavedMealIngredientDraft
} from "@/types/domain";

export type LogMealItemOrigin = "ai" | "library_food" | "library_meal";
export type LogMealMacroBasis = "per_100g" | "per_original";

export interface LogMealItem {
  id: string;
  name: string;
  gramsText: string;
  macroBasis: LogMealMacroBasis;
  baseGrams: number;
  baseCalories: number;
  baseProtein: number;
  baseCarbs: number;
  baseFat: number;
  origin: LogMealItemOrigin;
  linkedFoodId: string | null;
  aiConfidence: number | null;
  aiNotes: string;
  isNutritionMissing?: boolean;
}

export interface UsedMealSources {
  usedPhoto: boolean;
  usedText: boolean;
  usedLibrary: boolean;
}

export type LogMealAnalyzeInputType = "food_photo" | "label_photo" | "text";

export interface BuildFoodEntryPayloadInput {
  entryId: string;
  userId: string;
  activeDate: string;
  imagePath: string | null;
  items: LogMealItem[];
  sources: UsedMealSources;
  isLabelPhoto: boolean;
}

export interface BuildFoodEntryPayloadResult {
  entry: FoodEntry;
  entryItems: FoodEntryItem[];
}

const zeroTotals = (): MacroTotals => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0
});

export const MAX_LOG_ITEM_GRAMS = 5000;

const toPositiveNumberOr = (value: number | null, fallback: number): number =>
  value != null && Number.isFinite(value) && value > 0 ? value : fallback;

const normalizeEstimateItems = (items: MacroItemEstimate[]): MacroItemEstimate[] =>
  items
    .map((item) => ({ ...item, name: item.name.trim() }))
    .filter((item) => item.name.length > 0);

const clampToRange = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const normalizeLogItemGrams = (value: string): number | null => {
  const parsed = parseNumberInput(value);
  if (parsed == null || !Number.isFinite(parsed)) {
    return null;
  }

  return clampToRange(parsed, 0, MAX_LOG_ITEM_GRAMS);
};

export const parseLogItemGrams = (value: string): number | null => {
  const normalized = normalizeLogItemGrams(value);
  if (normalized == null || normalized <= 0) {
    return null;
  }
  return normalized;
};

export const macrosFromLogItem = (item: LogMealItem): MacroTotals => {
  if (item.isNutritionMissing) {
    return zeroTotals();
  }

  const grams = normalizeLogItemGrams(item.gramsText);
  if (!grams) {
    return zeroTotals();
  }

  const multiplier = item.macroBasis === "per_100g" ? grams / 100 : grams / toPositiveNumberOr(item.baseGrams, 1);

  return {
    calories: item.baseCalories * multiplier,
    protein: item.baseProtein * multiplier,
    carbs: item.baseCarbs * multiplier,
    fat: item.baseFat * multiplier
  };
};

export const totalsFromLogItems = (items: LogMealItem[]): MacroTotals =>
  items.reduce(
    (acc, item) => {
      const macros = macrosFromLogItem(item);
      return {
        calories: acc.calories + macros.calories,
        protein: acc.protein + macros.protein,
        carbs: acc.carbs + macros.carbs,
        fat: acc.fat + macros.fat
      };
    },
    zeroTotals()
  );

export const buildLogItemFromSavedFood = (food: SavedFood, grams = 100): LogMealItem => {
  const per100 = resolvedPer100g(food);
  return {
    id: crypto.randomUUID(),
    name: food.name,
    gramsText: formatMacro(toPositiveNumberOr(grams, 100), 1),
    macroBasis: "per_100g",
    baseGrams: 100,
    baseCalories: per100.calories,
    baseProtein: per100.protein,
    baseCarbs: per100.carbs,
    baseFat: per100.fat,
    origin: "library_food",
    linkedFoodId: food.id,
    aiConfidence: null,
    aiNotes: "Added from library food",
    isNutritionMissing: false
  };
};

export const buildLogItemsFromSavedMeal = (ingredients: SavedMealIngredient[]): LogMealItem[] =>
  ingredients.map((ingredient) => {
    const grams = toPositiveNumberOr(ingredient.grams, 0);
    const hasMissingNutrition =
      grams <= 0 ||
      [ingredient.calories, ingredient.protein, ingredient.carbs, ingredient.fat].some(
        (value) => !Number.isFinite(value)
      );
    const per100Multiplier = hasMissingNutrition ? 0 : 100 / grams;

    const safePer100Calories = hasMissingNutrition ? 0 : ingredient.calories * per100Multiplier;
    const safePer100Protein = hasMissingNutrition ? 0 : ingredient.protein * per100Multiplier;
    const safePer100Carbs = hasMissingNutrition ? 0 : ingredient.carbs * per100Multiplier;
    const safePer100Fat = hasMissingNutrition ? 0 : ingredient.fat * per100Multiplier;

    return {
      id: crypto.randomUUID(),
      name: ingredient.name,
      gramsText: formatMacro(grams, 1),
      macroBasis: "per_100g",
      baseGrams: 100,
      baseCalories: Number.isFinite(safePer100Calories) ? safePer100Calories : 0,
      baseProtein: Number.isFinite(safePer100Protein) ? safePer100Protein : 0,
      baseCarbs: Number.isFinite(safePer100Carbs) ? safePer100Carbs : 0,
      baseFat: Number.isFinite(safePer100Fat) ? safePer100Fat : 0,
      origin: "library_meal",
      linkedFoodId: ingredient.linked_food_id ?? null,
      aiConfidence: null,
      aiNotes: hasMissingNutrition
        ? "[PLACEHOLDER] Missing nutrition fields in template item"
        : "Added from saved meal",
      isNutritionMissing: hasMissingNutrition
    } satisfies LogMealItem;
  });

export const buildLogItemsFromEstimate = (
  estimate: MacroEstimate,
  fallbackName = "AI item"
): LogMealItem[] => {
  const normalizedItems = normalizeEstimateItems(estimate.items);

  if (normalizedItems.length === 0) {
    return [
      {
        id: crypto.randomUUID(),
        name: estimate.foodName?.trim() || fallbackName,
        gramsText: "100",
        macroBasis: "per_original",
        baseGrams: 100,
        baseCalories: estimate.calories,
        baseProtein: estimate.protein,
        baseCarbs: estimate.carbs,
        baseFat: estimate.fat,
        origin: "ai",
        linkedFoodId: null,
        aiConfidence: estimate.confidence ?? null,
        aiNotes: estimate.notes ?? "",
        isNutritionMissing: false
      }
    ];
  }

  return normalizedItems.map((item) => ({
    id: crypto.randomUUID(),
    name: item.name,
    gramsText: formatMacro(toPositiveNumberOr(item.grams, 1), 1),
    macroBasis: "per_original",
    baseGrams: toPositiveNumberOr(item.grams, 1),
    baseCalories: item.calories,
    baseProtein: item.protein,
    baseCarbs: item.carbs,
    baseFat: item.fat,
    origin: "ai",
    linkedFoodId: null,
    aiConfidence: item.confidence ?? estimate.confidence ?? null,
    aiNotes: item.notes ?? estimate.notes ?? "",
    isNutritionMissing: false
  }));
};

export const buildLabelLogItemsFromEstimate = (
  estimate: MacroEstimate,
  grams: number | null,
  fallbackName = "Nutrition label"
): LogMealItem[] => {
  const resolvedGrams = toPositiveNumberOr(grams, 100);
  const normalizedItems = normalizeEstimateItems(estimate.items);

  if (normalizedItems.length === 0) {
    return [
      {
        id: crypto.randomUUID(),
        name: estimate.foodName?.trim() || fallbackName,
        gramsText: formatMacro(resolvedGrams, 1),
        macroBasis: "per_100g",
        baseGrams: 100,
        baseCalories: estimate.calories,
        baseProtein: estimate.protein,
        baseCarbs: estimate.carbs,
        baseFat: estimate.fat,
        origin: "ai",
        linkedFoodId: null,
        aiConfidence: estimate.confidence ?? null,
        aiNotes: estimate.notes ?? "",
        isNutritionMissing: false
      }
    ];
  }

  return normalizedItems.map((item) => ({
    id: crypto.randomUUID(),
    name: item.name,
    gramsText: formatMacro(resolvedGrams, 1),
    macroBasis: "per_100g",
    baseGrams: 100,
    baseCalories: item.calories,
    baseProtein: item.protein,
    baseCarbs: item.carbs,
    baseFat: item.fat,
    origin: "ai",
    linkedFoodId: null,
    aiConfidence: item.confidence ?? estimate.confidence ?? null,
    aiNotes: item.notes ?? estimate.notes ?? "",
    isNutritionMissing: false
  }));
};

export const scalePer100gMacros = (base: MacroTotals, grams: number | null): MacroTotals => {
  if (!grams || grams <= 0) {
    return base;
  }
  const multiplier = grams / 100;
  return {
    calories: base.calories * multiplier,
    protein: base.protein * multiplier,
    carbs: base.carbs * multiplier,
    fat: base.fat * multiplier
  };
};

export const normalizeScaledMacrosToPer100g = (display: MacroTotals, grams: number | null): MacroTotals => {
  if (!grams || grams <= 0) {
    return display;
  }
  const multiplier = grams / 100;
  if (multiplier <= 0) {
    return display;
  }
  return {
    calories: display.calories / multiplier,
    protein: display.protein / multiplier,
    carbs: display.carbs / multiplier,
    fat: display.fat / multiplier
  };
};

export const applyEditedLabelMacrosToItem = (
  item: LogMealItem,
  editedDisplay: MacroTotals,
  grams: number | null
): LogMealItem => {
  const per100 = normalizeScaledMacrosToPer100g(editedDisplay, grams);
  return {
    ...item,
    macroBasis: "per_100g",
    baseGrams: 100,
    baseCalories: per100.calories,
    baseProtein: per100.protein,
    baseCarbs: per100.carbs,
    baseFat: per100.fat,
    gramsText: formatMacro(grams && grams > 0 ? grams : parseLogItemGrams(item.gramsText) ?? 100, 1)
  };
};

export const buildEntryItemsFromLogItems = (
  entryId: string,
  userId: string,
  items: LogMealItem[]
): FoodEntryItem[] => {
  const rows: FoodEntryItem[] = [];

  for (const item of items) {
    const grams = parseLogItemGrams(item.gramsText);
    const name = item.name.trim();
    if (!grams || !name || item.isNutritionMissing) {
      continue;
    }

    const macros = macrosFromLogItem(item);
    rows.push({
      id: crypto.randomUUID(),
      entry_id: entryId,
      user_id: userId,
      name,
      grams,
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      ai_confidence: item.aiConfidence,
      ai_notes: item.aiNotes,
      created_at: null
    });
  }

  return rows;
};

export const buildMealIngredientsFromLogItems = (items: LogMealItem[]): SavedMealIngredientDraft[] =>
  items
    .map((item) => {
      const grams = parseLogItemGrams(item.gramsText);
      const name = item.name.trim();
      if (!grams || !name || item.isNutritionMissing) {
        return null;
      }

      const macros = macrosFromLogItem(item);
      return {
        name,
        grams,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        linked_food_id: item.linkedFoodId
      } satisfies SavedMealIngredientDraft;
    })
    .filter((item): item is SavedMealIngredientDraft => item !== null);

export const resolveLogMealAnalyzeInputType = (hasPhoto: boolean, isLabelPhoto: boolean): LogMealAnalyzeInputType => {
  if (hasPhoto) {
    return isLabelPhoto ? "label_photo" : "food_photo";
  }

  return "text";
};

export const buildLogInputText = (items: FoodEntryItem[]): string => {
  const names = items.map((item) => item.name.trim()).filter(Boolean);
  return names.length > 0 ? names.join(", ") : "Meal";
};

export const buildFoodEntryPayload = (input: BuildFoodEntryPayloadInput): BuildFoodEntryPayloadResult => {
  const entryItems = buildEntryItemsFromLogItems(input.entryId, input.userId, input.items);
  const totals = totalsFromLogItems(input.items);
  const source = resolveFoodEntryInput(input.sources, input.isLabelPhoto);

  const confidenceValues = entryItems
    .map((item) => item.ai_confidence)
    .filter((value): value is number => value != null);
  const aiConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : null;

  return {
    entryItems,
    entry: {
      id: input.entryId,
      user_id: input.userId,
      date: input.activeDate,
      input_type: source.input_type,
      input_text: buildLogInputText(entryItems),
      image_path: input.imagePath,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      ai_confidence: aiConfidence,
      ai_source: source.ai_source,
      ai_notes: "Logged from combined meal sources",
      created_at: null
    }
  };
};

export const resolveFoodEntryInput = (
  sources: UsedMealSources,
  isLabelPhoto: boolean
): Pick<FoodEntry, "input_type" | "ai_source"> => {
  if (sources.usedPhoto && sources.usedText) {
    return {
      input_type: "photo+text",
      ai_source: isLabelPhoto ? "label_photo" : "food_photo"
    };
  }

  if (sources.usedPhoto) {
    return {
      input_type: "photo",
      ai_source: isLabelPhoto ? "label_photo" : "food_photo"
    };
  }

  if (sources.usedText) {
    return {
      input_type: "text",
      ai_source: "text"
    };
  }

  if (sources.usedLibrary) {
    return {
      input_type: "text",
      ai_source: "library"
    };
  }

  return {
    input_type: "text",
    ai_source: "unknown"
  };
};
