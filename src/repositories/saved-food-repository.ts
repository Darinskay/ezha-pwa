import { ensureNoError, getUserId, supabaseClient } from "@/repositories/repository-utils";
import type {
  SavedFood,
  SavedFoodDraft,
  SavedMealIngredient,
  SavedMealIngredientDraft
} from "@/types/domain";
import {
  parseListWithSchema,
  parseWithSchema,
  savedFoodSchema,
  savedMealIngredientSchema
} from "@/types/schemas";

export const savedFoodRepository = {
  async fetchFoods(): Promise<SavedFood[]> {
    const { data, error } = await supabaseClient.from("saved_foods").select("*").order("name", { ascending: true });
    ensureNoError(error);
    return parseListWithSchema(savedFoodSchema, data ?? [], "saved_foods");
  },

  async fetchNonMealFoods(): Promise<SavedFood[]> {
    const { data, error } = await supabaseClient
      .from("saved_foods")
      .select("*")
      .eq("is_meal", false)
      .order("name", { ascending: true });

    ensureNoError(error);
    return parseListWithSchema(savedFoodSchema, data ?? [], "saved_foods");
  },

  async fetchFoodByName(name: string): Promise<SavedFood | null> {
    const userId = await getUserId();
    const trimmedName = name.trim();
    if (!trimmedName) {
      return null;
    }

    const { data, error } = await supabaseClient
      .from("saved_foods")
      .select("*")
      .eq("user_id", userId)
      .eq("is_meal", false)
      .ilike("name", trimmedName)
      .limit(20);

    if (error || !data?.length) {
      return null;
    }

    const normalizedName = trimmedName.toLocaleLowerCase();
    const exactMatch =
      data.find((food) => typeof food.name === "string" && food.name.trim().toLocaleLowerCase() === normalizedName) ??
      null;

    if (!exactMatch) {
      return null;
    }

    return parseWithSchema(savedFoodSchema, exactMatch, "saved_food");
  },

  async insertFood(draft: SavedFoodDraft): Promise<void> {
    const userId = await getUserId();
    const payload = { user_id: userId, is_meal: false, ...draft };
    const { error } = await supabaseClient.from("saved_foods").insert(payload);
    ensureNoError(error);
  },

  async updateFood(id: string, draft: SavedFoodDraft): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabaseClient.from("saved_foods").update(draft).eq("id", id).eq("user_id", userId);
    ensureNoError(error);
  },

  async deleteFood(id: string): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabaseClient.from("saved_foods").delete().eq("id", id).eq("user_id", userId);
    ensureNoError(error);
  },

  async insertMeal(name: string, ingredients: SavedMealIngredientDraft[]): Promise<void> {
    const userId = await getUserId();
    const mealId = crypto.randomUUID();

    const mealPayload = {
      id: mealId,
      user_id: userId,
      name,
      unit_type: "per_100g" as const,
      is_meal: true,
      calories_per_100g: 0,
      protein_per_100g: 0,
      carbs_per_100g: 0,
      fat_per_100g: 0,
      calories_per_serving: 0,
      protein_per_serving: 0,
      carbs_per_serving: 0,
      fat_per_serving: 0
    };

    const mealInsert = await supabaseClient.from("saved_foods").insert(mealPayload);
    ensureNoError(mealInsert.error);

    if (ingredients.length === 0) {
      return;
    }

    const ingredientPayload = ingredients.map((ingredient) => ({
      meal_id: mealId,
      user_id: userId,
      name: ingredient.name,
      grams: ingredient.grams,
      calories: ingredient.calories,
      protein: ingredient.protein,
      carbs: ingredient.carbs,
      fat: ingredient.fat,
      linked_food_id: ingredient.linked_food_id
    }));

    const insertIngredients = await supabaseClient
      .from("saved_meal_ingredients")
      .insert(ingredientPayload);

    ensureNoError(insertIngredients.error);
  },

  async fetchMealIngredients(mealId: string): Promise<SavedMealIngredient[]> {
    const { data, error } = await supabaseClient
      .from("saved_meal_ingredients")
      .select("*")
      .eq("meal_id", mealId)
      .order("created_at", { ascending: true });

    ensureNoError(error);
    return parseListWithSchema(savedMealIngredientSchema, data ?? [], "saved_meal_ingredients");
  }
};
