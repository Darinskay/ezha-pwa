export const normalizeNumberString = (value: string): string => {
  const noSpaces = value.replaceAll(" ", "");
  if (noSpaces.includes(",") && !noSpaces.includes(".")) {
    return noSpaces.replaceAll(",", ".");
  }
  return noSpaces;
};

export const parseNumberInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(normalizeNumberString(trimmed));
  return Number.isFinite(parsed) ? parsed : null;
};
