<script setup lang="ts">
import { computed, ref } from "vue";
import { Check, ChevronRight, Plus, X } from "lucide-vue-next";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import type { DailyTarget } from "@/types/domain";

const props = defineProps<{
  targets: DailyTarget[];
  selectedTargetId?: string;
  hasEntries: boolean;
  loading: boolean;
  errorMessage?: string | null;
}>();

const emit = defineEmits<{
  select: [targetId: string];
  close: [];
  addTarget: [];
}>();

const pendingTarget = ref<DailyTarget | null>(null);

const selectedTarget = computed(() =>
  props.targets.find((target) => target.id === props.selectedTargetId),
);

const chooseTarget = (target: DailyTarget): void => {
  if (target.id === props.selectedTargetId) {
    emit("close");
    return;
  }

  if (props.hasEntries) {
    pendingTarget.value = target;
    return;
  }

  emit("select", target.id);
};

const confirmTarget = (): void => {
  if (!pendingTarget.value) return;
  emit("select", pendingTarget.value.id);
};
</script>

<template>
  <div class="dialog-overlay feature feature-today">
    <Card
      class="target-sheet w-full max-w-none space-y-4 rounded-b-none rounded-t-[1.2rem] border-border/80 bg-card/96 p-3 sm:max-w-lg sm:rounded-[1.4rem] sm:p-5"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 space-y-1">
          <p
            class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Day target
          </p>
          <h3 class="text-lg font-semibold leading-tight">
            Choose target for this day
          </h3>
        </div>
        <Button
          aria-label="Close target selector"
          class="size-9 rounded-xl px-0"
          variant="ghost"
          @click="emit('close')"
        >
          <X class="size-4" />
        </Button>
      </div>

      <div
        v-if="pendingTarget"
        class="space-y-4 rounded-[1.1rem] border border-primary/20 bg-primary/10 p-3"
      >
        <div class="space-y-1">
          <h4 class="font-semibold">Change to {{ pendingTarget.name }}?</h4>
          <p class="text-sm leading-5 text-muted-foreground">
            Your logged meals stay the same. Only this day&apos;s goals and
            remaining macros update.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            :disabled="loading"
            @click="pendingTarget = null"
          >
            Cancel
          </Button>
          <Button :loading="loading" @click="confirmTarget">
            Change target
          </Button>
        </div>
      </div>

      <div v-else class="space-y-2">
        <button
          v-for="target in targets"
          :key="target.id"
          class="group flex w-full items-center justify-between gap-3 rounded-[1rem] border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-card/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          :class="
            target.id === selectedTargetId
              ? 'border-primary/35 bg-primary/10 shadow-[0_10px_26px_hsl(var(--feature-primary)/0.14)]'
              : 'border-border/70 bg-card/68'
          "
          type="button"
          @click="chooseTarget(target)"
        >
          <div class="min-w-0 space-y-1.5">
            <div class="flex min-w-0 items-center gap-2">
              <span class="truncate font-semibold">{{ target.name }}</span>
              <Badge
                v-if="target.id === selectedTargetId"
                class="shrink-0"
                variant="outline"
              >
                Selected
              </Badge>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ Math.round(target.calories_target) }} kcal · P{{
                Math.round(target.protein_target)
              }}
              · C{{ Math.round(target.carbs_target) }} · F{{
                Math.round(target.fat_target)
              }}
            </p>
          </div>

          <div
            class="flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/50 text-muted-foreground transition-colors group-hover:text-foreground"
          >
            <Check
              v-if="target.id === selectedTargetId"
              class="size-4 text-primary"
            />
            <ChevronRight v-else class="size-4" />
          </div>
        </button>
      </div>

      <p
        v-if="errorMessage"
        class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ errorMessage }}
      </p>

      <button
        class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/35 bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        type="button"
        @click="emit('addTarget')"
      >
        <Plus class="size-4" />
        Add new target
      </button>

      <p
        v-if="selectedTarget"
        class="text-center text-xs leading-5 text-muted-foreground"
      >
        Current: {{ selectedTarget.name }} ·
        {{ Math.round(selectedTarget.calories_target) }} kcal
      </p>
    </Card>
  </div>
</template>

<style scoped>
.target-sheet {
  box-shadow:
    0 -10px 34px hsl(var(--glass-shadow) / 0.28),
    inset 0 1px 0 hsl(var(--glass-highlight) / 0.52);
}
</style>
