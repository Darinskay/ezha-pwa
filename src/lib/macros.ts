import type { MacroDoubles, MacroTargets, MacroTotals, SavedFood } from "@/types/domain";

export const ZERO_TOTALS: MacroTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0
};

export const EXAMPLE_TARGETS: MacroTargets = {
  calories: 2100,
  protein: 140,
  carbs: 220,
  fat: 70
};

export const roundMacro = (value: number): number => Math.round(value);

export const formatMacro = (value: number, maxFractionDigits = 2): string =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
    useGrouping: false
  }).format(value);

export const toMacroTotals = (entries: Array<Pick<MacroDoubles, "calories" | "protein" | "carbs" | "fat">>): MacroTotals => ({
  calories: roundMacro(entries.reduce((sum, entry) => sum + entry.calories, 0)),
  protein: roundMacro(entries.reduce((sum, entry) => sum + entry.protein, 0)),
  carbs: roundMacro(entries.reduce((sum, entry) => sum + entry.carbs, 0)),
  fat: roundMacro(entries.reduce((sum, entry) => sum + entry.fat, 0))
});

export const remainingMacros = (targets: MacroTargets, totals: MacroTotals): MacroTotals => ({
  calories: targets.calories - totals.calories,
  protein: targets.protein - totals.protein,
  carbs: targets.carbs - totals.carbs,
  fat: targets.fat - totals.fat
});

const resolvedPerServing = (food: SavedFood): MacroDoubles => {
  if (
    food.calories_per_serving > 0 ||
    food.protein_per_serving > 0 ||
    food.carbs_per_serving > 0 ||
    food.fat_per_serving > 0
  ) {
    return {
      calories: food.calories_per_serving,
      protein: food.protein_per_serving,
      carbs: food.carbs_per_serving,
      fat: food.fat_per_serving
    };
  }

  if (!food.serving_size || food.serving_size <= 0) {
    return { ...ZERO_TOTALS };
  }

  const multiplier = food.serving_size / 100;
  return {
    calories: food.calories_per_100g * multiplier,
    protein: food.protein_per_100g * multiplier,
    carbs: food.carbs_per_100g * multiplier,
    fat: food.fat_per_100g * multiplier
  };
};

export const resolvedPer100g = (food: SavedFood): MacroDoubles => {
  if (
    food.calories_per_100g > 0 ||
    food.protein_per_100g > 0 ||
    food.carbs_per_100g > 0 ||
    food.fat_per_100g > 0
  ) {
    return {
      calories: food.calories_per_100g,
      protein: food.protein_per_100g,
      carbs: food.carbs_per_100g,
      fat: food.fat_per_100g
    };
  }

  if (!food.serving_size || food.serving_size <= 0) {
    return { ...ZERO_TOTALS };
  }

  const perServing = resolvedPerServing(food);
  const multiplier = 100 / food.serving_size;
  return {
    calories: perServing.calories * multiplier,
    protein: perServing.protein * multiplier,
    carbs: perServing.carbs * multiplier,
    fat: perServing.fat * multiplier
  };
};

export const savedFoodMacrosForQuantity = (food: SavedFood, quantity: number): MacroDoubles => {
  const per100g = resolvedPer100g(food);
  const multiplier = quantity / 100;
  return {
    calories: per100g.calories * multiplier,
    protein: per100g.protein * multiplier,
    carbs: per100g.carbs * multiplier,
    fat: per100g.fat * multiplier
  };
};
