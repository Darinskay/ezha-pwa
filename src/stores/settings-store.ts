import { computed, watch } from "vue";
import { defineStore } from "pinia";
import { usePreferredDark, useStorage } from "@vueuse/core";
import type { AppAppearance } from "@/types/domain";

const applyAppearance = (appearance: AppAppearance): void => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = appearance === "dark" || (appearance === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
};

export const useSettingsStore = defineStore("settings", () => {
  const appearance = useStorage<AppAppearance>("appAppearance", "system");
  const preferredDark = usePreferredDark();

  const resolvedDarkMode = computed(() => {
    if (appearance.value === "dark") return true;
    if (appearance.value === "light") return false;
    return preferredDark.value;
  });

  watch(
    appearance,
    (value) => {
      applyAppearance(value);
    },
    { immediate: true }
  );

  watch(preferredDark, () => {
    applyAppearance(appearance.value);
  });

  return {
    appearance,
    resolvedDarkMode
  };
});
