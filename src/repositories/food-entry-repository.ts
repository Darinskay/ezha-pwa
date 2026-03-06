import { dateKeyForQuery, ensureNoError, getUserId, supabaseClient } from "@/repositories/repository-utils";
import type { FoodEntry, FoodEntryItem, FoodEntryWithItems } from "@/types/domain";
import {
  foodEntryItemSchema,
  foodEntrySchema,
  parseListWithSchema
} from "@/types/schemas";

const allowedInputTypes = new Set(["photo", "text", "photo+text"]);
const allowedSources = new Set(["food_photo", "label_photo", "text", "unknown", "library"]);

export const foodEntryRepository = {
  async insertFoodEntry(entry: FoodEntry, items: FoodEntryItem[] = []): Promise<void> {
    const userId = await getUserId();

    const payload: FoodEntry = {
      ...entry,
      user_id: userId,
      input_type: allowedInputTypes.has(entry.input_type) ? entry.input_type : "text",
      ai_source: allowedSources.has(entry.ai_source) ? entry.ai_source : "unknown"
    };

    const insertEntryResponse = await supabaseClient.from("food_entries").insert(payload);
    ensureNoError(insertEntryResponse.error);

    if (items.length === 0) {
      return;
    }

    const itemPayloads = items.map((item) => ({
      ...item,
      user_id: userId,
      entry_id: entry.id
    }));

    const insertItemsResponse = await supabaseClient.from("food_entry_items").insert(itemPayloads);

    if (insertItemsResponse.error) {
      await supabaseClient.from("food_entries").delete().eq("id", entry.id);
      throw new Error(insertItemsResponse.error.message);
    }
  },

  async fetchEntries(date: Date): Promise<FoodEntry[]> {
    const dateString = dateKeyForQuery(date);
    const { data, error } = await supabaseClient
      .from("food_entries")
      .select("*")
      .eq("date", dateString)
      .order("created_at", { ascending: false });

    ensureNoError(error);
    return parseListWithSchema(foodEntrySchema, data ?? [], "food_entries");
  },

  async fetchEntriesByDateKey(dateKey: string): Promise<FoodEntry[]> {
    const { data, error } = await supabaseClient
      .from("food_entries")
      .select("*")
      .eq("date", dateKey)
      .order("created_at", { ascending: false });

    ensureNoError(error);
    return parseListWithSchema(foodEntrySchema, data ?? [], "food_entries");
  },

  async fetchEntriesRange(startDate: Date, endDate: Date): Promise<FoodEntry[]> {
    const startString = dateKeyForQuery(startDate);
    const endString = dateKeyForQuery(endDate);

    const { data, error } = await supabaseClient
      .from("food_entries")
      .select("*")
      .gte("date", startString)
      .lte("date", endString)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    ensureNoError(error);
    return parseListWithSchema(foodEntrySchema, data ?? [], "food_entries");
  },

  async deleteEntry(id: string): Promise<void> {
    const { error } = await supabaseClient.from("food_entries").delete().eq("id", id);
    ensureNoError(error);
  },

  async fetchItems(entryId: string): Promise<FoodEntryItem[]> {
    const { data, error } = await supabaseClient
      .from("food_entry_items")
      .select("*")
      .eq("entry_id", entryId)
      .order("created_at", { ascending: true });

    ensureNoError(error);
    return parseListWithSchema(foodEntryItemSchema, data ?? [], "food_entry_items");
  },

  async fetchEntriesWithItems(date: Date): Promise<FoodEntryWithItems[]> {
    const entries = await this.fetchEntries(date);
    return this.fetchItemsForEntries(entries);
  },

  async fetchEntriesWithItemsByDateKey(dateKey: string): Promise<FoodEntryWithItems[]> {
    const entries = await this.fetchEntriesByDateKey(dateKey);
    return this.fetchItemsForEntries(entries);
  },

  async fetchEntriesWithItemsRange(startDate: Date, endDate: Date): Promise<FoodEntryWithItems[]> {
    const entries = await this.fetchEntriesRange(startDate, endDate);
    return this.fetchItemsForEntries(entries);
  },

  async fetchItemsForEntries(entries: FoodEntry[]): Promise<FoodEntryWithItems[]> {
    if (entries.length === 0) return [];

    const entryIds = entries.map((entry) => entry.id);
    const { data, error } = await supabaseClient
      .from("food_entry_items")
      .select("*")
      .in("entry_id", entryIds)
      .order("created_at", { ascending: true });

    ensureNoError(error);

    const items = parseListWithSchema(foodEntryItemSchema, data ?? [], "food_entry_items");
    const itemsByEntryId = new Map<string, FoodEntryItem[]>();

    for (const item of items) {
      const bucket = itemsByEntryId.get(item.entry_id) ?? [];
      bucket.push(item);
      itemsByEntryId.set(item.entry_id, bucket);
    }

    return entries.map((entry) => ({
      entry,
      items: itemsByEntryId.get(entry.id) ?? []
    }));
  }
};
