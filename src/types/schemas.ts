import { z } from "zod";

const uuidSchema = z.string().uuid();
const nullableDateTime = z.string().datetime({ offset: true }).nullable().optional();

export const profileSchema = z.object({
  user_id: uuidSchema,
  calories_target: z.coerce.number(),
  protein_target: z.coerce.number(),
  carbs_target: z.coerce.number(),
  fat_target: z.coerce.number(),
  active_date: z.string(),
  active_target_id: uuidSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

export const dailyTargetSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  name: z.string(),
  calories_target: z.coerce.number(),
  protein_target: z.coerce.number(),
  carbs_target: z.coerce.number(),
  fat_target: z.coerce.number(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional()
});

export const dailySummarySchema = z.object({
  user_id: uuidSchema,
  date: z.string(),
  calories: z.coerce.number(),
  protein: z.coerce.number(),
  carbs: z.coerce.number(),
  fat: z.coerce.number(),
  calories_target: z.coerce.number(),
  protein_target: z.coerce.number(),
  carbs_target: z.coerce.number(),
  fat_target: z.coerce.number(),
  has_data: z.coerce.boolean(),
  daily_target_id: uuidSchema.nullable().optional(),
  daily_target_name: z.string().nullable().optional(),
  created_at: z.string().nullable().optional()
});

export const foodEntrySchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  date: z.string(),
  input_type: z.enum(["photo", "text", "photo+text"]),
  input_text: z.string().nullable().optional(),
  image_path: z.string().nullable().optional(),
  calories: z.coerce.number(),
  protein: z.coerce.number(),
  carbs: z.coerce.number(),
  fat: z.coerce.number(),
  ai_confidence: z.coerce.number().nullable().optional(),
  ai_source: z.enum(["food_photo", "label_photo", "text", "unknown", "library"]),
  ai_notes: z.string(),
  created_at: nullableDateTime
});

export const foodEntryItemSchema = z.object({
  id: uuidSchema,
  entry_id: uuidSchema,
  user_id: uuidSchema,
  name: z.string(),
  grams: z.coerce.number(),
  calories: z.coerce.number(),
  protein: z.coerce.number(),
  carbs: z.coerce.number(),
  fat: z.coerce.number(),
  ai_confidence: z.coerce.number().nullable().optional(),
  ai_notes: z.string(),
  created_at: nullableDateTime
});

export const savedFoodSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  name: z.string(),
  unit_type: z.enum(["per_100g", "per_serving"]),
  serving_size: z.coerce.number().nullable().optional(),
  serving_unit: z.string().nullable().optional(),
  calories_per_100g: z.coerce.number(),
  protein_per_100g: z.coerce.number(),
  carbs_per_100g: z.coerce.number(),
  fat_per_100g: z.coerce.number(),
  calories_per_serving: z.coerce.number(),
  protein_per_serving: z.coerce.number(),
  carbs_per_serving: z.coerce.number(),
  fat_per_serving: z.coerce.number(),
  is_meal: z.coerce.boolean(),
  created_at: nullableDateTime,
  updated_at: nullableDateTime
});

export const savedMealIngredientSchema = z.object({
  id: uuidSchema,
  meal_id: uuidSchema,
  user_id: uuidSchema,
  name: z.string(),
  grams: z.coerce.number(),
  calories: z.coerce.number(),
  protein: z.coerce.number(),
  carbs: z.coerce.number(),
  fat: z.coerce.number(),
  linked_food_id: uuidSchema.nullable().optional(),
  created_at: nullableDateTime
});

export const aiItemEstimateSchema = z.object({
  name: z.string(),
  grams: z.coerce.number(),
  calories: z.coerce.number(),
  protein: z.coerce.number(),
  carbs: z.coerce.number(),
  fat: z.coerce.number(),
  confidence: z.coerce.number().nullable().optional(),
  notes: z.string().nullable().optional()
});

const aiTotalsSchema = z.object({
  calories: z.coerce.number(),
  protein: z.coerce.number(),
  carbs: z.coerce.number(),
  fat: z.coerce.number()
});

export const aiAnalysisResponseSchema = z.object({
  totals: aiTotalsSchema.optional(),
  calories: z.coerce.number().optional(),
  protein: z.coerce.number().optional(),
  carbs: z.coerce.number().optional(),
  fat: z.coerce.number().optional(),
  confidence: z.coerce.number().nullable().optional(),
  source: z.string().optional(),
  food_name: z.string().nullable().optional(),
  notes: z.string().optional(),
  items: z.array(aiItemEstimateSchema).optional(),
  error: z.string().optional()
});

export const aiSuggestionPayloadSchema = z.object({
  title: z.string(),
  description: z.string(),
  calories: z.coerce.number(),
  protein: z.coerce.number(),
  carbs: z.coerce.number(),
  fat: z.coerce.number(),
  notes: z.string().optional()
});

export const aiSuggestionResponseSchema = z.object({
  suggestions: z.array(aiSuggestionPayloadSchema).optional(),
  error: z.string().optional()
});

export const parseWithSchema = <T>(schema: z.ZodSchema<T>, input: unknown, label: string): T => {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`${label} validation failed`);
  }
  return parsed.data;
};

export const parseListWithSchema = <T>(schema: z.ZodSchema<T>, input: unknown, label: string): T[] => {
  const arraySchema = z.array(schema);
  return parseWithSchema(arraySchema, input, label);
};
