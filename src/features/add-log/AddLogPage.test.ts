// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, nextTick } from "vue";
import AddLogPage from "./AddLogPage.vue";

const mocks = vi.hoisted(() => ({
  drafts: new Map<string, unknown>(),
  saveDraft: vi.fn(),
  analyze: vi.fn(),
  saved: vi.fn(),
  insertFoodEntry: vi.fn(),
  insertMeal: vi.fn(),
  router: { back: vi.fn(), replace: vi.fn(), push: vi.fn() },
}));
vi.mock("@/db/offline-db", () => ({
  loadDraft: async (key: string) => mocks.drafts.get(key) ?? null,
  saveDraft: mocks.saveDraft,
  clearDraft: async (key: string) => {
    mocks.drafts.delete(key);
  },
  enqueueRetry: vi.fn(),
}));
vi.mock("vue-router", () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => mocks.router,
  onBeforeRouteLeave: vi.fn(),
}));
vi.mock("@tanstack/vue-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/stores/active-day-store", () => ({
  useActiveDayStore: () => ({
    activeDate: "2026-10-05",
    setActiveDate: vi.fn(),
  }),
}));
vi.mock("@/lib/supabase", () => ({ currentUserId: async () => "user" }));
vi.mock("@/repositories/food-entry-repository", () => ({
  foodEntryRepository: { insertFoodEntry: mocks.insertFoodEntry },
}));
vi.mock("@/repositories/saved-food-repository", () => ({
  savedFoodRepository: { insertMeal: mocks.insertMeal },
}));
vi.mock("@/services/active-date-service", () => ({
  resolveActiveDateForLogging: vi.fn(),
}));
vi.mock("@/services/day-summary-service", () => ({
  syncDailySummaryForDate: vi.fn(),
}));
vi.mock("@/services/storage-service", () => ({ storageService: {} }));
vi.mock("@/services/ai-analysis-service", () => ({
  aiAnalysisService: { analyze: mocks.analyze },
}));

const settle = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
};
const apps: ReturnType<typeof createApp>[] = [];
const mount = async () => {
  const root = document.createElement("div");
  document.body.append(root);
  const app = createApp(AddLogPage, { embedded: true, onSaved: mocks.saved });
  apps.push(app);
  const vm = app.mount(root) as unknown as {
    persistDraft: () => Promise<boolean>;
  };
  await settle();
  return { root, app, vm };
};
const enterDescription = async (
  root: HTMLElement,
  value: string,
): Promise<void> => {
  const input = root.querySelector("textarea")!;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();
};
const primaryButton = (root: HTMLElement): HTMLButtonElement =>
  Array.from(root.querySelectorAll("button")).find((el) =>
    /Estimate nutrition|Log meal ·/.test(el.textContent ?? ""),
  )!;

beforeEach(() => {
  mocks.drafts.clear();
  vi.clearAllMocks();
  mocks.saveDraft.mockImplementation(async (key, draft) => {
    mocks.drafts.set(key, JSON.parse(JSON.stringify(draft)));
  });
  mocks.insertFoodEntry.mockResolvedValue(undefined);
  mocks.insertMeal.mockResolvedValue(undefined);
  mocks.analyze.mockResolvedValue({
    calories: 200,
    protein: 10,
    carbs: 30,
    fat: 4,
    source: "text",
    items: [
      {
        name: "Rice",
        grams: 100,
        calories: 200,
        protein: 10,
        carbs: 30,
        fat: 4,
      },
    ],
  });
});
afterEach(() => {
  vi.useRealTimers();
  apps.splice(0).forEach((app) => app.unmount());
  document.body.innerHTML = "";
});

describe("meal logger recovery and estimate freshness", () => {
  it("restores text after closing and reopening and keeps drafts separate by date", async () => {
    const first = await mount();
    await enterDescription(first.root, "Chicken and rice");
    expect(await first.vm.persistDraft()).toBe(true);
    expect(mocks.drafts.has("add-log:log:2026-10-05")).toBe(true);
    first.app.unmount();
    apps.splice(apps.indexOf(first.app), 1);
    const second = await mount();
    expect(second.root.querySelector("textarea")?.value).toBe(
      "Chicken and rice",
    );
  });
  it("requires a new estimate after editing text and preserves selected library items", async () => {
    mocks.drafts.set("add-log:log:2026-10-05", {
      descriptionText: "",
      entryMode: "description",
      items: [],
      logItems: [
        {
          id: "library-item",
          name: "Chicken",
          gramsText: "100",
          macroBasis: "per_100g",
          baseGrams: 100,
          baseCalories: 100,
          baseProtein: 20,
          baseCarbs: 0,
          baseFat: 0,
          origin: "library_food",
          linkedFoodId: "chicken",
          aiConfidence: null,
          aiNotes: "",
          isNutritionMissing: false,
        },
      ],
    });
    const { root, vm } = await mount();
    await enterDescription(root, "Rice");
    expect(primaryButton(root).textContent ?? "").toContain(
      "Estimate nutrition",
    );
    primaryButton(root).click();
    await settle();
    expect(primaryButton(root).textContent ?? "").toContain(
      "Log meal · 300 kcal",
    );
    await enterDescription(root, "Rice with oil");
    expect(primaryButton(root).textContent ?? "").toContain(
      "Estimate nutrition",
    );
    await vm.persistDraft();
    const draft = mocks.drafts.get("add-log:log:2026-10-05") as {
      logItems: unknown[];
    };
    expect(draft.logItems).toHaveLength(2);
  });
  it("migrates an older list draft without dropping its food quantities", async () => {
    mocks.drafts.set("add-log:log", {
      entryMode: "list",
      items: [{ name: "Chicken", gramsText: "150" }],
      logItems: [],
    });
    const { root } = await mount();
    expect(root.querySelector("textarea")?.value).toBe("Chicken 150g");
    expect(mocks.drafts.has("add-log:log")).toBe(false);
    expect(mocks.drafts.has("add-log:log:2026-10-05")).toBe(true);
  });
  it("does not let an old debounce overwrite the draft after moving to the library picker", async () => {
    const { root, app, vm } = await mount();
    vi.useFakeTimers();
    await enterDescription(root, "Meal before library");
    await vm.persistDraft();
    app.unmount();
    apps.splice(apps.indexOf(app), 1);
    mocks.drafts.set("add-log:log:2026-10-05", {
      descriptionText: "Updated by library picker",
    });
    await vi.advanceTimersByTimeAsync(1300);
    expect(mocks.drafts.get("add-log:log:2026-10-05")).toEqual({
      descriptionText: "Updated by library picker",
    });
  });
  it("finishes a successful meal log when saving its optional library copy fails", async () => {
    const { root, vm } = await mount();
    await enterDescription(root, "Rice");
    primaryButton(root).click();
    await settle();
    const checkbox = root.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    )!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    await nextTick();
    mocks.insertMeal.mockRejectedValueOnce(new Error("Network error"));
    primaryButton(root).click();
    await settle();
    expect(mocks.insertFoodEntry).toHaveBeenCalledTimes(1);
    expect(mocks.saved).toHaveBeenCalledWith(
      "today",
      false,
      "The library copy could not be saved. Your meal log is kept.",
    );
    expect(await vm.persistDraft()).toBe(true);
    expect(mocks.drafts.has("add-log:log:2026-10-05")).toBe(false);
  });
  it("blocks dismissal when draft storage fails", async () => {
    const { root, vm } = await mount();
    await enterDescription(root, "Lunch");
    mocks.saveDraft.mockRejectedValueOnce(new Error("Quota exceeded"));
    expect(await vm.persistDraft()).toBe(false);
    await nextTick();
    expect(root.textContent).toContain(
      "Your draft could not be saved on this device",
    );
  });
});
