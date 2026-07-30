type ExpoMessage = {
  to: string | string[];
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
};

export async function sendExpoPushNotifications(messages: ExpoMessage[]): Promise<void> {
  if (messages.length === 0) return;

  // Structural guard: in test mode, never make a real network call to
  // exp.host — mirrors the notificationService test-mode short-circuit.
  if (process.env.NODE_ENV === "test") {
    return;
  }

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
    });
    if (!response.ok) {
      console.error("[push] Expo push API error", response.status, await response.text());
    }
  } catch (err) {
    console.error("[push] Failed to send Expo push notification", err);
  }
}
