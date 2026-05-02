import AsyncStorage from "@react-native-async-storage/async-storage";

export type Site = {
  id: string;
  name: string;
  address: string;
  client: string;
  startDate: string;
  createdAt: number;
};

const KEY = "sites:v1";

export async function getSites(): Promise<Site[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as Site[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function saveSites(sites: Site[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(sites));
}

export async function addSite(site: Site) {
  const sites = await getSites();
  const next = [site, ...sites];
  await saveSites(next);
  return next;
}
