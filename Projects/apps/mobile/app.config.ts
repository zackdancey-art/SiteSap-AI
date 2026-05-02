// Expo evaluates this file in Node, so runtime metadata can be derived here.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require("./package.json");
const buildStamp = new Date().toISOString().replace("T", " ").slice(0, 16);

type AppConfigInput = {
  config: {
    extra?: Record<string, unknown>;
    [key: string]: unknown;
  };
};

export default ({ config }: AppConfigInput) => ({
  ...config,
  name: "SiteSnap",
  slug: "sitesnap",
  version: pkg.version || "0.0.1",
  icon: "../../assets/images/icon.png",
  splash: {
    image: "../../assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0F2B46",
  },
  extra: {
    ...(config.extra ?? {}),
    appVersion: pkg.version || "0.0.1",
    buildVersion: buildStamp,
    apiUrl:
      process.env.EXPO_PUBLIC_API_BASE_URL ||
      process.env.EXPO_PUBLIC_API_URL ||
      process.env.EXPO_PUBLIC_API_FALLBACK_LAN ||
      "http://192.168.4.28:4001",
  },
});
