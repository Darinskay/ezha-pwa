import { ensureNoError, supabaseClient } from "@/repositories/repository-utils";
import type { DailySummary } from "@/types/domain";
import { dailySummarySchema, parseListWithSchema, parseWithSchema } from "@/types/schemas";

export const dailySummaryRepository = {
  async upsertSummary(summary: DailySummary): Promise<void> {
    const { error } = await supabaseClient.from("daily_summaries").upsert(summary, {
      onConflict: "user_id,date"
    });
    ensureNoError(error);
  },

  async fetchSummaries(fromDate: string, toDate: string): Promise<DailySummary[]> {
    const { data, error } = await supabaseClient
      .from("daily_summaries")
      .select("*")
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date", { ascending: false });

    ensureNoError(error);
    return parseListWithSchema(dailySummarySchema, data ?? [], "daily_summaries");
  },

  async fetchSummary(date: string): Promise<DailySummary | null> {
    const { data, error } = await supabaseClient
      .from("daily_summaries")
      .select("*")
      .eq("date", date)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return parseWithSchema(dailySummarySchema, data, "daily_summary");
  }
};
