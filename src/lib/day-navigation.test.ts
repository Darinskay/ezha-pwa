import { describe, expect, it } from "vitest";
import {
  clampSelectableDate,
  dayLabel,
  nextSelectableDate,
  previousSelectableDate,
} from "@/lib/day-navigation";

describe("day-navigation", () => {
  it("labels today and formats historical selected days", () => {
    expect(dayLabel("2026-05-09", "2026-05-09", "en-US")).toBe("Today");
    expect(dayLabel("2026-05-08", "2026-05-09", "en-US")).toBe("May 8");
    expect(dayLabel("2026-05-01", "2026-05-09", "en-US")).toBe("May 1");
  });

  it("moves one day backward and clamps forward navigation at today", () => {
    expect(previousSelectableDate("2026-05-09")).toBe("2026-05-08");
    expect(nextSelectableDate("2026-05-08", "2026-05-09")).toBe("2026-05-09");
    expect(nextSelectableDate("2026-05-09", "2026-05-09")).toBe("2026-05-09");
  });

  it("rejects invalid and future date selections by returning today", () => {
    expect(clampSelectableDate("not-a-date", "2026-05-09")).toBe("2026-05-09");
    expect(clampSelectableDate("2026-05-10", "2026-05-09")).toBe("2026-05-09");
    expect(clampSelectableDate("2026-05-08", "2026-05-09")).toBe("2026-05-08");
  });
});
