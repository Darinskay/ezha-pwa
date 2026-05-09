import { addDays, parseDateKey, toDateKey } from "@/lib/date";

export const clampSelectableDate = (
  dateKey: string,
  todayKey: string,
): string => {
  const selected = parseDateKey(dateKey);
  const today = parseDateKey(todayKey);
  if (!selected || !today) return todayKey;
  return selected.getTime() > today.getTime() ? todayKey : toDateKey(selected);
};

export const previousSelectableDate = (dateKey: string): string => {
  const selected = parseDateKey(dateKey) ?? new Date();
  return toDateKey(addDays(selected, -1));
};

export const nextSelectableDate = (
  dateKey: string,
  todayKey: string,
): string => {
  const selected =
    parseDateKey(dateKey) ?? parseDateKey(todayKey) ?? new Date();
  return clampSelectableDate(toDateKey(addDays(selected, 1)), todayKey);
};

export const dayLabel = (
  dateKey: string,
  todayKey: string,
  locale = navigator.language,
): string => {
  const selected = parseDateKey(clampSelectableDate(dateKey, todayKey));
  const today = parseDateKey(todayKey);
  if (!selected || !today) return "Today";

  if (toDateKey(selected) === toDateKey(today)) return "Today";

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(selected);
};
