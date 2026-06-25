import type { ExpoConfig, ConfigContext } from "expo/config";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require("./package.json") as { version?: string };

// APP_ENV is set per EAS build profile (see eas.json).
// Anything other than "production" is treated as a dev/preview build.
const IS_DEV = process.env.APP_ENV !== "production";
const buildStamp = new Date().toISOString().replace("T", " ").slice(0, 16);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "SiteSnap",
  slug: "sitesnap",
  scheme: "sitesnap",
  version: pkg.version || "1.0.0",
  orientation: "portrait",
  jsEngine: "hermes",
  platforms: ["ios", "android"],
  icon: "./images/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0F2B46",
  },
  // EAS OTA updates are enabled for production builds only.
  // Dev and preview builds skip EAS auth requirements entirely.
  ...(IS_DEV ? {} : {
    updates: {
      url: "https://u.expo.dev/sitesnap-app-id",
      enabled: true,
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0,
    },
    runtimeVersion: { policy: "appVersion" },
  }),
  ios: {
    bundleIdentifier: "com.sitesnapai.app",
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription:
        "SiteSnap uses your camera to capture construction site photos for daily diaries.",
      NSPhotoLibraryUsageDescription:
        "SiteSnap accesses your photo library to attach existing site photos to diary entries.",
      NSPhotoLibraryAddUsageDescription:
        "SiteSnap saves exported site diaries and photos to your library.",
      NSLocationWhenInUseUsageDescription:
        "SiteSnap uses your location to auto-fill weather conditions for site diary entries.",
      NSMicrophoneUsageDescription:
        "SiteSnap may use the microphone when recording video on site.",
      NSLocalNetworkUsageDescription:
        "SiteSnap uses local network access to communicate with the development API server.",
      ITSAppUsesNonExemptEncryption: false,
      // NSAllowsArbitraryLoads must be false in release builds (App Store requirement).
      // Dev builds allow plain HTTP to reach the local dev API server.
      NSAppTransportSecurity: IS_DEV
        ? { NSAllowsArbitraryLoads: true }
        : {
            NSAllowsArbitraryLoads: false,
            NSExceptionDomains: {
              localhost: {
                NSThirdPartyExceptionAllowsInsecureHTTPLoads: true,
                NSThirdPartyExceptionRequiresForwardSecrecy: false,
                NSIncludesSubdomains: true,
              },
            },
          },
    },
  },
  android: {
    package: "com.sitesnapai.app",
    adaptiveIcon: {
      foregroundImage: "./images/icon.png",
      backgroundColor: "#0F2B46",
    },
    permissions: [
      "CAMERA",
      "READ_MEDIA_IMAGES",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
    ],
  },
  plugins: [
    "expo-router",
    "expo-font",
    ...(IS_DEV ? [] : ["expo-updates"]),
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "SiteSnap uses your location to auto-fill weather conditions for site entries.",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./images/icon.png",
        color: "#0F2B46",
        defaultChannel: "default",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "SiteSnap accesses your photos to attach site images to diary entries.",
        cameraPermission:
          "SiteSnap uses your camera to capture construction site photos.",
      },
    ],
    [
      "expo-build-properties",
      {
        ios: { deploymentTarget: "15.1" },
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          minSdkVersion: 24,
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
  ],
  extra: {
    ...(config.extra ?? {}),
    appVersion: pkg.version || "1.0.0",
    buildVersion: buildStamp,
    // Production URL is injected by the EAS build profile env (see eas.json).
    // Falls back to "" so resolveApiBaseUrl() will throw early in release builds
    // if the variable is not set, rather than silently using a LAN address.
    apiUrl:
      process.env.EXPO_PUBLIC_API_BASE_URL ||
      process.env.EXPO_PUBLIC_API_URL ||
      "",
    eas: { projectId: "FILL-AFTER-eas-init" },
  },
});
