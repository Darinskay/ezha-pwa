import { createClient, type Session } from "@supabase/supabase-js";
import { env } from "@/lib/env";

const refreshBufferSeconds = 300;

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce"
  }
});

export const currentSession = async (): Promise<Session> => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error(error?.message ?? "No active session");
  }

  const expiresAt = data.session.expires_at ? data.session.expires_at * 1000 : 0;
  const isExpiringSoon = expiresAt > 0 && expiresAt - Date.now() < refreshBufferSeconds * 1000;

  if (isExpiringSoon) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) {
      throw new Error(refreshed.error?.message ?? "Unable to refresh session");
    }
    return refreshed.data.session;
  }

  return data.session;
};

export const currentUserId = async (): Promise<string> => {
  const session = await currentSession();
  return session.user.id;
};
