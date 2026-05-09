const todayEntriesRoot = ["today-entries"] as const;
const daySummaryRoot = ["day-summary"] as const;

export const queryKeys = {
  todaySummary: ["today-summary"] as const,
  daySummary: daySummaryRoot,
  daySummaryByDate: (dateKey: string) => [...daySummaryRoot, dateKey] as const,
  todayEntries: todayEntriesRoot,
  todayEntriesByDate: (dateKey: string) =>
    [...todayEntriesRoot, dateKey] as const,
  library: ["library"] as const,
  settingsTargets: ["settings-targets"] as const,
  suggestionsContext: ["suggestions-context"] as const,
};
