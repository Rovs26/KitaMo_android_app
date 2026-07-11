import { getAppSetting, setAppSetting } from "@/db/repositories";

const MAX_RECENT_PRODUCTS = 8;

export type KioskPreferences = {
  favoriteProductIds: string[];
  recentProductIds: string[];
};

function parseProductIds(value: string | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function loadKioskPreferences(): Promise<KioskPreferences> {
  const favorites = await getAppSetting("favoriteProductIds");
  const recents = await getAppSetting("recentProductIds");

  return {
    favoriteProductIds: parseProductIds(favorites?.value),
    recentProductIds: parseProductIds(recents?.value),
  };
}

export async function saveFavoriteProductIds(productIds: string[]) {
  await setAppSetting("favoriteProductIds", JSON.stringify([...new Set(productIds)]), "json");
}

export async function recordRecentProduct(productId: string, currentProductIds: string[]) {
  const nextProductIds = [productId, ...currentProductIds.filter((id) => id !== productId)].slice(0, MAX_RECENT_PRODUCTS);
  await setAppSetting("recentProductIds", JSON.stringify(nextProductIds), "json");
  return nextProductIds;
}
