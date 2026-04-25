import { ensureNoError, getUserId, supabaseClient } from "@/repositories/repository-utils";
import type { DailyTarget, Profile } from "@/types/domain";
import { dailyTargetSchema, parseListWithSchema, parseWithSchema } from "@/types/schemas";

const toPayload = (name: string, calories: number, protein: number, carbs: number, fat: number) => ({
  name,
  calories_target: calories,
  protein_target: protein,
  carbs_target: carbs,
  fat_target: fat
});

export const dailyTargetRepository = {
  async fetchTargets(userId?: string): Promise<DailyTarget[]> {
    const resolvedUserId = userId ?? await getUserId();
    const { data, error } = await supabaseClient
      .from("daily_targets")
      .select("*")
      .eq("user_id", resolvedUserId)
      .order("created_at", { ascending: true });

    ensureNoError(error);
    return parseListWithSchema(dailyTargetSchema, data ?? [], "daily_targets");
  },

  async insertTarget(name: string, calories: number, protein: number, carbs: number, fat: number): Promise<void> {
    const userId = await getUserId();
    const payload = { user_id: userId, ...toPayload(name, calories, protein, carbs, fat) };
    const { error } = await supabaseClient.from("daily_targets").insert(payload);
    ensureNoError(error);
  },

  async updateTarget(id: string, name: string, calories: number, protein: number, carbs: number, fat: number): Promise<void> {
    const { error } = await supabaseClient
      .from("daily_targets")
      .update(toPayload(name, calories, protein, carbs, fat))
      .eq("id", id);

    ensureNoError(error);
  },

  async deleteTarget(id: string): Promise<void> {
    const { error } = await supabaseClient.from("daily_targets").delete().eq("id", id);
    ensureNoError(error);
  },

  async ensureTargets(profile: Profile, userId?: string): Promise<DailyTarget[]> {
    const resolvedUserId = userId ?? profile.user_id;
    const existing = await this.fetchTargets(resolvedUserId);
    if (existing.length > 0) {
      return existing;
    }

    await this.insertTarget(
      "Basic",
      profile.calories_target,
      profile.protein_target,
      profile.carbs_target,
      profile.fat_target
    );

    return this.fetchTargets(resolvedUserId);
  },

  async fetchTarget(id: string): Promise<DailyTarget | null> {
    const { data, error } = await supabaseClient
      .from("daily_targets")
      .select("*")
      .eq("id", id)
      .limit(1)
      .maybeSingle();

    if (error) {
      return null;
    }

    if (!data) {
      return null;
    }

    return parseWithSchema(dailyTargetSchema, data, "daily_target");
  }
};
