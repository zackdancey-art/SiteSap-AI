const INPUT_DEBUG_ENABLED = process.env.EXPO_PUBLIC_INPUT_DEBUG === "true";

function preview(value: string) {
  if (!value) return "";
  return value.length <= 6 ? "*".repeat(value.length) : `${"*".repeat(3)}(${value.length})`;
}

export function logInputEvent(field: string, event: "focus" | "blur" | "change", value?: string) {
  if (!INPUT_DEBUG_ENABLED) return;
  const suffix = typeof value === "string" ? ` value=${preview(value)}` : "";
  // Keep as log/warn, never error, to avoid red-box overlays.
  console.log(`[input-debug] ${field} ${event}${suffix}`);
}

export function isInputDebugEnabled() {
  return INPUT_DEBUG_ENABLED;
}
