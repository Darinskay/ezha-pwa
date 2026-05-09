import type { QueryClient } from "@tanstack/vue-query";
import { queryKeys } from "@/query/keys";

interface DailyDataInvalidationOptions {
  includeEntries?: boolean;
  includeLibrary?: boolean;
  includeSettingsTargets?: boolean;
}

export const invalidateDailyDataQueries = async (
  queryClient: QueryClient,
  {
    includeEntries = true,
    includeLibrary = false,
    includeSettingsTargets = false,
  }: DailyDataInvalidationOptions = {},
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.daySummary }),
    queryClient.invalidateQueries({ queryKey: queryKeys.todaySummary }),
  ]);

  const followUpInvalidations = [
    queryClient.invalidateQueries({ queryKey: queryKeys.suggestionsContext }),
  ];

  if (includeEntries) {
    followUpInvalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.todayEntries }),
    );
  }

  if (includeLibrary) {
    followUpInvalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.library }),
    );
  }

  if (includeSettingsTargets) {
    followUpInvalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.settingsTargets }),
    );
  }

  await Promise.all(followUpInvalidations);
};
