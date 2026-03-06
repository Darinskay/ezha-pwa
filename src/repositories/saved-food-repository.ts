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
    const { data, error } = await supabaseClient
      .from("saved_foods")
      .select("*")
      .eq("user_id", userId)
      .ilike("name", name)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return parseWithSchema(savedFoodSchema, data, "saved_food");
  },

  async insertFood(draft: SavedFoodDraft): Promise<void> {
    const userId = await getUserId();
    const payload = { user_id: userId, ...draft };
    const { error } = await supabaseClient.from("saved_foods").insert(payload);
    ensureNoError(error);
  },

  async updateFood(id: string, draft: SavedFoodDraft): Promise<void> {
    const { error } = await supabaseClient.from("saved_foods").update(draft).eq("id", id);
    ensureNoError(error);
  },

  async deleteFood(id: string): Promise<void> {
    const { error } = await supabaseClient.from("saved_foods").delete().eq("id", id);
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
