const todayEntriesRoot = ["today-entries"] as const;
const daySummaryRoot = ["day-summary"] as const;

export const queryKeys = {
  todaySummary: ["today-summary"] as const,
  daySummary: daySummaryRoot,
  daySummaryByDate: (dateKey: string) => [...daySummaryRoot, dateKey] as const,
  todayEntries: todayEntriesRoot,
  todayEntriesByDate: (dateKey: string, entryIds: readonly string[] = []) =>
    [...todayEntriesRoot, dateKey, ...entryIds] as const,
  library: ["library"] as const,
  settingsTargets: ["settings-targets"] as const,
  suggestionsContext: ["suggestions-context"] as const,
};
