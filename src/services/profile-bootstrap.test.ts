import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDayBootstrap } from "@/services/profile-bootstrap";
import { dailySummaryRepository } from "@/repositories/daily-summary-repository";
import { dailyTargetRepository } from "@/repositories/daily-target-repository";
import { foodEntryRepository } from "@/repositories/food-entry-repository";
import { profileRepository } from "@/repositories/profile-repository";
import type { DailySummary, DailyTarget, Profile } from "@/types/domain";

vi.mock("@/lib/supabase", () => ({
  currentUserId: vi.fn(async () => "user-1"),
  supabase: {},
}));

vi.mock("@/repositories/profile-repository", () => ({
  profileRepository: {
    ensureProfileRowExists: vi.fn(),
    fetchProfile: vi.fn(),
    updateActiveTarget: vi.fn(),
  },
}));

vi.mock("@/repositories/daily-target-repository", () => ({
  dailyTargetRepository: {
    ensureTargets: vi.fn(),
    fetchTarget: vi.fn(),
  },
}));

vi.mock("@/repositories/daily-summary-repository", () => ({
  dailySummaryRepository: {
    fetchSummary: vi.fn(),
    fetchLatestTargetSummaryBefore: vi.fn(),
  },
}));

vi.mock("@/repositories/food-entry-repository", () => ({
  foodEntryRepository: {
    fetchEntriesByDateKey: vi.fn(),
  },
}));

const profile: Profile = {
  user_id: "user-1",
  calories_target: 1800,
  protein_target: 120,
  carbs_target: 180,
  fat_target: 60,
  active_date: "2026-05-09",
  active_target_id: "target-1",
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z",
};

const cutTarget: DailyTarget = {
  id: "target-1",
  user_id: "user-1",
  name: "Cut",
  calories_target: 1700,
  protein_target: 130,
  carbs_target: 150,
  fat_target: 55,
};

const trainingTarget: DailyTarget = {
  id: "target-2",
  user_id: "user-1",
  name: "Training Day",
  calories_target: 2200,
  protein_target: 160,
  carbs_target: 245,
  fat_target: 70,
};

const summary = (overrides: Partial<DailySummary>): DailySummary => ({
  user_id: "user-1",
  date: "2026-05-08",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  calories_target: 1700,
  protein_target: 130,
  carbs_target: 150,
  fat_target: 55,
  has_data: false,
  daily_target_id: "target-1",
  daily_target_name: "Cut",
  ...overrides,
});

describe("profile-bootstrap", () => {
  beforeEach(() => {
    vi.mocked(profileRepository.ensureProfileRowExists).mockResolvedValue();
    vi.mocked(profileRepository.fetchProfile).mockResolvedValue(profile);
    vi.mocked(profileRepository.updateActiveTarget).mockResolvedValue();
    vi.mocked(dailyTargetRepository.ensureTargets).mockResolvedValue([
      cutTarget,
      trainingTarget,
    ]);
    vi.mocked(dailyTargetRepository.fetchTarget).mockResolvedValue(null);
    vi.mocked(dailySummaryRepository.fetchSummary).mockResolvedValue(null);
    vi.mocked(
      dailySummaryRepository.fetchLatestTargetSummaryBefore,
    ).mockResolvedValue(null);
    vi.mocked(foodEntryRepository.fetchEntriesByDateKey).mockResolvedValue([]);
  });

  it("uses the most recent applicable target when a selected day has no summary", async () => {
    vi.mocked(
      dailySummaryRepository.fetchLatestTargetSummaryBefore,
    ).mockResolvedValue(
      summary({
        date: "2026-05-08",
        calories_target: 2200,
        protein_target: 160,
        carbs_target: 245,
        fat_target: 70,
        daily_target_id: "target-2",
        daily_target_name: "Training Day",
      }),
    );

    const data = await fetchDayBootstrap("2026-05-09");

    expect(data.activeTarget).toEqual(trainingTarget);
    expect(data.targets).toEqual({
      calories: 2200,
      protein: 160,
      carbs: 245,
      fat: 70,
    });
  });
});
