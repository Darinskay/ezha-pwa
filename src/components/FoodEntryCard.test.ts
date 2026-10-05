// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createApp, nextTick } from "vue";
import FoodEntryCard from "./FoodEntryCard.vue";
import type { FoodEntryWithItems } from "@/types/domain";

const apps: ReturnType<typeof createApp>[] = [];
afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount());
  document.body.innerHTML = "";
});

const expandMeal = async (
  title: string,
  names: string[],
): Promise<HTMLElement> => {
  const data: FoodEntryWithItems = {
    entry: {
      id: "meal",
      user_id: "user",
      date: "2026-10-05",
      input_type: "text",
      input_text: title,
      calories: 400,
      protein: 20,
      carbs: 50,
      fat: 10,
      ai_source: "library",
      ai_notes: "",
    },
    items: names.map((name, index) => ({
      id: `item-${index}`,
      entry_id: "meal",
      user_id: "user",
      name,
      grams: 100,
      calories: 200,
      protein: 10,
      carbs: 25,
      fat: 5,
      ai_notes: "",
    })),
  };
  const root = document.createElement("div");
  document.body.append(root);
  const app = createApp(FoodEntryCard, {
    entryWithItems: data,
    showExpand: true,
  });
  apps.push(app);
  app.mount(root);
  root.querySelector<HTMLButtonElement>("button")!.click();
  await nextTick();
  return root;
};

describe("expanded meal naming", () => {
  it("shows ingredients once rather than repeating the auto-generated list as a heading", async () => {
    const root = await expandMeal("Bread, Egg", ["Bread", "Egg"]);
    expect(root.querySelector("h3")).toBeNull();
    expect(root.querySelectorAll("li")).toHaveLength(2);
    expect(root.querySelector("ul")?.textContent?.match(/Bread/g)).toHaveLength(
      1,
    );
    expect(root.querySelector("ul")?.textContent?.match(/Egg/g)).toHaveLength(
      1,
    );
  });
  it("keeps a distinct meal name above its ingredients", async () => {
    const root = await expandMeal("Breakfast", ["Bread", "Egg"]);
    expect(root.querySelector("h3")?.textContent).toBe("Breakfast");
  });
  it("preserves separate logged portions of the same food", async () => {
    const root = await expandMeal("Bread, Bread", ["Bread", "Bread"]);
    expect(root.querySelector("h3")).toBeNull();
    expect(root.querySelectorAll("li")).toHaveLength(2);
  });
});
