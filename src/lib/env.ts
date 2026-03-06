const getEnv = (key: string): string => {
  const value = import.meta.env[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const env = {
  supabaseUrl: getEnv("VITE_SUPABASE_URL"),
  supabaseAnonKey: getEnv("VITE_SUPABASE_ANON_KEY"),
  supabaseOAuthRedirectUrl: import.meta.env.VITE_SUPABASE_OAUTH_REDIRECT_URL as string | undefined,
  storageBucket: (import.meta.env.VITE_FOOD_IMAGES_BUCKET as string | undefined) ?? "food-images"
};
