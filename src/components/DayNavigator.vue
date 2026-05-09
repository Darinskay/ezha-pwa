<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { parseDate, type DateValue } from "@internationalized/date";
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeader,
  CalendarHeading,
  CalendarNext,
  CalendarPrev,
  CalendarRoot,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from "radix-vue";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-vue-next";
import Button from "@/components/ui/Button.vue";
import { nowDateKey } from "@/lib/date";
import {
  clampSelectableDate,
  dayLabel,
  nextSelectableDate,
  previousSelectableDate,
} from "@/lib/day-navigation";

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const todayKey = computed(() => nowDateKey());
const selectedDate = computed(() =>
  clampSelectableDate(props.modelValue, todayKey.value),
);
const isToday = computed(() => selectedDate.value === todayKey.value);
const label = computed(() => dayLabel(selectedDate.value, todayKey.value));
const calendarLocale = computed(() => navigator.language);
const isCalendarOpen = ref(false);

const dateKeyToCalendarDate = (dateKey: string): DateValue =>
  parseDate(clampSelectableDate(dateKey, todayKey.value));

const selectedCalendarDate = computed(() =>
  dateKeyToCalendarDate(selectedDate.value),
);
const todayCalendarDate = computed(() => dateKeyToCalendarDate(todayKey.value));
const calendarPlaceholder = ref<DateValue>(selectedCalendarDate.value);

watch(selectedCalendarDate, (date) => {
  calendarPlaceholder.value = date;
});

const selectDate = (date: string): void => {
  emit("update:modelValue", clampSelectableDate(date, todayKey.value));
};

const selectCalendarDate = (
  date: DateValue | DateValue[] | undefined,
): void => {
  if (!date || Array.isArray(date)) return;
  selectDate(date.toString());
  calendarPlaceholder.value = date;
  isCalendarOpen.value = false;
};

const selectToday = (): void => {
  selectDate(todayKey.value);
  isCalendarOpen.value = false;
};

const goPrevious = (): void => {
  selectDate(previousSelectableDate(selectedDate.value));
};

const goNext = (): void => {
  selectDate(nextSelectableDate(selectedDate.value, todayKey.value));
};
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl justify-center pt-3">
    <div class="relative h-10 w-full">
      <div class="absolute left-1/2 top-0 -translate-x-1/2">
        <div
          class="grid grid-cols-[2.55rem_8.4rem_2.55rem] items-center rounded-[1rem] border border-border/50 bg-muted/60 p-0.5 shadow-[0_10px_26px_hsl(var(--glass-shadow)/0.1)] backdrop-blur-xl dark:border-white/5 dark:bg-white/8"
        >
          <Button
            aria-label="Previous day"
            class="h-9 rounded-[0.85rem] px-0 text-foreground/85 hover:text-foreground"
            variant="ghost"
            @click="goPrevious"
          >
            <ChevronLeft class="size-5 stroke-[3]" />
          </Button>

          <PopoverRoot v-model:open="isCalendarOpen">
            <PopoverTrigger as-child>
              <button
                aria-label="Select day"
                class="group relative flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-[0.85rem] bg-card/82 px-2.5 text-[13px] font-bold uppercase tracking-[0.12em] text-foreground shadow-[inset_0_1px_0_hsl(var(--glass-highlight)/0.5),0_8px_18px_hsl(var(--glass-shadow)/0.1)] transition-all duration-200 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99] dark:bg-white/12 dark:shadow-[inset_0_1px_0_hsl(var(--glass-highlight)/0.12)] dark:hover:bg-white/16"
                type="button"
              >
                <CalendarDays class="size-3.5 shrink-0 opacity-70" />
                <span class="truncate">{{ label }}</span>
                <ChevronDown
                  class="size-3.5 shrink-0 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180"
                />
              </button>
            </PopoverTrigger>

            <PopoverPortal>
              <PopoverContent
                align="center"
                class="z-50 w-[min(calc(100vw-1.5rem),20rem)] rounded-[1.2rem] border border-border/55 bg-card/95 p-3 shadow-[0_22px_54px_hsl(var(--glass-shadow)/0.2),inset_0_1px_0_hsl(var(--glass-highlight)/0.62)] backdrop-blur-2xl dark:border-white/10 dark:bg-card/95 dark:shadow-[0_22px_54px_hsl(var(--glass-shadow)/0.58),inset_0_1px_0_hsl(var(--glass-highlight)/0.12)]"
                :collision-padding="16"
                side="bottom"
                :side-offset="10"
              >
                <CalendarRoot
                  calendar-label="Select history day"
                  class="space-y-3"
                  fixed-weeks
                  initial-focus
                  :locale="calendarLocale"
                  :max-value="todayCalendarDate"
                  :model-value="selectedCalendarDate"
                  :placeholder="calendarPlaceholder"
                  prevent-deselect
                  weekday-format="short"
                  @update:modelValue="selectCalendarDate"
                  @update:placeholder="calendarPlaceholder = $event"
                >
                  <template #default="{ grid, weekDays }">
                    <CalendarHeader
                      class="flex items-center justify-between gap-3"
                    >
                      <CalendarPrev
                        class="flex size-9 items-center justify-center rounded-xl text-foreground/78 transition-colors hover:bg-muted/70 disabled:pointer-events-none disabled:opacity-35 dark:hover:bg-white/10"
                      >
                        <ChevronLeft class="size-4 stroke-[3]" />
                      </CalendarPrev>

                      <CalendarHeading
                        v-slot="{ headingValue }"
                        class="min-w-0 text-center text-sm font-bold text-foreground"
                      >
                        <span class="truncate">{{ headingValue }}</span>
                      </CalendarHeading>

                      <CalendarNext
                        class="flex size-9 items-center justify-center rounded-xl text-foreground/78 transition-colors hover:bg-muted/70 disabled:pointer-events-none disabled:opacity-35 dark:hover:bg-white/10"
                      >
                        <ChevronRight class="size-4 stroke-[3]" />
                      </CalendarNext>
                    </CalendarHeader>

                    <CalendarGrid
                      v-for="month in grid"
                      :key="month.value.toString()"
                      class="w-full border-separate border-spacing-y-1"
                    >
                      <CalendarGridHead>
                        <CalendarGridRow>
                          <CalendarHeadCell
                            v-for="day in weekDays"
                            :key="day"
                            class="h-7 text-center text-[11px] font-bold uppercase text-muted-foreground/80"
                          >
                            {{ day }}
                          </CalendarHeadCell>
                        </CalendarGridRow>
                      </CalendarGridHead>

                      <CalendarGridBody>
                        <CalendarGridRow
                          v-for="(weekDates, weekIndex) in month.rows"
                          :key="`${month.value.toString()}-${weekIndex}`"
                        >
                          <CalendarCell
                            v-for="day in weekDates"
                            :key="day.toString()"
                            class="p-0"
                            :date="day"
                          >
                            <CalendarCellTrigger
                              class="mx-auto flex size-9 items-center justify-center rounded-xl text-[13px] font-semibold text-foreground/80 transition-all duration-150 hover:bg-muted/70 data-[disabled]:pointer-events-none data-[disabled]:opacity-30 data-[outside-view]:text-muted-foreground/30 data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:shadow-[0_10px_20px_hsl(var(--feature-primary)/0.26)] data-[today]:ring-1 data-[today]:ring-primary/30 dark:hover:bg-white/10"
                              :day="day"
                              :month="month.value"
                            />
                          </CalendarCell>
                        </CalendarGridRow>
                      </CalendarGridBody>
                    </CalendarGrid>
                  </template>
                </CalendarRoot>

                <div
                  class="mt-2 flex justify-end border-t border-border/60 pt-2"
                >
                  <Button size="sm" variant="secondary" @click="selectToday">
                    Today
                  </Button>
                </div>
              </PopoverContent>
            </PopoverPortal>
          </PopoverRoot>

          <Button
            aria-label="Next day"
            class="h-9 rounded-[0.85rem] px-0 text-foreground/85 hover:text-foreground disabled:text-muted-foreground/45"
            variant="ghost"
            :disabled="isToday"
            @click="goNext"
          >
            <ChevronRight class="size-5 stroke-[3]" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
