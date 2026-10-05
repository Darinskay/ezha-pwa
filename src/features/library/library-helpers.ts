import type { SavedFood } from "@/types/domain";

export type LibraryFilter = "all" | "foods" | "meals" | "favorites";

export const filterLibraryFoods = (
  foods: SavedFood[],
  search: string,
  filter: LibraryFilter,
  favoriteIds: string[] = [],
): SavedFood[] => {
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return foods.filter((food) => {
    if (filter === "foods" && food.is_meal) return false;
    if (filter === "meals" && !food.is_meal) return false;
    if (filter === "favorites" && !favoriteIds.includes(food.id)) return false;
    const name = food.name.toLocaleLowerCase();
    return terms.every((term) => name.includes(term));
  });
};

export const defaultFoodGrams = (food: SavedFood): number =>
  food.unit_type === "per_serving" && food.serving_size && food.serving_size > 0
    ? food.serving_size
    : 100;

export const readLibraryIds = (key: "favorites" | "recents"): string[] => {
  try {
    const ids: unknown = JSON.parse(
      window.localStorage.getItem(`ezha:library-food-${key}`) ?? "[]",
    );
    return Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
};

export const writeLibraryIds = (
  key: "favorites" | "recents",
  ids: string[],
): void => {
  try {
    window.localStorage.setItem(
      `ezha:library-food-${key}`,
      JSON.stringify(ids),
    );
  } catch {
    /* Logging remains available when browser storage is restricted. */
  }
};

export const sortLibraryByRecent = (
  foods: SavedFood[],
  recentIds: string[],
): SavedFood[] => {
  const rank = (id: string): number => {
    const index = recentIds.indexOf(id);
    return index < 0 ? recentIds.length : index;
  };
  return [...foods].sort((a, b) => rank(a.id) - rank(b.id));
};
