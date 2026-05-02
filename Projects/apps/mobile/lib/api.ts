import { resolveApiBaseUrl } from "@/lib/api-base-url";

export type ApiClientOptions = { baseUrl?: string; token?: string };

export class ApiClient {
  baseUrl: string;
  token?: string;
  constructor(opts?: ApiClientOptions) {
    this.baseUrl = opts?.baseUrl || `${resolveApiBaseUrl()}/api`;
    this.token = opts?.token;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }
}
