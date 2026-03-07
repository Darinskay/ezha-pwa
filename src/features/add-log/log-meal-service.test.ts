import { describe, expect, it } from "vitest";
import {
  applyEditedLabelMacrosToItem,
  buildEntryItemsFromLogItems,
  buildLogItemFromSavedFood,
  buildLogItemsFromEstimate,
  buildLogItemsFromSavedMeal,
  buildMealIngredientsFromLogItems,
  macrosFromLogItem,
  resolveFoodEntryInput,
  scalePer100gMacros,
  totalsFromLogItems,
  type LogMealItem
} from "@/features/add-log/log-meal-service";
import type { MacroEstimate, SavedFood, SavedMealIngredient } from "@/types/domain";

const sampleFood = (overrides: Partial<SavedFood> = {}): SavedFood => ({
  id: "1d4621d0-d302-49b4-a8f4-6285ff89f8ff",
  user_id: "f8941c58-b320-4d0e-a6f5-433c8ea2369f",
  name: "Chicken Breast",
  unit_type: "per_100g",
  serving_size: null,
  serving_unit: null,
  calories_per_100g: 165,
  protein_per_100g: 31,
  carbs_per_100g: 0,
  fat_per_100g: 3.6,
  calories_per_serving: 0,
  protein_per_serving: 0,
  carbs_per_serving: 0,
  fat_per_serving: 0,
  is_meal: false,
  created_at: null,
  updated_at: null,
  ...overrides
});

const sampleEstimate = (overrides: Partial<MacroEstimate> = {}): MacroEstimate => ({
  calories: 520,
  protein: 30,
  carbs: 56,
  fat: 20,
  confidence: 0.88,
  source: "text",
  foodName: "Chicken rice bowl",
  notes: "AI estimate",
  items: [
    {
      name: "Chicken",
      grams: 150,
      calories: 247.5,
      protein: 46.5,
      carbs: 0,
      fat: 5.4,
      confidence: 0.9
    },
    {
      name: "Rice",
      grams: 180,
      calories: 272.5,
      protein: 3.5,
      carbs: 56,
      fat: 14.6,
      confidence: 0.86
    }
  ],
  ...overrides
});

describe("log-meal-service", () => {
  it("builds log items from library food with default grams=100 and macro scaling", () => {
    const item = buildLogItemFromSavedFood(sampleFood(), 100);
    expect(item.origin).toBe("library_food");
    expect(item.gramsText).toBe("100");
    expect(macrosFromLogItem(item)).toEqual({
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6
    });
  });

  it("builds log items from AI text/photo estimate and produces entry item rows", () => {
    const aiItems = buildLogItemsFromEstimate(sampleEstimate());
    expect(aiItems).toHaveLength(2);
    expect(aiItems[0].origin).toBe("ai");

    const entryItems = buildEntryItemsFromLogItems(
      "b3a8ef08-b00d-4aa4-ab64-a62367d334f0",
      "5f6f806e-f6ba-4a8a-8d4f-7d4339f0120f",
      aiItems
    );
    expect(entryItems).toHaveLength(2);
    expect(entryItems[0].name).toBe("Chicken");
    expect(entryItems[1].grams).toBe(180);
  });

  it("resolves source metadata for each log source and mixed source", () => {
    expect(resolveFoodEntryInput({ usedPhoto: false, usedText: true, usedLibrary: false }, false)).toEqual({
      input_type: "text",
      ai_source: "text"
    });

    expect(resolveFoodEntryInput({ usedPhoto: true, usedText: false, usedLibrary: false }, false)).toEqual({
      input_type: "photo",
      ai_source: "food_photo"
    });

    expect(resolveFoodEntryInput({ usedPhoto: true, usedText: false, usedLibrary: false }, true)).toEqual({
      input_type: "photo",
      ai_source: "label_photo"
    });

    expect(resolveFoodEntryInput({ usedPhoto: false, usedText: false, usedLibrary: true }, false)).toEqual({
      input_type: "text",
      ai_source: "library"
    });

    expect(resolveFoodEntryInput({ usedPhoto: true, usedText: true, usedLibrary: true }, false)).toEqual({
      input_type: "photo+text",
      ai_source: "food_photo"
    });
  });

  it("supports label scaling and manual macro edit normalization", () => {
    const per100 = { calories: 400, protein: 20, carbs: 60, fat: 10 };
    const scaled60 = scalePer100gMacros(per100, 60);
    expect(scaled60).toEqual({ calories: 240, protein: 12, carbs: 36, fat: 6 });

    const baseItem: LogMealItem = {
      id: "fdb28720-0b9b-4326-b6b1-5a28032ceb9c",
      name: "Label item",
      gramsText: "60",
      macroBasis: "per_100g",
      baseGrams: 100,
      baseCalories: per100.calories,
      baseProtein: per100.protein,
      baseCarbs: per100.carbs,
      baseFat: per100.fat,
      origin: "ai",
      linkedFoodId: null,
      aiConfidence: null,
      aiNotes: ""
    };

    const editedDisplay = { calories: 210, protein: 14, carbs: 30, fat: 7 };
    const updated = applyEditedLabelMacrosToItem(baseItem, editedDisplay, 60);
    const updatedMacros = macrosFromLogItem(updated);
    expect(updatedMacros.calories).toBeCloseTo(210);
    expect(updatedMacros.protein).toBeCloseTo(14);
    expect(updatedMacros.carbs).toBeCloseTo(30);
    expect(updatedMacros.fat).toBeCloseTo(7);
  });

  it("expands saved meal ingredients into editable log items with proportional scaling", () => {
    const ingredients: SavedMealIngredient[] = [
      {
        id: "8c4c336f-a6f1-4f89-b79f-bf1a8595d26b",
        meal_id: "bd286f20-a749-43b7-b81b-c12a9514abca",
        user_id: "0f013d56-fec5-4f15-a949-b502e5ca01f8",
        name: "Pasta",
        grams: 200,
        calories: 260,
        protein: 9,
        carbs: 51,
        fat: 1.3,
        linked_food_id: null,
        created_at: null
      },
      {
        id: "e8ee82b6-f6b5-4d7f-a344-9cf671f1f6d2",
        meal_id: "bd286f20-a749-43b7-b81b-c12a9514abca",
        user_id: "0f013d56-fec5-4f15-a949-b502e5ca01f8",
        name: "Sauce",
        grams: 100,
        calories: 90,
        protein: 2,
        carbs: 10,
        fat: 4,
        linked_food_id: "f3816bc4-f07e-4dc9-8f8d-7426d6eb0f98",
        created_at: null
      }
    ];

    const mealItems = buildLogItemsFromSavedMeal(ingredients);
    expect(mealItems).toHaveLength(2);
    mealItems[0].gramsText = "300";
    const pastaMacros = macrosFromLogItem(mealItems[0]);
    expect(pastaMacros.calories).toBeCloseTo(390);
    expect(pastaMacros.carbs).toBeCloseTo(76.5);
  });

  it("builds saved meal ingredient drafts from current log items", () => {
    const libraryItem = buildLogItemFromSavedFood(sampleFood(), 120);
    const aiItem = buildLogItemsFromEstimate(sampleEstimate({ items: [] }), "Soup")[0];
    aiItem.gramsText = "80";

    const ingredients = buildMealIngredientsFromLogItems([libraryItem, aiItem]);
    expect(ingredients).toHaveLength(2);
    expect(ingredients[0].name).toBe("Chicken Breast");
    expect(ingredients[0].grams).toBe(120);
    expect(ingredients[0].linked_food_id).toBe(sampleFood().id);

    const totals = totalsFromLogItems([libraryItem, aiItem]);
    const draftTotals = ingredients.reduce(
      (acc, ingredient) => ({
        calories: acc.calories + ingredient.calories,
        protein: acc.protein + ingredient.protein,
        carbs: acc.carbs + ingredient.carbs,
        fat: acc.fat + ingredient.fat
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    expect(draftTotals.calories).toBeCloseTo(totals.calories);
    expect(draftTotals.protein).toBeCloseTo(totals.protein);
    expect(draftTotals.carbs).toBeCloseTo(totals.carbs);
    expect(draftTotals.fat).toBeCloseTo(totals.fat);
  });
});
