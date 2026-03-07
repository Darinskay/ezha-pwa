import { dailyTargetRepository } from "@/repositories/daily-target-repository";
import { profileRepository } from "@/repositories/profile-repository";
import { defaultProfileForUser } from "@/services/profile-bootstrap";

export const resolveActiveDateForLogging = async (userId: string): Promise<string> => {
  const profile = await profileRepository.fetchProfile();
  if (profile?.active_date) {
    return profile.active_date;
  }

  const fallback = defaultProfileForUser(userId);
  await profileRepository.ensureProfileRowExists(fallback);

  const ensuredProfile = await profileRepository.fetchProfile();
  if (!ensuredProfile?.active_date) {
    throw new Error("Unable to determine active date.");
  }

  const targets = await dailyTargetRepository.ensureTargets(ensuredProfile);
  if (!ensuredProfile.active_target_id && targets[0]) {
    await profileRepository.updateActiveTarget(targets[0].id);
  }

  return ensuredProfile.active_date;
};
