import { formatMacro, resolvedPer100g } from "@/lib/macros";
import { parseNumberInput } from "@/lib/number";
import type {
  FoodEntry,
  FoodEntryItem,
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
}

export interface UsedMealSources {
  usedPhoto: boolean;
  usedText: boolean;
  usedLibrary: boolean;
}

const zeroTotals = (): MacroTotals => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0
});

const toPositiveNumberOr = (value: number | null, fallback: number): number =>
  value != null && Number.isFinite(value) && value > 0 ? value : fallback;

export const parseLogItemGrams = (value: string): number | null => {
  const parsed = parseNumberInput(value);
  if (parsed == null || parsed <= 0) {
    return null;
  }
  return parsed;
};

export const macrosFromLogItem = (item: LogMealItem): MacroTotals => {
  const grams = parseLogItemGrams(item.gramsText);
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
    aiNotes: "Added from library food"
  };
};

export const buildLogItemsFromSavedMeal = (ingredients: SavedMealIngredient[]): LogMealItem[] =>
  ingredients.map((ingredient) => ({
    id: crypto.randomUUID(),
    name: ingredient.name,
    gramsText: formatMacro(toPositiveNumberOr(ingredient.grams, 1), 1),
    macroBasis: "per_original",
    baseGrams: toPositiveNumberOr(ingredient.grams, 1),
    baseCalories: ingredient.calories,
    baseProtein: ingredient.protein,
    baseCarbs: ingredient.carbs,
    baseFat: ingredient.fat,
    origin: "library_meal",
    linkedFoodId: ingredient.linked_food_id ?? null,
    aiConfidence: null,
    aiNotes: "Added from saved meal"
  }));

export const buildLogItemsFromEstimate = (
  estimate: MacroEstimate,
  fallbackName = "AI item"
): LogMealItem[] => {
  if (estimate.items.length === 0) {
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
        aiNotes: estimate.notes ?? ""
      }
    ];
  }

  return estimate.items.map((item) => ({
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
    aiNotes: item.notes ?? estimate.notes ?? ""
  }));
};

export const buildLabelLogItemsFromEstimate = (
  estimate: MacroEstimate,
  grams: number | null,
  fallbackName = "Nutrition label"
): LogMealItem[] => {
  const resolvedGrams = toPositiveNumberOr(grams, 100);

  if (estimate.items.length === 0) {
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
        aiNotes: estimate.notes ?? ""
      }
    ];
  }

  return estimate.items.map((item) => ({
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
    aiNotes: item.notes ?? estimate.notes ?? ""
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
    if (!grams || !name) {
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
      if (!grams || !name) {
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
