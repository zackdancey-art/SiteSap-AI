import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBaseUrl } from "./api-base-url";

const QUEUE_KEY = "sitesnap.offlineQueue";
const MAX_QUEUE_SIZE = 100;

export type QueuedAction = {
  id: string;
  createdAt: string;
  method: "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  retries: number;
};

async function readQueue(): Promise<QueuedAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedAction[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueAction(action: Omit<QueuedAction, "id" | "createdAt" | "retries">): Promise<void> {
  const queue = await readQueue();
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.shift(); // evict oldest
  }
  queue.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    retries: 0,
    ...action,
  });
  await writeQueue(queue);
}

export async function getPendingCount(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

export async function flushQueue(getToken: () => Promise<string | null>): Promise<{ flushed: number; failed: number }> {
  const queue = await readQueue();
  if (queue.length === 0) return { flushed: 0, failed: 0 };

  const token = await getToken();
  if (!token) return { flushed: 0, failed: queue.length };

  const base = getApiBaseUrl();
  const remaining: QueuedAction[] = [];
  let flushed = 0;
  let failed = 0;

  for (const action of queue) {
    try {
      const res = await fetch(`${base}${action.path}`, {
        method: action.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: action.body ? JSON.stringify(action.body) : undefined,
      });

      if (res.ok) {
        flushed++;
      } else if (res.status === 404 && action.method === "DELETE") {
        // Resource already gone — DELETE is idempotent, treat as success
        flushed++;
      } else if (res.status >= 400 && res.status < 500) {
        // Client error — drop, don't retry
        console.warn(`[offlineQueue] Dropping ${action.method} ${action.path} — client error ${res.status}`);
        failed++;
      } else {
        // Server error — keep for retry
        remaining.push({ ...action, retries: action.retries + 1 });
      }
    } catch {
      if (action.retries < 5) {
        remaining.push({ ...action, retries: action.retries + 1 });
      } else {
        console.warn(`[offlineQueue] Dropping ${action.method} ${action.path} after ${action.retries} retries`);
        failed++;
      }
    }
  }

  await writeQueue(remaining);
  return { flushed, failed };
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
