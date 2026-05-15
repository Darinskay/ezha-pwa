import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyDailyTargetForDate,
  syncDailySummaryForDate,
} from "@/services/day-summary-service";
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

vi.mock("@/repositories/profile-repository", () => ({
  profileRepository: {
    fetchProfile: vi.fn(),
    updateActiveTarget: vi.fn(),
  },
}));

vi.mock("@/repositories/daily-target-repository", () => ({
  dailyTargetRepository: {
    fetchTarget: vi.fn(),
  },
}));

vi.mock("@/repositories/food-entry-repository", () => ({
  foodEntryRepository: {
    fetchEntriesByDateKey: vi.fn(),
  },
}));

vi.mock("@/repositories/daily-summary-repository", () => ({
  dailySummaryRepository: {
    fetchSummary: vi.fn(),
    upsertSummary: vi.fn(),
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

const selectedSummary: DailySummary = {
  user_id: "user-1",
  date: "2026-05-09",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  calories_target: 2200,
  protein_target: 160,
  carbs_target: 245,
  fat_target: 70,
  has_data: false,
  daily_target_id: "target-2",
  daily_target_name: "Training Day",
};

const entry: FoodEntry = {
  id: "entry-1",
  user_id: "user-1",
  date: "2026-05-09",
  input_type: "text",
  input_text: null,
  image_path: null,
  calories: 500,
  protein: 35,
  carbs: 60,
  fat: 15,
  ai_confidence: null,
  ai_source: "text",
  ai_notes: "",
  created_at: null,
};

describe("day summary target selection", () => {
  beforeEach(() => {
    vi.mocked(profileRepository.fetchProfile).mockResolvedValue(profile);
    vi.mocked(dailySummaryRepository.fetchSummary).mockResolvedValue(
      selectedSummary,
    );
    vi.mocked(dailyTargetRepository.fetchTarget).mockImplementation(
      async (targetId) =>
        targetId === "target-2" ? trainingTarget : cutTarget,
    );
    vi.mocked(foodEntryRepository.fetchEntriesByDateKey).mockResolvedValue([
      entry,
    ]);
    vi.mocked(dailySummaryRepository.upsertSummary).mockResolvedValue();
  });

  it("preserves the selected day target when syncing logged meals", async () => {
    await syncDailySummaryForDate("2026-05-09");

    expect(dailySummaryRepository.upsertSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        calories: 500,
        protein: 35,
        carbs: 60,
        fat: 15,
        calories_target: 2200,
        protein_target: 160,
        carbs_target: 245,
        fat_target: 70,
        daily_target_id: "target-2",
        daily_target_name: "Training Day",
      }),
    );
  });

  it("applies a selected target to one day summary", async () => {
    await applyDailyTargetForDate("2026-05-09", "target-2");

    expect(dailyTargetRepository.fetchTarget).toHaveBeenCalledWith("target-2");
    expect(dailySummaryRepository.upsertSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        calories: 500,
        protein: 35,
        carbs: 60,
        fat: 15,
        calories_target: 2200,
        protein_target: 160,
        carbs_target: 245,
        fat_target: 70,
        daily_target_id: "target-2",
        daily_target_name: "Training Day",
      }),
    );
  });
});
