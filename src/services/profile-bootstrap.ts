import { nowDateKey } from "@/lib/date";
import { clampSelectableDate } from "@/lib/day-navigation";
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
  updated_at: new Date().toISOString(),
});

export const ensureProfileAndTargets = async (): Promise<{
  profile: Profile;
  targets: DailyTarget[];
}> => {
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
  targets: DailyTarget[],
): Promise<DailyTarget | undefined> => {
  if (profile.active_target_id) {
    const match = targets.find(
      (target) => target.id === profile.active_target_id,
    );
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

const targetFromSummary = (
  summary: { daily_target_id?: string | null } | null,
  targets: DailyTarget[],
): DailyTarget | undefined => {
  if (!summary?.daily_target_id) return undefined;
  return targets.find((target) => target.id === summary.daily_target_id);
};

const macroTargetsFromTarget = (target: DailyTarget): MacroTargets => ({
  calories: Math.round(target.calories_target),
  protein: Math.round(target.protein_target),
  carbs: Math.round(target.carbs_target),
  fat: Math.round(target.fat_target),
});

const macroTargetsFromSummary = (summary: {
  calories_target: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
}): MacroTargets => ({
  calories: Math.round(summary.calories_target),
  protein: Math.round(summary.protein_target),
  carbs: Math.round(summary.carbs_target),
  fat: Math.round(summary.fat_target),
});

const resolveSelectedTarget = async (
  selectedDate: string,
  profile: Profile,
  targets: DailyTarget[],
  summary: Awaited<ReturnType<typeof dailySummaryRepository.fetchSummary>>,
  fallbackTarget: DailyTarget | undefined,
): Promise<DailyTarget | undefined> => {
  const summaryTarget = targetFromSummary(summary, targets);
  if (summaryTarget) {
    return summaryTarget;
  }

  if (summary) {
    return undefined;
  }

  const latestSummary =
    await dailySummaryRepository.fetchLatestTargetSummaryBefore(selectedDate);
  const latestTarget = targetFromSummary(latestSummary, targets);
  if (latestTarget) {
    if (
      selectedDate === nowDateKey() &&
      profile.active_target_id !== latestTarget.id
    ) {
      await profileRepository.updateActiveTarget(latestTarget.id);
    }
    return latestTarget;
  }

  return fallbackTarget;
};

export interface TodayBootstrap {
  activeDate: string;
  targets: MacroTargets;
  totals: MacroTargets;
  availableTargets: DailyTarget[];
  activeTarget?: DailyTarget;
  entries: Awaited<
    ReturnType<typeof foodEntryRepository.fetchEntriesByDateKey>
  >;
}

export const fetchDayBootstrap = async (
  dateKey = nowDateKey(),
): Promise<TodayBootstrap> => {
  const userId = await currentUserId();
  const fallbackProfile = defaultProfileForUser(userId);
  await profileRepository.ensureProfileRowExists(fallbackProfile, userId);

  const profile = await profileRepository.fetchProfile(userId);
  if (!profile) {
    throw new Error("Unable to load profile");
  }

  const targets = await dailyTargetRepository.ensureTargets(profile, userId);
  const fallbackTarget = await resolveActiveTarget(profile, targets);
  const selectedDate = clampSelectableDate(dateKey, nowDateKey());
  const [summary, entries] = await Promise.all([
    dailySummaryRepository.fetchSummary(selectedDate),
    foodEntryRepository.fetchEntriesByDateKey(selectedDate),
  ]);
  const activeTarget = await resolveSelectedTarget(
    selectedDate,
    profile,
    targets,
    summary,
    fallbackTarget,
  );

  const resolvedTargets: MacroTargets = summary
    ? macroTargetsFromSummary(summary)
    : activeTarget
      ? macroTargetsFromTarget(activeTarget)
      : EXAMPLE_TARGETS;

  return {
    activeDate: selectedDate,
    targets: resolvedTargets,
    totals: toMacroTotals(entries),
    availableTargets: targets,
    activeTarget,
    entries,
  };
};

export const fetchTodayBootstrap = async (): Promise<TodayBootstrap> =>
  fetchDayBootstrap();
