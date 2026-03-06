const pad = (value: number): string => String(value).padStart(2, "0");

export const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (dateKey: string): Date | null => {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const maxDate = (a: Date, b: Date): Date => (a.getTime() >= b.getTime() ? a : b);

export const displayDate = (dateKey: string, locale = navigator.language): string => {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return dateKey;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(parsed);
};

export const displayShortDay = (dateKey: string, locale = navigator.language): string => {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return dateKey;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(parsed);
};

export const nowDateKey = (): string => toDateKey(new Date());
