import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { nowDateKey } from "@/lib/date";
import { clampSelectableDate } from "@/lib/day-navigation";

export const useActiveDayStore = defineStore("active-day", () => {
  const activeDate = ref<string>(nowDateKey());
  const lastTodayKey = ref<string>(nowDateKey());

  const isToday = computed(() => activeDate.value === nowDateKey());

  const goToToday = (): void => {
    activeDate.value = nowDateKey();
    lastTodayKey.value = activeDate.value;
  };

  const refreshTodayBoundary = (): void => {
    const currentToday = nowDateKey();
    if (currentToday === lastTodayKey.value) return;
    if (activeDate.value === lastTodayKey.value) {
      activeDate.value = currentToday;
    }
    lastTodayKey.value = currentToday;
  };

  const setActiveDate = (date: string): void => {
    activeDate.value = clampSelectableDate(date, nowDateKey());
  };

  return {
    activeDate,
    isToday,
    goToToday,
    refreshTodayBoundary,
    setActiveDate,
  };
});
