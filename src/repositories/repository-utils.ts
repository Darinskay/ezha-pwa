import { supabase } from "@/lib/supabase";
import { currentUserId } from "@/lib/supabase";

export const getUserId = async (): Promise<string> => currentUserId();

export const ensureNoError = (error: { message: string } | null): void => {
  if (error) {
    throw new Error(error.message);
  }
};

export const dateKeyForQuery = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const supabaseClient = supabase;
