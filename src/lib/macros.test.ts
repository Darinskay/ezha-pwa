import { describe, expect, it } from "vitest";
import { macroProgressBarPercent, macroProgressPercent } from "@/lib/macros";

describe("macro progress helpers", () => {
  it("reports the consumed percentage while capping the bar width", () => {
    expect(macroProgressPercent(1500, 2000)).toBe(75);
    expect(macroProgressPercent(2250, 2000)).toBe(113);
    expect(macroProgressBarPercent(2250, 2000)).toBe(100);
  });

  it("returns zero progress when the target is not set", () => {
    expect(macroProgressPercent(400, 0)).toBe(0);
    expect(macroProgressBarPercent(400, 0)).toBe(0);
  });
});
