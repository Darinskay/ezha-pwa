import { describe, expect, it } from "vitest";
import { descriptionFromDraft } from "./meal-input-helpers";

describe("restoring drafts after removing input modes", () => {
  it("keeps a typed description intact", () => {
    expect(descriptionFromDraft({ descriptionText: "Chicken and rice" })).toBe(
      "Chicken and rice",
    );
  });
  it("converts old list drafts into readable text without losing quantities", () => {
    expect(
      descriptionFromDraft({
        entryMode: "list",
        descriptionText: "old description",
        items: [
          { name: " Chicken ", gramsText: " 150 " },
          { name: "Rice", gramsText: "" },
          { name: "", gramsText: "" },
        ],
      }),
    ).toBe("Chicken 150g, Rice");
  });
});
