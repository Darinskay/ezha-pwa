<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { BookMarked, CalendarDays, Lightbulb, Settings, Sun } from "lucide-vue-next";
import { cn } from "@/lib/utils";

const route = useRoute();
const router = useRouter();

const tabs = [
  { name: "today", label: "Today", icon: Sun },
  { name: "suggestions", label: "Suggestions", icon: Lightbulb },
  { name: "library", label: "Library", icon: BookMarked },
  { name: "history", label: "History", icon: CalendarDays },
  { name: "settings", label: "Settings", icon: Settings }
] as const;

const hideTabs = computed(() => route.name === "add-log");

const navigate = async (name: (typeof tabs)[number]["name"]): Promise<void> => {
  if (route.name === name) return;
  await router.push({ name });
};
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <main class="mx-auto flex min-h-screen w-full max-w-5xl flex-col pb-20 md:px-4">
      <RouterView />
    </main>

    <nav
      v-if="!hideTabs"
      class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur"
    >
      <div class="mx-auto grid max-w-5xl grid-cols-5 gap-1 px-2 py-2">
        <button
          v-for="tab in tabs"
          :key="tab.name"
          class="flex flex-col items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium"
          :class="
            cn(
              route.name === tab.name ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            )
          "
          @click="navigate(tab.name)"
        >
          <component :is="tab.icon" class="size-4" />
          <span>{{ tab.label }}</span>
        </button>
      </div>
    </nav>
  </div>
</template>
