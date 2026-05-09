import { describe, expect, it } from "vitest";
import { queryKeys } from "@/query/keys";

describe("queryKeys", () => {
  it("keys today entry items by date and summary entry ids", () => {
    expect(
      queryKeys.todayEntriesByDate("2026-05-09", ["entry-1", "entry-2"]),
    ).toEqual(["today-entries", "2026-05-09", "entry-1", "entry-2"]);
  });
});
