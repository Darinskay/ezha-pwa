import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { env } from "@/lib/env";

export const useAuthStore = defineStore("auth", () => {
  const session = ref<Session | null>(null);
  const user = ref<User | null>(null);
  const isLoading = ref(false);
  const initialized = ref(false);
  const errorMessage = ref<string | null>(null);

  const isAuthenticated = computed(() => !!session.value?.user);

  const setSession = (value: Session | null): void => {
    session.value = value;
    user.value = value?.user ?? null;
  };

  const initialize = async (): Promise<void> => {
    if (initialized.value) return;
    isLoading.value = true;

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        errorMessage.value = error.message;
      }
      setSession(data.session ?? null);

      supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
      });
    } finally {
      initialized.value = true;
      isLoading.value = false;
    }
  };

  const perform = async (action: () => Promise<void>): Promise<void> => {
    errorMessage.value = null;
    isLoading.value = true;

    try {
      await action();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "Unexpected error";
    } finally {
      isLoading.value = false;
    }
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    await perform(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    });
  };

  const signUp = async (email: string, password: string): Promise<void> => {
    await perform(async () => {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
    });
  };

  const signInWithGoogle = async (): Promise<void> => {
    await perform(async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: env.supabaseOAuthRedirectUrl
        }
      });
      if (error) throw error;
    });
  };

  const signOut = async (): Promise<void> => {
    await perform(async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
    });
  };

  return {
    session,
    user,
    isLoading,
    isAuthenticated,
    initialized,
    errorMessage,
    initialize,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    setSession
  };
});
