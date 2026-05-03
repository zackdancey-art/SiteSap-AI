import * as Location from "expo-location";

type WeatherResult = {
  description: string;
  tempC: number | null;
};

const WMO_CODE_MAP: Record<number, string> = {
  0: "Sunny", 1: "Mostly Sunny", 2: "Partly Cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy Fog",
  51: "Light Drizzle", 53: "Drizzle", 55: "Heavy Drizzle",
  61: "Light Rain", 63: "Rain", 65: "Heavy Rain",
  71: "Light Snow", 73: "Snow", 75: "Heavy Snow",
  77: "Sleet",
  80: "Light Showers", 81: "Showers", 82: "Heavy Showers",
  85: "Snow Showers", 86: "Heavy Snow Showers",
  95: "Thunderstorm", 96: "Thunderstorm with Hail", 99: "Severe Thunderstorm",
};

export async function fetchCurrentWeather(): Promise<WeatherResult | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude } = loc.coords;

    // Open-Meteo is free, no API key required
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode&temperature_unit=celsius&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weathercode?: number };
    };

    const code = data.current?.weathercode ?? -1;
    const temp = data.current?.temperature_2m ?? null;
    const description = WMO_CODE_MAP[code] ?? "Conditions Unknown";

    return { description, tempC: temp };
  } catch {
    return null;
  }
}

export function formatWeatherString(result: WeatherResult): string {
  if (result.tempC !== null) {
    return `${result.description}, ${Math.round(result.tempC)}°C`;
  }
  return result.description;
}
