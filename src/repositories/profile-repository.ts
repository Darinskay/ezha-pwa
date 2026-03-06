import { nowDateKey } from "@/lib/date";
import { ensureNoError, getUserId, supabaseClient } from "@/repositories/repository-utils";
import type { Profile } from "@/types/domain";
import { parseWithSchema, profileSchema } from "@/types/schemas";

export const profileRepository = {
  async fetchProfile(): Promise<Profile | null> {
    const userId = await getUserId();
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return null;
    if (!data) return null;
    return parseWithSchema(profileSchema, data, "profile");
  },

  async ensureProfileRowExists(defaultTargets: Profile): Promise<void> {
    const existing = await this.fetchProfile();
    if (existing) return;

    const { error } = await supabaseClient.from("profiles").insert(defaultTargets);
    ensureNoError(error);
  },

  async upsertProfileTargets(calories: number, protein: number, carbs: number, fat: number): Promise<void> {
    const userId = await getUserId();
    const existingProfile = await this.fetchProfile();

    const payload = {
      user_id: userId,
      calories_target: calories,
      protein_target: protein,
      carbs_target: carbs,
      fat_target: fat,
      active_date: existingProfile?.active_date ?? nowDateKey(),
      active_target_id: existingProfile?.active_target_id ?? null,
      created_at: existingProfile?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabaseClient.from("profiles").upsert(payload, { onConflict: "user_id" });
    ensureNoError(error);
  },

  async updateActiveDate(date: string): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabaseClient
      .from("profiles")
      .update({ active_date: date })
      .eq("user_id", userId);

    ensureNoError(error);
  },

  async updateActiveTarget(targetId: string): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabaseClient
      .from("profiles")
      .update({ active_target_id: targetId })
      .eq("user_id", userId);

    ensureNoError(error);
  },

  async fetchActiveDate(): Promise<string> {
    const userId = await getUserId();
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("active_date")
      .eq("user_id", userId)
      .single();

    ensureNoError(error);
    if (!data?.active_date) {
      throw new Error("Profile active date missing");
    }
    return data.active_date;
  }
};
