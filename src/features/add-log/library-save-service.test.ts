import { describe, expect, it, vi } from "vitest";
import {
  buildManualLibraryDraft,
  buildPhotoLibraryDraft,
  resolveDuplicateSaveChoice,
  saveLibraryDraftWithDuplicateCheck
} from "@/features/add-log/library-save-service";
import type { SavedFood, SavedFoodDraft } from "@/types/domain";

const buildSavedFood = (overrides: Partial<SavedFood>): SavedFood => ({
  id: "7e4f28c8-75d1-4c37-a2f2-c26c32b8f04d",
  user_id: "4d93ca8d-57d4-4750-b95f-17c7016e1060",
  name: "Apple",
  unit_type: "per_100g",
  serving_size: null,
  serving_unit: null,
  calories_per_100g: 52,
  protein_per_100g: 0.3,
  carbs_per_100g: 14,
  fat_per_100g: 0.2,
  calories_per_serving: 0,
  protein_per_serving: 0,
  carbs_per_serving: 0,
  fat_per_serving: 0,
  is_meal: false,
  created_at: null,
  updated_at: null,
  ...overrides
});

const sampleDraft: SavedFoodDraft = {
  name: "Apple",
  unit_type: "per_100g",
  serving_size: null,
  serving_unit: null,
  calories_per_100g: 52,
  protein_per_100g: 0.3,
  carbs_per_100g: 14,
  fat_per_100g: 0.2,
  calories_per_serving: 0,
  protein_per_serving: 0,
  carbs_per_serving: 0,
  fat_per_serving: 0
};

describe("library-save-service", () => {
  it("builds a photo-mode draft as per_100g", () => {
    const result = buildPhotoLibraryDraft({
      name: "Greek Yogurt",
      caloriesPerDisplayUnit: 96,
      proteinPerDisplayUnit: 9.8,
      carbsPerDisplayUnit: 3.6,
      fatPerDisplayUnit: 5.2,
      isLabelPhoto: false,
      labelGrams: null
    });

    expect(result.error).toBeNull();
    expect(result.draft).toEqual({
      name: "Greek Yogurt",
      unit_type: "per_100g",
      serving_size: null,
      serving_unit: null,
      calories_per_100g: 96,
      protein_per_100g: 9.8,
      carbs_per_100g: 3.6,
      fat_per_100g: 5.2,
      calories_per_serving: 0,
      protein_per_serving: 0,
      carbs_per_serving: 0,
      fat_per_serving: 0
    });
  });

  it("normalizes label-photo macros back to per_100g when grams were entered", () => {
    const result = buildPhotoLibraryDraft({
      name: "Granola",
      caloriesPerDisplayUnit: 240,
      proteinPerDisplayUnit: 6,
      carbsPerDisplayUnit: 36,
      fatPerDisplayUnit: 9,
      isLabelPhoto: true,
      labelGrams: 60
    });

    expect(result.error).toBeNull();
    expect(result.draft?.calories_per_100g).toBeCloseTo(400);
    expect(result.draft?.protein_per_100g).toBeCloseTo(10);
    expect(result.draft?.carbs_per_100g).toBeCloseTo(60);
    expect(result.draft?.fat_per_100g).toBeCloseTo(15);
  });

  it("computes per_serving macros from per_100g and serving size in manual mode", () => {
    const result = buildManualLibraryDraft({
      name: "Protein Bar",
      unitType: "per_serving",
      servingSizeGrams: 45,
      servingUnit: "bar",
      caloriesPer100g: 420,
      proteinPer100g: 30,
      carbsPer100g: 40,
      fatPer100g: 12
    });

    expect(result.error).toBeNull();
    expect(result.draft).toEqual({
      name: "Protein Bar",
      unit_type: "per_serving",
      serving_size: 45,
      serving_unit: "bar",
      calories_per_100g: 420,
      protein_per_100g: 30,
      carbs_per_100g: 40,
      fat_per_100g: 12,
      calories_per_serving: 189,
      protein_per_serving: 13.5,
      carbs_per_serving: 18,
      fat_per_serving: 5.4
    });
  });

  it("returns validation errors for invalid manual inputs", () => {
    const noName = buildManualLibraryDraft({
      name: " ",
      unitType: "per_100g",
      servingSizeGrams: null,
      servingUnit: "",
      caloriesPer100g: 100,
      proteinPer100g: 5,
      carbsPer100g: 10,
      fatPer100g: 2
    });
    expect(noName.error).toBe("Please enter a food name.");

    const invalidMacros = buildManualLibraryDraft({
      name: "Soup",
      unitType: "per_100g",
      servingSizeGrams: null,
      servingUnit: "",
      caloriesPer100g: null,
      proteinPer100g: 5,
      carbsPer100g: 10,
      fatPer100g: 2
    });
    expect(invalidMacros.error).toBe("Please enter valid macro values.");

    const invalidServingSize = buildManualLibraryDraft({
      name: "Soup",
      unitType: "per_serving",
      servingSizeGrams: 0,
      servingUnit: "bowl",
      caloriesPer100g: 65,
      proteinPer100g: 3,
      carbsPer100g: 9,
      fatPer100g: 1.5
    });
    expect(invalidServingSize.error).toBe("Please enter grams per serving.");
  });

  it("handles duplicate resolution path: update existing", async () => {
    const existing = buildSavedFood({ id: "d6158bd8-e881-4ce1-bdf8-90cc31e63c6a", name: "Apple" });
    const fetchFoodByName = vi.fn().mockResolvedValue(existing);
    const insertFood = vi.fn().mockResolvedValue(undefined);
    const updateFood = vi.fn().mockResolvedValue(undefined);
    const repository = { fetchFoodByName, insertFood, updateFood };

    const saveResult = await saveLibraryDraftWithDuplicateCheck(repository, sampleDraft);
    expect(saveResult.status).toBe("duplicate");
    if (saveResult.status !== "duplicate") {
      return;
    }

    await resolveDuplicateSaveChoice(repository, saveResult.pending, "update");
    expect(updateFood).toHaveBeenCalledWith(existing.id, sampleDraft);
    expect(insertFood).not.toHaveBeenCalled();
  });

  it("handles duplicate resolution path: create new", async () => {
    const existing = buildSavedFood({ id: "2322ca3a-89a8-467f-a6fd-697a510b8f0f", name: "Apple" });
    const fetchFoodByName = vi.fn().mockResolvedValue(existing);
    const insertFood = vi.fn().mockResolvedValue(undefined);
    const updateFood = vi.fn().mockResolvedValue(undefined);
    const repository = { fetchFoodByName, insertFood, updateFood };

    const saveResult = await saveLibraryDraftWithDuplicateCheck(repository, sampleDraft);
    expect(saveResult.status).toBe("duplicate");
    if (saveResult.status !== "duplicate") {
      return;
    }

    await resolveDuplicateSaveChoice(repository, saveResult.pending, "create");
    expect(insertFood).toHaveBeenCalledWith(sampleDraft);
    expect(updateFood).not.toHaveBeenCalled();
  });
});
