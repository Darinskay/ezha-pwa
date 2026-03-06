export type UUID = string;

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroTargets extends MacroTotals {}

export interface MacroDoubles extends MacroTotals {}

export interface Profile {
  user_id: UUID;
  calories_target: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
  active_date: string;
  active_target_id: UUID | null;
  created_at: string;
  updated_at: string;
}

export interface DailyTarget {
  id: UUID;
  user_id: UUID;
  name: string;
  calories_target: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DailySummary {
  user_id: UUID;
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  calories_target: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
  has_data: boolean;
  daily_target_id?: UUID | null;
  daily_target_name?: string | null;
  created_at?: string | null;
}

export interface FoodEntry {
  id: UUID;
  user_id: UUID;
  date: string;
  input_type: "photo" | "text" | "photo+text";
  input_text?: string | null;
  image_path?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ai_confidence?: number | null;
  ai_source: "food_photo" | "label_photo" | "text" | "unknown" | "library";
  ai_notes: string;
  created_at?: string | null;
}

export interface FoodEntryItem {
  id: UUID;
  entry_id: UUID;
  user_id: UUID;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ai_confidence?: number | null;
  ai_notes: string;
  created_at?: string | null;
}

export interface FoodEntryWithItems {
  entry: FoodEntry;
  items: FoodEntryItem[];
}

export type FoodUnitType = "per_100g" | "per_serving";

export interface SavedFood {
  id: UUID;
  user_id: UUID;
  name: string;
  unit_type: FoodUnitType;
  serving_size?: number | null;
  serving_unit?: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  calories_per_serving: number;
  protein_per_serving: number;
  carbs_per_serving: number;
  fat_per_serving: number;
  is_meal: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SavedMealIngredient {
  id: UUID;
  meal_id: UUID;
  user_id: UUID;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  linked_food_id?: UUID | null;
  created_at?: string | null;
}

export interface SavedFoodDraft {
  name: string;
  unit_type: FoodUnitType;
  serving_size: number | null;
  serving_unit: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  calories_per_serving: number;
  protein_per_serving: number;
  carbs_per_serving: number;
  fat_per_serving: number;
}

export interface SavedMealIngredientDraft {
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  linked_food_id: UUID | null;
}

export interface AIItemInput {
  name: string;
  grams: number;
}

export interface MacroItemEstimate {
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence?: number | null;
  notes?: string | null;
}

export interface MacroEstimate {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence?: number | null;
  source: string;
  foodName?: string | null;
  notes: string;
  items: MacroItemEstimate[];
}

export interface AISuggestionRequest {
  remaining: MacroTotals;
  mealType: string;
  maxPrepMinutes: number;
  count: number;
  ingredientNotes?: string;
  variationNote?: string;
  units: string;
}

export interface AISuggestionPayload {
  title: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes?: string;
}

export interface MealSuggestion {
  id: string;
  title: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  warning?: string;
  notes?: string;
}

export type AppAppearance = "system" | "light" | "dark";

export interface DailyTargetInput {
  id?: UUID;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface EditableMealIngredient {
  id: UUID;
  name: string;
  gramsText: string;
  originalGrams: number;
  originalCalories: number;
  originalProtein: number;
  originalCarbs: number;
  originalFat: number;
  linkedFoodId: UUID | null;
}
