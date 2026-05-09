import { describe, expect, it } from "vitest";
import { buildDailySummaryForDate } from "@/services/day-summary-service";
import type { DailyTarget, FoodEntry, Profile } from "@/types/domain";

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

const target: DailyTarget = {
  id: "target-1",
  user_id: "user-1",
  name: "Cut",
  calories_target: 1700,
  protein_target: 130,
  carbs_target: 150,
  fat_target: 55,
};

const entry = (overrides: Partial<FoodEntry>): FoodEntry => ({
  id: "entry-1",
  user_id: "user-1",
  date: "2026-05-08",
  input_type: "text",
  input_text: null,
  image_path: null,
  calories: 100,
  protein: 10,
  carbs: 12,
  fat: 3,
  ai_confidence: null,
  ai_source: "text",
  ai_notes: "",
  created_at: null,
  ...overrides,
});

describe("day-summary-service", () => {
  it("builds a summary from entries and the selected target", () => {
    const summary = buildDailySummaryForDate({
      date: "2026-05-08",
      entries: [
        entry({ id: "entry-1", calories: 250, protein: 20, carbs: 30, fat: 8 }),
        entry({
          id: "entry-2",
          calories: 400,
          protein: 35,
          carbs: 45,
          fat: 12,
        }),
      ],
      profile,
      target,
    });

    expect(summary).toMatchObject({
      user_id: "user-1",
      date: "2026-05-08",
      calories: 650,
      protein: 55,
      carbs: 75,
      fat: 20,
      calories_target: 1700,
      protein_target: 130,
      carbs_target: 150,
      fat_target: 55,
      has_data: true,
      daily_target_id: "target-1",
      daily_target_name: "Cut",
    });
  });

  it("falls back to profile targets and marks an empty day as no data", () => {
    const summary = buildDailySummaryForDate({
      date: "2026-05-08",
      entries: [],
      profile,
      target: null,
    });

    expect(summary).toMatchObject({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      calories_target: 1800,
      protein_target: 120,
      carbs_target: 180,
      fat_target: 60,
      has_data: false,
      daily_target_id: null,
      daily_target_name: null,
    });
  });
});
