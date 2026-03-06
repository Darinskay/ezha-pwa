import { createRouter, createWebHistory } from "vue-router";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth-store";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/auth",
      name: "auth",
      component: () => import("@/features/auth/AuthPage.vue"),
      meta: { guestOnly: true }
    },
    {
      path: "/",
      component: () => import("@/app/AppShell.vue"),
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          redirect: { name: "today" }
        },
        {
          path: "today",
          name: "today",
          component: () => import("@/features/today/TodayPage.vue"),
          meta: { tab: "today" }
        },
        {
          path: "suggestions",
          name: "suggestions",
          component: () => import("@/features/suggestions/SuggestionsPage.vue"),
          meta: { tab: "suggestions" }
        },
        {
          path: "library",
          name: "library",
          component: () => import("@/features/library/LibraryPage.vue"),
          meta: { tab: "library" }
        },
        {
          path: "history",
          name: "history",
          component: () => import("@/features/history/HistoryPage.vue"),
          meta: { tab: "history" }
        },
        {
          path: "settings",
          name: "settings",
          component: () => import("@/features/settings/SettingsPage.vue"),
          meta: { tab: "settings" }
        },
        {
          path: "log/new",
          name: "add-log",
          component: () => import("@/features/add-log/AddLogPage.vue")
        }
      ]
    }
  ]
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  if (!authStore.initialized) {
    await authStore.initialize();
  }

  const { isAuthenticated } = storeToRefs(authStore);

  if (to.meta.requiresAuth && !isAuthenticated.value) {
    return { name: "auth" };
  }

  if (to.meta.guestOnly && isAuthenticated.value) {
    return { name: "today" };
  }

  return true;
});

export default router;
