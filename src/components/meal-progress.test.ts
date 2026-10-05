import { describe, expect, it } from "vitest";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import MacroProgressTable from "./MacroProgressTable.vue";
import FoodEntryCard from "./FoodEntryCard.vue";
import type { FoodEntryWithItems } from "@/types/domain";

describe("remaining macros and compact meal entries", () => {
  it("shows amounts left and over target as text instead of relying on color", async () => {
    const html = await renderToString(
      createSSRApp(MacroProgressTable, {
        targets: { calories: 2000, protein: 120, carbs: 200, fat: 70 },
        eaten: { calories: 2200, protein: 60, carbs: 230, fat: 70 },
      }),
    );
    expect(html).toContain('aria-label="2200 of 2000 calories consumed"');
    expect(html).toContain("kcal left");
    expect(html).toContain("over");
    expect(html).toContain("60 g");
    expect(html).toContain("0 g");
    expect(html).not.toContain("closed");
  });
  it("hides meal metadata while retaining details and delete controls even without ingredients", async () => {
    const data: FoodEntryWithItems = {
      entry: {
        id: "meal-1",
        user_id: "user",
        date: "2026-10-05",
        input_type: "text",
        input_text: "Chicken dinner",
        calories: 500,
        protein: 30,
        carbs: 40,
        fat: 10,
        ai_source: "library",
        ai_notes: "",
        created_at: "2026-10-05T12:00:00Z",
      },
      items: [],
    };
    const html = await renderToString(
      createSSRApp(FoodEntryCard, {
        entryWithItems: data,
        showExpand: true,
        showDelete: true,
      }),
    );
    expect(html).toContain("500 kcal");
    expect(html).toContain("P 30g");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Delete Chicken dinner"');
    expect(html).not.toContain("<h3");
    expect(html).not.toContain(">Library<");
  });
});
