import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { getApiBaseUrl } from "./api-base-url";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(token: string): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn("[push] No EAS projectId configured — skipping push token registration");
      return null;
    }

    const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "SiteSnap",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    // Register token with our API
    const base = getApiBaseUrl();
    await fetch(`${base}/api/push/tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ token: pushToken.data, platform: "expo" }),
    });

    return pushToken.data;
  } catch (err) {
    console.warn("[push] Failed to register for push notifications", err);
    return null;
  }
}
