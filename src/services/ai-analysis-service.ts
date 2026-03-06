import { env } from "@/lib/env";
import { currentSession, supabase } from "@/lib/supabase";
import type { AIItemInput, MacroEstimate } from "@/types/domain";
import { aiAnalysisResponseSchema, parseWithSchema } from "@/types/schemas";

export type AIStreamEvent =
  | { type: "status"; stage: string }
  | { type: "delta"; delta: string }
  | { type: "result"; estimate: MacroEstimate }
  | { type: "error"; error: string };

export interface AnalyzePayload {
  text?: string;
  items?: AIItemInput[];
  imagePath?: string;
  inputType: string;
}

const toEstimate = (payload: unknown): MacroEstimate => {
  const parsed = parseWithSchema(aiAnalysisResponseSchema, payload, "ai_analysis_response");

  if (parsed.error) {
    throw new Error(parsed.error);
  }

  const totals =
    parsed.totals ??
    (parsed.calories !== undefined &&
    parsed.protein !== undefined &&
    parsed.carbs !== undefined &&
    parsed.fat !== undefined
      ? {
          calories: parsed.calories,
          protein: parsed.protein,
          carbs: parsed.carbs,
          fat: parsed.fat
        }
      : null);

  if (!totals || !parsed.source || typeof parsed.notes !== "string") {
    throw new Error("Analysis returned an invalid response.");
  }

  return {
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    confidence: parsed.confidence ?? null,
    source: parsed.source,
    foodName: parsed.food_name ?? null,
    notes: parsed.notes,
    items: parsed.items ?? []
  };
};

const makeRequest = async (body: Record<string, unknown>, accessToken: string, stream = false): Promise<Response> => {
  return fetch(`${env.supabaseUrl}/functions/v1/ai-estimate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: stream ? "text/event-stream" : "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: env.supabaseAnonKey
    },
    body: JSON.stringify(body)
  });
};

const withSessionRetry = async <T>(
  request: (accessToken: string) => Promise<T>,
  onUnauthorized?: () => Promise<void>
): Promise<T> => {
  try {
    const session = await currentSession();
    return await request(session.access_token);
  } catch (error) {
    if (error instanceof Error && error.message.includes("session")) {
      throw error;
    }

    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) {
      throw new Error(refreshed.error?.message ?? "Your session expired. Please log in again.");
    }

    if (onUnauthorized) {
      await onUnauthorized();
    }

    return request(refreshed.data.session.access_token);
  }
};

export const aiAnalysisService = {
  async analyze(payload: AnalyzePayload): Promise<MacroEstimate> {
    const text = payload.text?.trim() ?? "";
    const items = payload.items?.filter((item) => item.name.trim() && item.grams > 0) ?? [];

    if (!text && !payload.imagePath && items.length === 0) {
      throw new Error("Please enter a food description or attach a photo.");
    }

    const requestBody = {
      text: text || undefined,
      items: items.length > 0 ? items : undefined,
      imagePath: payload.imagePath,
      inputType: payload.inputType
    };

    return withSessionRetry(async (accessToken) => {
      const response = await makeRequest(requestBody, accessToken, false);
      const json = await response.json();

      if (response.status === 401) {
        throw new Error("unauthorized");
      }

      if (!response.ok) {
        const message = typeof json?.error === "string" ? json.error : `Edge Function returned ${response.status}`;
        throw new Error(message);
      }

      return toEstimate(json);
    });
  },

  async analyzeStream(payload: AnalyzePayload, onEvent: (event: AIStreamEvent) => void): Promise<void> {
    const text = payload.text?.trim() ?? "";
    const items = payload.items?.filter((item) => item.name.trim() && item.grams > 0) ?? [];

    if (!text && !payload.imagePath && items.length === 0) {
      throw new Error("Please enter a food description or attach a photo.");
    }

    const requestBody = {
      text: text || undefined,
      items: items.length > 0 ? items : undefined,
      imagePath: payload.imagePath,
      inputType: payload.inputType,
      stream: true
    };

    await withSessionRetry(async (accessToken) => {
      const response = await makeRequest(requestBody, accessToken, true);
      if (response.status === 401) {
        throw new Error("unauthorized");
      }
      if (!response.ok || !response.body) {
        throw new Error(`Edge Function returned ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const lines = block.split("\n");
          const event = lines.find((line) => line.startsWith("event:"))?.replace("event:", "").trim();
          const data = lines
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.replace("data:", "").trim())
            .join("\n");

          if (!event || !data) continue;
          const json = JSON.parse(data) as Record<string, unknown>;

          if (event === "status" && typeof json.stage === "string") {
            onEvent({ type: "status", stage: json.stage });
          }
          if (event === "delta" && typeof json.delta === "string") {
            onEvent({ type: "delta", delta: json.delta });
          }
          if (event === "result") {
            onEvent({ type: "result", estimate: toEstimate(json) });
          }
          if (event === "error" && typeof json.error === "string") {
            onEvent({ type: "error", error: json.error });
          }
        }
      }
    });
  }
};
