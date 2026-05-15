import { nowDateKey } from "@/lib/date";
import { toMacroTotals } from "@/lib/macros";
import { dailySummaryRepository } from "@/repositories/daily-summary-repository";
import { dailyTargetRepository } from "@/repositories/daily-target-repository";
import { foodEntryRepository } from "@/repositories/food-entry-repository";
import { profileRepository } from "@/repositories/profile-repository";
import type {
  DailySummary,
  DailyTarget,
  FoodEntry,
  Profile,
} from "@/types/domain";

interface BuildDailySummaryInput {
  date: string;
  entries: FoodEntry[];
  profile: Profile;
  target: DailyTarget | null;
}

export const buildDailySummaryForDate = ({
  date,
  entries,
  profile,
  target,
}: BuildDailySummaryInput): DailySummary => {
  const totals = toMacroTotals(entries);

  return {
    user_id: profile.user_id,
    date,
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    calories_target: target?.calories_target ?? profile.calories_target,
    protein_target: target?.protein_target ?? profile.protein_target,
    carbs_target: target?.carbs_target ?? profile.carbs_target,
    fat_target: target?.fat_target ?? profile.fat_target,
    has_data: entries.length > 0,
    daily_target_id: target?.id ?? null,
    daily_target_name: target?.name ?? null,
  };
};

export const syncDailySummaryForDate = async (date: string): Promise<void> => {
  const profile = await profileRepository.fetchProfile();
  if (!profile) {
    throw new Error("Unable to load profile.");
  }

  const existingSummary = await dailySummaryRepository.fetchSummary(date);
  const targetId = existingSummary?.daily_target_id ?? profile.active_target_id;
  const [entries, target] = await Promise.all([
    foodEntryRepository.fetchEntriesByDateKey(date),
    targetId
      ? dailyTargetRepository.fetchTarget(targetId)
      : Promise.resolve(null),
  ]);

  await dailySummaryRepository.upsertSummary(
    buildDailySummaryForDate({
      date,
      entries,
      profile,
      target,
    }),
  );
};

export const applyDailyTargetForDate = async (
  date: string,
  targetId: string,
): Promise<void> => {
  const profile = await profileRepository.fetchProfile();
  if (!profile) {
    throw new Error("Unable to load profile.");
  }

  const [entries, target] = await Promise.all([
    foodEntryRepository.fetchEntriesByDateKey(date),
    dailyTargetRepository.fetchTarget(targetId),
  ]);

  if (!target) {
    throw new Error("Unable to load target.");
  }

  await dailySummaryRepository.upsertSummary(
    buildDailySummaryForDate({
      date,
      entries,
      profile,
      target,
    }),
  );

  if (date === nowDateKey() && profile.active_target_id !== target.id) {
    await profileRepository.updateActiveTarget(target.id);
  }
};
