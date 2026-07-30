import Constants from "expo-constants";

type ExpoExtra = {
  apiUrl?: string;
};

function getHostFromExpoRuntime(): string | null {
  const expoConfigHostUri = (Constants.expoConfig as { hostUri?: string } | null)?.hostUri;
  if (expoConfigHostUri && typeof expoConfigHostUri === "string") {
    return expoConfigHostUri.split(":")[0] || null;
  }
  const debuggerHost = (
    Constants as unknown as {
      manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
      manifest?: { debuggerHost?: string };
    }
  ).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;

  if (debuggerHost && typeof debuggerHost === "string") {
    return debuggerHost.split(":")[0] || null;
  }

  return null;
}

function isLocalhostUrl(url: string) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function isLanUrl(url: string) {
  return /^http:\/\//i.test(url);
}

function normalizeUrl(url: string) {
  return url.trim().replace(/\/$/, "");
}

export function resolveApiBaseUrl(): string {
  const expoExtra = Constants.expoConfig?.extra as ExpoExtra | undefined;
  const envBase =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    "";

  const candidate = normalizeUrl(envBase || expoExtra?.apiUrl || "");

  if (!candidate) {
    if (!__DEV__) {
      // A release build with no API URL configured is non-functional.
      // Throw early rather than silently hitting a LAN address that won't exist in the field.
      throw new Error(
        "[api] Production build is missing EXPO_PUBLIC_API_BASE_URL. " +
        "Set it in your EAS build profile (eas.json) and rebuild."
      );
    }
    const host = getHostFromExpoRuntime();
    if (host) {
      const runtimeGuess = `http://${host}:4000`;
      console.warn(`[api] Missing API base URL; using runtime host guess ${runtimeGuess}`);
      return runtimeGuess;
    }
    throw new Error(
      "[api] No API base URL configured and no dev host could be detected. " +
      "Set EXPO_PUBLIC_API_URL in your .env (e.g. http://<your-machine-LAN-IP>:4000) and restart Expo."
    );
  }

  if (!__DEV__ && (isLocalhostUrl(candidate) || isLanUrl(candidate))) {
    throw new Error(
      `[api] Production build has an invalid API URL: "${candidate}". ` +
      "Release builds must use an HTTPS URL. Set EXPO_PUBLIC_API_BASE_URL in eas.json and rebuild."
    );
  }

  if (isLocalhostUrl(candidate)) {
    const host = getHostFromExpoRuntime();
    if (host) {
      const runtimeGuess = `http://${host}:4000`;
      console.warn(`[api] Localhost URL detected (${candidate}); using detected dev host ${runtimeGuess}`);
      return runtimeGuess;
    }
    throw new Error(
      `[api] Localhost API URL "${candidate}" won't work from a device/simulator, and no dev host could ` +
      "be detected. Set EXPO_PUBLIC_API_URL to your machine's LAN IP (e.g. http://192.168.x.x:4000) and restart Expo."
    );
  }

  return candidate;
}

let logged = false;

export function logResolvedApiBaseUrlOnce() {
  if (logged) return;
  logged = true;
  const base = resolveApiBaseUrl();
  console.log(`[api] Resolved base URL: ${base}`);
}

export function getApiBaseUrl() {
  return resolveApiBaseUrl();
}
