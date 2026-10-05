export const descriptionFromDraft = (draft: {
  entryMode?: string;
  descriptionText?: string;
  items?: { name: string; gramsText: string }[];
}): string => {
  if (draft.entryMode !== "list") return draft.descriptionText ?? "";
  return (draft.items ?? [])
    .filter((item) => item.name.trim())
    .map(
      (item) =>
        `${item.name.trim()}${item.gramsText.trim() ? ` ${item.gramsText.trim()}g` : ""}`,
    )
    .join(", ");
};
