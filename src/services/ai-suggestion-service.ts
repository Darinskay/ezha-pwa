import { env } from "@/lib/env";
import { currentSession, supabase } from "@/lib/supabase";
import type { AISuggestionPayload, AISuggestionRequest } from "@/types/domain";
import { aiSuggestionResponseSchema, parseWithSchema } from "@/types/schemas";

const requestSuggestions = async (
  payload: AISuggestionRequest,
  accessToken: string
): Promise<AISuggestionPayload[]> => {
  const response = await fetch(`${env.supabaseUrl}/functions/v1/ai-suggestions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: env.supabaseAnonKey
    },
    body: JSON.stringify({
      remaining: payload.remaining,
      meal_type: payload.mealType,
      max_prep_minutes: payload.maxPrepMinutes,
      count: payload.count,
      ingredient_notes: payload.ingredientNotes,
      variation_note: payload.variationNote,
      units: payload.units
    })
  });

  const json = await response.json();
  const parsed = parseWithSchema(aiSuggestionResponseSchema, json, "ai_suggestion_response");

  if (response.status === 401) {
    throw new Error("unauthorized");
  }

  if (!response.ok) {
    throw new Error(parsed.error ?? `Edge Function returned ${response.status}`);
  }

  if (!parsed.suggestions || parsed.suggestions.length === 0) {
    throw new Error("Suggestions returned an invalid response.");
  }

  return parsed.suggestions;
};

export const aiSuggestionService = {
  async fetchSuggestions(payload: AISuggestionRequest): Promise<AISuggestionPayload[]> {
    const session = await currentSession();

    try {
      return await requestSuggestions(payload, session.access_token);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "unauthorized") {
        throw error;
      }

      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.error || !refreshed.data.session) {
        await supabase.auth.signOut();
        throw new Error("Your session expired. Please log in again.");
      }

      return requestSuggestions(payload, refreshed.data.session.access_token);
    }
  }
};
