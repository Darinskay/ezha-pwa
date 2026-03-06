import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { nowDateKey } from "@/lib/date";
import { profileRepository } from "@/repositories/profile-repository";

export const useActiveDayStore = defineStore("active-day", () => {
  const activeDate = ref<string>(nowDateKey());
  const loading = ref(false);

  const isToday = computed(() => activeDate.value === nowDateKey());

  const syncFromProfile = async (): Promise<void> => {
    loading.value = true;
    try {
      const profile = await profileRepository.fetchProfile();
      if (profile?.active_date) {
        activeDate.value = profile.active_date;
      }
    } finally {
      loading.value = false;
    }
  };

  const setActiveDate = (date: string): void => {
    activeDate.value = date;
  };

  return {
    activeDate,
    loading,
    isToday,
    setActiveDate,
    syncFromProfile
  };
});
