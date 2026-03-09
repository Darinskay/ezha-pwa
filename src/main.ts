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

retryQueueService.start();

let isHardUpdatingServiceWorker = false;

const clearServiceWorkerCaches = async (): Promise<void> => {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
};

const hardUpdateServiceWorker = async (
  triggerUpdate: (reloadPage?: boolean) => Promise<void>
): Promise<void> => {
  if (isHardUpdatingServiceWorker) return;
  isHardUpdatingServiceWorker = true;

  try {
    await clearServiceWorkerCaches();
    await triggerUpdate(true);
  } catch {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    await clearServiceWorkerCaches();
    window.location.reload();
    return;
  }

  window.setTimeout(() => {
    window.location.reload();
  }, 1500);
};

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null;

updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (!updateServiceWorker) return;
    void hardUpdateServiceWorker(updateServiceWorker);
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    window.setInterval(() => {
      void registration.update();
    }, 60_000);
  }
});

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
useSettingsStore(pinia);
app.use(router);
app.use(VueQueryPlugin, { queryClient });

app.mount("#app");
