import { describe, expect, it } from "vitest";
import {
  defaultFoodGrams,
  filterLibraryFoods,
  sortLibraryByRecent,
} from "./library-helpers";
import {
  buildLogItemFromSavedFood,
  macrosFromLogItem,
} from "@/features/add-log/log-meal-service";
import type { SavedFood } from "@/types/domain";

const food = (id: string, name: string, isMeal = false): SavedFood => ({
  id,
  name,
  is_meal: isMeal,
  user_id: "user",
  unit_type: "per_100g",
  serving_size: null,
  serving_unit: null,
  calories_per_100g: 200,
  protein_per_100g: 20,
  carbs_per_100g: 10,
  fat_per_100g: 5,
  calories_per_serving: 0,
  protein_per_serving: 0,
  carbs_per_serving: 0,
  fat_per_serving: 0,
  created_at: null,
  updated_at: null,
});

describe("library discovery and quick logging", () => {
  const foods = [
    food("a", "Chicken rice bowl", true),
    food("b", "Chicken breast"),
    food("c", "Rice"),
  ];
  it("searches foods and meals together with case-insensitive words in any order", () => {
    expect(
      filterLibraryFoods(foods, "  RICE chicken ", "all").map(
        (item) => item.id,
      ),
    ).toEqual(["a"]);
    expect(filterLibraryFoods(foods, "chicken", "all")).toHaveLength(2);
    expect(
      filterLibraryFoods(foods, "chicken", "foods").map((item) => item.id),
    ).toEqual(["b"]);
    expect(
      filterLibraryFoods(foods, "", "meals").map((item) => item.id),
    ).toEqual(["a"]);
  });
  it("preserves favorites across both item types and puts recently used items first", () => {
    expect(
      filterLibraryFoods(foods, "", "favorites", ["a", "c"]).map(
        (item) => item.id,
      ),
    ).toEqual(["a", "c"]);
    expect(
      sortLibraryByRecent(foods, ["c", "missing", "a"]).map((item) => item.id),
    ).toEqual(["c", "a", "b"]);
    expect(foods[0]?.id).toBe("a");
  });
  it("uses saved serving grams rather than silently logging 100g", () => {
    const serving = {
      ...food("a", "Yogurt"),
      unit_type: "per_serving" as const,
      serving_size: 150,
    };
    const item = buildLogItemFromSavedFood(serving, defaultFoodGrams(serving));
    expect(item.gramsText).toBe("150");
    expect(macrosFromLogItem(item).calories).toBe(300);
    expect(defaultFoodGrams({ ...serving, serving_size: 0 })).toBe(100);
  });
});
