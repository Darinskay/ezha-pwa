<script setup lang="ts">
import { computed, ref } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import SelectField from "@/components/ui/SelectField.vue";
import { queryKeys } from "@/query/keys";
import { dailyTargetRepository } from "@/repositories/daily-target-repository";
import { profileRepository } from "@/repositories/profile-repository";
import { ensureProfileAndTargets } from "@/services/profile-bootstrap";
import { useAuthStore } from "@/stores/auth-store";
import { useSettingsStore } from "@/stores/settings-store";
import DailyTargetEditorDialog from "@/features/settings/DailyTargetEditorDialog.vue";
import type { DailyTarget, DailyTargetInput } from "@/types/domain";

const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const queryClient = useQueryClient();

const editorTarget = ref<DailyTarget | undefined>();
const isEditorOpen = ref(false);
const saveMessage = ref<string | null>(null);

const targetsQuery = useQuery({
  queryKey: queryKeys.settingsTargets,
  queryFn: async () => {
    const { profile, targets } = await ensureProfileAndTargets();
    if (!profile.active_target_id && targets[0]) {
      await profileRepository.updateActiveTarget(targets[0].id);
    }
    return targets;
  },
});

const saveTargetMutation = useMutation({
  mutationFn: async (input: DailyTargetInput) => {
    if (input.id) {
      await dailyTargetRepository.updateTarget(
        input.id,
        input.name,
        input.calories,
        input.protein,
        input.carbs,
        input.fat,
      );
    } else {
      await dailyTargetRepository.insertTarget(
        input.name,
        input.calories,
        input.protein,
        input.carbs,
        input.fat,
      );
    }

    const profile = await profileRepository.fetchProfile();
    if (profile && !profile.active_target_id) {
      const updated = await dailyTargetRepository.fetchTargets();
      if (updated[0]) {
        await profileRepository.updateActiveTarget(updated[0].id);
      }
    }
  },
  onSuccess: async () => {
    isEditorOpen.value = false;
    saveMessage.value = "Target saved.";
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.settingsTargets }),
      queryClient.invalidateQueries({ queryKey: queryKeys.todaySummary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestionsContext }),
    ]);
  },
});

const deleteTargetMutation = useMutation({
  mutationFn: async (targetId: string) => {
    const currentTargets = targetsQuery.data.value ?? [];
    if (currentTargets.length <= 1) {
      throw new Error("At least one target is required.");
    }

    await dailyTargetRepository.deleteTarget(targetId);

    const profile = await profileRepository.fetchProfile();
    const updated = await dailyTargetRepository.fetchTargets();

    if (profile?.active_target_id === targetId && updated[0]) {
      await profileRepository.updateActiveTarget(updated[0].id);
    }
  },
  onSuccess: async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.settingsTargets }),
      queryClient.invalidateQueries({ queryKey: queryKeys.todaySummary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestionsContext }),
    ]);
  },
});

const openCreate = (): void => {
  editorTarget.value = undefined;
  isEditorOpen.value = true;
};

const openEdit = (target: DailyTarget): void => {
  editorTarget.value = target;
  isEditorOpen.value = true;
};

const saveTarget = async (input: DailyTargetInput): Promise<void> => {
  await saveTargetMutation.mutateAsync(input);
};

const deleteTarget = async (targetId: string): Promise<void> => {
  const confirmed = window.confirm("Delete this target?");
  if (!confirmed) return;
  await deleteTargetMutation.mutateAsync(targetId);
};

const sortedTargets = computed(() => targetsQuery.data.value ?? []);
</script>

<template>
  <section class="app-page feature feature-settings">
    <header class="page-header">
      <h1 class="page-title">Settings</h1>
      <p class="page-subtitle">
        Manage daily targets, appearance, and session.
      </p>
    </header>

    <section class="stack-section">
      <div class="stack-section-header flex-wrap">
        <h2 class="text-lg font-semibold">Daily Targets</h2>
        <Button size="sm" @click="openCreate">Add Target</Button>
      </div>

      <div
        v-if="targetsQuery.isPending.value"
        class="stack-section-state stack-section-state-dashed"
      >
        Loading targets...
      </div>

      <div
        v-else-if="sortedTargets.length === 0"
        class="stack-section-state stack-section-state-dashed"
      >
        No targets yet.
      </div>

      <div v-else class="stack-section-list">
        <article
          v-for="target in sortedTargets"
          :key="target.id"
          class="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/70 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h3 class="font-semibold">{{ target.name }}</h3>
            <p class="text-xs text-muted-foreground">
              {{ Math.round(target.calories_target) }} kcal · P{{
                Math.round(target.protein_target)
              }}g · C{{ Math.round(target.carbs_target) }}g · F{{
                Math.round(target.fat_target)
              }}g
            </p>
          </div>

          <div class="grid grid-cols-2 gap-2 sm:flex sm:gap-1">
            <Button size="sm" variant="secondary" @click="openEdit(target)"
              >Edit</Button
            >
            <Button
              size="sm"
              variant="ghost"
              class="text-destructive"
              :loading="deleteTargetMutation.isPending.value"
              @click="deleteTarget(target.id)"
            >
              Delete
            </Button>
          </div>
        </article>
      </div>

      <p
        v-if="targetsQuery.error.value"
        class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ (targetsQuery.error.value as Error).message }}
      </p>
      <p
        v-if="deleteTargetMutation.error.value"
        class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ (deleteTargetMutation.error.value as Error).message }}
      </p>
      <p
        v-if="saveMessage"
        class="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary"
      >
        {{ saveMessage }}
      </p>
    </section>

    <Card class="space-y-3 p-3 sm:p-5">
      <h2 class="text-lg font-semibold">Appearance</h2>
      <SelectField v-model="settingsStore.appearance">
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </SelectField>
    </Card>

    <Card class="space-y-3 p-3 sm:p-5">
      <h2 class="text-lg font-semibold">Session</h2>
      <Button
        variant="destructive"
        :loading="authStore.isLoading"
        @click="authStore.signOut"
        >Sign out</Button
      >
    </Card>

    <DailyTargetEditorDialog
      v-if="isEditorOpen"
      :target="editorTarget"
      @save="saveTarget"
      @close="isEditorOpen = false"
    />
  </section>
</template>
