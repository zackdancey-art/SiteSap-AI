export type AddressSuggestion = {
  displayName: string;
  lat?: string;
  lon?: string;
};

export async function fetchAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
    },
  });

  if (!res.ok) {
    throw new Error(`Address lookup failed (${res.status})`);
  }

  const data = (await res.json()) as Array<{ display_name?: string; lat?: string; lon?: string }>;
  return data
    .filter((item) => Boolean(item.display_name))
    .map((item) => ({
      displayName: item.display_name as string,
      lat: item.lat,
      lon: item.lon,
    }));
}
