import { nowDateKey } from "@/lib/date";
import { currentUserId } from "@/lib/supabase";
import { dailyTargetRepository } from "@/repositories/daily-target-repository";
import { profileRepository } from "@/repositories/profile-repository";
import type { DailyTarget, Profile } from "@/types/domain";

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
  await profileRepository.ensureProfileRowExists(fallbackProfile);

  const profile = await profileRepository.fetchProfile();
  if (!profile) {
    throw new Error("Unable to load profile");
  }

  const targets = await dailyTargetRepository.ensureTargets(profile);
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
