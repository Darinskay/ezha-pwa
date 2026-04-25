const todayEntriesRoot = ["today-entries"] as const;

export const queryKeys = {
  todaySummary: ["today-summary"] as const,
  todayEntries: todayEntriesRoot,
  todayEntriesByDate: (dateKey: string) => [...todayEntriesRoot, dateKey] as const,
  history: ["history"] as const,
  library: ["library"] as const,
  settingsTargets: ["settings-targets"] as const,
  suggestionsContext: ["suggestions-context"] as const
};
