import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is missing. Add it to services/api/.env");
    }
    _client = new OpenAI({
      apiKey,
      timeout: 90_000,
      maxRetries: 2,
    });
  }
  return _client;
}

export function resetOpenAIClient(): void {
  _client = null;
}
