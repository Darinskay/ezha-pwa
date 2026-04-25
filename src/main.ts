import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { registerSW } from "virtual:pwa-register";
import App from "@/App.vue";
import router from "@/router";
import { queryClient } from "@/query/query-client";
import { retryQueueService } from "@/services/retry-queue-service";
import { foodEntryRepository } from "@/repositories/food-entry-repository";
import { useSettingsStore } from "@/stores/settings-store";
import type { FoodEntry, FoodEntryItem } from "@/types/domain";
import "@/style.css";

retryQueueService.register("create_food_entry", async (payload) => {
  const typed = payload as { entry: FoodEntry; items: FoodEntryItem[] };
  await foodEntryRepository.insertFoodEntry(typed.entry, typed.items);
});

const scheduleAfterInitialRender = (task: () => void): void => {
  const run = (): void => {
    window.setTimeout(task, 0);
  };

  const requestIdleCallback = window.requestIdleCallback;
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 2_000 });
    return;
  }

  window.setTimeout(run, 1_500);
};

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
useSettingsStore(pinia);
app.use(router);
app.use(VueQueryPlugin, { queryClient });

app.mount("#app");

scheduleAfterInitialRender(() => {
  retryQueueService.start();

  registerSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      window.setInterval(() => {
        void registration.update();
      }, 30 * 60_000);
    }
  });
});
