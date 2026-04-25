import { nowDateKey } from "@/lib/date";
import { currentUserId } from "@/lib/supabase";
import { EXAMPLE_TARGETS, toMacroTotals } from "@/lib/macros";
import { dailySummaryRepository } from "@/repositories/daily-summary-repository";
import { dailyTargetRepository } from "@/repositories/daily-target-repository";
import { foodEntryRepository } from "@/repositories/food-entry-repository";
import { profileRepository } from "@/repositories/profile-repository";
import type { DailyTarget, MacroTargets, Profile } from "@/types/domain";

export const defaultProfileForUser = (userId: string): Profile => ({
  user_id: userId,
  calories_target: 0,
  protein_target: 0,
  carbs_target: 0,
  fat_target: 0,
  active_date: nowDateKey(),
  active_target_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

export const ensureProfileAndTargets = async (): Promise<{ profile: Profile; targets: DailyTarget[] }> => {
  const userId = await currentUserId();
  const fallbackProfile = defaultProfileForUser(userId);
  await profileRepository.ensureProfileRowExists(fallbackProfile, userId);

  const profile = await profileRepository.fetchProfile(userId);
  if (!profile) {
    throw new Error("Unable to load profile");
  }

  const targets = await dailyTargetRepository.ensureTargets(profile, userId);
  return { profile, targets };
};

export const resolveActiveTarget = async (
  profile: Profile,
  targets: DailyTarget[]
): Promise<DailyTarget | undefined> => {
  if (profile.active_target_id) {
    const match = targets.find((target) => target.id === profile.active_target_id);
    if (match) {
      return match;
    }
  }

  const fallback = targets[0];
  if (!fallback) {
    return undefined;
  }

  await profileRepository.updateActiveTarget(fallback.id);
  return fallback;
};

export interface TodayBootstrap {
  activeDate: string;
  targets: MacroTargets;
  totals: MacroTargets;
  availableTargets: DailyTarget[];
  activeTarget?: DailyTarget;
  entries: Awaited<ReturnType<typeof foodEntryRepository.fetchEntriesByDateKey>>;
}

export const fetchTodayBootstrap = async (): Promise<TodayBootstrap> => {
  const userId = await currentUserId();
  const fallbackProfile = defaultProfileForUser(userId);
  await profileRepository.ensureProfileRowExists(fallbackProfile, userId);

  const profile = await profileRepository.fetchProfile(userId);
  if (!profile) {
    throw new Error("Unable to load profile");
  }

  const targets = await dailyTargetRepository.ensureTargets(profile, userId);
  const activeTarget = await resolveActiveTarget(profile, targets);
  const [summary, entries] = await Promise.all([
    dailySummaryRepository.fetchSummary(profile.active_date),
    foodEntryRepository.fetchEntriesByDateKey(profile.active_date)
  ]);

  const resolvedTargets: MacroTargets = summary
    ? {
        calories: Math.round(summary.calories_target),
        protein: Math.round(summary.protein_target),
        carbs: Math.round(summary.carbs_target),
        fat: Math.round(summary.fat_target)
      }
    : activeTarget
      ? {
          calories: Math.round(activeTarget.calories_target),
          protein: Math.round(activeTarget.protein_target),
          carbs: Math.round(activeTarget.carbs_target),
          fat: Math.round(activeTarget.fat_target)
        }
      : EXAMPLE_TARGETS;

  return {
    activeDate: profile.active_date,
    targets: resolvedTargets,
    totals: toMacroTotals(entries),
    availableTargets: targets,
    activeTarget,
    entries
  };
};
